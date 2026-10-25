import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAddressCrossChain } from '../lib/endpoints'
import {
  ArrowLeftRight,
  GitMerge,
  PieChart,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Layers,
  ArrowRight,
  Activity,
  Zap,
} from 'lucide-react'
import { ResponsiveContainer, PieChart as RPie, Pie, Cell, Tooltip, Sankey } from 'recharts'
import { Skeleton } from './Skeleton'
import { explorerTxUrl } from '../lib/explorers'

type Props = { address: string }

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6']

const CHAIN_SYMBOLS: Record<string, string> = {
  ethereum: 'ETH',
  bsc: 'BNB',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  optimism: 'ETH',
  avalanche: 'AVAX',
  base: 'ETH',
  gnosis: 'xDAI',
  fantom: 'FTM',
  bitcoin: 'BTC',
  solana: 'SOL',
}

export function CrossChainPanel({ address }: Props) {
  const [chainFilter, setChainFilter] = useState<string>('all')
  const q = useQuery({
    queryKey: ['cross-chain', address],
    queryFn: () => fetchAddressCrossChain(address),
    enabled: Boolean(address),
  })

  const data = (q.data ?? {}) as any
  const balances = useMemo(() => (Array.isArray(data?.balances) ? data.balances : []), [data?.balances])
  const bridges = useMemo(() => (Array.isArray(data?.bridges) ? data.bridges : []), [data?.bridges])
  const flows = useMemo(() => (data?.flows ?? null) as any, [data?.flows])
  const summary = useMemo(() => (data?.summary ?? {}) as any, [data?.summary])

  const pie = useMemo(
    () =>
      balances
        .filter((b: any) => chainFilter === 'all' || b.chain === chainFilter)
        .map((b: any) => ({
          name: b.chain.toUpperCase(),
          chain: b.chain,
          value: Number(b.value ?? 0),
        })),
    [balances, chainFilter],
  )

  const activeChainsCount = balances.filter((b: any) => Number(b.value || 0) > 0 || Number(b.txCount || 0) > 0).length || balances.length

  const hasFlowLinks = Boolean(flows?.nodes?.length > 0 && flows?.links?.length > 0)

  const getRiskBadge = (risk: string) => {
    switch ((risk || '').toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
            <ShieldAlert className="h-3.5 w-3.5" /> CRITICAL (Rapid Hop / Exploit)
          </span>
        )
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
            <ShieldAlert className="h-3.5 w-3.5" /> HIGH (Active Bridge User)
          </span>
        )
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
            <Activity className="h-3.5 w-3.5" /> MEDIUM (Multi-Chain Presence)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> LOW (Single Chain / Dormant)
          </span>
        )
    }
  }

  return (
    <div className="grid gap-4">
      {/* Header & Filter */}
      <div className="glass glass-hover p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-gray-100">
              <ArrowLeftRight className="h-5 w-5 text-violet-400" />
              Cross-Chain Intelligence & Bridge Tracker
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Real-time multi-chain balance discovery, cross-chain hop detection, and bridge protocol tracking.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-[#0B0B0B] px-3 text-xs text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
            >
              <option value="all">All chains</option>
              {balances.map((b: any) => (
                <option key={b.chain} value={b.chain}>
                  {b.chain.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Verified Entity Intelligence Banner */}
      {summary?.title && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4 sm:p-5 text-gray-200">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/20 p-2.5 text-violet-300">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-violet-200">{summary.title}</span>
                <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                  Verified Cross-Chain Profile
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{summary.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="glass p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <Layers className="h-3.5 w-3.5 text-violet-400" /> Active Chains
          </div>
          <div className="mt-2 text-xl font-bold text-gray-100">
            {q.isLoading ? <Skeleton className="h-7 w-12" /> : `${activeChainsCount} Chains`}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Multi-chain activity footprint</div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <GitMerge className="h-3.5 w-3.5 text-emerald-400" /> Bridge Events
          </div>
          <div className="mt-2 text-xl font-bold text-gray-100">
            {q.isLoading ? <Skeleton className="h-7 w-12" /> : `${bridges.length} Detected`}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Cross-chain bridge interactions</div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <Activity className="h-3.5 w-3.5 text-blue-400" /> Primary Network
          </div>
          <div className="mt-2 text-xl font-bold text-gray-100 capitalize">
            {q.isLoading ? <Skeleton className="h-7 w-20" /> : summary?.primaryChain || 'Ethereum'}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Highest volume chain</div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" /> Hop Risk Status
          </div>
          <div className="mt-2">
            {q.isLoading ? <Skeleton className="h-7 w-24" /> : getRiskBadge(summary?.hopRiskLevel)}
          </div>
        </div>
      </div>

      {/* Main Grid: Balance Summary & Bridge Usage */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Balance Breakdown Chart */}
        <div className="glass p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
              <PieChart className="h-4 w-4 text-violet-400" />
              Cross-Chain Balance Breakdown
            </div>
            <span className="text-xs text-gray-400">Native holdings</span>
          </div>

          <div className="mt-4 h-60">
            {q.isLoading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : pie.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-gray-400">
                No active balances found across queried chains.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RPie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(10, 10, 10, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 12,
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      `${val} ${CHAIN_SYMBOLS[String(name).toLowerCase()] || ''}`,
                      name,
                    ]}
                  />
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                    {pie.map((_x: unknown, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </RPie>
              </ResponsiveContainer>
            )}
          </div>

          {/* Balance Badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {balances.map((b: any, idx: number) => (
              <div
                key={b.chain}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-200"
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="font-semibold uppercase">{b.chain}:</span>
                <span>
                  {b.value} {CHAIN_SYMBOLS[b.chain] || 'ETH'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bridge Usage Events */}
        <div className="glass p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
              <GitMerge className="h-4 w-4 text-emerald-400" />
              Bridge & Cross-Chain Interactions ({bridges.length})
            </div>
            <span className="text-xs text-gray-400">Chronological</span>
          </div>

          <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
            {q.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : bridges.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-400">
                <GitMerge className="mb-2 h-8 w-8 text-gray-600" />
                No cross-chain bridge events detected on public logs for this address.
              </div>
            ) : (
              bridges.map((b: any, idx: number) => (
                <div
                  key={b.id ?? idx}
                  className="glass glass-hover rounded-xl border border-white/10 bg-white/[0.02] p-3.5 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-100">{b.bridge ?? 'Cross-Chain Bridge'}</span>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                          {b.status ?? 'Completed'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-300">
                        <span className="rounded bg-white/10 px-2 py-0.5 uppercase font-medium text-violet-300">
                          {b.sourceChain}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                        <span className="rounded bg-white/10 px-2 py-0.5 uppercase font-medium text-emerald-300">
                          {b.destinationChain}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="font-semibold text-white">
                          {b.amount} {b.asset || ''}
                        </span>
                      </div>
                    </div>

                    {b.txHash && (
                      <a
                        href={explorerTxUrl(b.sourceChain, b.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                        title="View Bridge Transaction on Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {b.details && <p className="mt-2 text-[11px] text-gray-400 leading-normal">{b.details}</p>}

                  <div className="mt-2 text-[10px] text-gray-500">
                    {b.date ? new Date(b.date).toLocaleString() : '—'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Cross-Chain Flow (Sankey Diagram & Hop Visualizer) */}
      <div className="glass p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
              <ArrowLeftRight className="h-4 w-4 text-violet-400" />
              Cross-Chain Fund Movement Flow
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Directed visual flow graph of asset movement and bridges across networks.
            </div>
          </div>
          {hasFlowLinks && (
            <span className="rounded-md bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 border border-violet-500/20">
              {flows.links.length} Connected Flow Paths
            </span>
          )}
        </div>

        <div className="mt-4 h-72">
          {q.isLoading ? (
            <Skeleton className="h-full w-full rounded-2xl" />
          ) : hasFlowLinks ? (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={flows}
                nodePadding={40}
                nodeWidth={14}
                linkCurvature={0.45}
                iterations={64}
                node={{ stroke: '#8b5cf6', strokeWidth: 1 }}
                link={{ stroke: 'rgba(139, 92, 246, 0.45)' }}
              />
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-gray-400">
              <ArrowLeftRight className="mb-2 h-8 w-8 text-gray-600" />
              <span>No multi-chain movement flows available yet.</span>
              <span className="mt-1 text-xs text-gray-500">
                Single chain wallet holding funds on {summary?.primaryChain || 'one network'}.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


