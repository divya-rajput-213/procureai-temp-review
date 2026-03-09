'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search, X, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useRouter } from 'next/navigation'

export default function ProcurementPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [trackingFilter, setTrackingFilter] = useState('')
  const [deletingPR, setDeletingPR] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

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
    queryKey: ['purchase-requisitions', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await apiClient.get(`/procurement/?${params}`)
      return data.results || data
    },
    staleTime: 0,
  })

  const allPrs: any[] = data || []

  // Client-side tracking code filter
  const prs = trackingFilter.trim()
    ? allPrs.filter(pr =>
        (pr.tracking_code ?? '').toLowerCase().includes(trackingFilter.toLowerCase())
      )
    : allPrs

  const hasFilters = search || statusFilter || trackingFilter

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search PRs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tracking ID..."
              className="pl-9"
              value={trackingFilter}
              onChange={e => setTrackingFilter(e.target.value)}
            />
          </div>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setStatusFilter(''); setTrackingFilter('') }}
            >
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
        <Link href="/procurement/new">
          <Button className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            New PR
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && prs.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {hasFilters ? 'No purchase requisitions match your filters.' : 'No purchase requisitions found.'}
            </div>
          )}
          {!isLoading && prs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">PR Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Tracking ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Plant</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prs.map((pr: any) => (
                    <tr
                      key={pr.id}
                      onClick={() => router.push(`/procurement/${pr.hash_id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{pr.pr_number}</p>
                        {pr.created_by_name && <p className="text-xs text-muted-foreground">{pr.created_by_name}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{pr.tracking_code || '—'}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(pr.total_amount, pr.currency_code)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{pr.plant_name}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {pr.selected_vendor_name ? (
                          <span className="text-xs font-medium text-teal-700">{pr.selected_vendor_name}</span>
                        ) : (pr.invited_vendor_names ?? []).length > 0 ? (
                          <span className="text-xs text-muted-foreground">{(pr.invited_vendor_names as string[]).length} invited</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={pr.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(pr.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {pr.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeletingPR(pr) }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(trackingFilter && allPrs.length !== prs.length) && (
                <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                  {prs.length} of {allPrs.length} records
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {deletingPR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Delete Purchase Requisition</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deletingPR.pr_number}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingPR(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingPR.hash_id)} className="gap-2">
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
