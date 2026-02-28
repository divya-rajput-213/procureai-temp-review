'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Plus, Search, Loader2 } from 'lucide-react'
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

  const { data, isLoading } = useQuery({
    queryKey: ['tracking-ids', search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const { data } = await apiClient.get(`/budget/tracking-ids/${params}`)
      return data.results || data
    },
  })

  const trackingIds: any[] = data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tracking IDs..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            <div className="p-8 text-center text-muted-foreground">No budget requests found.</div>
          )}
          {!isLoading && trackingIds.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {['Code', 'Title', 'Priority', 'Requested',  'Status', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trackingIds.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/budget/${t.id}`)}>
                      <td className="px-4 py-3 font-medium text-primary">{t.tracking_code}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium truncate">{t.title || t.description}</p>
                        {t.title && t.description && (
                          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.priority && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium}`}>
                            {t.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(t.requested_amount, t.currency_code)}</td>
                      {/* <td className="px-4 py-3">{t.approved_amount ? formatCurrency(t.approved_amount) : '—'}</td>
                      <td className="px-4 py-3">
                        {t.remaining_amount == null && '—'}
                        {t.remaining_amount != null && (
                          <span className={t.remaining_amount > 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                            {formatCurrency(t.remaining_amount)}
                          </span>
                        )}
                      </td> */}
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(t.created_at)}</td>
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
