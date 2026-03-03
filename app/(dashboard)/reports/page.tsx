'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Line,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLORS = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316']

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

const PRIORITY_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#94a3b8',
  Other: '#6b7280',
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent }: Readonly<{ label: string; value: string | number; sub?: string; accent?: string }>) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function NoData({ msg = 'No data yet' }: Readonly<{ msg?: string }>) {
  return (
    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">{msg}</div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: prsRaw } = useQuery({
    queryKey: ['all-prs-report'],
    queryFn: async () => {
      const r = await apiClient.get('/procurement/?page_size=500')
      return r.data.results ?? r.data ?? []
    },
  })

  const { data: vendorsRaw } = useQuery({
    queryKey: ['all-vendors-report'],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/?page_size=500&ordering=-total_spend')
      return r.data.results ?? r.data ?? []
    },
  })

  const { data: budgetsRaw } = useQuery({
    queryKey: ['all-budgets-report'],
    queryFn: async () => {
      const r = await apiClient.get('/budget/tracking-ids/?page_size=500')
      return r.data.results ?? r.data ?? []
    },
  })

  const prs: any[] = prsRaw ?? []
  const vendors: any[] = vendorsRaw ?? []
  const budgets: any[] = budgetsRaw ?? []

  // ── KPI values ──────────────────────────────────────────────────────────────

  const totalPRValue = useMemo(
    () => prs.reduce((s, pr) => s + Number.parseFloat(pr.total_amount || 0), 0),
    [prs],
  )
  const approvedPRs = useMemo(() => prs.filter(p => p.status === 'approved').length, [prs])
  const approvedVendors = useMemo(() => vendors.filter(v => v.status === 'approved').length, [vendors])
  const totalBudgetRequested = useMemo(
    () => budgets.reduce((s, b) => s + Number.parseFloat(b.requested_amount || 0), 0),
    [budgets],
  )
  const totalBudgetApproved = useMemo(
    () => budgets.filter(b => b.status === 'approved').reduce((s, b) => s + Number.parseFloat(b.approved_amount || 0), 0),
    [budgets],
  )

  // ── PR Status Pie ────────────────────────────────────────────────────────────

  const prStatusData = useMemo(() => {
    const map: Record<string, number> = {}
    prs.forEach(pr => { map[pr.status] = (map[pr.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [prs])

  // ── Vendor Status Pie ─────────────────────────────────────────────────────────

  const vendorStatusData = useMemo(() => {
    const map: Record<string, number> = {}
    vendors.forEach(v => { map[v.status] = (map[v.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [vendors])

  // ── Budget Status Pie ─────────────────────────────────────────────────────────

  const budgetStatusData = useMemo(() => {
    const map: Record<string, number> = {}
    budgets.forEach(b => { map[b.status] = (map[b.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [budgets])

  // ── Monthly PR Trend ──────────────────────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; count: number; value: number }> = {}
    prs.forEach(pr => {
      const d = new Date(pr.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2)
      if (!map[key]) map[key] = { month: label, count: 0, value: 0 }
      map[key].count++
      map[key].value += Number.parseFloat(pr.total_amount || 0)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [prs])

  // ── Top Vendors by Spend ───────────────────────────────────────────────────────

  const topVendors = useMemo(
    () =>
      vendors
        .filter(v => v.total_spend && Number.parseFloat(v.total_spend) > 0)
        .sort((a, b) => Number.parseFloat(b.total_spend) - Number.parseFloat(a.total_spend))
        .slice(0, 8)
        .map(v => ({
          name: v.company_name.length > 22 ? `${v.company_name.substring(0, 22)}…` : v.company_name,
          spend: Number.parseFloat(v.total_spend),
          contracts: v.contracts_count,
        })),
    [vendors],
  )

  // ── PR by Purchase Type ────────────────────────────────────────────────────────

  const prByTypeData = useMemo(() => {
    const types: Record<string, { count: number; value: number }> = {}
    prs.forEach(pr => {
      const t = pr.purchase_type || 'Other'
      if (!types[t]) types[t] = { count: 0, value: 0 }
      types[t].count++
      types[t].value += Number.parseFloat(pr.total_amount || 0)
    })
    return Object.entries(types).map(([name, v]) => ({ name, ...v }))
  }, [prs])

  // ── Vendor Category Distribution ───────────────────────────────────────────────

  const vendorCategoryData = useMemo(() => {
    const map: Record<string, number> = {}
    vendors.forEach(v => {
      const cat = v.category_name || 'Uncategorized'
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }))
  }, [vendors])

  // ── Budget by Priority ─────────────────────────────────────────────────────────

  const budgetPriorityData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    budgets.forEach(b => {
      const p = b.priority ? (b.priority.charAt(0).toUpperCase() + b.priority.slice(1)) : 'Other'
      if (!map[p]) map[p] = { count: 0, value: 0 }
      map[p].count++
      map[p].value += Number.parseFloat(b.requested_amount || 0)
    })
    return Object.entries(map).map(([name, v]) => ({ name, ...v }))
  }, [budgets])

  // ── PR Status by Value ─────────────────────────────────────────────────────────

  const prStatusValueData = useMemo(() => {
    const map: Record<string, number> = {}
    prs.forEach(pr => {
      map[pr.status] = (map[pr.status] || 0) + Number.parseFloat(pr.total_amount || 0)
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }))
  }, [prs])

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Total PRs"
          value={prs.length}
          sub={`${approvedPRs} approved`}
        />
        <KPICard
          label="Total PR Value"
          value={formatCurrency(totalPRValue)}
        />
        <KPICard
          label="Total Vendors"
          value={vendors.length}
          sub={`${approvedVendors} approved`}
        />
        <KPICard
          label="Budget Requests"
          value={budgets.length}
          sub={`${budgets.filter(b => b.status === 'approved').length} approved`}
        />
        <KPICard
          label="Budget Requested"
          value={formatCurrency(totalBudgetRequested)}
        />
        <KPICard
          label="Budget Approved"
          value={formatCurrency(totalBudgetApproved)}
          accent="text-green-700"
        />
      </div>

      {/* ── Status Distributions (3 pies) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">PR Status Distribution</CardTitle>
            <CardDescription>By count of purchase requisitions</CardDescription>
          </CardHeader>
          <CardContent>
            {prStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={prStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={72}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {prStatusData.map((entry, i) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vendor Status Distribution</CardTitle>
            <CardDescription>By count of vendors</CardDescription>
          </CardHeader>
          <CardContent>
            {vendorStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={vendorStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={72}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {vendorStatusData.map((entry, i) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Budget Status Distribution</CardTitle>
            <CardDescription>By count of tracking IDs</CardDescription>
          </CardHeader>
          <CardContent>
            {budgetStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={budgetStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={72}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {budgetStatusData.map((entry, i) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly PR Trend ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly PR Trend</CardTitle>
          <CardDescription>Purchase requisitions created per month — count (bars) and total value (line)</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  yAxisId="value"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => formatCurrency(v)}
                  width={90}
                />
                <Tooltip
                  formatter={(v: any, name: string) =>
                    name === 'Total Value' ? [formatCurrency(Number(v)), name] : [v, name]
                  }
                />
                <Legend />
                <Bar yAxisId="count" dataKey="count" name="PR Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="value"
                  type="monotone"
                  dataKey="value"
                  name="Total Value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <NoData msg="No PRs found yet" />}
        </CardContent>
      </Card>

      {/* ── Top Vendors by Spend + PR by Type ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Vendors by Spend</CardTitle>
            <CardDescription>Total value of approved contracts</CardDescription>
          </CardHeader>
          <CardContent>
            {topVendors.length > 0 ? (
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={topVendors} layout="vertical" margin={{ left: 8, right: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatCurrency(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Total Spend']} />
                  <Bar dataKey="spend" name="Total Spend" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData msg="No vendor spend data yet" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">PR by Purchase Type</CardTitle>
            <CardDescription>Count and total value per type (CAPEX / OPEX / Other)</CardDescription>
          </CardHeader>
          <CardContent>
            {prByTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={prByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    yAxisId="value"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    tickFormatter={v => formatCurrency(v)}
                    width={90}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) =>
                      name === 'Value' ? [formatCurrency(Number(v)), name] : [v, name]
                    }
                  />
                  <Legend />
                  <Bar yAxisId="count" dataKey="count" name="Count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="value" dataKey="value" name="Value" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </CardContent>
        </Card>
      </div>

      {/* ── PR Value by Status ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">PR Value by Status</CardTitle>
          <CardDescription>Total monetary value of purchase requisitions grouped by current status</CardDescription>
        </CardHeader>
        <CardContent>
          {prStatusValueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={prStatusValueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v)} width={90} />
                <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Total Value']} />
                <Bar dataKey="value" name="Total Value" radius={[4, 4, 0, 0]}>
                  {prStatusValueData.map((entry, i) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </CardContent>
      </Card>

      {/* ── Vendor Category + Budget by Priority ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vendor Category Breakdown</CardTitle>
            <CardDescription>Number of vendors per category</CardDescription>
          </CardHeader>
          <CardContent>
            {vendorCategoryData.length === 0 && <NoData />}
            {vendorCategoryData.length > 0 && vendorCategoryData.length <= 6 && (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={vendorCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                    {vendorCategoryData.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            {vendorCategoryData.length > 6 && (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={vendorCategoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" name="Vendors" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Budget Requests by Priority</CardTitle>
            <CardDescription>Count and requested amount by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {budgetPriorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={budgetPriorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    yAxisId="value"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    tickFormatter={v => formatCurrency(v)}
                    width={90}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) =>
                      name === 'Requested' ? [formatCurrency(Number(v)), name] : [v, name]
                    }
                  />
                  <Legend />
                  <Bar yAxisId="count" dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {budgetPriorityData.map((entry, i) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="value"
                    type="monotone"
                    dataKey="value"
                    name="Requested"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
