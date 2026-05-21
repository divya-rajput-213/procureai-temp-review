'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Download, Trash2, Loader2, ChevronLeft, ChevronRight, X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate, PAGE_SIZE, VALIDITY_DAYS, parseLooseDate, diffDays } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { SortableTh } from '@/components/shared/SortableTh'

type SortDir = 'asc' | 'desc'
type SortField = 'ref_no' | 'vendor_name' | 'total_amount' | 'status' | 'created_at'

type Quotation = {
  id: number | string
  hash_id: string
  ref_no: string
  quotation_no: string
  quotation_date: string
  vendor_name: string
  vendor_gstin?: string
  plant_name?: string
  department_name?: string
  pr_number: string
  status: string
  items_count: number
  total_amount: number
  valid_until?: string
  created_at: string
}

function mapQuotation(raw: any): Quotation {
  return {
    id: raw.id ?? raw.hash_id,
    hash_id: raw.hash_id ?? raw.id,
    ref_no: raw.ref_no ?? '—',
    quotation_no: raw.quotation_no ?? raw.quotation_number ?? '—',
    quotation_date: raw.quotation_date ?? '',
    vendor_name: raw.vendor_name ?? raw.vendor?.company_name ?? raw.vendor?.name ?? '—',
    vendor_gstin: raw.vendor_gstin ?? raw.gstin ?? raw.vendor?.gstin ?? undefined,
    plant_name: raw.plant_name ?? raw.plant?.name ?? raw.procurement?.plant_name ?? undefined,
    department_name: raw.department_name ?? raw.department?.name ?? raw.procurement?.department_name ?? undefined,
    pr_number: raw.pr_no ?? raw.pr_number ?? raw.purchase_requisition_number ?? raw.procurement?.pr_number ?? raw.pr?.pr_number ?? '—',
    status: raw.status ?? 'draft',
    items_count: Number(raw.items_count ?? 0),
    total_amount: Number(raw.total_amount ?? 0),
    valid_until: raw.valid_until ?? undefined,
    created_at: raw.created_at ?? raw.uploaded_at ?? '',
  }
}

function getValidUntil(q: Quotation): { date: Date; daysLeft: number } | null {
  if (q.valid_until) {
    const d = new Date(q.valid_until)
    if (!isNaN(d.getTime())) return { date: d, daysLeft: diffDays(new Date(), d) }
  }
  const base = parseLooseDate(q.quotation_date) ?? parseLooseDate(q.created_at)
  if (!base) return null
  const d = new Date(base)
  d.setDate(d.getDate() + VALIDITY_DAYS)
  return { date: d, daysLeft: diffDays(new Date(), d) }
}

// ─── Status summary ───────────────────────────────────────────────────────────

