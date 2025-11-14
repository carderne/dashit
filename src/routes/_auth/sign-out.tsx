import { authClient } from '@/lib/auth-client'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/_auth/sign-out')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  useEffect(() => {
    authClient.signOut().then(() => navigate({ to: '/', reloadDocument: true }))
  }, [])
}
