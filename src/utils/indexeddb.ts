// IndexedDB utilities for storing guest user datasets

export function openDatasetsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dashit-datasets', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('datasets')) {
        db.createObjectStore('datasets', { keyPath: 'id' })
      }
    }
  })
}

export async function getDatasetFromIndexedDB(
  datasetName: string,
  sessionId: string,
): Promise<ArrayBuffer | null> {
  try {
    const db = await openDatasetsDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['datasets'], 'readonly')
      const store = transaction.objectStore('datasets')

      // Get all datasets for this session
      const request = store.openCursor()
      const datasets: Array<{
        id: string
        name: string
        fileName: string
        data: ArrayBuffer
        sessionId: string
        createdAt: number
      }> = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          if (cursor.value.sessionId === sessionId) {
            datasets.push(cursor.value)
          }
          cursor.continue()
        } else {
          // Find dataset by name
          const dataset = datasets.find((d) => d.name === datasetName)
          resolve(dataset?.data || null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to get dataset from IndexedDB:', error)
    return null
  }
}

export async function saveDatasetToIndexedDB(
  datasetId: string,
  name: string,
  fileName: string,
  data: ArrayBuffer,
  sessionId: string,
): Promise<void> {
  const db = await openDatasetsDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['datasets'], 'readwrite')
    const store = transaction.objectStore('datasets')
    const request = store.put({
      id: datasetId,
      name,
      fileName,
      data,
      sessionId,
      createdAt: Date.now(),
    })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
