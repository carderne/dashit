import type { GenericCtx } from '@convex-dev/better-auth'
import { Autumn } from '@useautumn/convex'
import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { authComponent } from './auth'

export const autumn = new Autumn(components.autumn, {
  secretKey: process.env.AUTUMN_SECRET_KEY ?? '',
  identify: async (ctx: GenericCtx<DataModel>) => {
    const user = await authComponent.safeGetAuthUser(ctx)
    if (!user) return null

    const { userId, name, email } = user
    if (!userId) return null

    return {
      customerId: userId,
      customerData: {
        name: name,
        email: email,
      },
    }
  },
})

/**
 * These exports are required for our react hooks and components
 */
export const {
  track,
  cancel,
  query,
  attach,
  check,
  checkout,
  usage,
  setupPayment,
  createCustomer,
  listProducts,
  billingPortal,
  createReferralCode,
  redeemReferralCode,
  createEntity,
  getEntity,
} = autumn.api()
