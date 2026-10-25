'use client'
import { Check } from 'lucide-react'

const PLANS = [
  {
    name: 'Basic',
    price: 'Free',
    period: '',
    color: '#6B7280',
    features: ['100 screenings/month', '1 graph/month', 'Email alerts', '7-day history', 'PDF reports'],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    color: '#3B82F6',
    features: ['10,000 screenings', 'Unlimited graphs', 'Telegram alerts', 'Discord alerts', '2-year history', 'CSV batch import', 'Priority support'],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    color: '#8B5CF6',
    features: ['Unlimited screenings', 'Full API access', 'On-prem deployment', 'Dedicated support', 'SLA guarantee', 'Custom integrations', 'FIC reporting module'],
    cta: 'Contact Us',
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3B82F6' }}>Pricing</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-3 text-base" style={{ color: '#A1A1AA' }}>Start free. Scale as your investigations grow.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className="relative rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: plan.popular ? `linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08))` : 'rgba(255,255,255,0.03)',
                border: plan.popular ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.07)',
                boxShadow: plan.popular ? '0 0 40px rgba(59,130,246,0.12)' : 'none',
              }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}>
                  MOST POPULAR
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black" style={{ color: plan.color }}>{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-400">{plan.period}</span>}
                </div>
              </div>
              <ul className="mb-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                    <Check className="h-4 w-4 shrink-0" style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/app"
                className="block w-full rounded-xl py-3 text-center text-sm font-semibold transition hover:opacity-90"
                style={plan.popular
                  ? { background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)' }}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
