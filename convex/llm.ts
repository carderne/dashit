import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { v } from 'convex/values'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import { autumn } from './autumn'

// Type definitions for query results
interface DatasetWithSchema {
  _id: Id<'datasets'>
  _creationTime: number
  name: string
  fileName: string
  r2Key?: string
  fileSizeBytes: number
  userId?: Id<'users'>
  dashboardId?: Id<'dashboards'>
  isPublic: boolean
  schema?: Array<{ name: string; type: string }>
  createdAt: number
  expiresAt?: number
  downloadUrl?: string
}

interface BoxWithResults {
  _id: Id<'boxes'>
  _creationTime: number
  dashboardId: Id<'dashboards'>
  type: 'query' | 'table' | 'chart'
  positionX: number
  positionY: number
  width: number
  height: number
  content?: string
  results?: string
  lastRunContent?: string
  editedAt?: number
  runAt?: number
  title?: string
  createdAt: number
  updatedAt: number
}

// Generate SQL from natural language prompt
export const generateSQL = action({
  args: {
    prompt: v.string(),
    dashboardId: v.id('dashboards'),
  },
  handler: async (ctx, { prompt, dashboardId }): Promise<string> => {
    // Check usage limit for AI generation
    const { data: usageCheck, error: checkError } = await autumn.check(ctx, {
      featureId: 'ai_generation',
    })

    if (checkError) {
      console.error('Failed to check AI generation usage:', checkError)
      throw new Error('Failed to check usage limits')
    }

    if (!usageCheck?.allowed) {
      throw new Error(
        'AI generation limit reached. Upgrade to Pro for unlimited generations at /upgrade',
      )
    }

    // Fetch datasets with schemas for this dashboard
    const datasets = (await ctx.runQuery(api.datasets.listForDashboard, {
      dashboardId,
    })) as DatasetWithSchema[]

    // Fetch all boxes for the dashboard to find named query boxes
    const boxes = (await ctx.runQuery(api.boxes.list, { dashboardId })) as BoxWithResults[]

    const namedQueries: Array<string | undefined> = boxes
      .filter((box) => box.type === 'query' && box.title && box.results)
      .map((box) => box.title)

    // Build system prompt with dataset schemas
    const datasetSchemas: string = datasets
      .filter((d) => d.schema && d.schema.length > 0)
      .map((dataset) => {
        const columns: string = dataset
          .schema!.map((col) => `  ${col.name}: ${col.type}`)
          .join('\n')
        return `Table: ${dataset.name}\nColumns:\n${columns}`
      })
      .join('\n\n')

    const namedQueriesText: string =
      namedQueries.length > 0
        ? `\n\nNamed query results (can be used as tables):\n${namedQueries.map((name) => `- "${name}"`).join('\n')}`
        : ''

    const systemPrompt = `You are an expert SQL query generator using DuckDB syntax. Your task is to generate valid SQL queries based on natural language prompts.

Available datasets:
${datasetSchemas || 'No datasets available'}${namedQueriesText}

IMPORTANT RULES:
1. Generate ONLY valid DuckDB SQL - no explanations, no markdown, no code fences
2. Use exact table names as shown above
3. Use exact column names and types as shown in the schemas
4. If the prompt is empty or unclear, generate a creative example query showcasing the data
5. Always include appropriate WHERE, GROUP BY, ORDER BY, or LIMIT clauses when relevant
6. For aggregations, include meaningful column aliases
7. Named queries can be referenced as tables using double quotes like: SELECT * FROM "query_name"
8. Return ONLY the SQL query text, nothing else

Examples:
- For "show me sales by region": SELECT region, SUM(amount) as total_sales FROM sales GROUP BY region ORDER BY total_sales DESC
- For empty prompt with sales data: SELECT * FROM sales ORDER BY date DESC LIMIT 10`

    // Handle empty prompt with a helpful default
    const effectivePrompt =
      prompt.trim() === ''
        ? 'Generate an interesting example query that showcases the available data'
        : prompt

    try {
      // Call Claude Haiku via AI SDK
      const { text }: { text: string } = await generateText({
        model: anthropic('claude-3-5-haiku-20241022'),
        prompt: effectivePrompt,
        system: systemPrompt,
        temperature: 0.3, // Lower temperature for more deterministic SQL
      })

      // Clean up the response - remove any markdown code fences or extra whitespace
      let sql: string = text.trim()
      if (sql.startsWith('```sql')) {
        sql = sql.replace(/^```sql\n/, '').replace(/\n```$/, '')
      } else if (sql.startsWith('```')) {
        sql = sql.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      // Track usage for AI generation
      const { error: trackError } = await autumn.track(ctx, {
        featureId: 'ai_generation',
        value: 1,
      })

      if (trackError) {
        console.error('Failed to track AI generation usage:', trackError)
        // Don't fail the request, just log the error
      }

      return sql.trim()
    } catch (error) {
      console.error('LLM generation failed:', error)
      throw new Error('Failed to generate SQL query')
    }
  },
})
