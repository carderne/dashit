import type { ChartConfig } from '@/components/ui/chart'

// Type for cell values from DuckDB query results
export type CellValue = string | number | boolean | null

// Query results structure from DuckDB execution
export interface QueryResults {
  columns: Array<string>
  rows: Array<Array<CellValue>>
  executionTime?: number
  totalRows?: number
  truncated?: boolean
}

// Chart data format (Recharts expects array of objects)
export type ChartData = Array<Record<string, CellValue>>

// Chart configuration that we store
export interface ChartBoxConfig {
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter'
  config: ChartConfig
  options: {
    xAxisKey: string
    yAxisKeys: Array<string>
    showLegend: boolean
    showGrid: boolean
    showTooltip: boolean
  }
}

// Color palette for auto-generated configs
// These reference the CSS custom properties defined in app.css
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/**
 * Transform query results (columns + rows) into Recharts format (array of objects)
 */
export function transformQueryResultsToChartData(results: QueryResults): ChartData {
  const { columns, rows } = results

  return rows.map((row) => {
    const obj: Record<string, CellValue> = {}
    columns.forEach((col, idx) => {
      let value = row[idx] ?? null

      // Convert string numbers to actual numbers for Recharts
      if (typeof value === 'string' && value.trim() !== '') {
        const numValue = Number(value)
        if (!isNaN(numValue)) {
          value = numValue
        }
      }

      obj[col] = value
    })
    return obj
  })
}

/**
 * Detect if a column contains numeric data
 */
function isNumericColumn(rows: Array<Array<CellValue>>, columnIndex: number): boolean {
  // Check first 100 rows (or all if fewer)
  const sampleSize = Math.min(100, rows.length)

  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i]
    if (!row) continue
    const value = row[columnIndex]
    if (value === null) continue
    if (typeof value === 'number') continue
    if (typeof value === 'string' && !isNaN(Number(value))) continue
    // Found non-numeric value
    return false
  }

  return true
}

/**
 * Detect if a column looks like a date/time field
 */
function isDateColumn(columns: Array<string>, columnIndex: number): boolean {
  const name = columns[columnIndex]
  if (!name) return false
  const nameLower = name.toLowerCase()
  const dateKeywords = ['date', 'time', 'timestamp', 'created', 'updated', 'year', 'month', 'day']
  return dateKeywords.some((keyword) => nameLower.includes(keyword))
}

/**
 * Infer the best chart type based on data structure
 */
export function inferChartType(results: QueryResults): ChartBoxConfig['chartType'] {
  const { columns, rows } = results

  if (rows.length === 0) return 'bar'

  const numericColumns = columns.map((_, idx) => isNumericColumn(rows, idx)).filter(Boolean).length

  const hasDateColumn = columns.some((_, idx) => isDateColumn(columns, idx))

  // If we have a date column and numeric data, line/area chart is best
  if (hasDateColumn && numericColumns >= 1) {
    return 'line'
  }

  // If we have categorical + one numeric, bar chart is good
  if (numericColumns === 1) {
    return 'bar'
  }

  // If we have two numeric columns, scatter might be good
  if (numericColumns === 2) {
    return 'scatter'
  }

  // Default to bar
  return 'bar'
}

/**
 * Auto-generate a ChartConfig from query results
 */
export function inferChartConfig(results: QueryResults): ChartConfig {
  const { columns, rows } = results
  const config: ChartConfig = {}

  if (rows.length === 0) return config

  // Identify numeric columns (these will be data series)
  const numericColumnIndices: Array<number> = []
  columns.forEach((_col, idx) => {
    if (isNumericColumn(rows, idx)) {
      numericColumnIndices.push(idx)
    }
  })

  // Create config entries for each numeric column
  numericColumnIndices.forEach((idx, colorIdx) => {
    const columnName = columns[idx]
    if (columnName) {
      config[columnName] = {
        label: columnName,
        color: CHART_COLORS[colorIdx % CHART_COLORS.length],
      }
    }
  })

  return config
}

/**
 * Infer which column should be the X axis
 */
export function inferXAxisKey(results: QueryResults): string {
  const { columns, rows } = results

  if (columns.length === 0) return ''

  // Prefer date columns for X axis
  const dateColumnIdx = columns.findIndex((_, idx) => isDateColumn(columns, idx))
  if (dateColumnIdx !== -1 && columns[dateColumnIdx]) {
    return columns[dateColumnIdx]
  }

  // Prefer first non-numeric column for X axis (categorical)
  const nonNumericIdx = columns.findIndex((_, idx) => !isNumericColumn(rows, idx))
  if (nonNumericIdx !== -1 && columns[nonNumericIdx]) {
    return columns[nonNumericIdx]
  }

  // Fallback: use first column
  return columns[0] ?? ''
}

/**
 * Infer which columns should be Y axes (data series)
 */
export function inferYAxisKeys(results: QueryResults, xAxisKey: string): Array<string> {
  const { columns, rows } = results

  // All numeric columns except the X axis
  return columns.filter((_col, idx) => {
    const col = columns[idx]
    if (!col || col === xAxisKey) return false
    return isNumericColumn(rows, idx)
  })
}

/**
 * Generate a complete default chart configuration from query results
 */
export function generateDefaultChartConfig(results: QueryResults): ChartBoxConfig {
  const chartType = inferChartType(results)
  const config = inferChartConfig(results)
  const xAxisKey = inferXAxisKey(results)
  const yAxisKeys = inferYAxisKeys(results, xAxisKey)

  return {
    chartType,
    config,
    options: {
      xAxisKey,
      yAxisKeys,
      showLegend: yAxisKeys.length > 1, // Show legend if multiple series
      showGrid: true,
      showTooltip: true,
    },
  }
}

/**
 * Sample large datasets to prevent performance issues
 */
export function sampleDataForChart(data: ChartData, maxPoints: number = 1000): ChartData {
  if (data.length <= maxPoints) {
    return data
  }

  // Simple sampling: take every nth element
  const step = Math.ceil(data.length / maxPoints)
  const sampled: ChartData = []

  for (let i = 0; i < data.length; i += step) {
    const item = data[i]
    if (item) {
      sampled.push(item)
    }
  }

  return sampled
}
