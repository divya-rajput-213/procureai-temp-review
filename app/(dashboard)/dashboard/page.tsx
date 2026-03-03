'use client'

import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Building2, CheckSquare, TrendingUp, AlertCircle, Wallet, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import Link from 'next/link'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string
  value: string | number
  subtitle: string
  icon: any
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Activity type config ─────────────────────────────────────────────────────
const ACTIVITY_CONFIG: Record<string, { label: string; color: string }> = {
  pr:     { label: 'PR',     color: 'bg-blue-100 text-blue-700' },
  vendor: { label: 'Vendor', color: 'bg-green-100 text-green-700' },
  budget: { label: 'Budget', color: 'bg-purple-100 text-purple-700' },
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  approved:  'success',
  active:    'success',
  draft:     'secondary',
  pending:   'warning',
  submitted: 'warning',
  rejected:  'destructive',
}

// ─── Y-axis tick formatter ────────────────────────────────────────────────────
function formatYAxis(v: number): string {
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return String(v)
}

// ─── Custom tooltip for the line chart ───────────────────────────────────────
function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const { data } = await apiClient.get('/approvals/requests/pending-mine/')
      return data as any[]
    },
  })

  const { data: recentPRs } = useQuery({
    queryKey: ['recent-prs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/?ordering=-created_at&page_size=10')
      return data.results || data
    },
  })

  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/core/dashboard/')
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const pendingCount = pendingApprovals?.length || 0
  const stats = analytics?.stats
  const monthlySpend: any[] = analytics?.monthly_spend ?? []
  const topVendors: any[] = analytics?.top_vendors ?? []
  const recentActivity: any[] = analytics?.recent_activity ?? []

  // Max spend for bar width calculation
  const maxSpend = topVendors.reduce((m, v) => Math.max(m, v.total_spend), 1)

  return (
    <div className="space-y-6">

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approvals"
          value={pendingCount}
          subtitle="Awaiting your action"
          icon={CheckSquare}
          color="bg-amber-500"
        />
        <StatCard
          title="Active PRs"
          value={recentPRs?.length || '—'}
          subtitle="This period"
          icon={ShoppingCart}
          color="bg-blue-600"
        />
        <StatCard
          title="Approved Vendors"
          value={stats?.approved_vendors ?? '—'}
          subtitle="On-boarded & active"
          icon={Building2}
          color="bg-green-600"
        />
        <StatCard
          title="Budget Utilised"
          value={stats ? `${stats.budget_utilization_pct}%` : '—'}
          subtitle={stats ? `${formatCurrency(stats.total_consumed)} of ${formatCurrency(stats.total_budget_approved)}` : 'vs. approved budget'}
          icon={TrendingUp}
          color="bg-purple-600"
        />
      </div>

      {/* ── Pending approvals alert ─────────────────────────────────────────── */}
      {/* {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                You have {pendingCount} item{pendingCount === 1 ? '' : 's'} awaiting your approval.
              </p>
              <Link href="/approvals" className="text-xs text-amber-700 underline">
                View approvals →
              </Link>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* ── Spend vs Budget chart ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend vs Budget</CardTitle>
          <CardDescription>Monthly procurement spend analysis — last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlySpend.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              No spend data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlySpend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  width={48}
                />
                <Tooltip content={<SpendTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="budget"
                  name="Budget"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  name="Spend"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom two-column section ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription className="mt-0.5">Latest events across PRs, vendors &amp; budget</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity.</p>
            ) : (
              <div className="divide-y">
                {recentActivity.map((item) => {
                  const cfg = ACTIVITY_CONFIG[item.type] ?? { label: item.type, color: 'bg-slate-100 text-slate-700' }
                  const statusVariant = STATUS_VARIANT[item.status] ?? 'secondary'
                  return (
                    <Link
                      key={`${item.type}-${item.timestamp}`}
                      href={item.href}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <Badge variant={statusVariant} className="text-[10px]">{item.status}</Badge>
                        {item.amount != null && (
                          <p className="text-xs font-medium">{formatCurrency(item.amount)}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vendors by Spend */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Top Vendors by Spend</CardTitle>
                <CardDescription className="mt-0.5">Vendors with highest procurement value</CardDescription>
              </div>
              <Link href="/vendors" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                All vendors <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topVendors.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Wallet className="w-8 h-8 text-muted-foreground/40" />
                No spend data yet. Assign vendors to purchase requisitions to see rankings.
              </div>
            ) : (
              <div className="space-y-3">
                {topVendors.map((v, idx) => {
                  const barPct = maxSpend > 0 ? (v.total_spend / maxSpend) * 100 : 0
                  return (
                    <Link key={v.vendor_id} href={`/vendors/${v.vendor_id}`} className="group block">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {v.vendor_name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right ml-3">
                          <p className="text-sm font-semibold">{formatCurrency(v.total_spend)}</p>
                          <p className="text-[10px] text-muted-foreground">{v.pr_count} PR{v.pr_count === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full transition-all"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent PRs ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Purchase Requisitions</CardTitle>
              <CardDescription>Latest PR activity across all departments</CardDescription>
            </div>
            <Link href="/procurement" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              All PRs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!recentPRs || recentPRs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No purchase requisitions found.</p>
          ) : (
            <div className="divide-y">
              {recentPRs.slice(0, 10).map((pr: any) => (
                <Link key={pr.id} href={`/procurement/${pr.id}`} className="py-3 flex items-center justify-between gap-4 hover:bg-muted/40 -mx-2 px-2 rounded transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{pr.pr_number}</span>
                      <Badge variant={pr.purchase_type === 'CAPEX' ? 'info' : 'secondary'} className="text-xs">
                        {pr.purchase_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pr.vendor_name} · {pr.plant_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(pr.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(pr.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
