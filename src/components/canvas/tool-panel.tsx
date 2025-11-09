import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BarChart3, Database, FileStack, Table, Upload } from 'lucide-react'

interface ToolPanelProps {
  selectedTool: 'query' | 'table' | 'chart' | null
  onSelectTool: (tool: 'query' | 'table' | 'chart' | null) => void
  onUploadClick?: () => void
  onDatasetClick?: () => void
}

export function ToolPanel({
  selectedTool,
  onSelectTool,
  onUploadClick,
  onDatasetClick,
}: ToolPanelProps) {
  const tools = [
    {
      id: 'query' as const,
      label: 'Query',
      icon: Database,
      description: 'Create a SQL query box',
    },
    {
      id: 'table' as const,
      label: 'Table',
      icon: Table,
      description: 'Create a data table',
    },
    {
      id: 'chart' as const,
      label: 'Chart',
      icon: BarChart3,
      description: 'Create a chart visualization',
    },
  ]

  return (
    <Card className="absolute top-4 left-1/2 z-10 -translate-x-1/2 p-2 shadow-lg">
      <div className="flex gap-2">
        {/* Data Management Buttons */}
        <div className="flex gap-2 border-r border-gray-700 pr-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUploadClick}
            className="flex h-auto flex-col px-3 py-2"
            title="Upload CSV or Parquet file"
          >
            <Upload className="mb-1 h-5 w-5" />
            <span className="text-xs">Upload</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDatasetClick}
            className="flex h-auto flex-col px-3 py-2"
            title="View datasets"
          >
            <FileStack className="mb-1 h-5 w-5" />
            <span className="text-xs">Data</span>
          </Button>
        </div>

        {/* Box Creation Tools */}
        {tools.map((tool) => {
          const Icon = tool.icon
          const isSelected = selectedTool === tool.id

          return (
            <Button
              key={tool.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelectTool(isSelected ? null : tool.id)}
              className="flex h-auto flex-col px-3 py-2"
              title={tool.description}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-xs">{tool.label}</span>
            </Button>
          )
        })}
      </div>

      {selectedTool && (
        <p className="text-muted-foreground mt-2 px-1 text-xs">
          Click on the canvas to place a {selectedTool} box
        </p>
      )}
    </Card>
  )
}
