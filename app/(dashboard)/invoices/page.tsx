'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, X, Trash2, Loader2, AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'matched', label: 'Matched' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'payment_initiated', label: 'Payment Initiated' },
  { value: 'paid', label: 'Paid' },
]

const INVOICE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'proforma', label: 'Proforma' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'advance', label: 'Advance' },
]

export default function InvoicesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [deletingInvoice, setDeletingInvoice] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/invoices/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({ title: 'Invoice deleted' })
      setDeletingInvoice(null)
    },
    onError: (err: any) => {
      toast({ title: err?.response?.data?.error ?? 'Failed to delete invoice', variant: 'destructive' })
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['invoices-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/invoices/dashboard-stats/')
      return data
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', search, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('invoice_type', typeFilter)
      const { data } = await apiClient.get(`/invoices/?${params}`)
      return data.results || data
    },
    staleTime: 0,
  })

  const invoices: any[] = data || []
  const hasFilters = search || statusFilter || typeFilter

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{statsData.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-bold">{statsData.pending_approval ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Payable</p>
              <p className="text-2xl font-bold">{formatCurrency(statsData.total_payable ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className={statsData.overdue > 0 ? 'border-red-300 bg-red-50/50' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {statsData.overdue > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                Overdue
              </p>
              <p className="text-2xl font-bold">{statsData.overdue ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + buttons */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {INVOICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1"
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}>
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/invoices/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Register Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && invoices.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {hasFilters ? 'No invoices match your filters.' : 'No invoices found. Create or upload your first invoice.'}
            </div>
          )}
          {!isLoading && invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Invoice No.</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">PO Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">GRN Ref</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Invoice Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">3-Way</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Due Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv: any) => {
                    const now = new Date()
                    const due = inv.due_date ? new Date(inv.due_date) : null
                    const daysToDue = due ? Math.round((due.getTime() - now.getTime()) / 86400000) : null
                    const overdue = daysToDue !== null && daysToDue < 0 && inv.status !== 'paid'

                    const matchSummary = inv.match_status
                    const matched = matchSummary?.po_match_status === 'matched' && matchSummary?.grn_match_status === 'matched'
                    const hasMatch = !!matchSummary
                    const withinTol = matchSummary?.is_within_tolerance
                    const matchPct = matched ? 100 : (withinTol ? 90 : (hasMatch ? 60 : 0))
                    const matchColor = matchPct === 100 ? 'bg-green-500' : matchPct >= 80 ? 'bg-amber-500' : 'bg-red-500'
                    const matchTextColor = matchPct === 100 ? 'text-green-700' : matchPct >= 80 ? 'text-amber-700' : 'text-red-700'

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => router.push(`/invoices/${inv.hash_id || inv.id}`)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-purple-700 font-semibold">{inv.internal_ref}</p>
                          <p className="text-xs text-muted-foreground">{inv.invoice_number || '—'} · {inv.invoice_type?.replace('_', ' ')}</p>
                        </td>
                        <td className="px-4 py-3 font-medium">{inv.vendor_name}</td>
                        <td className="px-4 py-3">
                          {inv.po_number ? (
                            <span className="font-mono text-xs text-blue-700">{inv.po_number}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {inv.grn_number ? (
                            <span className="font-mono text-xs text-green-700">{inv.grn_number}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.total_amount)}</td>
                        <td className="px-4 py-3">
                          {hasMatch ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${matchTextColor}`}>{matchPct}%</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${matchColor}`} style={{ width: `${matchPct}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className={overdue ? 'text-red-700 font-medium' : 'text-muted-foreground'}>
                            {inv.due_date ? formatDate(inv.due_date) : '—'}
                          </div>
                          {overdue && (
                            <div className="text-[10px] text-red-600">{Math.abs(daysToDue!)}d overdue</div>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={overdue ? 'rejected' : inv.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                            <Link href={`/invoices/${inv.hash_id || inv.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </Link>
                            {inv.status === 'draft' && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeletingInvoice(inv)}
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

      {/* Delete modal */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Delete Invoice</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deletingInvoice.internal_ref}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingInvoice(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingInvoice.hash_id || deletingInvoice.id)} className="gap-2">
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
