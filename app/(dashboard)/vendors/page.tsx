'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Plus, Upload, Search, ExternalLink, Download, FileText,
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
type SortField = 'company_name' | 'status' | 'performance_score' | 'created_at' | 'category_name'

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
  return dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
    : <ChevronDown className="w-3.5 h-3.5 text-primary" />
}

function SortableTh({
  field, label, current, dir, onSort,
}: {
  field: SortField; label: string; current: SortField; dir: SortDir
  onSort: (f: SortField) => void
}) {
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
    'Company', 'Vendor Code', 'GST No.', 'PAN No.', 'Category', 'Plant', 'SAP Code',
    'Status', 'Score', 'Risk Score', 'MSME', 'MSME No.', 'SEZ', 'International',
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
    v.sap_vendor_code ?? '',
    v.status ?? '',
    v.performance_score?.toFixed(1) ?? '',
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
      <td>${v.sap_vendor_code ?? ''}</td>
      <td>${v.status ?? ''}</td>
      <td>${v.performance_score?.toFixed(1) ?? '—'}</td>
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
      <th>Category</th><th>Plant</th><th>SAP Code</th>
      <th>Status</th><th>Score</th><th>Risk</th><th>MSME</th><th>SEZ</th><th>Created</th>
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

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  win.close()
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function scoreClass(score: number): string {
  if (score >= 70) return 'text-green-700 bg-green-50 border-green-200'
  if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${scoreClass(score)}`}>
      {score.toFixed(1)}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function VendorsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const ordering = sortDir === 'asc' ? sortField : `-${sortField}`

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', search, statusFilter, page, ordering],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        page_size: String(PAGE_SIZE),
        ordering,
      }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
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
    const { data } = await apiClient.get('/vendors/', { params })
    return (data?.results ?? data) as any[]
  }, [search, statusFilter, ordering])

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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
          <Link href="/vendors/import">
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" /> Import
            </Button>
          </Link>
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
          {(search || statusFilter) && ' matching filters'}
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">GST No.</th>
                    <SortableTh field="category_name" label="Category" {...sortProps} />
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plant</th>
                    <SortableTh field="status" label="Status" {...sortProps} />
                    <SortableTh field="performance_score" label="Score" {...sortProps} />
                    <SortableTh field="created_at" label="Created" {...sortProps} />
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vendors.map((v: any) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{v.company_name}</p>
                          {v.vendor_code && (
                            <p className="text-xs text-muted-foreground">{v.vendor_code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.gst_number || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.category_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.plant_name || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={v.performance_score} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(v.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/vendors/${v.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
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
