import { authClient } from '@/lib/auth-client'
import { useConvexAuth } from '@convex-dev/react-query'
import { useEffect, useState } from 'react'

/**
 * Hook to ensure users are always authenticated, either with a real account or anonymously
 */
export function useAnonymousAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    async function ensureAuth() {
      // Wait for auth to finish loading
      if (isLoading) {
        return
      }

      // If already authenticated, we're done
      if (isAuthenticated) {
        setIsInitializing(false)
        return
      }

      // Sign in anonymously
      try {
        await authClient.signIn.anonymous()
        setIsInitializing(false)
      } catch (error) {
        console.error('Failed to sign in anonymously:', error)
        setIsInitializing(false)
      }
    }

    ensureAuth()
  }, [isAuthenticated, isLoading])

  return {
    isReady: !isInitializing && !isLoading,
  }
}
