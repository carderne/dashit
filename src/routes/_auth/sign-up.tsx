import { authClient } from '@/lib/auth-client'
import { invariant } from '@/lib/invariant'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useMutation } from 'convex/react'
import type { FormEvent } from 'react'
import * as z from 'zod/v4'
import { SignInUp } from './-components/sign-in-up'

const searchSchema = z.object({
  error: z.string().optional(),
})

export const Route = createFileRoute('/_auth/sign-up')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { error } = Route.useSearch()
  const callbackURL = '/onboard'
  const mutation = useMutation(api.auth.signUpSocialFn)

  const onClickSocial = async (_provider: 'google') => {
    const { url } = await mutation({
      redirectUrl: callbackURL,
      errorCallbackUrl: callbackURL,
    })
    navigate({ href: url })
  }

  const onSubmitDevOnly = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const [name] = email.split('@')
    invariant(name)
    await authClient.signUp.email(
      { email, password, name, callbackURL },
      {
        onError: async (ctx) => {
          await navigate({ to: '/sign-up', search: { error: ctx.error.code } })
        },
        onSuccess: async () => {
          await navigate({ to: '/' })
        },
      },
    )
  }

  return (
    <SignInUp
      variant="up"
      onClickSocial={onClickSocial}
      onSubmitDevOnly={onSubmitDevOnly}
      error={error}
      showEmail={process.env.NODE_ENV !== 'production'}
    />
  )
}
