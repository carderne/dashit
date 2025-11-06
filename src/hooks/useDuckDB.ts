import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import { useEffect, useRef, useState } from 'react'

let globalDB: duckdb.AsyncDuckDB | null = null
let globalConnection: duckdb.AsyncDuckDBConnection | null = null
let initPromise: Promise<void> | null = null

async function initializeDuckDB(): Promise<{
  db: duckdb.AsyncDuckDB
  connection: duckdb.AsyncDuckDBConnection
}> {
  if (globalDB && globalConnection) {
    return { db: globalDB, connection: globalConnection }
  }

  if (initPromise) {
    await initPromise
    if (globalDB && globalConnection) {
      return { db: globalDB, connection: globalConnection }
    }
  }

  initPromise = (async () => {
    try {
      const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: duckdb_wasm,
          mainWorker: new URL(
            '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js',
            import.meta.url,
          ).toString(),
        },
        eh: {
          mainModule: duckdb_wasm_eh,
          mainWorker: new URL(
            '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js',
            import.meta.url,
          ).toString(),
        },
      }

      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)

      const worker = new Worker(bundle.mainWorker!)
      const logger = new duckdb.ConsoleLogger()

      const db = new duckdb.AsyncDuckDB(logger, worker)
      await db.instantiate(bundle.mainModule)

      const connection = await db.connect()

      globalDB = db
      globalConnection = connection
    } catch (error) {
      console.error('Failed to initialize DuckDB:', error)
      throw error
    }
  })()

  await initPromise
  return { db: globalDB!, connection: globalConnection! }
}

interface UseDuckDBReturn {
  db: duckdb.AsyncDuckDB | null
  connection: duckdb.AsyncDuckDBConnection | null
  isLoading: boolean
  error: Error | null
  executeQuery: (sql: string) => Promise<{
    columns: Array<string>
    rows: Array<Array<unknown>>
  }>
  convertCSVToParquet: (csvFile: File) => Promise<ArrayBuffer>
  loadParquetFromURL: (url: string, tableName: string) => Promise<void>
  loadParquetFromBuffer: (buffer: ArrayBuffer, tableName: string) => Promise<void>
}

export function useDuckDB(): UseDuckDBReturn {
  const [db, setDB] = useState<duckdb.AsyncDuckDB | null>(null)
  const [connection, setConnection] = useState<duckdb.AsyncDuckDBConnection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    initializeDuckDB()
      .then(({ db: dbInstance, connection: connInstance }) => {
        setDB(dbInstance)
        setConnection(connInstance)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err)
        setIsLoading(false)
      })
  }, [])

  const executeQuery = async (sql: string) => {
    if (!connection) throw new Error('DuckDB not initialized')

    try {
      const result = await connection.query(sql)
      const columns = result.schema.fields.map((f) => f.name)
      const rows = result.toArray().map((row) => columns.map((col) => row[col]))

      return { columns, rows }
    } catch (err) {
      console.error('Query execution failed:', err)
      throw err
    }
  }

  const convertCSVToParquet = async (csvFile: File): Promise<ArrayBuffer> => {
    if (!connection || !db) throw new Error('DuckDB not initialized')

    try {
      // Read CSV file
      const csvText = await csvFile.text()

      // Register CSV data in DuckDB
      await db.registerFileText(csvFile.name, csvText)

      // Create a temp table from CSV
      const tempTableName = `temp_csv_${Date.now()}`
      await connection.query(
        `CREATE TABLE ${tempTableName} AS SELECT * FROM read_csv_auto('${csvFile.name}')`,
      )

      // Export to Parquet
      const parquetFileName = `${tempTableName}.parquet`
      await connection.query(`COPY ${tempTableName} TO '${parquetFileName}' (FORMAT PARQUET)`)

      // Read the parquet file back
      const parquetFile = await db.copyFileToBuffer(parquetFileName)

      // Cleanup
      await connection.query(`DROP TABLE ${tempTableName}`)

      return parquetFile.buffer as ArrayBuffer
    } catch (err) {
      console.error('CSV to Parquet conversion failed:', err)
      throw err
    }
  }

  const loadParquetFromURL = async (url: string, tableName: string) => {
    if (!connection || !db) throw new Error('DuckDB not initialized')

    try {
      // Fetch the parquet file from the URL
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch parquet file: ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()

      // Register the buffer and create table
      const fileName = `${tableName}.parquet`
      await db.registerFileBuffer(fileName, new Uint8Array(buffer))

      await connection.query(
        `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${fileName}')`,
      )
    } catch (err) {
      console.error('Failed to load parquet from URL:', err)
      throw err
    }
  }

  const loadParquetFromBuffer = async (buffer: ArrayBuffer, tableName: string) => {
    if (!connection || !db) throw new Error('DuckDB not initialized')

    try {
      const fileName = `${tableName}.parquet`
      await db.registerFileBuffer(fileName, new Uint8Array(buffer))

      await connection.query(
        `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${fileName}')`,
      )
    } catch (err) {
      console.error('Failed to load parquet from buffer:', err)
      throw err
    }
  }

  return {
    db,
    connection,
    isLoading,
    error,
    executeQuery,
    convertCSVToParquet,
    loadParquetFromURL,
    loadParquetFromBuffer,
  }
}
