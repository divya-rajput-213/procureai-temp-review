'use client'

import { useMemo } from 'react'
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
  PieChart,
  Pie,
  Cell,
  Bar,
  ComposedChart,
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

// ─── Chart colors ────────────────────────────────────────────────────────────
const CHART_COLORS = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316']

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending_approval: '#f59e0b',
  pending_finance: '#f97316',
  approved: '#10b981',
  rejected: '#ef4444',
  cancelled: '#6b7280',
  vendor_selected: '#3b82f6',
  synced_to_sap: '#8b5cf6',
  po_created: '#1e3a5f',
  blocked: '#dc2626',
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

  const { data: allPRs } = useQuery({
    queryKey: ['all-prs-dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/?page_size=500')
      return (data.results ?? data ?? []) as any[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: allBudgets } = useQuery({
    queryKey: ['all-budgets-dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/budget/tracking-ids/?page_size=500')
      return (data.results ?? data ?? []) as any[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const pendingCount = pendingApprovals?.length || 0
  const stats = analytics?.stats
  const monthlySpend: any[] = analytics?.monthly_spend ?? []
  const topVendors: any[] = analytics?.top_vendors ?? []
  const recentActivity: any[] = analytics?.recent_activity ?? []

  // Max spend for bar width calculation
  const maxSpend = topVendors.reduce((m, v) => Math.max(m, v.total_spend), 1)

  // ── Report data ──
  const prs = allPRs ?? []
  const budgets = allBudgets ?? []

  const prStatusData = useMemo(() => {
    const map: Record<string, number> = {}
    prs.forEach((pr: any) => { map[pr.status] = (map[pr.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [prs])

  const budgetStatusData = useMemo(() => {
    const map: Record<string, number> = {}
    budgets.forEach((b: any) => { map[b.status] = (map[b.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [budgets])

  const monthlyPRData = useMemo(() => {
    const map: Record<string, { month: string; count: number; value: number }> = {}
    prs.forEach((pr: any) => {
      const d = new Date(pr.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2)
      if (!map[key]) map[key] = { month: label, count: 0, value: 0 }
      map[key].count++
      map[key].value += Number.parseFloat(pr.total_amount || 0)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [prs])

  const prTotal = prStatusData.reduce((s, d) => s + d.value, 0)
  const budgetTotal = budgetStatusData.reduce((s, d) => s + d.value, 0)

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

      {/* ── Status Distributions (donut + legend) ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">PR Status Distribution</CardTitle>
            <CardDescription>Purchase requisitions by status</CardDescription>
          </CardHeader>
          <CardContent>
            {prStatusData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={prStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {prStatusData.map((entry, i) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {prStatusData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground capitalize">{entry.name.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{entry.value}</span>
                        <span className="text-muted-foreground w-8 text-right">{prTotal > 0 ? `${Math.round((entry.value / prTotal) * 100)}%` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Budget Status Distribution</CardTitle>
            <CardDescription>Tracking IDs by status</CardDescription>
          </CardHeader>
          <CardContent>
            {budgetStatusData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={budgetStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {budgetStatusData.map((entry, i) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {budgetStatusData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground capitalize">{entry.name.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{entry.value}</span>
                        <span className="text-muted-foreground w-8 text-right">{budgetTotal > 0 ? `${Math.round((entry.value / budgetTotal) * 100)}%` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly PR Trend ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly PR Trend</CardTitle>
          <CardDescription>Count and total value per month</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyPRData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={monthlyPRData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="value" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => formatCurrency(v)} width={90} />
                <Tooltip formatter={(v: any, name: string) => name === 'Total Value' ? [formatCurrency(Number(v)), name] : [v, name]} />
                <Legend />
                <Bar yAxisId="count" dataKey="count" name="PR Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="value" type="monotone" dataKey="value" name="Total Value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[230px] text-sm text-muted-foreground">No PRs found yet</div>
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
                <Link key={pr.hash_id ?? pr.id} href={`/procurement/${pr.hash_id}`} className="py-3 flex items-center justify-between gap-4 hover:bg-muted/40 -mx-2 px-2 rounded transition-colors">
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