function fmtValue(v: number) {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`
  return `₹${v}`
}

function StatusSummary({ totalCount, counts, totalValue }: {
  totalCount: number; counts: Record<string, number>; totalValue: number;
}) {
  const badges = [
    { key: 'total', label: 'Total', count: totalCount, cls: 'bg-gray-900 text-white' },
    { key: 'draft', label: 'Draft', count: counts['draft'] ?? 0, cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    { key: 'under_review', label: 'Under Review', count: counts['under_review'] ?? 0, cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    { key: 'pending_approval', label: 'Pending', count: counts['pending_approval'] ?? 0, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    { key: 'approved', label: 'Approved', count: counts['approved'] ?? 0, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    { key: 'rejected', label: 'Rejected', count: counts['rejected'] ?? 0, cls: 'bg-red-50 text-red-700 border border-red-200' },
  ]
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map(b => (
        <span key={b.key} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>
          {b.count} {b.label}
        </span>
      ))}
      {totalValue > 0 && (
        <>
          <span className="text-muted-foreground/40 text-xs mx-0.5">|</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            VALUE {fmtValue(totalValue)} Total
          </span>
        </>
      )}
    </div>
  )
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onClose, onConfirm, isPending }: Readonly<{
  name: string; onClose: () => void; onConfirm: () => void; isPending: boolean
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-md shadow-xl w-full max-w-[520px] p-0 overflow-hidden">
        <div className="p-5 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight pr-10">Delete Quotation</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="mt-2 text-sm text-slate-700 leading-relaxed">
            <div>By deleting the quotation <span className="font-semibold text-slate-900">{name}</span>, this action cannot be undone.</div>
            <div>Are you sure you want to delete it?</div>
          </div>
        </div>
        <div className="border-t px-5 py-3 flex items-center justify-end gap-4">
          <Button variant="ghost" className="px-2 text-[#042348] hover:text-[#032B5C] hover:bg-transparent" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending} onClick={onConfirm} className="gap-2 bg-[#042348] text-white hover:bg-[#032B5C] shadow-md rounded-md px-6 font-semibold">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuotationPage() {
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deletingQuotation, setDeletingQuotation] = useState<Quotation | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const [search] = useDebounce(searchInput, 400)
  const ordering = sortDir === 'asc' ? sortField : `-${sortField}`
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => apiClient.delete(`/quotations/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast({ title: 'Quotation deleted' })
      setDeletingQuotation(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.response?.data?.detail ?? 'Failed to delete quotation'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data?.results ?? r.data ?? [] },
  })
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => { const r = await apiClient.get('/vendors/?page_size=200&ordering=company_name'); return r.data?.results ?? r.data ?? [] },
  })

  const hasFilters = !!(search || statusFilter || departmentFilter || vendorFilter)
  const activeFilterCount = [statusFilter, departmentFilter, vendorFilter].filter(Boolean).length

  const clearFilters = () => { setSearchInput(''); setStatusFilter(''); setDepartmentFilter(''); setVendorFilter(''); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', search, statusFilter, departmentFilter, vendorFilter, page, ordering],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE), ordering }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (departmentFilter) params.department_id = departmentFilter
      if (vendorFilter) params.vendor_id = vendorFilter
      const { data } = await apiClient.get('/quotations/', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })

  const fetchAllForExport = useCallback(async () => {
    const params: Record<string, string> = { page_size: '9999', ordering }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (departmentFilter) params.department_id = departmentFilter
    if (vendorFilter) params.vendor_id = vendorFilter
    const { data } = await apiClient.get('/quotations/', { params })
    return ((data?.results ?? data) as any[]).map(mapQuotation)
  }, [search, statusFilter, departmentFilter, vendorFilter, ordering])

  const rawList: any[] = data?.results ?? (Array.isArray(data) ? data : [])
  const quotations: Quotation[] = rawList.map(mapQuotation)
  const totalCount: number = data?.count ?? quotations.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const statusCounts = quotations.reduce((acc: Record<string, number>, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1
    return acc
  }, {})
  const totalValue = quotations.reduce((sum, q) => sum + (q.total_amount ?? 0), 0)
  const totalItems = quotations.reduce((sum, q) => sum + (q.items_count ?? 0), 0)

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const sortProps = { current: sortField, dir: sortDir, onSort: handleSort }

  useEffect(() => { setPage(1) }, [search])

  const exportCSV = async () => {
    const rows = await fetchAllForExport()
    if (!rows.length) { toast({ title: 'No quotations to export', variant: 'destructive' }); return }
    const headers = ['Quote Ref', 'Vendor', 'PR Linked', 'Items', 'Total Value', 'Valid Until', 'Status', 'Created At']
    const csvRows = rows.map(q => {
      const v = getValidUntil(q)
      return [
        q.ref_no, q.vendor_name, q.pr_number !== '—' ? q.pr_number : '',
        q.items_count, q.total_amount,
        v ? formatDate(v.date.toISOString()) : '',
        q.status, q.created_at ? formatDate(q.created_at) : '',
      ]
    })
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `quotations_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">

      {/* ── Mobile search + filter toggle ── */}
      <div className="flex items-center gap-2 sm:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search quotations…" className="pl-9 h-9" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <Button variant={showFilters ? 'default' : 'outline'} size="sm" className="gap-1.5 shrink-0 relative" onClick={() => setShowFilters(f => !f)}>
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full text-[10px] w-4 h-4 inline-flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* ── Mobile: collapsible dropdowns ── */}
      {showFilters && (
        <div className="flex flex-col gap-2 sm:hidden">
          <select className="h-9 border rounded-md px-3 text-sm bg-background w-full" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="under_review">Under Review</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="h-9 border rounded-md px-3 text-sm bg-background w-full" value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setPage(1) }}>
            <option value="">All Departments</option>
            {(departments as any[]).map((d: any) => {
              const name = d?.name ?? d?.department_name
              if (!name) return null
              return <option key={d?.id} value={String(d?.id)}>{String(name)}</option>
            })}
          </select>
          <select className="h-9 border rounded-md px-3 text-sm bg-background w-full" value={vendorFilter} onChange={e => { setVendorFilter(e.target.value); setPage(1) }}>
            <option value="">All Vendors</option>
            {(vendors as any[]).map((v: any) => (
              <option key={v.id} value={String(v.id)}>{v.company_name}</option>
            ))}
          </select>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground w-full justify-center">
              <X className="w-3.5 h-3.5" /> Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* ── Desktop: full inline filter bar ── */}
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by quote ref, PR number…" className="pl-9 h-9" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <select className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[140px]" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="under_review">Under Review</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[150px]" value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setPage(1) }}>
          <option value="">All Departments</option>
          {(departments as any[]).map((d: any) => {
            const name = d?.name ?? d?.department_name
            if (!name) return null
            return <option key={d.id} value={String(d.id)}>{String(name)}</option>
          })}
        </select>
        <select className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[160px]" value={vendorFilter} onChange={e => { setVendorFilter(e.target.value); setPage(1) }}>
          <option value="">All Vendors</option>
          {(vendors as any[]).map((v: any) => (
            <option key={v.id} value={String(v.id)}>{v.company_name}</option>
          ))}
        </select>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Status summary + action buttons ── */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusSummary totalCount={totalCount} counts={statusCounts} totalValue={totalValue} />
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button variant="outline" size="sm" disabled={totalCount === 0} onClick={exportCSV} className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Link href="/quotation/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Quotation</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading quotations…
            </div>
          )}
          {!isLoading && quotations.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              {hasFilters ? 'No quotations match your filters.' : 'No quotations found.'}
            </div>
          )}
          {!isLoading && quotations.length > 0 && (
            <div className="w-full overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <SortableTh field="ref_no" label="Quote Ref" {...sortProps} />
                    <SortableTh field="vendor_name" label="Vendor" {...sortProps} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">PR Linked</th>
                    <SortableTh field="total_amount" label="Total Value" {...sortProps} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Valid Until</th>
                    <SortableTh field="status" label="Status" {...sortProps} />
                    <SortableTh field="created_at" label="Created At" {...sortProps} />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotations.map((q) => {
                    const validity = getValidUntil(q)
                    const pr = q.pr_number && q.pr_number !== '—' ? q.pr_number : null
                    const isExpiring = validity ? validity.daysLeft >= 0 && validity.daysLeft <= 7 : false

                    return (
                      <tr
                        key={q.id}
                        onClick={() => router.push(`/quotation/${q.hash_id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm leading-snug">{q.ref_no}</p>
                          {q.quotation_no && q.quotation_no !== '—' && q.quotation_no !== q.ref_no && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{q.quotation_no}</p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm leading-snug max-w-[200px] truncate" title={q.vendor_name}>{q.vendor_name}</p>
                          {(q.plant_name || q.department_name) && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                              {[q.department_name, q.plant_name].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-foreground">{q.items_count} item{q.items_count !== 1 ? 's' : ''}</span>
                        </td>

                        <td className="px-4 py-3">
                          {pr ? (
                            <span className="text-xs  text-muted-foreground  px-1.5 py-0.5 ">{pr}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(q.total_amount)}</span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {validity ? (
                            <span className={`text-xs ${isExpiring ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              {formatDate(validity.date.toISOString())}
                              {isExpiring && <span className="ml-1 text-[10px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded-full font-semibold">Expiring</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={q.status} />
                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {q.created_at ? formatDate(q.created_at) : '—'}
                        </td>

                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {q.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={e => { e.stopPropagation(); setDeletingQuotation(q) }}
                                title="Delete"
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

      {deletingQuotation && (
        <DeleteConfirmModal
          name={deletingQuotation.ref_no}
          onClose={() => setDeletingQuotation(null)}
          onConfirm={() => deleteMutation.mutate(deletingQuotation.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} quotation{totalCount === 1 ? '' : 's'}
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
    </div>
  )
}
