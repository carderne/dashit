import { Plan, planConfigs } from '@/components/plan'
import { invariant } from '@/lib/invariant'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePricingTable } from 'autumn-js/react'
import { Loader2Icon } from 'lucide-react'

export const Route = createFileRoute('/pricing')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { products, isLoading } = usePricingTable()

  const handlePlanAction = (productId: string) => {
    if (productId === 'free') {
      navigate({ to: '/' })
    } else {
      navigate({ to: '/sign-up', search: { next: '/upgrade' } })
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
              isLoading={false}
              onAction={handlePlanAction}
              marketing={true}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
