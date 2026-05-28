'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  GitCompare, Search, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

type MatchView = 'all' | 'matched' | 'variance' | 'blocked' | 'not_run'

const VIEWS: { key: MatchView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'matched', label: 'Matched' },
  { key: 'variance', label: 'Variance' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'not_run', label: 'Not Run' },
]

function classify(inv: any): MatchView {
  const m = inv.match_status
  if (!m) return 'not_run'
  if (inv.status === 'disputed' || inv.status === 'on_hold') return 'blocked'
  if (m.is_within_tolerance) return 'matched'
  return 'variance'
}

function variance(inv: any): number {
  const po = Number(inv.po_total_amount ?? 0)
  const total = Number(inv.total_amount ?? 0)
  if (!po) return 0
  return total - po
}

export default function MatchingDashboardPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<MatchView>('all')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['matching-invoices', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const { data } = await apiClient.get(`/invoices/?${params}`)
      const list: any[] = data.results || data
      // Only invoices that have a PO linked — matching is meaningful for those
      return list.filter((i) => i.po)
    },
    staleTime: 0,
  })

  const stats = useMemo(() => {
    const list = invoices || []
    const byView: Record<MatchView, number> = { all: list.length, matched: 0, variance: 0, blocked: 0, not_run: 0 }
    let totalValue = 0
    let pendingValue = 0
    for (const inv of list) {
      const c = classify(inv)
      byView[c] += 1
      totalValue += Number(inv.total_amount ?? 0)
      if (c !== 'matched') pendingValue += Number(inv.total_amount ?? 0)
    }
    return { ...byView, totalValue, pendingValue }
  }, [invoices])

  const filtered = useMemo(() => {
    if (!invoices) return []
    if (view === 'all') return invoices
    return invoices.filter((i: any) => classify(i) === view)
  }, [invoices, view])

  const runMatchMutation = useMutation({
    mutationFn: async (hashId: string) => {
      const { data } = await apiClient.post(`/invoices/${hashId}/match/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-invoices'] })
      toast({ title: '3-way matching complete' })
    },
    onError: (err: any) =>
      toast({ title: err?.response?.data?.error ?? 'Matching failed', variant: 'destructive' }),
  })

  const verdictBadge = (inv: any) => {
    const c = classify(inv)
    if (c === 'matched') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Matched</Badge>
    if (c === 'variance') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Variance</Badge>
    if (c === 'blocked') return <Badge variant="destructive">Blocked</Badge>
    return <Badge variant="secondary">Not Run</Badge>
  }

  const verdictIcon = (inv: any) => {
    const c = classify(inv)
    if (c === 'matched') return <CheckCircle2 className="w-4 h-4 text-green-500" />
    if (c === 'variance') return <AlertTriangle className="w-4 h-4 text-amber-500" />
    if (c === 'blocked') return <XCircle className="w-4 h-4 text-red-500" />
    return <span className="w-4 h-4 inline-block rounded-full border border-muted-foreground" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">3-Way Matching</h1>
            <p className="text-sm text-muted-foreground">Finance verification: Purchase Order × Goods Receipt × Invoice</p>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mr-2">Invoices</span>
          <Badge className="bg-slate-900 text-white hover:bg-slate-900">{stats.all} Total</Badge>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{stats.matched} Matched</Badge>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{stats.variance} Variance</Badge>
          <Badge variant="destructive">{stats.blocked} Blocked</Badge>
          <Badge variant="secondary">{stats.not_run} Not Run</Badge>
          <div className="w-px h-5 bg-border mx-2" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mr-2">Value</span>
          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">{formatCurrency(stats.totalValue)}</Badge>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{formatCurrency(stats.pendingValue)} Pending</Badge>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search invoice no., vendor, PO…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 border rounded-md p-1 bg-background">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`px-3 py-1 text-xs font-medium rounded ${view === v.key ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-slate-100'}`}
            >
              {v.label} <span className="ml-1 opacity-70">({stats[v.key]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Invoice</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">PO</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">GRN</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Invoice</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">PO Value</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Variance</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Verdict</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline-block" />
                  </td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No invoices in this view.
                  </td></tr>
                )}
                {filtered.map((inv: any) => {
                  const v = variance(inv)
                  return (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {verdictIcon(inv)}
                          <div>
                            <p className="font-medium font-mono text-xs">{inv.internal_ref}</p>
                            <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{inv.vendor_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{inv.po_number ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-green-700">{inv.grn_number ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {inv.po_total_amount ? formatCurrency(inv.po_total_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={v > 0 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                            {v > 0 ? '+' : ''}{formatCurrency(v)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{verdictBadge(inv)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runMatchMutation.mutate(inv.hash_id ?? inv.id)}
                            disabled={runMatchMutation.isPending}
                            className="gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {classify(inv) === 'not_run' ? 'Run' : 'Re-run'}
                          </Button>
                          <Link href={`/invoices/${inv.hash_id ?? inv.id}`}>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <Eye className="w-3.5 h-3.5" /> View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
