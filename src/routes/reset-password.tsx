'use client'

import ResetPassword from '@/components/ResetPassword'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/reset-password')({
  component: ResetPassword,
})
