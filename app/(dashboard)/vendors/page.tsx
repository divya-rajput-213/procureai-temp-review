'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Download, Trash2, Loader2,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  Upload, X, MapPin, Building, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, PAGE_SIZE } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'
type SortField = 'company_name' | 'status' | 'created_at' | 'category_name' | 'performance_score'

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: Readonly<{ field: SortField; current: SortField; dir: SortDir }>) {
  if (field !== current) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/50 inline-block ml-1" />
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-primary inline-block ml-1" />
    : <ChevronDown className="w-3 h-3 text-primary inline-block ml-1" />
}

function SortableTh({
  field, label, current, dir, onSort, className = '',
}: Readonly<{
  field: SortField; label: string; current: SortField; dir: SortDir
  onSort: (f: SortField) => void; className?: string
}>) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-0.5 hover:text-foreground transition-colors uppercase"
      >
        {label} <SortIcon field={field} current={current} dir={dir} />
      </button>
    </th>
  )
}

// ─── Quotation mini-badges ────────────────────────────────────────────────────

function QuotBadge({ count, label, color }: { count: number; label: string; color: string }) {
  if (!count) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${color}`}>
      <span className="opacity-60 text-[10px]">▣</span>
      {count} {label}
    </span>
  )
}

// ─── Vendor Score ─────────────────────────────────────────────────────────────

function VendorScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>

  const textColor = score > 90 ? 'text-red-600' : score > 70 ? 'text-amber-600' : 'text-green-600'
  const bgColor = score > 90 ? 'bg-red-500' : score > 70 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div className="min-w-[80px]">
      <span className={`text-xs font-semibold ${textColor}`}>{score}%</span>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
        <div className={`h-full rounded-full ${bgColor}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(vendors: any[]) {
  const headers = [
    'Company', 'Vendor Code', 'GST No.', 'PAN No.', 'Category', 'Plant',
    'Status', 'Risk Score', 'MSME', 'SEZ', 'International',
    'Contact Name', 'Contact Email', 'Contact Phone',
    'Address', 'City', 'State', 'PIN', 'Country',
    'Bank Name', 'Bank Account', 'Bank IFSC', 'Currency', 'Incoterms',
    'Created By', 'Created',
  ]
  const rows = vendors.map(v => [
    v.company_name ?? '', v.vendor_code ?? '', v.gst_number ?? '', v.pan_number ?? '',
    v.category_name ?? '', v.plant_name ?? '', v.status ?? '',
    v.risk_score?.toFixed(1) ?? '',
    v.is_msme ? 'Yes' : 'No', v.is_sez ? 'Yes' : 'No', v.is_international ? 'Yes' : 'No',
    v.contact_name ?? '', v.contact_email ?? '', v.contact_phone ?? '',
    v.address ?? '', v.city ?? '', v.state ?? '', v.pincode ?? '', v.country ?? '',
    v.bank_name ?? '', v.bank_account ?? '', v.bank_ifsc ?? '',
    v.currency ?? '', v.incoterms ?? '', v.created_by_name ?? '',
    v.created_at ? formatDate(v.created_at) : '',
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `vendors_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onClose, onConfirm, isPending }: Readonly<{
  name: string; onClose: () => void; onConfirm: () => void; isPending: boolean
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold">Delete Vendor</h2>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-medium text-foreground">{name}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm} className="gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Status summary badges ────────────────────────────────────────────────────

function StatusSummary({ totalCount, counts }: { totalCount: number; counts: Record<string, number> }) {
  const badges = [
    { key: 'total', label: 'Total', count: totalCount, cls: 'bg-gray-900 text-white' },
    { key: 'draft', label: 'Draft', count: counts['draft'] ?? 0, cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    { key: 'pending_approval', label: 'Pending', count: counts['pending_approval'] ?? 0, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    { key: 'approved', label: 'Approved', count: counts['approved'] ?? 0, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    { key: 'rejected', label: 'Rejected', count: counts['rejected'] ?? 0, cls: 'bg-red-50 text-red-700 border border-red-200' },
    { key: 'blocked', label: 'Blocked', count: counts['blocked'] ?? 0, cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
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

// ─── Mobile vendor card ───────────────────────────────────────────────────────

function VendorCard({ v, onDelete, onClick }: { v: any; onDelete: () => void; onClick: () => void }) {
  const hasQuot = (v.quotations_count ?? 0) + (v.purchase_requests_count ?? 0) + (v.purchase_orders_count ?? 0) > 0

  return (
    <div
      onClick={onClick}
      className="p-4 border-b last:border-b-0 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer select-none"
    >
      {/* Row 1: name + status + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-snug truncate" title={v.company_name}>
            {v.company_name}
          </p>
          {(v.city || v.state) && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              {[v.city, v.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={v.status} />
          {v.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={e => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: vendor code + plant + category */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {v.vendor_code && (
          <span className="text-xs font-mono font-medium text-foreground">{v.vendor_code}</span>
        )}
        {v.plant_name && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Building className="w-2.5 h-2.5 shrink-0" /> {v.plant_name}
          </span>
        )}
        {v.category_name && (
          <span className="text-xs text-muted-foreground">{v.category_name}</span>
        )}
      </div>

      {/* Row 3: quotation badges + score + date */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {hasQuot ? (
            <>
              <QuotBadge count={v.quotations_count ?? 0} label="Quot." color="bg-blue-50 text-blue-700 border-blue-200" />
              <QuotBadge count={v.purchase_requests_count ?? 0} label="PR" color="bg-violet-50 text-violet-700 border-violet-200" />
              <QuotBadge count={v.purchase_orders_count ?? 0} label="PO" color="bg-emerald-50 text-emerald-700 border-emerald-200" />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No quotations</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {v.performance_score != null && <VendorScore score={v.performance_score} />}
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(v.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────



export default function VendorsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [plantFilter, setPlantFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deletingVendor, setDeletingVendor] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [search] = useDebounce(searchInput, 1000)
  const ordering = sortDir === 'asc' ? sortField : `-${sortField}`
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async (hashId: string) => apiClient.delete(`/vendors/${hashId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: 'Vendor deleted' })
      setDeletingVendor(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to delete vendor'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: categories } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => { const r = await apiClient.get('/vendors/categories/'); return r.data.results ?? r.data },
  })
  const plantList: any[] = Array.isArray(plants) ? plants : []
  const categoryList: any[] = Array.isArray(categories) ? categories : []

  const hasFilters = !!(search || statusFilter || plantFilter || categoryFilter)
  const activeFilterCount = [statusFilter, plantFilter, categoryFilter].filter(Boolean).length

  const clearFilters = () => {
    setSearchInput(''); setStatusFilter(''); setPlantFilter(''); setCategoryFilter(''); setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', search, statusFilter, plantFilter, categoryFilter, page, ordering],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE), ordering }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (plantFilter) params.plant = plantFilter
      if (categoryFilter) params.category = categoryFilter
      const { data } = await apiClient.get('/vendors/', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })

  const fetchAllForExport = useCallback(async () => {
    const params: Record<string, string> = { page_size: '9999', ordering }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (plantFilter) params.plant = plantFilter
    if (categoryFilter) params.category = categoryFilter
    const { data } = await apiClient.get('/vendors/', { params })
    return (data?.results ?? data) as any[]
  }, [search, statusFilter, plantFilter, categoryFilter, ordering])

  const vendors: any[] = data?.results ?? (Array.isArray(data) ? data : [])
  const totalCount: number = data?.count ?? vendors.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const statusCounts = vendors.reduce((acc: Record<string, number>, v) => {
    acc[v.status ?? 'unknown'] = (acc[v.status ?? 'unknown'] ?? 0) + 1
    return acc
  }, {})

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const sortProps = { current: sortField, dir: sortDir, onSort: handleSort }
  useEffect(() => { setPage(1) }, [search])
  return (
    <div className="space-y-4">

      {/* ── Mobile search + filter toggle ── */}
      <div className="flex items-center gap-2 sm:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors…"
            className="pl-9 h-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5 shrink-0 relative"
          onClick={() => setShowFilters(f => !f)}
        >
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
          <select
            className="h-9 border rounded-md px-3 text-sm bg-background w-full"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="blocked">Blocked</option>
          </select>
          <select
            className="h-9 border rounded-md px-3 text-sm bg-background w-full"
            value={plantFilter}
            onChange={e => { setPlantFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Plants</option>
            {plantList.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <select
            className="h-9 border rounded-md px-3 text-sm bg-background w-full"
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Categories</option>
            {categoryList.map((c: any) => <option key={c.id} value={c.series_code}>{c.name}</option>)}
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground w-full justify-center h-9">
              <X className="w-3.5 h-3.5" /> Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* ── Desktop: full inline filter bar ── */}
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors by name, ID…"
            className="pl-9 h-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[140px]"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[130px]"
          value={plantFilter}
          onChange={e => { setPlantFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Plants</option>
          {plantList.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <select
          className="h-9 border rounded-md px-3 text-sm bg-background shrink-0 min-w-[160px]"
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Categories</option>
          {categoryList.map((c: any) => <option key={c.id} value={c.series_code}>{c.name}</option>)}
        </select>
        {hasFilters && (
          <Button size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground h-9 bg-white border border-muted hover:bg-muted/50">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Status summary + action buttons ── */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusSummary totalCount={totalCount} counts={statusCounts} />
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={totalCount === 0}
              onClick={async () => {
                const exportData = await fetchAllForExport()
                if (!exportData.length) { toast({ title: 'No vendors to export', variant: 'destructive' }); return }
                exportCSV(exportData)
              }}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Link href="/vendors/import">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            </Link>
            <Link href="/vendors/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Vendor</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Card (mobile) / Table (md+) ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading vendors…
            </div>
          )}
          {!isLoading && vendors.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">No vendors found.</div>
          )}

          {/* Mobile cards */}
          {!isLoading && vendors.length > 0 && (
            <div className="md:hidden">
              {vendors.map((v: any) => (
                <VendorCard
                  key={v.id}
                  v={v}
                  onDelete={() => setDeletingVendor(v)}
                  onClick={() => router.push(`/vendors/${v.hash_id}`)}
                />
              ))}
            </div>
          )}

          {/* Desktop table */}
          {!isLoading && vendors.length > 0 && (
            <div className="hidden md:block w-full overflow-auto max-h-[70vh]">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 border-b sticky top-0 z-10">
                  <tr>
                    <SortableTh field="company_name" label="Company" {...sortProps} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Vendor ID / Plant
                    </th>
                    <SortableTh field="category_name" label="Category" {...sortProps} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Quotation
                    </th>
                    <SortableTh field="performance_score" label="Vendor Score" {...sortProps} />
                    <SortableTh field="status" label="Status" {...sortProps} />
                    <SortableTh field="created_at" label="Created At" {...sortProps} />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendors.map((v: any) => (
                    <tr
                      key={v.id}
                      onClick={() => router.push(`/vendors/${v.hash_id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-sm leading-snug max-w-[200px] truncate" title={v.company_name}>
                          {v.company_name}
                        </p>
                        {(v.city || v.state) && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            {[v.city, v.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {v.vendor_code && (
                          <p className="text-xs font-mono font-medium text-foreground">{v.vendor_code}</p>
                        )}
                        {v.plant_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Building className="w-2.5 h-2.5" /> {v.plant_name}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {v.category_name
                          ? <p className="text-xs font-mono font-medium text-foreground">{v.category_name}</p>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(v.quotations_count ?? 0) + (v.purchase_requests_count ?? 0) + (v.purchase_orders_count ?? 0) === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <>
                              <QuotBadge count={v.quotations_count ?? 0} label="Quot." color="bg-blue-50 text-blue-700 border-blue-200" />
                              <QuotBadge count={v.purchase_requests_count ?? 0} label="PR" color="bg-violet-50 text-violet-700 border-violet-200" />
                              <QuotBadge count={v.purchase_orders_count ?? 0} label="PO" color="bg-emerald-50 text-emerald-700 border-emerald-200" />
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <VendorScore score={v.performance_score} />
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} />
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(v.created_at)}
                      </td>

                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {v.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={e => { e.stopPropagation(); setDeletingVendor(v) }}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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

      {deletingVendor && (
        <DeleteConfirmModal
          name={deletingVendor.company_name}
          onClose={() => setDeletingVendor(null)}
          onConfirm={() => deleteMutation.mutate(deletingVendor.hash_id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} vendor{totalCount === 1 ? '' : 's'}
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