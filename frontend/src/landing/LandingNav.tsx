'use client'
import { useEffect, useState } from 'react'
import { Menu, X, ShieldCheck } from 'lucide-react'

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scrollTo = (href: string) => {
    setOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(10,10,15,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
        paddingTop: '2px',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-white/10"
            style={{ background: '#0d1b2e' }}>
            <img src="/logo.jpg" alt="NBE" className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }} />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">
              Wallet<span style={{ color: '#D4A853' }}>Intelligence</span>
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest">NBE Platform</div>
          </div>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => scrollTo(l.href)}
              className="rounded-xl px-4 py-2 text-sm text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/app"
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
          >
            Open Platform →
          </a>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden rounded-xl border border-white/10 bg-white/[0.04] p-2 text-gray-300" onClick={() => setOpen(v => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-white/[0.07] px-6 py-4 flex flex-col gap-2"
          style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)' }}>
          {links.map((l) => (
            <button key={l.label} onClick={() => scrollTo(l.href)}
              className="rounded-xl px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition">
              {l.label}
            </button>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <a href="/app" className="rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}>Open Platform →</a>
          </div>
        </div>
      )}
    </nav>
  )
}
