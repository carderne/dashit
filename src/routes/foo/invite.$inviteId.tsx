import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { H2 } from '@/components/ui/typography'
import { authClient } from '@/lib/auth-client'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/foo/invite/$inviteId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { inviteId: invitationId } = Route.useParams()
  const navigate = useNavigate()

  const accept = async () => {
    await authClient.organization.acceptInvitation({ invitationId })
    navigate({ to: '/' })
  }
  const reject = async () => {
    await authClient.organization.rejectInvitation({ invitationId })
    navigate({ to: '/' })
  }
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Card>
        <CardHeader>
          <H2>Accept invitation?</H2>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>You will be added to the organization.</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button onClick={reject} variant="secondary">
            Reject
          </Button>
          <Button onClick={accept}>Accept</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
