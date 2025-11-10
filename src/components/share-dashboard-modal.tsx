import { AlertCircle, Share2 } from 'lucide-react'
import type { Id } from '../../convex/_generated/dataModel'
import { CopyDisplay } from './copy-display'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface ShareDashboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: Id<'dashboards'>
}

export function ShareDashboardModal({ open, onOpenChange, dashboardId }: ShareDashboardModalProps) {
  const shareUrl = `${window.location.origin}/${dashboardId}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Dashboard
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view and edit this dashboard and access all connected
            datasets.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Warning */}
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Warning: Anyone with this link will have full access to this dashboard, including the
              ability to upload, modify, and delete datasets.
            </span>
          </div>

          {/* Share Link */}
          <div className="grid gap-2">
            <CopyDisplay value={shareUrl} label="Copy Link" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
