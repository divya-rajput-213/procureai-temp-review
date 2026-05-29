'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Trash2, Loader2, Package, Receipt, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { CommonConfirmModal } from '@/components/shared/CommonModal'
import { formatCurrency, formatDate, PAGE_SIZE } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { SortableTh } from '@/components/shared/SortableTh'

type SortDir = 'asc' | 'desc'
type SortField = 'po_number' | 'vendor_name' | 'total_amount' | 'status' | 'created_at' | 'earliest_delivery_date'

const PO_TYPES = [
  { value: 'NB', label: 'Standard' },
  { value: 'FO', label: 'Blanket/Framework' },
  { value: 'RO', label: 'Release Order' },
  { value: 'SV', label: 'Service' },
  { value: 'ZT', label: 'Tooling/Capex' },
  { value: 'IM', label: 'Import' },
  { value: 'SC', label: 'Subcontract' },
]

const PO_TYPE_MAP: Record<string, string> = {
  NB: 'Standard', FO: 'Blanket', RO: 'Release', SV: 'Service',
  ZT: 'Tooling', IM: 'Import', SC: 'Subcontract',
}

const PO_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'sent_to_vendor', label: 'Sent to Vendor' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'fully_received', label: 'Fully Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'on_hold', label: 'On Hold' },
]

