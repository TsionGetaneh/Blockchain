'use client'
import { ShieldAlert, AlertTriangle, CheckCircle, Activity } from 'lucide-react'

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  backdropFilter: 'blur(20px)',
}

export function DashboardPreview() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%,#3B82F6,transparent 60%)' }} />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3B82F6' }}>Live Platform</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Enterprise-grade intelligence dashboard</h2>
          <p className="mt-3 text-base" style={{ color: '#A1A1AA' }}>Everything an investigator needs in one screen</p>
        </div>

        {/* Mock dashboard */}
        <div className="rounded-2xl p-1" style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl p-6" style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Top bar */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-rose-500/70" />
              <div className="h-3 w-3 rounded-full bg-amber-500/70" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
              <div className="ml-4 flex-1 rounded-lg px-4 py-1.5 text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                wallet-intelligence.nbe.gov.et/app/address/ethereum/0x722122df...
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Risk card */}
              <div className="lg:col-span-1" style={CARD_STYLE}>
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Risk Assessment</span>
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mb-1 font-mono text-xs text-gray-500">0x722122df12d4e14e...</div>
                  <div className="mt-3 text-5xl font-black text-rose-400">95</div>
                  <div className="mt-1 text-xs text-gray-500">/ 100 — Critical Risk</div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {['OFAC Sanctioned','Mixer','Tornado Cash'].map(t => (
                      <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-rose-300" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>{t}</span>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {[['OFAC Sanctions','Yes'],['Mixer Usage','Yes'],['Ransomware','No'],['Darknet','No']].map(([k,v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{k}</span>
                        <span className={v === 'Yes' ? 'font-bold text-rose-400' : 'text-gray-600'}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Graph + feed */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {/* Graph mock */}
                <div className="flex-1 rounded-2xl p-4" style={CARD_STYLE}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fund Flow Graph</span>
                    <Activity className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="relative h-36 rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 140">
                      <defs>
                        <radialGradient id="ng1"><stop offset="0%" stopColor="#EF4444" stopOpacity="0.8"/><stop offset="100%" stopColor="#EF4444" stopOpacity="0"/></radialGradient>
                        <radialGradient id="ng2"><stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8"/><stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/></radialGradient>
                        <radialGradient id="ng3"><stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8"/><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/></radialGradient>
                      </defs>
                      {/* Edges */}
                      <line x1="200" y1="70" x2="80" y2="40" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5"/>
                      <line x1="200" y1="70" x2="320" y2="40" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5"/>
                      <line x1="200" y1="70" x2="120" y2="110" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5"/>
                      <line x1="200" y1="70" x2="300" y2="110" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5"/>
                      <line x1="80" y1="40" x2="40" y2="20" stroke="rgba(239,68,68,0.3)" strokeWidth="1"/>
                      <line x1="320" y1="40" x2="370" y2="20" stroke="rgba(59,130,246,0.3)" strokeWidth="1"/>
                      {/* Nodes */}
                      <circle cx="200" cy="70" r="14" fill="url(#ng1)"/><circle cx="200" cy="70" r="6" fill="#EF4444"/>
                      <circle cx="80" cy="40" r="10" fill="url(#ng2)"/><circle cx="80" cy="40" r="4" fill="#3B82F6"/>
                      <circle cx="320" cy="40" r="10" fill="url(#ng3)"/><circle cx="320" cy="40" r="4" fill="#8B5CF6"/>
                      <circle cx="120" cy="110" r="8" fill="url(#ng2)"/><circle cx="120" cy="110" r="3" fill="#3B82F6"/>
                      <circle cx="300" cy="110" r="8" fill="url(#ng3)"/><circle cx="300" cy="110" r="3" fill="#8B5CF6"/>
                      <circle cx="40" cy="20" r="6" fill="rgba(239,68,68,0.6)"/><circle cx="40" cy="20" r="2.5" fill="#EF4444"/>
                      <circle cx="370" cy="20" r="6" fill="rgba(59,130,246,0.6)"/><circle cx="370" cy="20" r="2.5" fill="#3B82F6"/>
                    </svg>
                    <div className="absolute bottom-2 right-2 text-[10px] text-gray-600">7 wallets · 3 hops</div>
                  </div>
                </div>

                {/* Threat feed */}
                <div className="rounded-2xl p-4" style={CARD_STYLE}>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Threat Detection Feed</div>
                  <div className="space-y-2">
                    {[
                      { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'OFAC Sanctions Match', time: '2s ago' },
                      { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'Tornado Cash Interaction', time: '1m ago' },
                      { icon: CheckCircle, color: '#22C55E', bg: 'rgba(34,197,94,0.1)', label: 'No Ransomware Match', time: '1m ago' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: item.bg }}>
                        <item.icon className="h-3.5 w-3.5 shrink-0" style={{ color: item.color }} />
                        <span className="flex-1 text-xs text-gray-200">{item.label}</span>
                        <span className="text-[10px] text-gray-500">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
