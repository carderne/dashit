import { Button } from '@/components/ui/button'
import type { ProductScenario } from 'autumn-js'
import {
  CheckIcon,
  Loader2,
  type LucideIcon,
  SparklesIcon,
  UploadIcon,
  UsersIcon,
} from 'lucide-react'

interface Feature {
  icon?: LucideIcon
  text: string
  highlight?: string // For bolded text like "3", "Unlimited"
}

export interface PlanConfig {
  id: string
  price: number
  subtitle: string
  featuresHeading: string
  features: Feature[]
  highlighted?: boolean
  highlightLabel?: string
}

export const planConfigs: Record<'free' | 'pro' | 'team', PlanConfig> = {
  free: {
    id: 'free',
    price: 0,
    subtitle: 'Perfect for getting started',
    featuresHeading: 'Features:',
    features: [
      { icon: UploadIcon, highlight: '5', text: 'file uploads per month' },
      { icon: SparklesIcon, highlight: '5', text: 'AI query generations per month' },
      { text: 'Unlimited dashboards & queries' },
      { text: 'DuckDB-powered SQL engine' },
      { text: 'Real-time collaboration' },
    ],
  },
  pro: {
    id: 'pro',
    price: 5,
    subtitle: 'For power users and teams',
    featuresHeading: 'Everything in Free, plus:',
    features: [
      { icon: UploadIcon, highlight: '100', text: 'file uploads' },
      { icon: SparklesIcon, highlight: '100', text: 'AI query generations' },
      { text: 'Priority support' },
    ],
    highlighted: true,
    highlightLabel: 'Most Popular',
  },
  team: {
    id: 'team',
    price: 100,
    subtitle: 'For organizations and enterprises',
    featuresHeading: 'Everything in Pro, plus:',
    features: [
      { icon: UploadIcon, highlight: '500', text: 'file uploads' },
      { icon: SparklesIcon, highlight: '1,000', text: 'AI query generations' },
      { icon: UsersIcon, text: 'Unlimited team members' },
    ],
  },
}

export function Plan({
  plan,
  config,
  isLoading,
  onAction,
  marketing = false,
}: {
  plan: {
    id: string
    name: string
    scenario?: ProductScenario
    items: Array<{ price?: number }>
  }
  config: PlanConfig
  isLoading: boolean
  onAction: (productId: string, scenario?: ProductScenario) => void
  marketing?: boolean
}) {
  return (
    <div
      className={`relative rounded-3xl p-8 shadow-2xl backdrop-blur-xl transition-all ${
        config.highlighted
          ? 'border-2 border-blue-500/50 bg-white/10 hover:border-blue-500/70 hover:bg-white/15'
          : 'border border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
      }`}
    >
      {config.highlightLabel && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full border border-blue-400/50 bg-black px-4 py-1 text-sm font-semibold text-blue-300">
            {config.highlightLabel}
          </div>
        </div>
      )}

      <div
        className={`absolute inset-0 rounded-3xl bg-linear-to-br ${
          config.highlighted ? 'from-blue-500/10' : 'from-white/5'
        } to-transparent`}
      />

      <div className="relative space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-white">{plan.name}</h2>
          <p className={`mt-2 ${config.highlighted ? 'text-slate-300' : 'text-slate-400'}`}>
            {config.subtitle}
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-white">${config.price}</span>
          <span className={config.highlighted ? 'text-slate-300' : 'text-slate-400'}>/month</span>
        </div>

        <Button
          size="lg"
          variant={config.highlighted ? 'default' : 'outline'}
          className={
            config.highlighted
              ? 'w-full bg-linear-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
              : 'w-full border-white/20 bg-white/10 text-white hover:bg-white/20'
          }
          onClick={() => onAction(plan.id, plan.scenario)}
          disabled={!marketing && (isLoading || plan.scenario === 'scheduled')}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {marketing ? (plan.id === 'free' ? 'Come in' : 'Upgrade') : getButtonText(plan.scenario)}
        </Button>

        <div className="space-y-4 pt-4">
          <p className="font-semibold text-white">{config.featuresHeading}</p>
          <ul className="space-y-3">
            {config.features.map((feature, index) => {
              const Icon = feature.icon || CheckIcon
              const iconColor = feature.icon
                ? {
                    [UploadIcon.name]: 'text-blue-400',
                    [SparklesIcon.name]: 'text-purple-400',
                    [UsersIcon.name]: 'text-indigo-400',
                  }[Icon.name] || 'text-green-400'
                : 'text-green-400'

              return (
                <li key={index} className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
                  <span className={config.highlighted ? 'text-slate-200' : 'text-slate-300'}>
                    {feature.highlight ? (
                      <>
                        <strong>{feature.highlight}</strong> {feature.text}
                      </>
                    ) : (
                      feature.text
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

const getButtonText = (scenario?: ProductScenario): string => {
  switch (scenario) {
    case 'active':
      return 'Manage'
    case 'downgrade':
      return 'Downgrade'
    case 'upgrade':
      return 'Upgrade'
    case 'cancel':
      return 'Downgrade'
    case 'scheduled':
      return 'Scheduled'
    case 'renew':
      return 'Active'
    case 'new':
      return 'Upgrade'
  }
  return 'Manage'
}
