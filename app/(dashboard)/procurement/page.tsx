'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

export default function ProcurementPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-requisitions', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await apiClient.get(`/procurement/?${params}`)
      return data.results || data
    },
  })

  const prs: any[] = data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search PRs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <option value="synced_to_sap">Synced to SAP</option>
            <option value="po_created">PO Created</option>
            <option value="rejected">Rejected</option>
          </select>
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
            <div className="p-8 text-center text-muted-foreground">No purchase requisitions found.</div>
          )}
          {!isLoading && prs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">PR Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tracking ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plant</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prs.map((pr: any) => (
                    <tr key={pr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{pr.pr_number}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{pr.tracking_code || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={pr.purchase_type === 'CAPEX' ? 'info' : 'secondary'} className="text-xs">
                          {pr.purchase_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(pr.total_amount, pr.currency_code)}</td>
                      <td className="px-4 py-3">{pr.plant_name}</td>
                      <td className="px-4 py-3"><StatusBadge status={pr.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(pr.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/procurement/${pr.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </td>
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
