import { type AuthFunctions, createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { withoutSystemFields } from 'convex-helpers'
import { components, internal } from './_generated/api'
import type { DataModel, Id } from './_generated/dataModel'
import { query, type QueryCtx } from './_generated/server'
import betterAuthSchema from './betterAuth/schema'

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
    emailAndPassword: {
      enabled: process.env.ENV === 'dev',
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    advanced: {
      useSecureCookies: false,
    },
    plugins: [convex()],
  })

export const safeGetUser = async (ctx: QueryCtx) => {
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) {
    return null
  }

  const user = await ctx.db.get(authUser.userId as Id<'users'>)
  if (!user) {
    return null
  }
  return { ...user, ...withoutSystemFields(authUser) }
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return safeGetUser(ctx)
  },
})
