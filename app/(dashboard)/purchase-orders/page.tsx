'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

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
  NB: 'Standard',
  FO: 'Blanket',
  RO: 'Release',
  SV: 'Service',
  ZT: 'Tooling',
  IM: 'Import',
  SC: 'Subcontract',
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

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [deletingPO, setDeletingPO] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

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

  const { data: statsData } = useQuery({
    queryKey: ['purchase-orders-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/purchase-orders/dashboard-stats/')
      return data
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', search, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('po_type', typeFilter)
      const { data } = await apiClient.get(`/purchase-orders/?${params}`)
      return data.results || data
    },
    staleTime: 0,
  })

  const orders: any[] = data || []
  const hasFilters = search || statusFilter || typeFilter

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total POs</p>
              <p className="text-2xl font-bold">{statsData.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-bold">{statsData.by_status?.pending_approval ?? statsData.pending_approval ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sent to Vendor</p>
              <p className="text-2xl font-bold">{statsData.by_status?.sent_to_vendor ?? statsData.sent_to_vendor ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(statsData.total_value ?? 0)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + New button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search purchase orders..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {PO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {PO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}>
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
        <Link href="/purchase-orders/new">
          <Button className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New PO
          </Button>
        </Link>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && orders.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {hasFilters ? 'No purchase orders match your filters.' : 'No purchase orders found. Create your first PO.'}
            </div>
          )}
          {!isLoading && orders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">PO Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((po: any) => (
                    <tr
                      key={po.id}
                      onClick={() => router.push(`/purchase-orders/${po.hash_id ?? po.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{po.po_number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{po.vendor_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {PO_TYPE_MAP[po.po_type] ?? po.po_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{po.vendor_name}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(po.total_amount ?? po.net_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(po.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {po.status === 'draft' && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeletingPO(po) }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete modal */}
      {deletingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Delete Purchase Order</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deletingPO.po_number}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingPO(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingPO.hash_id ?? deletingPO.id)} className="gap-2">
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
