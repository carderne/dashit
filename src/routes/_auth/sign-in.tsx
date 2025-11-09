import { authClient } from '@/lib/auth-client'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import * as z from 'zod/v4'
import { SignInUp } from './-components/sign-in-up'

const searchSchema = z.object({
  error: z.string().optional(),
})

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { error } = Route.useSearch()
  const callbackURL = '/'

  const onClickSocial = async (provider: 'google') => {
    await authClient.signIn.social({ provider, callbackURL })
  }

  const onSubmitDevOnly = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    await authClient.signIn.email(
      { email, password, callbackURL },
      {
        onError: async (ctx) => {
          await navigate({ to: '/sign-in', search: { error: ctx.error.code } })
        },
        onSuccess: async () => {
          await navigate({ to: '/' })
        },
      },
    )
  }

  return (
    <SignInUp
      variant="in"
      onClickSocial={onClickSocial}
      onSubmitDevOnly={onSubmitDevOnly}
      error={error}
      showEmail={process.env.NODE_ENV !== 'production'}
    />
  )
}
