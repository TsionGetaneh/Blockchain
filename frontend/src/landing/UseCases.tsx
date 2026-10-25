'use client'
import { Scale, Building2, Code2, User } from 'lucide-react'

const CASES = [
  {
    icon: Scale,
    color: '#EF4444',
    title: 'Law Enforcement',
    subtitle: 'Financial Intelligence Units',
    desc: 'Trace ransomware payments, identify money laundering networks, and generate court-admissible evidence reports for prosecution.',
    tags: ['Fund Tracing', 'Evidence Reports', 'Sanctions'],
  },
  {
    icon: Building2,
    color: '#3B82F6',
    title: 'Central Banks & Regulators',
    subtitle: 'Compliance & Oversight',
    desc: 'Monitor crypto activity within your jurisdiction, enforce OFAC sanctions, and audit exchange providers operating in your market.',
    tags: ['AML Compliance', 'Exchange Audit', 'OFAC'],
  },
  {
    icon: Code2,
    color: '#8B5CF6',
    title: 'Financial Institutions',
    subtitle: 'Risk & Compliance Teams',
    desc: 'Screen counterparties before transactions, integrate via REST API with core banking systems, and automate suspicious activity reporting.',
    tags: ['API Integration', 'Batch Screening', 'SAR'],
  },
  {
    icon: User,
    color: '#22C55E',
    title: 'Investigators',
    subtitle: 'Forensic Analysts',
    desc: 'Deep-dive into wallet histories, cluster related addresses, visualize fund flows across multiple hops, and build investigation timelines.',
    tags: ['Graph Analysis', 'Clustering', 'Timeline'],
  },
]

export function UseCases() {
  return (
    <section id="use-cases" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#22C55E' }}>Use Cases</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Built for every enforcement scenario</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {CASES.map((c) => (
            <div key={c.title} className="group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.01]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${c.color}35` }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>
              <div className="mb-4 flex items-start gap-4">
                <div className="inline-flex rounded-xl p-3" style={{ background: `${c.color}12`, border: `1px solid ${c.color}20` }}>
                  <c.icon className="h-6 w-6" style={{ color: c.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-white">{c.title}</h3>
                  <p className="text-xs" style={{ color: c.color }}>{c.subtitle}</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed" style={{ color: '#A1A1AA' }}>{c.desc}</p>
              <div className="flex flex-wrap gap-2">
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ background: `${c.color}10`, border: `1px solid ${c.color}20`, color: c.color }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
