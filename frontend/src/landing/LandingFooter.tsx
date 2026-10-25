'use client'
import { Globe, Share2, ExternalLink } from 'lucide-react'

const LINKS = {
  Product: ['Features', 'Pricing', 'API', 'Changelog'],
  Resources: ['Documentation', 'Blog', 'Support'],
  Company: ['About', 'Contact', 'Legal'],
}

export function LandingFooter() {
  return (
    <footer style={{ background: '#07070C', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-white/10"
                style={{ background: '#0d1b2e' }}>
                <img src="/logo.jpg" alt="NBE" className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  Wallet<span style={{ color: '#D4A853' }}>Intelligence</span>
                </div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest">NBE Platform</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#6B7280' }}>
              Blockchain intelligence platform for the National Bank of Ethiopia.
              Screening, tracing, and monitoring cryptocurrency activity.
            </p>
            <div className="flex gap-3">
              {[Globe, Share2, ExternalLink].map((Icon, i) => (
                <a key={i} href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 transition hover:bg-white/[0.08] hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">{section}</div>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm transition hover:text-white" style={{ color: '#6B7280' }}>{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: '#4B5563' }}>
            © 2026 National Bank of Ethiopia — Wallet Intelligence Platform. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs" style={{ color: '#4B5563' }}>
            <a href="#" className="hover:text-gray-300 transition">Privacy Policy</a>
            <a href="#" className="hover:text-gray-300 transition">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
