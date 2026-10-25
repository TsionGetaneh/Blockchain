'use client'
import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Download, CheckCircle, Clock, XCircle, HelpCircle,
  ChevronRight, Building2, RefreshCcw, Users,
  ShieldCheck, ArrowLeft,
} from 'lucide-react'
import { fetchExchanges, fetchExchangeAnalysis, fetchEthiopianFilter } from '../lib/endpoints'
import { Skeleton } from '../components/Skeleton'
import toast from 'react-hot-toast'

type VerificationStatus = 'verified' | 'pending' | 'failed' | 'not_available'

type AuditField = {
  field: string
  value: string
  verification_status: VerificationStatus
  evidence_source: string
  notes?: string
}

type ExchangeAnalysisResult = {
  exchange: string
  userId: string
  generatedAt: string
  fields: AuditField[]
}

type EthiopianUser = {
  user: Record<string, string>
  confidenceScore: number
  recommendation: string
  matchedSignals: string[]
  auditRecord: ExchangeAnalysisResult
}

type FilterResult = {
  totalScanned: number
  ethiopiansFound: number
  detectionRate: string
  users: EthiopianUser[]
}

type Exchange = {
  id: string
  name: string
  country: string
  founded: number
  website: string
}

type View = 'list' | 'ethiopians' | 'audit'

