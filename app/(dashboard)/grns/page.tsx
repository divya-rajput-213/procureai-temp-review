'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Package, Search, Loader2, Eye, Receipt, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import apiClient from '@/lib/api/client'

type Grn = {
  id: number
  hash_id?: string
  grn_number: string
  po: number
  po_number: string
  received_by: number | null
  received_by_name: string | null
  received_at: string
  warehouse: string
  challan_number: string
  challan_date: string | null
  line_items: any[]
}

function conditionBadge(grn: Grn) {
  const total = grn.line_items?.length || 0
  if (total === 0) return <Badge variant="secondary">No items</Badge>
  const rejected = grn.line_items.reduce((s, l) => s + (Number(l.rejected_qty) || 0), 0)
  const accepted = grn.line_items.reduce((s, l) => s + (Number(l.accepted_qty) || 0), 0)
  if (rejected === 0) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Good</Badge>
  if (accepted === 0) return <Badge variant="destructive">Rejected</Badge>
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partial</Badge>
}

function statusFor(grn: Grn) {
  const total = grn.line_items?.length || 0
  if (total === 0) return { label: 'Empty', cls: 'bg-slate-100 text-slate-700' }
  const accepted = grn.line_items.reduce((s, l) => s + (Number(l.accepted_qty) || 0), 0)
  const received = grn.line_items.reduce((s, l) => s + (Number(l.received_qty) || 0), 0)
  if (accepted === received) return { label: 'Full Receipt', cls: 'bg-teal-100 text-teal-800' }
  if (accepted === 0) return { label: 'All Rejected', cls: 'bg-red-100 text-red-700' }
  return { label: 'Partial Received', cls: 'bg-amber-100 text-amber-800' }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GrnListPage() {
  const [search, setSearch] = useState('')

  const { data: grns, isLoading } = useQuery({
    queryKey: ['grns', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const { data } = await apiClient.get(`/grns/?${params}`)
      return (data.results || data) as Grn[]
    },
    staleTime: 0,
  })

  const stats = useMemo(() => {
    const list = grns || []
    let full = 0, partial = 0, rejected = 0
    for (const g of list) {
      const total = g.line_items?.length || 0
      if (total === 0) continue
      const accepted = g.line_items.reduce((s, l) => s + (Number(l.accepted_qty) || 0), 0)
      const received = g.line_items.reduce((s, l) => s + (Number(l.received_qty) || 0), 0)
      if (accepted === 0) rejected += 1
      else if (accepted === received) full += 1
      else partial += 1
    }
    return { total: list.length, full, partial, rejected }
  }, [grns])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Goods Receipt Notes</h1>
            <p className="text-sm text-muted-foreground">What was physically delivered — drives 3-way matching</p>
          </div>
        </div>
        <Link href="/grns/new">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Record GRN
          </Button>
        </Link>
      </div>

      {/* Stat strip */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-slate-900 text-white hover:bg-slate-900">{stats.total} Total</Badge>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{stats.full} Full Receipt</Badge>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{stats.partial} Partial</Badge>
          <Badge variant="destructive">{stats.rejected} Rejected</Badge>
        </CardContent>
      </Card>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search GRN no., PO, vendor, challan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">GRN Number</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">PO Reference</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Received By</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Items</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Condition</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Challan</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline-block" />
                  </td></tr>
                )}
                {!isLoading && (grns || []).length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No GRNs recorded yet. Open a PO and record a Goods Receipt to get started.
                  </td></tr>
                )}
                {(grns || []).map((g) => {
                  const items = g.line_items?.length || 0
                  const accepted = (g.line_items || []).reduce((s, l) => s + (Number(l.accepted_qty) || 0), 0)
                  const received = (g.line_items || []).reduce((s, l) => s + (Number(l.received_qty) || 0), 0)
                  const status = statusFor(g)
                  return (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-green-700 font-semibold">{g.grn_number}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{g.po_number}</td>
                      <td className="px-4 py-3">{g.received_by_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{received || items}</span>
                        {received > 0 && accepted !== received && (
                          <span className="text-xs text-muted-foreground ml-1">({accepted} accepted)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{conditionBadge(g)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{g.challan_number || '—'}</td>
                      <td className="px-4 py-3 text-xs">{fmtDate(g.received_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Link href={`/purchase-orders/${g.po}`}>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <Eye className="w-3.5 h-3.5" /> PO
                            </Button>
                          </Link>
                          <Link href={`/invoices/new?po=${g.po}&grn=${g.id}`}>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <Receipt className="w-3.5 h-3.5" /> Invoice
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
