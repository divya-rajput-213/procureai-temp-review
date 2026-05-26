'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { CommonConfirmModal } from '@/components/shared/CommonModal'
import { formatCurrency, formatDate, PAGE_SIZE } from '@/lib/utils'
import apiClient from '@/lib/api/client'

function StatusSummary({ total, counts }: { total: number; counts: Record<string, number> }) {
  const badges = [
    { key: 'total', label: 'Total', count: total, cls: 'bg-gray-900 text-white' },
    { key: 'draft', label: 'Draft', count: counts['draft'] ?? 0, cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    { key: 'pending_approval', label: 'Pending', count: counts['pending_approval'] ?? 0, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    { key: 'approved', label: 'Approved', count: counts['approved'] ?? 0, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
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

export default function ProcurementPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [trackingFilter, setTrackingFilter] = useState('')
  const [page, setPage] = useState(1)
  const [deletingPR, setDeletingPR] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const resetPage = () => setPage(1)

  const deleteMutation = useMutation({
    mutationFn: async (hashId: string) => apiClient.delete(`/procurement/${hashId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
      toast({ title: 'Purchase requisition deleted' })
      setDeletingPR(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to delete purchase requisition'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-requisitions', search, statusFilter, trackingFilter, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (trackingFilter) params.tracking_code = trackingFilter
      const { data } = await apiClient.get('/procurement/', { params })
      return data
    },
    placeholderData: (prev) => prev,
    staleTime: 0,
  })

  const prs: any[] = data?.results ?? (Array.isArray(data) ? data : [])
  const totalCount: number = data?.count ?? prs.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const hasFilters = !!(search || statusFilter || trackingFilter)

  const statusCounts = prs.reduce((acc: Record<string, number>, pr: any) => {
    acc[pr.status] = (acc[pr.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search PRs…" className="pl-9 h-9" value={search} onChange={e => { setSearch(e.target.value); resetPage() }} />
        </div>
        <div className="relative min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tracking ID…" className="pl-9 h-9" value={trackingFilter} onChange={e => { setTrackingFilter(e.target.value); resetPage() }} />
        </div>
        <select
          className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[140px]"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); resetPage() }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="vendor_selected">Vendor Selected</option>
          <option value="synced_to_sap">Synced to SAP</option>
          <option value="po_created">PO Created</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {hasFilters && (
          <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground"
            onClick={() => { setSearch(''); setStatusFilter(''); setTrackingFilter(''); resetPage() }}>
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Summary + New PR button */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusSummary total={totalCount} counts={statusCounts} />
          <Button size="sm" className="gap-1.5 ml-auto" onClick={() => router.push('/procurement/new')}>
            <Plus className="w-4 h-4" /> New PR
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {!isLoading && prs.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {hasFilters ? 'No purchase requisitions match your filters.' : 'No purchase requisitions yet.'}
            </div>
          )}
          {!isLoading && prs.length > 0 && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">PR Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Tracking ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Plant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prs.map((pr: any) => (
                    <tr
                      key={pr.id}
                      onClick={() => router.push(`/procurement/${pr.hash_id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold leading-snug">{pr.pr_number}</p>
                        {pr.created_by_name && <p className="text-xs text-muted-foreground mt-0.5">{pr.created_by_name}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{pr.tracking_code || '—'}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(pr.total_amount, pr.currency_code)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{pr.plant_name || '—'}</td>
                      <td className="px-4 py-3">
                        {pr.selected_vendor_name
                          ? <span className="text-xs font-medium text-teal-700">{pr.selected_vendor_name}</span>
                          : (pr.invited_vendor_names ?? []).length > 0
                            ? <span className="text-xs text-muted-foreground">{(pr.invited_vendor_names as string[]).length} invited</span>
                            : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={pr.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(pr.created_at)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {pr.status === 'draft' && (
                            <>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={e => { e.stopPropagation(); setDeletingPR(pr) }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} PR{totalCount === 1 ? '' : 's'}
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

      <CommonConfirmModal
        isOpen={!!deletingPR}
        title="Delete Purchase Requisition"
        description={<>Are you sure you want to delete <strong>{deletingPR?.pr_number}</strong>? This action cannot be undone.</>}
        confirmLabel="Delete"
        onClose={() => setDeletingPR(null)}
        onConfirm={() => deletingPR && deleteMutation.mutate(deletingPR.hash_id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
