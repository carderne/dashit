import { styledLinkClassName } from '@/components/styled-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'

export function SignInUp({
  variant,
  onClickSocial,
  onSubmitDevOnly,
  error,
  showEmail,
  inviteId,
}: {
  variant: 'in' | 'up'
  onClickSocial: (p: 'google') => void
  onSubmitDevOnly: (f: FormEvent<HTMLFormElement>) => void
  showEmail: boolean
  error?: string
  inviteId: string | undefined
}) {
  const buttonText = variant === 'in' ? 'Sign in' : 'Sign up'
  return (
    <>
      {showEmail && (
        <form
          className="bg-background absolute inset-4 flex h-fit w-60 flex-col gap-2 p-2"
          onSubmit={onSubmitDevOnly}
        >
          <div className="text-status-warning font-bold">DEV ONLY</div>
          <Input
            name="email"
            type="email"
            required={true}
            placeholder="you@yours.com"
            data-testid="input-email"
          />
          <Input
            name="password"
            type="password"
            required={true}
            placeholder="password"
            data-testid="input-password"
          />
          <Button data-testid="btn-submit">{buttonText}</Button>
        </form>
      )}
      <Card className="flex h-100 flex-col items-center justify-between bg-white/95 p-8">
        <div>{error && <div className="text-xl text-red-500">Error!</div>}</div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <span className="overflow-hidden rounded-2xl text-[8rem] leading-none">DASHIT</span>
          </div>
          <div className="grid w-60 gap-4">
            <Button type="button" onClick={onClickSocial.bind(null, 'google')} className="w-full">
              Continue with Google
            </Button>
          </div>
        </div>
        {variant === 'in' ? (
          <div>
            Need an account?{' '}
            <Link className={styledLinkClassName} to="/sign-up" search={{ inviteId }}>
              Sign up!
            </Link>
          </div>
        ) : (
          <div>
            Have an account?{' '}
            <Link className={styledLinkClassName} to="/sign-in" search={{ inviteId }}>
              Sign in!
            </Link>
          </div>
        )}
      </Card>
    </>
  )
}
