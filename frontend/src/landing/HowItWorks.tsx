'use client'
import { Search, Zap, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    num: '01',
    icon: Search,
    color: '#3B82F6',
    title: 'Paste Any Address',
    desc: 'Enter any ETH, BTC, BSC, Polygon, or other supported blockchain wallet address into the search bar.',
  },
  {
    num: '02',
    icon: Zap,
    color: '#8B5CF6',
    title: 'Get Instant Analysis',
    desc: 'The platform returns risk score, entity label, sanctions status, transaction history, and behavioral patterns in under 1 second.',
  },
  {
    num: '03',
    icon: ArrowRight,
    color: '#22C55E',
    title: 'Take Action',
    desc: 'Trace funds through the graph, add to watchlist for monitoring, generate a PDF evidence report, or trigger enforcement alerts.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#8B5CF6' }}>Process</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Three steps to full intelligence</h2>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 lg:block"
            style={{ background: 'linear-gradient(to bottom,transparent,rgba(59,130,246,0.3),rgba(139,92,246,0.3),transparent)' }} />

          <div className="grid gap-8 lg:gap-12">
            {STEPS.map((step, i) => (
              <div key={step.num} className={`flex items-center gap-8 ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                <div className="flex-1 rounded-2xl p-6 transition hover:scale-[1.01]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="inline-flex rounded-xl p-2.5" style={{ background: `${step.color}15`, border: `1px solid ${step.color}25` }}>
                      <step.icon className="h-5 w-5" style={{ color: step.color }} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: step.color }}>Step {step.num}</span>
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#A1A1AA' }}>{step.desc}</p>
                </div>

                {/* Center dot */}
                <div className="hidden lg:flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black text-white"
                  style={{ borderColor: step.color, background: `${step.color}20`, color: step.color }}>
                  {step.num}
                </div>

                <div className="hidden flex-1 lg:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