function StatusSummary({ totalCount, counts }: { totalCount: number; counts: Record<string, number> }) {
  const badges = [
    { key: 'total',             label: 'Total',       count: totalCount,                    cls: 'bg-gray-900 text-white' },
    { key: 'draft',             label: 'Draft',       count: counts['draft'] ?? 0,           cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    { key: 'pending_approval',  label: 'Pending',     count: counts['pending_approval'] ?? 0, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    { key: 'approved',          label: 'Approved',    count: counts['approved'] ?? 0,        cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    { key: 'sent_to_vendor',    label: 'Sent',        count: counts['sent_to_vendor'] ?? 0,  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    { key: 'acknowledged',      label: 'Acknowledged',count: counts['acknowledged'] ?? 0,    cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
    { key: 'partially_received',label: 'Partial',     count: counts['partially_received'] ?? 0, cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
    { key: 'fully_received',    label: 'Delivered',   count: counts['fully_received'] ?? 0,  cls: 'bg-green-50 text-green-700 border border-green-200' },
    { key: 'cancelled',         label: 'Cancelled',   count: counts['cancelled'] ?? 0,       cls: 'bg-red-50 text-red-700 border border-red-200' },
  ]
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map(b => (
        <span key={b.key} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>
          {b.count} {b.label}
        </span>
      ))}
    </div>
  )
}

export default function PurchaseOrdersPage() {
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deletingPO, setDeletingPO] = useState<any>(null)

  const [search] = useDebounce(searchInput, 400)
  const ordering = sortDir === 'asc' ? sortField : `-${sortField}`
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => { setPage(1) }, [search])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/purchase-orders/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast({ title: 'Purchase order deleted' })
      setDeletingPO(null)
    },
    onError: (err: any) => {
      toast({ title: err?.response?.data?.error ?? 'Failed to delete purchase order', variant: 'destructive' })
    },
  })

  const hasFilters = !!(search || statusFilter || typeFilter)
  const clearFilters = () => { setSearchInput(''); setStatusFilter(''); setTypeFilter(''); setPage(1) }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['purchase-orders', search, statusFilter, typeFilter, page, ordering],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE), ordering }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.po_type = typeFilter
      const { data } = await apiClient.get('/purchase-orders/', { params })
      return data
    },
    placeholderData: (prev: any) => prev,
    staleTime: 0,
  })

  const orders: any[] = data?.results ?? (Array.isArray(data) ? data : [])
  const totalCount: number = data?.count ?? orders.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const counts = orders.reduce((acc: Record<string, number>, po: any) => {
    acc[po.status] = (acc[po.status] ?? 0) + 1
    return acc
  }, {})

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const sortProps = { current: sortField, dir: sortDir, onSort: handleSort }

  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search purchase orders…" className="pl-9 h-9" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <select className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[130px]" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">All Types</option>
          {PO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[160px]" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {PO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Status summary + New PO */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusSummary totalCount={totalCount} counts={counts} />
          <Link href="/purchase-orders/new">
            <Button size="sm" className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" /> New PO
            </Button>
          </Link>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading purchase orders…
            </div>
          )}
          {!isLoading && orders.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {hasFilters ? 'No purchase orders match your filters.' : 'No purchase orders found. Create your first PO.'}
            </div>
          )}
          {!isLoading && orders.length > 0 && (
            <div className="relative w-full overflow-x-auto">
              {isFetching && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <SortableTh field="po_number" label="PO Number" {...sortProps} />
                    <SortableTh field="vendor_name" label="Vendor" {...sortProps} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">QT / PR Ref</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Items</th>
                    <SortableTh field="total_amount" label="PO Value" {...sortProps} />
                    <SortableTh field="earliest_delivery_date" label="Delivery" {...sortProps} />
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Invoiced</th>
                    <SortableTh field="status" label="Status" {...sortProps} />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((po: any) => {
                    const progress = Number(po.received_progress_pct ?? 0)
                    const progressColor = progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-amber-500' : 'bg-slate-400'
                    const invoicedAmt = Number(po.invoiced_amount ?? 0)
                    const canGrn = ['sent_to_vendor', 'acknowledged', 'partially_received', 'issued'].includes(po.status)
                    const canInvoice = ['acknowledged', 'partially_received', 'fully_received', 'closed'].includes(po.status)
                    return (
                      <tr
                        key={po.id}
                        onClick={() => router.push(`/purchase-orders/${po.hash_id ?? po.id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-blue-700 font-semibold">{po.po_number}</p>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 mt-0.5">
                            {PO_TYPE_MAP[po.po_type] ?? po.po_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm leading-snug max-w-[200px] truncate" title={po.vendor_name}>{po.vendor_name ?? '—'}</p>
                          {(po.vendor_city || po.vendor_state) && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                              {[po.vendor_city, po.vendor_state].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {po.qt_number && <div className="font-mono text-xs text-purple-700">{po.qt_number}</div>}
                          {po.pr_number && <div className="font-mono text-xs text-blue-700">{po.pr_number}</div>}
                          {!po.qt_number && !po.pr_number && <span className="text-xs text-muted-foreground">Standalone</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-medium">{po.items_count ?? 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold tabular-nums">{formatCurrency(po.total_amount ?? 0)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">{po.earliest_delivery_date ? formatDate(po.earliest_delivery_date) : '—'}</div>
                          <div className="mt-1 h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${progressColor}`} style={{ width: `${progress}%` }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{progress}% received</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {invoicedAmt > 0 ? (
                            <span className="text-xs text-blue-700 font-medium tabular-nums">{formatCurrency(invoicedAmt)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {canGrn && (
                              <Link href={`/grns/new?po=${po.hash_id ?? po.id}`}>
                                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                                  <Package className="w-3.5 h-3.5" /> GRN
                                </Button>
                              </Link>
                            )}
                            {canInvoice && (
                              <Link href={`/invoices/new?po=${po.hash_id ?? po.id}`}>
                                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                                  <Receipt className="w-3.5 h-3.5" /> Invoice
                                </Button>
                              </Link>
                            )}
                            <Link href={`/purchase-orders/${po.hash_id ?? po.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            {po.status === 'draft' && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingPO(po)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CommonConfirmModal
        isOpen={!!deletingPO}
        title="Delete Purchase Order"
        description={<>Delete <strong>{deletingPO?.po_number}</strong>? This action cannot be undone.</>}
        confirmLabel="Delete"
        onClose={() => setDeletingPO(null)}
        onConfirm={() => deletingPO && deleteMutation.mutate(deletingPO.hash_id ?? deletingPO.id)}
        isPending={deleteMutation.isPending}
      />

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} purchase order{totalCount === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-8 w-8 p-0 text-xs hidden sm:flex items-center justify-center">«</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const p = start + i
              if (p > totalPages) return null
              return (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)} className="h-8 w-8 p-0 text-xs">
                  {p}
                </Button>
              )
            })}
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-8 w-8 p-0 text-xs hidden sm:flex items-center justify-center">»</Button>
          </div>
        </div>
      )}
    </div>
  )
}
