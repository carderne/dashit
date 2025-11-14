import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useNavigate, useRouteContext } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface ClearCanvasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: Id<'dashboards'>
}

export function ClearCanvasModal({ open, onOpenChange, dashboardId }: ClearCanvasModalProps) {
  const navigate = useNavigate()
  const { sessionId } = useRouteContext({ strict: false })
  const [migrateDatasets, setMigrateDatasets] = useState(true)
  const [isClearing, setIsClearing] = useState(false)

  const clearCanvas = useConvexMutation(api.dashboards.clearCanvas)

  const handleClearCanvas = async () => {
    try {
      setIsClearing(true)
      const newDashboardId = await clearCanvas({
        currentDashboardId: dashboardId,
        migrateDatasets,
        sessionId,
      })

      // Navigate to new dashboard
      navigate({ to: '/', search: { id: newDashboardId } })

      onOpenChange(false)
      setIsClearing(false)
    } catch (error) {
      console.error('Failed to clear canvas:', error)
      setIsClearing(false)
      alert('Failed to clear canvas. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clear Canvas</DialogTitle>
          <DialogDescription>
            Create a fresh dashboard and remove all queries, tables, and charts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Keep datasets checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="migrateDatasets"
              checked={migrateDatasets}
              onCheckedChange={(checked) => setMigrateDatasets(checked === true)}
            />
            <div className="space-y-1">
              <Label
                htmlFor="migrateDatasets"
                className="text-foreground cursor-pointer leading-none font-medium"
              >
                Keep my datasets
              </Label>
              <p className="text-muted-foreground text-sm">
                Your uploaded data files will be preserved in the new dashboard
              </p>
            </div>
          </div>

          {/* Warning message */}
          {migrateDatasets ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                All queries, tables, and charts will be deleted. Your datasets will be preserved and
                available in the new dashboard.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                    Warning: Permanent Deletion
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    All data including datasets will be permanently deleted from the database and
                    cloud storage. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isClearing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleClearCanvas}
            disabled={isClearing}
          >
            {isClearing ? 'Clearing...' : 'Clear Canvas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
