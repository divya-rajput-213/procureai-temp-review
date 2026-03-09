'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Upload, Search, Download, FileText,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'
type SortField = 'company_name' | 'status' | 'created_at' | 'category_name' | 'performance_score'

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: Readonly<{ field: SortField; current: SortField; dir: SortDir }>) {
  if (field !== current) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
  return dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
    : <ChevronDown className="w-3.5 h-3.5 text-primary" />
}

function SortableTh({
  field, label, current, dir, onSort,
}: Readonly<{
  field: SortField; label: string; current: SortField; dir: SortDir
  onSort: (f: SortField) => void
}>) {
  return (
    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label} <SortIcon field={field} current={current} dir={dir} />
      </button>
    </th>
  )
}

// ─── CSV / PDF export ─────────────────────────────────────────────────────────

function exportCSV(vendors: any[]) {
  const headers = [
    'Company', 'Vendor Code', 'GST No.', 'PAN No.', 'Category', 'Plant',
    'Status', 'Risk Score', 'MSME', 'MSME No.', 'SEZ', 'International',
    'Contact Name', 'Contact Email', 'Contact Phone',
    'Address', 'City', 'State', 'PIN', 'Country',
    'Bank Name', 'Bank Account', 'Bank IFSC',
    'Lead Time Std (days)', 'Lead Time Rush (days)', 'MOQ',
    'Pricing Model', 'Payment Terms', 'Currency', 'Incoterms',
    'Created By', 'Created',
  ]
  const rows = vendors.map(v => [
    v.company_name ?? '',
    v.vendor_code ?? '',
    v.gst_number ?? '',
    v.pan_number ?? '',
    v.category_name ?? '',
    v.plant_name ?? '',
    v.status ?? '',
    v.risk_score?.toFixed(1) ?? '',
    v.is_msme ? 'Yes' : 'No',
    v.msme_number ?? '',
    v.is_sez ? 'Yes' : 'No',
    v.is_international ? 'Yes' : 'No',
    v.contact_name ?? '',
    v.contact_email ?? '',
    v.contact_phone ?? '',
    v.address ?? '',
    v.city ?? '',
    v.state ?? '',
    v.pincode ?? '',
    v.country ?? '',
    v.bank_name ?? '',
    v.bank_account ?? '',
    v.bank_ifsc ?? '',
    v.standard_lead_time_days ?? '',
    v.rush_lead_time_days ?? '',
    v.min_order_quantity ?? '',
    v.pricing_model ?? '',
    v.payment_terms ?? '',
    v.currency ?? '',
    v.incoterms ?? '',
    v.created_by_name ?? '',
    v.created_at ? formatDate(v.created_at) : '',
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vendors_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(vendors: any[]) {
  const infoRows = vendors.map(v => `
    <tr>
      <td>${v.company_name ?? ''}</td>
      <td>${v.vendor_code ?? ''}</td>
      <td>${v.gst_number ?? ''}</td>
      <td>${v.pan_number ?? ''}</td>
      <td>${v.category_name ?? ''}</td>
      <td>${v.plant_name ?? ''}</td>
      <td>${v.status ?? ''}</td>
      <td>${v.risk_score?.toFixed(1) ?? '—'}</td>
      <td>${v.is_msme ? 'Yes' : 'No'}</td>
      <td>${v.is_sez ? 'Yes' : 'No'}</td>
      <td>${v.created_at ? formatDate(v.created_at) : ''}</td>
    </tr>`).join('')

  const contactRows = vendors.map(v => `
    <tr>
      <td>${v.company_name ?? ''}</td>
      <td>${v.contact_name ?? ''}</td>
      <td>${v.contact_email ?? ''}</td>
      <td>${v.contact_phone ?? ''}</td>
      <td>${v.address ?? ''}</td>
      <td>${v.city ?? ''}</td>
      <td>${v.state ?? ''}</td>
      <td>${v.pincode ?? ''}</td>
      <td>${v.country ?? ''}</td>
      <td>${v.bank_name ?? ''}</td>
      <td>${v.bank_account ?? ''}</td>
      <td>${v.bank_ifsc ?? ''}</td>
    </tr>`).join('')

  const commercialRows = vendors.map(v => `
    <tr>
      <td>${v.company_name ?? ''}</td>
      <td>${v.pricing_model ?? ''}</td>
      <td>${v.payment_terms ?? ''}</td>
      <td>${v.currency ?? ''}</td>
      <td>${v.incoterms ?? ''}</td>
      <td>${v.standard_lead_time_days ?? ''}</td>
      <td>${v.rush_lead_time_days ?? ''}</td>
      <td>${v.min_order_quantity ?? ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Vendor List</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; }
    h2 { font-size: 13px; margin: 0 0 8px; }
    h3 { font-size: 11px; margin: 18px 0 6px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th { background: #f1f5f9; text-align: left; padding: 5px 6px; border: 1px solid #e2e8f0; font-weight: 600; white-space: nowrap; }
    td { padding: 4px 6px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <h2>Vendor List — ${new Date().toLocaleDateString()}</h2>

  <h3>Company &amp; Identity</h3>
  <table>
    <thead><tr>
      <th>Company</th><th>Code</th><th>GST No.</th><th>PAN No.</th>
      <th>Category</th><th>Plant</th>
      <th>Status</th><th>Risk</th><th>MSME</th><th>SEZ</th><th>Created</th>
    </tr></thead>
    <tbody>${infoRows}</tbody>
  </table>

  <h3>Contact &amp; Address</h3>
  <table>
    <thead><tr>
      <th>Company</th><th>Contact</th><th>Email</th><th>Phone</th>
      <th>Address</th><th>City</th><th>State</th><th>PIN</th><th>Country</th>
      <th>Bank Name</th><th>Account No.</th><th>IFSC</th>
    </tr></thead>
    <tbody>${contactRows}</tbody>
  </table>

  <h3>Commercial Terms</h3>
  <table>
    <thead><tr>
      <th>Company</th><th>Pricing Model</th><th>Payment Terms</th><th>Currency</th>
      <th>Incoterms</th><th>Lead Time Std (d)</th><th>Lead Time Rush (d)</th><th>MOQ</th>
    </tr></thead>
    <tbody>${commercialRows}</tbody>
  </table>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) { URL.revokeObjectURL(url); return }
  win.addEventListener('load', () => { win.focus(); win.print() })
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function StarRating({ score }: Readonly<{ score: number }>) {
  const filled = Math.round(score / 20)   // 0-100 → 0-5
  return (
    <div className="flex items-center gap-0.5" title={`${score.toFixed(0)} / 100`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-base leading-none ${i < filled ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
      ))}
      <span className="text-xs text-muted-foreground ml-1 tabular-nums">{score.toFixed(0)}</span>
    </div>
  )
}

function riskLevel(score: number): { cls: string; label: string } {
  if (score <= 30) return { cls: 'bg-green-100 text-green-700', label: 'Low' }
  if (score <= 60) return { cls: 'bg-amber-100 text-amber-700', label: 'Medium' }
  return { cls: 'bg-red-100 text-red-700', label: 'High' }
}

function RiskBadge({ score }: Readonly<{ score: number }>) {
  const { cls, label } = riskLevel(score)
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full tabular-nums ${cls}`}>
      {label} ({score.toFixed(0)})
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function VendorsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [plantFilter, setPlantFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const ordering = sortDir === 'asc' ? sortField : `-${sortField}`
  const router = useRouter()

  // Fetch plants & categories for filter dropdowns
  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => (await apiClient.get('/users/plants/')).data,
  })
  const { data: categories } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => (await apiClient.get('/vendors/categories/')).data,
  })
  const plantList: any[] = plants?.results ?? (Array.isArray(plants) ? plants : [])
  const categoryList: any[] = categories?.results ?? (Array.isArray(categories) ? categories : [])

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', search, statusFilter, plantFilter, categoryFilter, page, ordering],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        page_size: String(PAGE_SIZE),
        ordering,
      }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (plantFilter) params.plant = plantFilter
      if (categoryFilter) params.category = categoryFilter
      const { data } = await apiClient.get('/vendors/', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })

  // For export we fetch ALL records (no pagination)
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

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const handleStatus = (val: string) => {
    setStatusFilter(val)
    setPage(1)
  }

  const handlePlant = (val: string) => {
    setPlantFilter(val)
    setPage(1)
  }

  const handleCategory = (val: string) => {
    setCategoryFilter(val)
    setPage(1)
  }

  const handleExportCSV = async () => {
    const all = await fetchAllForExport()
    exportCSV(all)
  }

  const handleExportPDF = async () => {
    const all = await fetchAllForExport()
    exportPDF(all)
  }

  const sortProps = { current: sortField, dir: sortDir, onSort: handleSort }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors…"
              className="pl-9"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background shrink-0"
            value={statusFilter}
            onChange={e => handleStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="blocked">Blocked</option>
          </select>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background shrink-0"
            value={plantFilter}
            onChange={e => handlePlant(e.target.value)}
          >
            <option value="">All Plants</option>
            {plantList.map((p: any) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <select
            className="h-10 border rounded-md px-3 text-sm bg-background shrink-0"
            value={categoryFilter}
            onChange={e => handleCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categoryList.map((c: any) => (
              <option key={c.id} value={c.series_code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          {/* <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
          <Link href="/vendors/import">
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" /> Import
            </Button>
          </Link> */}
          <Link href="/vendors/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add Vendor
            </Button>
          </Link>
        </div>
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {totalCount} vendor{totalCount === 1 ? '' : 's'}
          {(search || statusFilter || plantFilter || categoryFilter) && ' matching filters'}
        </p>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading vendors…</div>
          )}
          {!isLoading && vendors.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No vendors found.</div>
          )}
          {!isLoading && vendors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <SortableTh field="company_name" label="Company" {...sortProps} />
                    <SortableTh field="category_name" label="Category" {...sortProps} />
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Contracts</th>
                    <SortableTh field="status" label="Status" {...sortProps} />
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Risk</th>
                    <SortableTh field="performance_score" label="Rating" {...sortProps} />
                    <SortableTh field="created_at" label="Since" {...sortProps} />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vendors.map((v: any) => (
                    <tr
                      key={v.id}
                      onClick={() => router.push(`/vendors/${v.hash_id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <p className="font-semibold max-w-[200px] truncate leading-snug" title={v.company_name}>
                          {v.company_name}
                        </p>
                        {v.vendor_code && (
                          <p className="text-xs text-muted-foreground font-mono">{v.vendor_code}</p>
                        )}
                        {v.city && (
                          <p className="text-xs text-muted-foreground">{[v.city, v.state].filter(Boolean).join(', ')}</p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="text-sm">{v.category_name || <span className="text-muted-foreground">—</span>}</span>
                        {v.plant_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">{v.plant_name}</p>
                        )}
                      </td>

                      {/* Contracts */}
                      <td className="px-4 py-3 text-center">
                        {v.contracts_count > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {v.contracts_count}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} />
                      </td>

                      {/* Risk */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {v.risk_score == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <RiskBadge score={v.risk_score} />
                        )}
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3">
                        {v.performance_score == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <StarRating score={v.performance_score} />
                        )}
                      </td>

                      {/* Since */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(v.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {totalCount} total
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const p = start + i
              if (p > totalPages) return null
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {p}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              »
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
