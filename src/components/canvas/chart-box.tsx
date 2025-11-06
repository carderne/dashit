import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NodeProps } from '@xyflow/react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  ChevronDown,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  ScatterChart as ScatterChartIcon,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from 'recharts'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BoxUpdate } from '../../types/box'
import {
  generateDefaultChartConfig,
  sampleDataForChart,
  transformQueryResultsToChartData,
  type ChartBoxConfig,
  type QueryResults,
} from '../../utils/chart-adapter'

interface ChartBoxData {
  box: {
    _id: Id<'boxes'>
    content?: string // JSON ChartBoxConfig
    title?: string
    width?: number
    height?: number
  }
  dashboardId: Id<'dashboards'>
  onUpdate: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDelete: (boxId: Id<'boxes'>) => void
  sourceBox?: {
    _id: Id<'boxes'>
    results?: string
  }
}

const CHART_TYPE_ICONS = {
  bar: BarChart3,
  line: LineChartIcon,
  area: AreaChartIcon,
  pie: PieChartIcon,
  scatter: ScatterChartIcon,
}

export function ChartBox({ data }: NodeProps) {
  const { box, onDelete, onUpdate, sourceBox } = data as unknown as ChartBoxData

  // Parse query results from source box
  const queryResults = useMemo<QueryResults | null>(() => {
    const resultsToUse = sourceBox?.results

    if (!resultsToUse) {
      return null
    }

    try {
      return JSON.parse(resultsToUse) as QueryResults
    } catch (error) {
      console.error('Failed to parse results:', error)
      return null
    }
  }, [sourceBox?.results])

  // Parse or generate chart configuration
  const chartConfig = useMemo<ChartBoxConfig>(() => {
    // Try to load saved config
    if (box.content) {
      try {
        return JSON.parse(box.content) as ChartBoxConfig
      } catch (error) {
        console.error('Failed to parse chart config:', error)
      }
    }

    // Generate default config from data
    if (queryResults) {
      return generateDefaultChartConfig(queryResults)
    }

    // Fallback empty config
    return {
      chartType: 'bar',
      config: {},
      options: {
        xAxisKey: '',
        yAxisKeys: [],
        showLegend: true,
        showGrid: true,
        showTooltip: true,
      },
    }
  }, [box.content, queryResults])

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!queryResults) return []

    const transformed = transformQueryResultsToChartData(queryResults)
    // Sample if too many data points
    return sampleDataForChart(transformed, 1000)
  }, [queryResults])

  // Handle chart type change
  const handleChartTypeChange = useCallback(
    (chartType: ChartBoxConfig['chartType']) => {
      const newConfig: ChartBoxConfig = {
        ...chartConfig,
        chartType,
      }
      onUpdate(box._id, { content: JSON.stringify(newConfig) })
    },
    [box._id, chartConfig, onUpdate],
  )

  const handleDelete = useCallback(() => {
    onDelete(box._id)
  }, [box._id, onDelete])

  // Render the appropriate chart type
  const renderChart = () => {
    const { xAxisKey, yAxisKeys, showGrid, showLegend, showTooltip } = chartConfig.options

    const commonProps = {
      data: chartData,
    }

    switch (chartConfig.chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {yAxisKeys.map((key) => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )

      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {yAxisKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {yAxisKeys.map((key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={`var(--color-${key})`}
                stroke={`var(--color-${key})`}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        )

      case 'pie': {
        // For pie charts, use first Y axis key and X axis as labels
        const pieDataKey = yAxisKeys[0] || 'value'
        return (
          <PieChart>
            {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
            <Pie
              data={chartData}
              dataKey={pieDataKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill={`var(--color-${pieDataKey})`}
              label
            />
          </PieChart>
        )
      }

      case 'scatter': {
        // Scatter needs exactly 2 Y axis keys (X and Y coordinates)
        const xKey = yAxisKeys[0] || xAxisKey
        const yKey = yAxisKeys[1] || yAxisKeys[0]

        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis type="number" dataKey={xKey} name={xKey} />
            <YAxis type="number" dataKey={yKey} name={yKey} />
            {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
            <Scatter name="Data" dataKey={yKey} fill="var(--chart-1)" />
          </ScatterChart>
        )
      }

      default:
        // Fallback to bar chart for unknown types
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            {showTooltip && <ChartTooltip content={<ChartTooltipContent />} />}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {yAxisKeys.map((key) => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )
    }
  }

  // Handle resize
  const handleResize = useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      onUpdate(box._id, { width: params.width, height: params.height })
    },
    [box._id, onUpdate],
  )

  const ChartTypeIcon = CHART_TYPE_ICONS[chartConfig.chartType]

  return (
    <Card className="flex h-full w-full flex-col shadow-lg">
      <NodeResizer
        minWidth={300}
        minHeight={200}
        onResize={handleResize}
        handleStyle={{
          width: '8px',
          height: '8px',
          borderRadius: '2px',
        }}
      />
      <Handle type="target" position={Position.Top} />

      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{box.title || 'Chart'}</CardTitle>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <ChartTypeIcon className="mr-1 h-3 w-3" />
                  {chartConfig.chartType}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleChartTypeChange('bar')}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Bar Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleChartTypeChange('line')}>
                  <LineChartIcon className="mr-2 h-4 w-4" />
                  Line Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleChartTypeChange('area')}>
                  <AreaChartIcon className="mr-2 h-4 w-4" />
                  Area Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleChartTypeChange('pie')}>
                  <PieChartIcon className="mr-2 h-4 w-4" />
                  Pie Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleChartTypeChange('scatter')}>
                  <ScatterChartIcon className="mr-2 h-4 w-4" />
                  Scatter Chart
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden pt-0">
        {chartData.length === 0 || chartConfig.options.yAxisKeys.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No data to display. Connect this chart to a query box.
          </div>
        ) : (
          <ChartContainer config={chartConfig.config} className="h-full w-full">
            {renderChart()}
          </ChartContainer>
        )}
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}
