import { Plan, planConfigs } from '@/components/plan'
import { invariant } from '@/lib/invariant'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import type { ProductScenario } from 'autumn-js'
import { useCustomer, usePricingTable } from 'autumn-js/react'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/upgrade')({
  beforeLoad: ({ context: { user } }) => {
    if (!user || user.isAnonymous) {
      throw redirect({ to: '/sign-up', search: { next: '/upgrade' } })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { products, isLoading } = usePricingTable()
  const { checkout, openBillingPortal, attach } = useCustomer()
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const handlePlanAction = async (productId: string, scenario?: ProductScenario) => {
    setCheckoutLoading(productId)
    try {
      if (scenario === 'active' || productId === 'free' || scenario === 'cancel') {
        const { data, error } = await openBillingPortal()
        if (error) {
          toast.error('Manage plan failed', { description: error.message })
          return
        }
        return navigate({ href: data.url })
      }

      if (scenario === 'downgrade') {
        const { data, error } = await attach({ productId })
        if (error) {
          toast.error('Downgrade plan failed', { description: error.message })
          return
        }
        if ('checkout_url' in data) {
          return navigate({ href: data.checkout_url })
        } else {
          toast.error('Downgrade plan failed')
          return
        }
      }

      const { data, error } = await checkout({ productId })

      if (error) {
        toast.error('Checkout failed', { description: error.message })
        return
      }

      if (data.url) {
        navigate({ href: data.url })
      }
      toast.error('Something went wrong')
      console.log({ data })
    } catch (error) {
      toast.error('Something went wrong', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setCheckoutLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="canvas-grid relative flex h-screen w-full items-center justify-center overflow-hidden bg-neutral-950">
        <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[120px]" />
        <Loader2Icon className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  // Find plans from Autumn
  const freePlan = products?.find((p) => p.id === 'free')
  const proPlan = products?.find((p) => p.id === 'pro')
  const teamPlan = products?.find((p) => p.id === 'team')
  invariant(freePlan && proPlan && teamPlan)

  const plans = [
    { plan: freePlan, config: planConfigs.free },
    { plan: proPlan, config: planConfigs.pro },
    { plan: teamPlan, config: planConfigs.team },
  ]

  return (
    <div className="canvas-grid relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-950 p-8">
      {/* Diffuse glows */}
      <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 bg-linear-to-br from-white via-slate-300 to-white bg-clip-text text-5xl font-bold text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-400">
            Start analyzing your data with unlimited dashboards and queries
          </p>
        </div>

        {/* Pricing Cards */}
        <div className={`grid gap-8 ${plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {plans.map(({ plan, config }) => (
            <Plan
              key={plan.id}
              plan={plan}
              config={config}
              isLoading={checkoutLoading === plan.id}
              onAction={handlePlanAction}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
