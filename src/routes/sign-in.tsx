'use client'

import { SignIn } from '@/components/SignIn'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-in')({
  component: SignIn,
  beforeLoad: ({ context }) => {
    if (context.userId) {
      throw redirect({ to: '/client-only' })
    }
  },
})
