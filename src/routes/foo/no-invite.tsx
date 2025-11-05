import { styledLinkClassName } from '@/components/styled-link'
import { Button } from '@/components/ui/button'
import { H3, Lead } from '@/components/ui/typography'
import { authClient } from '@/lib/auth-client'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/foo/no-invite')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const signout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: '/sign-in' })
        },
      },
    })
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <H3>Hmm, no invite here...</H3>
      <div className="flex flex-col items-center">
        <Lead>That invite does not exist.</Lead>
        <Lead>Continue to your own organization?</Lead>
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <span onClick={signout} className={styledLinkClassName}>
          Sign out
        </span>
        <Button variant="outline" asChild>
          <Link to="/">Yes please</Link>
        </Button>
      </div>
    </div>
  )
}
