'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const CONTRACT_TYPES = [
  { value: 'MSA', label: 'MSA' },
  { value: 'LTA', label: 'LTA' },
  { value: 'SLA', label: 'SLA' },
  { value: 'Tooling', label: 'Tooling' },
  { value: 'NDA', label: 'NDA' },
  { value: 'SOW', label: 'SOW' },
]

const CONTRACT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'internal_review', label: 'Internal Review' },
  { value: 'pending_vendor_negotiation', label: 'Vendor Negotiation' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'active', label: 'Active' },
  { value: 'extended', label: 'Extended' },
  { value: 'closed', label: 'Closed' },
  { value: 'terminated', label: 'Terminated' },
]

export default function ContractsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [deletingContract, setDeletingContract] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async (hashId: string) => apiClient.delete(`/contracts/${hashId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      toast({ title: 'Contract deleted' })
      setDeletingContract(null)
    },
    onError: (err: any) => {
      toast({ title: err?.response?.data?.error ?? 'Failed to delete contract', variant: 'destructive' })
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['contracts-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/contracts/dashboard-stats/')
      return data
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', search, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('contract_type', typeFilter)
      const { data } = await apiClient.get(`/contracts/?${params}`)
      return data.results || data
    },
    staleTime: 0,
  })

  const contracts: any[] = data || []
  const hasFilters = search || statusFilter || typeFilter

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Contracts</p>
              <p className="text-2xl font-bold">{statsData.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active Value</p>
              <p className="text-2xl font-bold">{formatCurrency(statsData.total_value)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{statsData.by_status?.active || 0}</p>
            </CardContent>
          </Card>
          <Card className={statsData.expiring_30 > 0 ? 'border-amber-300 bg-amber-50/50' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {statsData.expiring_30 > 0 && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                Expiring in 30 days
              </p>
              <p className="text-2xl font-bold">{statsData.expiring_30}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + New button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search contracts..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {CONTRACT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}>
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
        <Link href="/contracts/new">
          <Button className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Contract
          </Button>
        </Link>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && contracts.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {hasFilters ? 'No contracts match your filters.' : 'No contracts found. Create your first contract.'}
            </div>
          )}
          {!isLoading && contracts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Contract ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Duration</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contracts.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/contracts/${c.hash_id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.contract_id}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {c.contract_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.vendor_name}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(c.estimated_value, c.currency_code)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {c.duration_months}mo &middot; {formatDate(c.start_date)} — {formatDate(c.end_date)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.status === 'draft' && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeletingContract(c) }}
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
      {deletingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Delete Contract</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deletingContract.contract_id}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingContract(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingContract.hash_id)} className="gap-2">
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
