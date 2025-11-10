import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Menu } from 'lucide-react'
import { memo } from 'react'

export const TopNav = memo(function TopNav() {
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))

  // Show sign in button if user is not logged in OR if they have isAnonymous on their account
  const shouldShowSignIn = !user || user.isAnonymous

  const handleSignIn = () => {
    window.location.href = '/sign-in'
  }

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link to="/dashboards" className="flex cursor-pointer items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard Overview</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {shouldShowSignIn && (
        <Button variant="outline" onClick={handleSignIn}>
          Sign In
        </Button>
      )}
    </div>
  )
})
