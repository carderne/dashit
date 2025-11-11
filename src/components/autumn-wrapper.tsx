import { api } from '@convex/_generated/api'
import { AutumnProvider } from 'autumn-js/react'
import { useConvex } from 'convex/react'

export function AutumnWrapper({ children }: { children: React.ReactNode }) {
  const convex = useConvex()

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <AutumnProvider convex={convex} convexApi={(api as any).autumn}>
      {children}
    </AutumnProvider>
  )
}
