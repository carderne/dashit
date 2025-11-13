import { type AuthFunctions, createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { anonymous } from 'better-auth/plugins'
import { withoutSystemFields } from 'convex-helpers'
import { v } from 'convex/values'
import { invariant } from '../src/lib/invariant'
import { components, internal } from './_generated/api'
import type { DataModel, Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import betterAuthSchema from './betterAuth/schema'

// This implementation is upgraded to 0.8 Local Install with no
// database migration required. It continues the pattern of writing
// userId to the Better Auth users table and maintaining a separate
// users table for application data.

const siteUrl = process.env.SITE_URL

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel, typeof betterAuthSchema>(
  components.betterAuth,
  {
    authFunctions,
    local: {
      schema: betterAuthSchema,
    },
    verbose: true,
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
          const userId = await ctx.db.insert('users', {
            email: authUser.email,
          })
          await authComponent.setUserId(ctx, authUser._id, userId)
        },
        onUpdate: async (ctx, newUser, oldUser) => {
          if (oldUser.email === newUser.email) {
            return
          }
          await ctx.db.patch(newUser.userId as Id<'users'>, {
            email: newUser.email,
          })
        },
        onDelete: async (ctx, authUser) => {
          const user = await ctx.db.get(authUser.userId as Id<'users'>)
          if (!user) {
            return
          }
          await ctx.db.delete(user._id)
        },
      },
    },
  },
)

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuth = (ctx: GenericCtx<DataModel>, { optionsOnly } = { optionsOnly: false }) =>
  betterAuth({
    baseURL: siteUrl,
    logger: {
      disabled: optionsOnly,
    },
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    plugins: [
      anonymous({
        emailDomainName: 'dashit.rdrn.me',
      }),
      convex(),
    ],
  })

// Below are example functions for getting the current user
// Feel free to edit, omit, etc.
export const safeGetUser = async (ctx: QueryCtx) => {
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) {
    return
  }

  const user = await ctx.db.get(authUser.userId as Id<'users'>)
  if (!user) {
    return
  }
  return { ...user, ...withoutSystemFields(authUser) }
}

export const getUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetUser(ctx)
    if (!user) {
      throw new Error('User not found')
    }
    return user
  },
})

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return safeGetUser(ctx)
  },
})

export const signUpSocialFn = mutation({
  args: {
    redirectUrl: v.string(),
    errorCallbackUrl: v.string(),
  },

  returns: {
    url: v.string(),
  },

  handler: async (ctx, { redirectUrl, errorCallbackUrl }) => {
    // This can throw, but only _after_ the redirect, so impossible to
    // handle in this function. Must rely on Better Auth error handling/codes
    console.log('begin social sign in/up', { provider: 'google' })
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    const res = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: redirectUrl,
        errorCallbackURL: errorCallbackUrl,
      },
      headers,
    })
    const { url } = res
    invariant(url, 'No social sign in url')
    return { url }
  },
})

export const signInAnon = mutation({
  args: {},

  handler: async (ctx) => {
    const user = await safeGetUser(ctx)
    if (user) {
      return false
    }
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    const res = await auth.api.signInAnonymous({
      headers,
    })
    invariant(res !== null, 'Anon sign in failed')
    return true
  },
})
