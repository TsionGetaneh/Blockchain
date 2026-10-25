'use client'
import { Star } from 'lucide-react'

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'Cyber Crimes Unit',
    quote: 'The platform helped us recover $1.5M in stolen funds within 48 hours. The graph visualization made it trivial to trace the money through 7 intermediate wallets.',
    stars: 5,
  },
  {
    name: 'Marcus Weber',
    role: 'Senior Security Analyst',
    quote: 'The graph visualization is the best I\'ve used. Traced a 20-wallet scam network in minutes. The explainable risk scoring is critical for our court submissions.',
    stars: 5,
  },
  {
    name: 'Aisha Mwangi',
    role: 'AML Compliance Officer',
    quote: 'Finally a tool that gives us real blockchain intelligence without the black-box AI. Every risk factor is explained — exactly what regulators require.',
    stars: 5,
  },
]

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#F59E0B' }}>Testimonials</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Trusted by investigators worldwide</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl p-6 transition hover:scale-[1.01]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="mb-4 flex gap-1">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mb-6 text-sm leading-relaxed" style={{ color: '#D1D5DB' }}>"{t.quote}"</p>
              <div>
                <div className="font-semibold text-white">{t.name}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
