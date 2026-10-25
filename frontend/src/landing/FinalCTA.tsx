'use client'
import { ArrowRight } from 'lucide-react'

export function FinalCTA() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]"
          style={{ background: 'radial-gradient(circle,#3B82F6,#8B5CF6,transparent)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <h2 className="mb-4 text-4xl font-black text-white sm:text-5xl">
          Ready to secure your
          <span style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> crypto ecosystem?</span>
        </h2>
        <p className="mb-10 text-lg" style={{ color: '#A1A1AA' }}>
          Join financial intelligence units, compliance teams, and law enforcement agencies
          protecting their jurisdictions against crypto crime.
        </p>
        <a
          href="/app"
          className="group inline-flex items-center gap-2 rounded-2xl px-10 py-4 text-lg font-bold text-white transition-all hover:scale-[1.04] hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', boxShadow: '0 12px 40px rgba(59,130,246,0.4)' }}
        >
          Open Platform
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </a>
        <p className="mt-4 text-sm" style={{ color: '#6B7280' }}>No credit card required · Instant access</p>
      </div>
    </section>
  )
}
