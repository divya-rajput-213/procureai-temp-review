'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Search, Loader2, X, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

export default function BudgetPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [deletingItem, setDeletingItem] = useState<any>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async (hashId: string) => apiClient.delete(`/budget/tracking-ids/${hashId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracking-ids'] })
      toast({ title: 'Budget request deleted' })
      setDeletingItem(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to delete budget request'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['tracking-ids', search, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      const { data } = await apiClient.get(`/budget/tracking-ids/?${params.toString()}`)
      return data.results || data
    },
    staleTime: 0,
  })

  const trackingIds: any[] = data || []
  const hasFilters = search || statusFilter || priorityFilter

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tracking IDs..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="pending_finance">Pending Finance</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter('') }}
            >
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
        <Button onClick={() => router.push('/budget/new')} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Budget Request
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          )}
          {!isLoading && trackingIds.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {hasFilters ? 'No budget requests match your filters.' : 'No budget requests found.'}
            </div>
          )}
          {!isLoading && trackingIds.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Priority</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Requested</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Approved</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Utilised</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trackingIds.map((t: any) => {
                    const approved = Number(t.approved_amount || 0)
                    const consumed = Number(t.consumed_amount || 0)
                    const utilPct = approved > 0 ? Math.round((consumed / approved) * 100) : 0
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/budget/${t.hash_id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-primary">{t.tracking_code}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="font-medium truncate">{t.title || t.description}</p>
                          {t.title && t.description && (
                            <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {t.priority ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium}`}>
                              {t.priority}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(t.requested_amount, t.currency_code)}</td>
                        <td className="px-4 py-3 font-semibold">{approved ? formatCurrency(approved) : '—'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {t.status === 'approved' ? (
                            <div className="min-w-[100px]">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`text-xs font-semibold ${utilPct > 90 ? 'text-red-600' : utilPct > 70 ? 'text-amber-600' : 'text-green-600'}`}>
                                  {utilPct}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${utilPct > 90 ? 'bg-red-500' : utilPct > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(utilPct, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(t.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {t.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={e => { e.stopPropagation(); setDeletingItem(t) }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
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

      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Delete Budget Request</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deletingItem.tracking_code}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingItem.hash_id)} className="gap-2">
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
