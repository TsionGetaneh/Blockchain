'use client'
import { useEffect, useRef } from 'react'
import { ArrowRight, Play, ShieldCheck } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-20">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Glow orbs */}
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full opacity-20 blur-[120px]"
          style={{ background: 'radial-gradient(circle,#3B82F6,transparent)' }} />
        <div className="absolute right-1/4 bottom-1/3 h-80 w-80 rounded-full opacity-15 blur-[100px]"
          style={{ background: 'radial-gradient(circle,#8B5CF6,transparent)' }} />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[80px]"
          style={{ background: 'radial-gradient(circle,#60A5FA,transparent)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60A5FA' }}>
          <ShieldCheck className="h-3.5 w-3.5" />
          National Bank of Ethiopia — Blockchain Intelligence Platform
        </div>

        {/* Subheadline */}
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em]" style={{ color: '#8B5CF6' }}>
          Screening · Tracing · Monitoring · Compliance
        </p>

        {/* Main headline */}
        <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          <span className="text-white">Know Any Wallet.</span>
          <br />
          <span style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6,#60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Instantly.
          </span>
        </h1>

        {/* Description */}
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed" style={{ color: '#A1A1AA' }}>
          Screen wallet addresses against sanctions, ransomware, darknet, phishing, and scam databases.
          Trace suspicious activity across 14 blockchains. Get real-time alerts and forensic-grade
          transaction intelligence — all in one platform.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="/app"
            className="group flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold text-white transition-all hover:scale-[1.03] hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', boxShadow: '0 8px 32px rgba(59,130,246,0.35)' }}
          >
            Screen an Address
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <button
            onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 rounded-2xl border px-8 py-4 text-base font-medium text-gray-200 transition hover:bg-white/[0.06] hover:text-white"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <Play className="h-4 w-4" />
            See How It Works
          </button>
        </div>

        {/* Trust line */}
        <p className="mt-10 text-xs" style={{ color: '#6B7280' }}>
          Trusted by financial intelligence units, compliance teams, and law enforcement agencies
        </p>

        {/* Trust logos placeholder */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 opacity-40">
          {['FIC', 'INTERPOL', 'FATF', 'NBE', 'EFCC'].map((name) => (
            <span key={name} className="text-xs font-bold tracking-widest text-gray-400 uppercase">{name}</span>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
        style={{ background: 'linear-gradient(to bottom,transparent,#0A0A0F)' }} />
    </section>
  )
}
