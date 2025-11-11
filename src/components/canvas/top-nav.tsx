import { ClearCanvasModal } from '@/components/modals/clear-canvas-modal'
import { EditNameModal } from '@/components/modals/edit-name-modal'
import { ShareDashboardModal } from '@/components/share-dashboard-modal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BarChart3Icon, CodeIcon, FileStackIcon, Menu, Share2Icon, TableIcon } from 'lucide-react'
import { memo, useState } from 'react'
import { ThemeSelector } from '../theme-selector'

export const TopNav = memo(function TopNav({
  dashboard,
  selectedTool,
  onSelectTool,
  onDatasetClick,
}: {
  dashboard: { _id: Id<'dashboards'>; userId?: Id<'users'> }
  selectedTool: 'query' | 'table' | 'chart' | null
  onSelectTool: (tool: 'query' | 'table' | 'chart' | null) => void
  onDatasetClick?: () => void
}) {
  const navigate = useNavigate()
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [editNameModalOpen, setEditNameModalOpen] = useState(false)
  const [clearCanvasModalOpen, setClearCanvasModalOpen] = useState(false)

  const tools = [
    {
      id: 'query' as const,
      label: 'Query',
      icon: CodeIcon,
    },
    {
      id: 'table' as const,
      label: 'Table',
      icon: TableIcon,
    },
    {
      id: 'chart' as const,
      label: 'Chart',
      icon: BarChart3Icon,
    },
  ]

  // Get dashboard to check ownership

  // Show sign in button if user is not logged in OR if they have isAnonymous on their account
  const shouldShowSignIn = !user || user.isAnonymous
  const shouldShowSignOut = user && !user.isAnonymous

  // Check if current user owns the dashboard
  const userOwnsDashboard = user && dashboard.userId === user._id

  const handleSignIn = () => {
    navigate({ to: '/sign-in' })
  }

  const handleSignOut = () => {
    authClient.signOut()
  }

  return (
    <div className="absolute top-2 flex w-screen justify-between px-4">
      <div className="z-10 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onDatasetClick}>Manage data</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditNameModalOpen(true)}>
              Change Name
            </DropdownMenuItem>
            {userOwnsDashboard && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setClearCanvasModalOpen(true)}>
                  Clear Canvas
                </DropdownMenuItem>
              </>
            )}
            {shouldShowSignOut && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ClearCanvasModal
          open={clearCanvasModalOpen}
          onOpenChange={setClearCanvasModalOpen}
          dashboardId={dashboard._id}
        />

        <EditNameModal open={editNameModalOpen} onOpenChange={setEditNameModalOpen} />

        {shouldShowSignIn && (
          <Button variant="outline" onClick={handleSignIn}>
            Sign In
          </Button>
        )}
      </div>

      <div className="shadox-xs z-10 flex items-center gap-2 rounded-md border p-2 backdrop-blur-xs">
        {/* Data Management Button */}
        <Button variant="outline" size="icon" onClick={onDatasetClick} title="Manage data">
          <FileStackIcon className="mb-1 h-5 w-5" />
        </Button>

        {/* Separator */}
        <div className="bg-border w-px" />

        {/* Box Creation Tools */}
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={selectedTool === tool.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectTool(selectedTool === tool.id ? null : tool.id)}
            className="flex h-auto flex-col px-3 py-2"
            title={tool.label}
          >
            <tool.icon className="mb-1 h-5 w-5" />
          </Button>
        ))}
      </div>

      <div className="z-10 flex items-center gap-2">
        <Button variant="outline" onClick={() => setShareModalOpen(true)}>
          <Share2Icon className="mr-2 h-4 w-4" />
          Share
        </Button>
        <ShareDashboardModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          dashboardId={dashboard._id}
        />
        <ThemeSelector />
      </div>
    </div>
  )
})
