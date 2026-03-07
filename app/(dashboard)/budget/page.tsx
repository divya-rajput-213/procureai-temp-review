'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Plus, Search, Loader2, X } from 'lucide-react'
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trackingIds.map((t: any) => (
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
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