const STATUS_CONFIG: Record<VerificationStatus, {
  icon: typeof CheckCircle; label: string; color: string; bg: string; border: string
}> = {
  verified:      { icon: CheckCircle, label: 'Verified',     color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20' },
  pending:       { icon: Clock,       label: 'Pending',      color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-400/20'   },
  failed:        { icon: XCircle,     label: 'Failed',       color: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-400/20'    },
  not_available: { icon: HelpCircle,  label: 'N/A',          color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-400/20'    },
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  )
}

function exportAuditHTML(data: ExchangeAnalysisResult) {
  const rows = data.fields.map(f => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111">${f.field}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${f.value}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
        <span style="padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;
          background:${f.verification_status==='verified'?'#d1fae5':f.verification_status==='pending'?'#fef3c7':f.verification_status==='failed'?'#fee2e2':'#f3f4f6'};
          color:${f.verification_status==='verified'?'#065f46':f.verification_status==='pending'?'#92400e':f.verification_status==='failed'?'#991b1b':'#6b7280'}">
          ${f.verification_status==='verified'?'✅ Verified':f.verification_status==='pending'?'⏳ Pending':f.verification_status==='failed'?'❌ Failed':'🔍 N/A'}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${f.evidence_source}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#9ca3af">${f.notes??''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Exchange Audit — ${data.exchange}</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{color:#1a1a2e;border-bottom:3px solid #3B82F6;padding-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}th{background:#1e3a5f;color:#fff;padding:10px 12px;text-align:left}
  tr:hover{background:#f9fafb}.meta{background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;font-size:13px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}</style>
  </head><body>
  <h1>🏦 Exchange Audit Report — ${data.exchange}</h1>
  <div class="meta">
    <strong>Exchange:</strong> ${data.exchange} &nbsp;|&nbsp;
    <strong>Subject:</strong> ${data.userId} &nbsp;|&nbsp;
    <strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()} &nbsp;|&nbsp;
    <strong>Authority:</strong> National Bank of Ethiopia — Financial Intelligence Unit
  </div>
  <table><thead><tr><th>Field</th><th>Value</th><th>Status</th><th>Evidence Source</th><th>Notes</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">CONFIDENTIAL — For Law Enforcement and Regulatory Use Only · NBE</div>
  </body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-${data.exchange}-${data.userId}-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Audit report downloaded')
}

// ─── Exchange List View ───────────────────────────────────────────────────────

function ExchangeListView({
  exchanges, loading, search, onSearch, onSelect,
}: {
  exchanges: Exchange[]
  loading: boolean
  search: string
  onSearch: (v: string) => void
  onSelect: (ex: Exchange) => void
}) {
  const filtered = exchanges.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.country.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="glass p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <Building2 className="h-3.5 w-3.5" />
          Select an exchange to begin analysis
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search exchanges…" value={search} onChange={e => onSearch(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            : filtered.map(ex => (
              <button
                key={ex.id}
                type="button"
                onClick={() => onSelect(ex)}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition hover:border-blue-400/30 hover:bg-blue-500/5 hover:scale-[1.01]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-400/20">
                    <Building2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-100">{ex.name}</div>
                    <div className="text-[10px] text-gray-500">{ex.country} · Est. {ex.founded}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Ethiopian Filter View ────────────────────────────────────────────────────

function EthiopianFilterView({
  exchange, onBack, onAuditUser,
}: {
  exchange: Exchange
  onBack: () => void
  onAuditUser: (userId: string) => void
}) {
  const [scanCount, setScanCount] = useState('200')
  const [submitted, setSubmitted] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const q = useQuery<FilterResult>({
    queryKey: ['ethiopians', exchange.id, scanCount],
    queryFn: () => fetchEthiopianFilter(exchange.id, parseInt(scanCount) || 200),
    enabled: submitted,
  })

  const data = q.data as FilterResult | undefined
  const users = data?.users ?? []

  const filtered = users.filter(u => {
    if (!userSearch) return true
    const s = userSearch.toLowerCase()
    return (
      u.user.full_name?.toLowerCase().includes(s) ||
      u.user.phone?.includes(s) ||
      u.user.national_id?.toLowerCase().includes(s) ||
      u.user.email?.toLowerCase().includes(s) ||
      u.user.address?.toLowerCase().includes(s)
    )
  })

  const CONFIDENCE_COLOR = (score: number) =>
    score >= 80 ? 'text-rose-300' : score >= 60 ? 'text-amber-300' : 'text-emerald-300'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost p-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="page-header">{exchange.name} — Ethiopian User Detection</div>
          <div className="page-subheader">
            Automatically scan bulk exchange data and filter Ethiopian users using multi-signal detection
          </div>
        </div>
      </div>

      {/* Scan config */}
      <div className="glass p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs text-gray-400">Users to scan (max 500)</label>
            <input className="input" type="number" min="10" max="500" value={scanCount}
              onChange={e => setScanCount(e.target.value)} />
          </div>
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/5 p-3 text-xs text-blue-200 flex-1">
            <div className="font-semibold mb-1">Detection signals used:</div>
            <div className="text-blue-200/70 space-y-0.5">
              <div>• Phone starts with +251</div>
              <div>• IP geolocation = Ethiopia</div>
              <div>• Address contains "Ethiopia" / "Addis Ababa"</div>
              <div>• National ID matches Ethiopian TIN format</div>
              <div>• Bank SWIFT = CBET / ABYS</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { setSubmitted(true); q.refetch() }}
            disabled={q.isFetching}
          >
            {q.isFetching
              ? <><RefreshCcw className="h-4 w-4 animate-spin" /> Scanning…</>
              : <><Users className="h-4 w-4" /> Scan {exchange.name}</>
            }
          </button>
        </div>
      </div>

      {/* Results */}
      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass p-4 text-center">
              <div className="text-3xl font-black text-blue-300">{data.totalScanned}</div>
              <div className="text-xs text-gray-400 mt-1">Total Scanned</div>
            </div>
            <div className="glass p-4 text-center border border-rose-400/20 bg-rose-500/5">
              <div className="text-3xl font-black text-rose-300">{data.ethiopiansFound}</div>
              <div className="text-xs text-gray-400 mt-1">Ethiopians Found</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-3xl font-black text-amber-300">{data.detectionRate}</div>
              <div className="text-xs text-gray-400 mt-1">Detection Rate</div>
            </div>
          </div>

          {/* Search + table */}
          <div className="glass overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input className="input pl-9" placeholder="Search by name, phone, ID, email…"
                  value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              <span className="text-xs text-gray-500">{filtered.length} shown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">National ID</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Signals</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No results.</td></tr>
                  ) : filtered.map((u, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-100">{u.user.full_name}</td>
                      <td className="px-4 py-2.5 text-gray-300">{u.user.phone}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-400">{u.user.national_id}</td>
                      <td className="px-4 py-2.5 text-gray-400 max-w-[140px] truncate">{u.user.address}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-500">{u.user.ip_address}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-bold ${CONFIDENCE_COLOR(u.confidenceScore)}`}>
                          {u.confidenceScore}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {u.matchedSignals.slice(0, 2).map((s, j) => (
                            <span key={j} className="rounded-full border border-blue-400/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-300">
                              {s}
                            </span>
                          ))}
                          {u.matchedSignals.length > 2 && (
                            <span className="text-[9px] text-gray-500">+{u.matchedSignals.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-300 transition hover:bg-violet-500/20"
                          onClick={() => onAuditUser(u.user.user_id ?? u.user.email ?? u.user.full_name)}
                        >
                          Full Audit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Audit Detail View ────────────────────────────────────────────────────────

function AuditDetailView({
  exchange, userId, onBack,
}: {
  exchange: Exchange
  userId: string
  onBack: () => void
}) {
  const [inputId, setInputId] = useState(userId)
  const [submittedId, setSubmittedId] = useState(userId)

  const q = useQuery<ExchangeAnalysisResult>({
    queryKey: ['audit', exchange.id, submittedId],
    queryFn: () => fetchExchangeAnalysis(exchange.id, submittedId || undefined),
    enabled: Boolean(exchange.id),
  })

  const data = q.data as ExchangeAnalysisResult | undefined
  const verifiedCount = data?.fields.filter(f => f.verification_status === 'verified').length ?? 0
  const pendingCount = data?.fields.filter(f => f.verification_status === 'pending').length ?? 0
  const failedCount = data?.fields.filter(f => f.verification_status === 'failed').length ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost p-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="page-header">{exchange.name} — Full Audit</div>
          <div className="page-subheader">
            KYC verification, transaction history, wallet tracing, and compliance fields
          </div>
        </div>
      </div>

      {/* Subject input */}
      <div className="glass p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-64">
            <label className="mb-1 block text-xs text-gray-400">Subject — Email, wallet address, or user ID</label>
            <input className="input" placeholder="e.g. user@email.com or 0x742d35…"
              value={inputId} onChange={e => setInputId(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSubmittedId(inputId) }}
            />
          </div>
          <button type="button" className="btn-primary" onClick={() => setSubmittedId(inputId)} disabled={q.isFetching}>
            {q.isFetching ? <><RefreshCcw className="h-4 w-4 animate-spin" /> Loading…</> : <><ShieldCheck className="h-4 w-4" /> Run Audit</>}
          </button>
          {data && (
            <button type="button" className="btn-ghost" onClick={() => exportAuditHTML(data)}>
              <Download className="h-4 w-4" /> Export Report
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Verified', count: verifiedCount, color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20' },
            { label: 'Pending', count: pendingCount, color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-400/20' },
            { label: 'Failed / N/A', count: failedCount + (data.fields.length - verifiedCount - pendingCount - failedCount), color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-400/20' },
          ].map(s => (
            <div key={s.label} className={`glass rounded-2xl border p-4 text-center ${s.bg} ${s.border}`}>
              <div className={`text-3xl font-black ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Fields table */}
      {q.isLoading ? (
        <div className="glass p-6 grid gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : data ? (
        <div className="glass overflow-hidden">
          <div className="border-b border-white/[0.07] px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-100">
              {data.exchange} · {data.userId} · {data.fields.length} fields
            </div>
            <div className="text-xs text-gray-500">Generated {new Date(data.generatedAt).toLocaleString()}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3 w-52">Field</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3 w-32">Status</th>
                  <th className="px-4 py-3 w-60">Evidence Source</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.fields.map((f, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-200 whitespace-nowrap">{f.field}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 max-w-[220px] truncate" title={f.value}>{f.value}</td>
                    <td className="px-4 py-3"><StatusBadge status={f.verification_status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{f.evidence_source}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{f.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ExchangeAnalyticsPage() {
  const [view, setView] = useState<View>('list')
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null)
  const [auditUserId, setAuditUserId] = useState('')
  const [search, setSearch] = useState('')

  const exchangesQ = useQuery<Exchange[]>({
    queryKey: ['exchanges'],
    queryFn: fetchExchanges,
  })
  const exchanges: Exchange[] = Array.isArray(exchangesQ.data) ? exchangesQ.data : []

  const selectExchange = useCallback((ex: Exchange) => {
    setSelectedExchange(ex)
    setView('ethiopians')
  }, [])

  const openAudit = useCallback((userId: string) => {
    setAuditUserId(userId)
    setView('audit')
  }, [])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-4">
        {/* Page header — only on list view */}
        {view === 'list' && (
          <div>
            <div className="page-header">Exchange Analytics</div>
            <div className="page-subheader">
              Click an exchange to automatically scan its users, detect Ethiopians, and run full KYC audits
            </div>
          </div>
        )}

        {view === 'list' && (
          <ExchangeListView
            exchanges={exchanges}
            loading={exchangesQ.isLoading}
            search={search}
            onSearch={setSearch}
            onSelect={selectExchange}
          />
        )}

        {view === 'ethiopians' && selectedExchange && (
          <EthiopianFilterView
            exchange={selectedExchange}
            onBack={() => setView('list')}
            onAuditUser={openAudit}
          />
        )}

        {view === 'audit' && selectedExchange && (
          <AuditDetailView
            exchange={selectedExchange}
            userId={auditUserId}
            onBack={() => setView('ethiopians')}
          />
        )}
      </div>
    </div>
  )
}
