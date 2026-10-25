'use client'
import { Shield, BarChart3, GitBranch, Globe, Bell, FileText } from 'lucide-react'

const FEATURES = [
  {
    icon: Shield,
    color: '#3B82F6',
    title: 'Wallet Screening',
    desc: 'Instantly screen any wallet address against OFAC sanctions, ransomware databases, darknet markets, phishing lists, and community-reported scam addresses.',
  },
  {
    icon: BarChart3,
    color: '#8B5CF6',
    title: 'Risk Scoring',
    desc: 'Rule-based composite risk score 0–100 with explicit factor breakdown. Every score is fully explainable — court-admissible evidence for law enforcement.',
  },
  {
    icon: GitBranch,
    color: '#60A5FA',
    title: 'Graph Visualization',
    desc: 'Interactive fund flow graph with 1–10 hop tracing. Follow money across multiple wallets and identify the ultimate beneficiary of suspicious transactions.',
  },
  {
    icon: Globe,
    color: '#22C55E',
    title: 'Cross-Chain Tracking',
    desc: 'Track the same address or related wallets across 14 blockchains simultaneously. Money laundering never stays on one chain.',
  },
  {
    icon: Bell,
    color: '#F59E0B',
    title: 'Real-Time Alerts',
    desc: 'Instant notifications via Telegram, Email, and WebSocket when monitored addresses show activity. 5-minute polling cycle for continuous surveillance.',
  },
  {
    icon: FileText,
    color: '#EF4444',
    title: 'Compliance Reports',
    desc: 'Generate court-ready PDF reports with full transaction history, risk assessment, and compliance statements. Ready for FIC and law enforcement submission.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3B82F6' }}>Capabilities</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Everything you need to investigate crypto</h2>
          <p className="mt-4 text-base" style={{ color: '#A1A1AA' }}>
            Built for financial intelligence units, compliance teams, and law enforcement
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${f.color}40`
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 30px ${f.color}15`
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <div className="mb-4 inline-flex rounded-xl p-2.5" style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}>
                <f.icon className="h-5 w-5" style={{ color: f.color }} />
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#A1A1AA' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
