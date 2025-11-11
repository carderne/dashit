import { EditNameModal } from '@/components/modals/edit-name-modal'
import { ShareDashboardModal } from '@/components/share-dashboard-modal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Menu, Share2Icon } from 'lucide-react'
import { memo, useState } from 'react'
import { ThemeSelector } from '../theme-selector'

export const TopNav = memo(function TopNav() {
  const navigate = useNavigate()
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))
  const { canvasId } = useParams({ strict: false })
  const dashboardId = canvasId as Id<'dashboards'> | undefined
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [editNameModalOpen, setEditNameModalOpen] = useState(false)

  // Show sign in button if user is not logged in OR if they have isAnonymous on their account
  const shouldShowSignIn = !user || user.isAnonymous
  const shouldShowSignOut = user && !user.isAnonymous

  const handleSignIn = () => {
    navigate({ to: '/sign-in' })
  }

  const handleSignOut = () => {
    authClient.signOut()
  }

  return (
    <>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setEditNameModalOpen(true)}>
              Change Name
            </DropdownMenuItem>
            {shouldShowSignOut && (
              <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {shouldShowSignIn && (
          <Button variant="outline" onClick={handleSignIn}>
            Sign In
          </Button>
        )}
      </div>

      {/* Share button - available to everyone */}
      {dashboardId && (
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button variant="outline" onClick={() => setShareModalOpen(true)}>
            <Share2Icon className="mr-2 h-4 w-4" />
            Share
          </Button>
          <ThemeSelector />
        </div>
      )}

      {/* Share modal */}
      {dashboardId && (
        <ShareDashboardModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          dashboardId={dashboardId}
        />
      )}

      {/* Edit name modal */}
      <EditNameModal open={editNameModalOpen} onOpenChange={setEditNameModalOpen} />
    </>
  )
})
