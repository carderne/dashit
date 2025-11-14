import { ClearCanvasModal } from '@/components/modals/clear-canvas-modal'
import { EditNameModal } from '@/components/modals/edit-name-modal'
import { ShareDashboardModal } from '@/components/modals/share-dashboard-modal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouteContext } from '@tanstack/react-router'
import {
  BarChart3Icon,
  CodeIcon,
  CrownIcon,
  DatabaseIcon,
  Menu,
  PenTool,
  Share2Icon,
  Square,
  TableIcon,
  Type,
} from 'lucide-react'
import { memo, useState } from 'react'
import { ThemeSelector } from '../theme-selector'

export type ToolType = 'query' | 'table' | 'chart' | 'text' | 'dashed-box' | 'drawing'

export const TopNav = memo(function TopNav({
  dashboard,
  selectedTool,
  onSelectTool,
  onDatasetClick,
}: {
  dashboard: { _id: Id<'dashboards'>; userId?: Id<'users'>; sessionId?: string }
  selectedTool: ToolType | null
  onSelectTool: (tool: ToolType | null) => void
  onDatasetClick?: () => void
}) {
  const { sessionId } = useRouteContext({ from: '/' })
  const { data: user } = useQuery(convexQuery(api.auth.getCurrentUser, {}))
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [editNameModalOpen, setEditNameModalOpen] = useState(false)
  const [clearCanvasModalOpen, setClearCanvasModalOpen] = useState(false)

  const boxTools = [
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

  const annotationTools = [
    {
      id: 'text' as const,
      label: 'Text',
      icon: Type,
    },
    {
      id: 'dashed-box' as const,
      label: 'Dashed Box',
      icon: Square,
    },
    {
      id: 'drawing' as const,
      label: 'Drawing',
      icon: PenTool,
    },
  ]

  // Check if current user owns the dashboard
  const userOwnsDashboard =
    (user && dashboard.userId === user._id) || (sessionId && dashboard.sessionId === sessionId)

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
            {userOwnsDashboard && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setClearCanvasModalOpen(true)}>
                  Clear Canvas
                </DropdownMenuItem>
              </>
            )}
            {!!user && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditNameModalOpen(true)}>
                  Change name
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/sign-out"> Sign out</Link>
                </DropdownMenuItem>
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

        <Button variant="outline" className="[box-shadow:0_0_12px_rgba(245,158,11,0.6)]" asChild>
          <Link to="/upgrade">
            <CrownIcon /> Upgrade
          </Link>
        </Button>

        {!user && (
          <Button variant="outline" asChild>
            <Link to="/sign-in">Sign In</Link>
          </Button>
        )}
      </div>

      <div className="shadox-xs z-10 flex items-center gap-2 rounded-md border p-2 backdrop-blur-xs">
        {/* Data Management Button */}
        <Button variant="outline" size="icon" onClick={onDatasetClick} title="Manage data">
          <DatabaseIcon />
        </Button>

        {/* Separator */}
        <div className="bg-border h-6 w-px" />

        {/* Box Creation Tools */}
        {boxTools.map((tool) => (
          <Button
            key={tool.id}
            variant={selectedTool === tool.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectTool(selectedTool === tool.id ? null : tool.id)}
            title={tool.label}
          >
            <tool.icon />
          </Button>
        ))}

        {/* Separator */}
        <div className="bg-border h-6 w-px" />

        {/* Annotation Tools */}
        {annotationTools.map((tool) => (
          <Button
            key={tool.id}
            variant={selectedTool === tool.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectTool(selectedTool === tool.id ? null : tool.id)}
            title={tool.label}
          >
            <tool.icon />
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
