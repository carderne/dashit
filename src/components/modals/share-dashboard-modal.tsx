import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { AlertCircle, RefreshCw, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CopyDisplay } from './copy-display'

interface ShareDashboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId: Id<'dashboards'>
}

export function ShareDashboardModal({ open, onOpenChange, dashboardId }: ShareDashboardModalProps) {
  const { sessionId } = useRouteContext({ from: '/' })
  const queryClient = useQueryClient()
  const [shareKey, setShareKey] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const generateKey = useConvexMutation(api.dashboards.generateShareKey)

  useEffect(() => {
    if (open && !shareKey && !isGenerating) {
      setIsGenerating(true)
      generateKey({ dashboardId, sessionId })
        .then((data) => setShareKey(data.key))
        .finally(() => setIsGenerating(false))
    }
  }, [open])

  const handleRegenerateKey = async () => {
    setIsRegenerating(true)
    try {
      const data = await generateKey({ dashboardId, sessionId })
      setShareKey(data.key)
      // Invalidate dashboard queries to update the key
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } finally {
      setIsRegenerating(false)
    }
  }

  const shareUrl = shareKey ? `${window.location.origin}?id=${dashboardId}&key=${shareKey}` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Dashboard
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view and edit this dashboard, but only you can upload
            datasets.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Warning */}
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Anyone with this link can view and edit boxes, but cannot upload or delete datasets.
            </span>
          </div>

          {/* Share Link */}
          <div className="grid gap-2">
            {isGenerating ? (
              <div className="text-muted-foreground text-sm">Generating share link...</div>
            ) : (
              <CopyDisplay value={shareUrl} label="Copy Link" />
            )}
          </div>

          {/* Regenerate Key Warning */}
          {shareKey && (
            <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Regenerate Share Key</p>
                <p className="text-muted-foreground mt-1">
                  This will invalidate the old link and anyone using it will lose access.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2"
                  onClick={handleRegenerateKey}
                  disabled={isRegenerating}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                  Regenerate Key
                </Button>
              </div>
            </div>
          )}
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
