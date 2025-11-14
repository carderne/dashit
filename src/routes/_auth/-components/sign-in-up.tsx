import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'

const SHOW_EMAIL_SIGN_UP = import.meta.env.MODE === 'development'

export function SignInUp({
  variant,
  onClickSocial,
  onSubmitDevOnly,
  error,
}: {
  variant: 'in' | 'up'
  onClickSocial: (p: 'google') => void
  onSubmitDevOnly: (f: FormEvent<HTMLFormElement>) => void
  error?: string
}) {
  const buttonText = variant === 'in' ? 'Sign in' : 'Sign up'
  return (
    <>
      {SHOW_EMAIL_SIGN_UP && (
        <form
          className="bg-background absolute top-4 left-4 flex h-fit w-60 flex-col gap-2 p-2"
          onSubmit={onSubmitDevOnly}
        >
          <div className="text-foreground font-bold">DEV ONLY</div>
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

      {/* Glassy card - works with grid background */}
      <div className="relative w-[400px] rounded-3xl border border-white/20 bg-white/50 p-10 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        {/* Gradient overlay for extra depth */}
        <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent" />

        {/* Content */}
        <div className="relative flex flex-col items-center gap-8">
          {/* Error message */}
          {error && (
            <div className="w-full rounded-2xl border border-red-200 bg-red-50/50 p-3 text-center backdrop-blur-sm dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Authentication failed
              </p>
            </div>
          )}

          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/dashit-full.png"
                alt="Dashit"
                className="h-12 w-auto object-contain opacity-70"
              />
              <span className="bg-linear-to-br from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-3xl font-semibold text-transparent dark:from-white dark:via-slate-300 dark:to-white">
                dashit
              </span>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {variant === 'in' ? 'Welcome back' : 'Create your account'}
            </p>
          </div>

          {/* Sign in button */}
          <div className="w-full">
            <Button
              type="button"
              onClick={onClickSocial.bind(null, 'google')}
              className="w-full rounded-full py-6 text-base shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              Continue with Google
            </Button>
          </div>

          {/* Sign up/in link */}
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {variant === 'in' ? (
              <>
                Need an account?{' '}
                <Link
                  to="/sign-up"
                  className="font-semibold text-slate-900 underline decoration-slate-900/30 underline-offset-2 transition-colors hover:decoration-slate-900 dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Have an account?{' '}
                <Link
                  to="/sign-in"
                  className="font-semibold text-slate-900 underline decoration-slate-900/30 underline-offset-2 transition-colors hover:decoration-slate-900 dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
