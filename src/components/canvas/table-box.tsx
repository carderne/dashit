import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { ArrowUpDown, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BoxUpdate } from '../../types/box'

interface TableBoxData {
  box: {
    _id: Id<'boxes'>
    results?: string
    title?: string
  }
  dashboardId: Id<'dashboards'>
  onUpdate: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDelete: (boxId: Id<'boxes'>) => void
}

type CellValue = string | number | boolean | null | undefined

interface QueryResults {
  columns: Array<string>
  rows: Array<Array<CellValue>>
}

export function TableBox({ data }: NodeProps) {
  const { box, onDelete } = data as unknown as TableBoxData
  const [sorting, setSorting] = useState<SortingState>([])

  // Parse results from JSON
  const tableData = useMemo<QueryResults>(() => {
    if (!box.results) {
      return { columns: [], rows: [] }
    }

    try {
      return JSON.parse(box.results) as QueryResults
    } catch (error) {
      console.error('Failed to parse results:', error)
      return { columns: [], rows: [] }
    }
  }, [box.results])

  // Convert to TanStack Table format
  const columns: Array<ColumnDef<Array<CellValue>>> = useMemo(() => {
    if (tableData.columns.length === 0) {
      return []
    }

    return tableData.columns.map((col: string, index: number) => ({
      accessorFn: (row: Array<CellValue>) => row[index],
      id: col,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            {col}
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ getValue }) => {
        const value = getValue()
        return <div className="px-2">{String(value ?? '')}</div>
      },
    }))
  }, [tableData.columns])

  const table = useReactTable({
    data: tableData.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  const handleDelete = useCallback(() => {
    onDelete(box._id)
  }, [box._id, onDelete])

  return (
    <Card className="flex h-full w-full flex-col shadow-lg">
      <Handle type="target" position={Position.Top} />

      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{box.title || 'Query Results'}</CardTitle>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto pt-0">
        {columns.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">No data to display</div>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="border-b text-left font-medium">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/50 border-b last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}
