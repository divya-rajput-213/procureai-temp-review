'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShoppingCart, TrendingUp,
  ArrowRight, FileText, Truck, Package,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import Link from 'next/link'

const CHART_COLORS = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', pending_approval: '#f59e0b', approved: '#10b981',
  rejected: '#ef4444', cancelled: '#6b7280', vendor_selected: '#3b82f6',
  sent_to_vendor: '#6366f1', acknowledged: '#06b6d4',
  partially_received: '#f59e0b', fully_received: '#10b981',
  closed: '#64748b', matched: '#14b8a6', paid: '#059669',
  disputed: '#f97316', submitted: '#3b82f6',
}

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

function StatCard({ title, value, subtitle, icon: Icon, color, href }: {
  title: string; value: string | number; subtitle: string; icon: any; color: string; href?: string
}) {
  const content = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function formatYAxis(v: number): string {
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return String(v)
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('month')

  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics', dateRange],
    queryFn: async () => (await apiClient.get(`/core/dashboard/?range=${dateRange}`)).data,
    staleTime: 60_000,
  })

  const { data: recentPOs } = useQuery({
    queryKey: ['recent-pos', dateRange],
    queryFn: async () => {
      const r = await apiClient.get('/purchase-orders/?page_size=5')
      return r.data.results ?? r.data
    },
  })

  const { data: recentPRs } = useQuery({
    queryKey: ['recent-prs', dateRange],
    queryFn: async () => {
      const r = await apiClient.get('/procurement/?ordering=-created_at&page_size=5')
      return r.data.results ?? r.data
    },
  })

  const stats = analytics?.stats
  const poStats = analytics?.po_stats || {}
  const invStats = analytics?.invoice_stats || {}
  const monthlySpend: any[] = analytics?.monthly_spend ?? []
  const topVendors: any[] = analytics?.top_vendors ?? []
  const recentActivity: any[] = analytics?.recent_activity ?? []

  // PO status pie data
  const poStatusData = useMemo(() => {
    if (!poStats.by_status) return []
    return Object.entries(poStats.by_status).map(([name, value]) => ({ name, value: value as number }))
  }, [poStats])

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {DATE_RANGES.map(r => (
            <Button key={r.value} size="sm" variant={dateRange === r.value ? 'default' : 'ghost'}
              className="h-7 text-xs px-3" onClick={() => setDateRange(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="PRs Created" value={stats?.pr_count ?? '—'}
          subtitle={formatCurrency(stats?.pr_total || 0)}
          icon={ShoppingCart} color="bg-blue-600" href="/procurement" />
        <StatCard title="Purchase Orders" value={stats?.po_count ?? poStats.total ?? 0}
          subtitle={formatCurrency(stats?.po_total || poStats.total_value || 0)}
          icon={Package} color="bg-indigo-600" href="/purchase-orders" />
        <StatCard title="GRN Pending" value={poStats.grn_pending || 0}
          subtitle="Awaiting goods receipt"
          icon={Truck} color="bg-cyan-600" href="/purchase-orders" />
        <StatCard title="Invoices" value={invStats.total || 0}
          subtitle={invStats.overdue ? `${invStats.overdue} overdue` : `${invStats.paid || 0} paid`}
          icon={FileText} color="bg-teal-600" href="/invoices" />
        <StatCard title="Vendors" value={stats?.approved_vendors ?? '—'}
          subtitle="Approved & active"
          icon={ShoppingCart} color="bg-green-600" href="/vendors" />
        <StatCard title="Budget Used" value={stats ? `${stats.budget_utilization_pct}%` : '—'}
          subtitle={stats ? `${formatCurrency(stats.total_consumed)} of ${formatCurrency(stats.total_budget_approved)}` : '—'}
          icon={TrendingUp} color="bg-purple-600" href="/budget" />
      </div>

      {/* Row 2 — Spend chart + PO status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spend vs Budget</CardTitle>
            <CardDescription>Monthly procurement spend — last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlySpend.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={monthlySpend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} width={45} />
                  <Tooltip formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]} />
                  <Bar dataKey="budget" name="Budget" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.3} />
                  <Line type="monotone" dataKey="spend" name="Spend" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">PO Status</CardTitle>
            <CardDescription>Purchase orders by status</CardDescription>
          </CardHeader>
          <CardContent>
            {poStatusData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={poStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={35} outerRadius={60} paddingAngle={2}>
                      {poStatusData.map((e, i) => (
                        <Cell key={e.name} fill={STATUS_COLORS[e.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {poStatusData.map((e, i) => (
                    <div key={e.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[e.name] ?? CHART_COLORS[i] }} />
                        <span className="text-muted-foreground capitalize">{e.name.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="font-semibold">{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No POs yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Recent POs + Recent PRs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
              <Link href="/purchase-orders" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!recentPOs || recentPOs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No purchase orders yet.</p>
            ) : (
              <div className="divide-y">
                {recentPOs.map((po: any) => (
                  <Link key={po.hash_id ?? po.id} href={`/purchase-orders/${po.hash_id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{po.po_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{po.vendor_name}</p>
                    </div>
                    <div className="shrink-0 text-right flex items-center gap-2">
                      <StatusBadge status={po.status} />
                      <span className="text-sm font-semibold">{formatCurrency(po.total_amount)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Purchase Requisitions</CardTitle>
              <Link href="/procurement" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!recentPRs || recentPRs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No purchase requisitions yet.</p>
            ) : (
              <div className="divide-y">
                {recentPRs.map((pr: any) => (
                  <Link key={pr.hash_id ?? pr.id} href={`/procurement/${pr.hash_id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pr.pr_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{pr.description}</p>
                    </div>
                    <div className="shrink-0 text-right flex items-center gap-2">
                      <StatusBadge status={pr.status} />
                      <span className="text-sm font-semibold">{formatCurrency(pr.total_amount)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — Top Vendors + Invoice summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top Vendors by Spend</CardTitle>
              <Link href="/vendors" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                All vendors <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topVendors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No spend data yet.</p>
            ) : (
              <div className="space-y-3">
                {topVendors.slice(0, 5).map((v, idx) => {
                  const maxSpend = topVendors[0]?.total_spend || 1
                  const pct = (v.total_spend / maxSpend) * 100
                  return (
                    <Link key={v.vendor_id} href={`/vendors/${v.vendor_id}`} className="block group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}</span>
                          <span className="text-sm font-medium truncate group-hover:text-primary">{v.vendor_name}</span>
                        </div>
                        <span className="text-sm font-semibold shrink-0">{formatCurrency(v.total_spend)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Invoice Summary</CardTitle>
              <Link href="/invoices" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                All invoices <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{invStats.pending_match || 0}</p>
                <p className="text-xs text-blue-600">Pending Match</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-teal-700">{invStats.matched || 0}</p>
                <p className="text-xs text-teal-600">Matched</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{invStats.paid || 0}</p>
                <p className="text-xs text-green-600">Paid</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${(invStats.overdue || 0) > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${(invStats.overdue || 0) > 0 ? 'text-red-700' : 'text-slate-400'}`}>{invStats.overdue || 0}</p>
                <p className={`text-xs ${(invStats.overdue || 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>Overdue</p>
              </div>
            </div>
            {(invStats.total_value || 0) > 0 && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Invoice Value</span>
                <span className="text-sm font-bold">{formatCurrency(invStats.total_value)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 5 — Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest events across the platform</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentActivity.slice(0, 8).map((item, idx) => (
                <Link key={`${item.type}-${idx}`} href={item.href || '#'}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors">
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                    {item.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{item.title}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.amount != null && <span className="text-xs font-medium">{formatCurrency(item.amount)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
