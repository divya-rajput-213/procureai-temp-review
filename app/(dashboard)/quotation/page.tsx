'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate, VALIDITY_DAYS, parseLooseDate, diffDays } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

type Category = { id: number; hash_id: string; name: string; is_active?: boolean }

type Quotation = {
    id: number | string
    hash_id: string
    ref_no: string
    quotation_no: string
    quotation_date: string
    vendor_name: string
    vendor_gstin?: string
    is_new_vendor?: boolean
    category_name?: string
    department_name?: string
    plant_name?: string
    pr_number: string
    status: string
    uploaded_by: string
    items_count: number
    total_amount: number
    created_at: string
}

function mapQuotation(raw: any): Quotation {
    return {
        id: raw.id ?? raw.hash_id,
        hash_id: raw.hash_id ?? raw.id,
        ref_no: raw.ref_no ?? '—',
        quotation_no: raw.quotation_no ?? raw.quotation_number ?? '—',
        quotation_date: raw.quotation_date ?? '—',
        vendor_name:
            raw.vendor_name ??
            raw.vendor?.company_name ??
            raw.vendor?.name ??
            raw.vendor_company_name ??
            '—',
        vendor_gstin:
            raw.vendor_gstin ??
            raw.gstin ??
            raw.vendor?.gstin ??
            raw.vendor?.tax_id ??
            undefined,
        is_new_vendor: Boolean(raw.is_new_vendor ?? raw.vendor?.is_new_vendor ?? false),
        category_name:
            raw.category_name ??
            raw.category?.name ??
            raw.procurement_category_name ??
            undefined,
        department_name:
            raw.department_name ??
            raw.department?.name ??
            raw.procurement?.department_name ??
            undefined,
        plant_name:
            raw.plant_name ??
            raw.plant?.name ??
            raw.procurement?.plant_name ??
            undefined,
        pr_number:
            raw.pr_no ??
            raw.pr_number ??
            raw.purchase_requisition_number ??
            raw.procurement?.pr_number ??
            raw.pr?.pr_number ??
            '—',
        status: raw.status ?? 'draft',
        uploaded_by:
            raw.uploaded_by ??
            raw.uploaded_by_name ??
            raw.uploaded_by?.full_name ??
            raw.created_by_name ??
            raw.created_by?.full_name ??
            '—',
        items_count: Number(raw.items_count ?? 0),
        total_amount: Number(raw.total_amount ?? 0),
        created_at: raw.created_at ?? raw.uploaded_at ?? '',
    }
}

function getValidity(quotation: Quotation) {
    const base = parseLooseDate(quotation.quotation_date) ?? parseLooseDate(quotation.created_at)
    if (!base) return null
    const validUntil = new Date(base)
    validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS)
    const daysLeft = diffDays(new Date(), validUntil)
    return { validUntil, daysLeft }
}


export default function QuotationPage() {
    const [search, setSearch] = useState('')
    const [vendorFilter, setVendorFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [statusFilterSource, setStatusFilterSource] = useState<'tab' | 'manual'>('tab')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [view, setView] = useState<'all' | 'pending' | 'confirmed' | 'attached' | 'expiring'>('all')
    const [deletingId, setDeletingId] = useState<number | string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<Quotation | null>(null)

    const router = useRouter()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const deleteMutation = useMutation({
        mutationFn: async (id: number | string) => {
            await apiClient.delete(`/quotations/${id}/`)
            return id
        },
        onMutate: (id) => setDeletingId(id),
        onSettled: () => setDeletingId(null),
        onSuccess: () => {
            toast({ title: 'Quotation deleted' })
            queryClient.invalidateQueries({ queryKey: ['quotations'] })
            setPendingDelete(null)
        },
        onError: (err: any) => {
            const message = err?.response?.data?.error ?? err?.response?.data?.detail ?? 'Could not delete quotation.'
            toast({ title: 'Delete failed', description: message, variant: 'destructive' })
        },
    })

    const { data, isLoading, isError } = useQuery({
        queryKey: ['quotations', search],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)

            const queryString = params.toString()
            const { data } = await apiClient.get(`/quotations/${queryString ? `?${queryString}` : ''}`)
            const records = data?.results || data || []
            return Array.isArray(records) ? records.map(mapQuotation) : []
        },
    })

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const r = await apiClient.get('/users/departments/')
            return r.data?.results ?? r.data ?? []
        },
    })

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['item-categories-active'],
        queryFn: async () => {
            const r = await apiClient.get('/procurement/categories/?active_only=true')
            return r.data?.results ?? r.data ?? []
        },
    })

    //  Apply Filters
    const allQuotations = data || []
    const totalQuotes = allQuotations.length
    const pendingReviewCount = allQuotations.filter((q: Quotation) => q.status === 'pending_approval').length
    const confirmedCount = allQuotations.filter((q: Quotation) => q.status === 'approved').length
    const attachedCount = allQuotations.filter((q: Quotation) => String(q.pr_number ?? '').trim() && q.pr_number !== '—').length
    const expiringSoonCount = allQuotations.filter((q: Quotation) => {
        const validity = getValidity(q)
        return validity ? validity.daysLeft >= 0 && validity.daysLeft <= 7 : false
    }).length

    const filtered = allQuotations.filter((q: Quotation) => {
        const term = search.trim().toLowerCase()
        const matchesSearch = term
            ? (
                q.ref_no.toLowerCase().includes(term) ||
                q.quotation_no.toLowerCase().includes(term) ||
                q.vendor_name.toLowerCase().includes(term)
            )
            : true

        const matchesStatus = statusFilter ? q.status === statusFilter : true
        const matchesVendor = vendorFilter.trim()
            ? q.vendor_name.toLowerCase().includes(vendorFilter.trim().toLowerCase())
            : true
        const matchesDepartment = departmentFilter
            ? (q.department_name ?? '').toLowerCase() === departmentFilter.toLowerCase()
            : true
        const matchesCategory = categoryFilter
            ? (q.category_name ?? '').toLowerCase() === categoryFilter.toLowerCase()
            : true

        const matchesView =
            view === 'all'
                ? true
                : view === 'pending'
                    ? q.status === 'pending_approval'
                    : view === 'confirmed'
                        ? q.status === 'approved'
                        : view === 'attached'
                            ? String(q.pr_number ?? '').trim() && q.pr_number !== '—'
                            : view === 'expiring'
                                ? (() => {
                                    const validity = getValidity(q)
                                    return validity ? validity.daysLeft >= 0 && validity.daysLeft <= 7 : false
                                })()
                                : true

        return matchesSearch && matchesStatus && matchesVendor && matchesDepartment && matchesCategory && matchesView
    })

    const showClear =
        Boolean(search.trim()) ||
        Boolean(vendorFilter.trim()) ||
        (statusFilterSource === 'manual' && Boolean(statusFilter)) ||
        Boolean(departmentFilter) ||
        Boolean(categoryFilter)

    const hasFiltersForEmptyState =
        Boolean(search.trim()) ||
        Boolean(vendorFilter.trim()) ||
        Boolean(statusFilter) ||
        Boolean(departmentFilter) ||
        Boolean(categoryFilter) ||
        view !== 'all'

    function exportCsv() {
        const rows = filtered.map((q) => {
            const validity = getValidity(q)
            return {
                ref_no: q.ref_no,
                vendor_name: q.vendor_name,
                category: q.category_name ?? '',
                department: q.department_name ?? '',
                plant: q.plant_name ?? '',
                total_value: q.total_amount,
                submitted: q.created_at ? formatDate(q.created_at) : '',
                valid_until: validity ? formatDate(validity.validUntil.toISOString()) : '',
                pr_linked: q.pr_number && q.pr_number !== '—' ? q.pr_number : '',
                status: q.status,
            }
        })

        const header = Object.keys(rows[0] ?? { ref_no: '', vendor_name: '' })
        const escape = (val: unknown) => {
            const s = String(val ?? '')
            return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
        }
        const csv = [header.join(','), ...rows.map((r) => header.map((k) => escape((r as any)[k])).join(','))].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-4">
            {/* Action Bar (Structure matched to Procurement) */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <div className="relative min-w-[180px] max-w-xs flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search quotations..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="h-10 border rounded-md px-3 text-sm bg-background"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setStatusFilterSource('manual')
                        }}
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved</option>
                    </select>

                    <select
                        className="h-10 border rounded-md px-3 text-sm bg-background"
                        aria-label="Department filter"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                    >
                        <option value="">All Departments</option>
                        {departments.map((d: any) => {
                            const name = d?.name ?? d?.department_name
                            if (!name) return null
                            return (
                                <option key={d?.id ?? d?.hash_id ?? name} value={String(name)}>
                                    {String(name)}
                                </option>
                            )
                        })}
                    </select>

                    <select
                        className="h-10 border rounded-md px-3 text-sm bg-background hidden md:block"
                        aria-label="Category filter"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.hash_id ?? c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    {showClear && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground gap-1"
                            onClick={() => {
                                setSearch('')
                                setVendorFilter('')
                                setStatusFilter('')
                                setStatusFilterSource('tab')
                                setDepartmentFilter('')
                                setCategoryFilter('')
                                setView('all')
                            }}
                        >
                            <X className="w-3.5 h-3.5" /> Clear
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" variant="outline" className="gap-2 h-10 hidden sm:flex" onClick={exportCsv} disabled={filtered.length === 0}>
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    <Link href="/quotation/new">
                        <Button type="button" className="gap-2 shrink-0">
                            <Plus className="h-4 w-4" />
                            Upload Quote
                        </Button>
                    </Link>
                </div>
            </div>

            {/* List */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading quotations...
                        </div>
                    ) : isError ? (
                        <div className="p-8 text-center text-destructive flex items-center justify-center font-medium">
                            Failed to load quotations.
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground flex items-center justify-center">
                            {hasFiltersForEmptyState ? 'No quotations match your filters.' : 'No quotations found.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b text-muted-foreground">
                                    <tr>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap">Quote Ref</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap">Vendor</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap">Category</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap hidden md:table-cell">Dept / Plant</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap">Total Value</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap hidden lg:table-cell">Submitted</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap hidden sm:table-cell">Valid Until</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap hidden xl:table-cell">PR Linked</th>
                                        <th className="text-left font-medium text-xs px-4 py-3 whitespace-nowrap">Status</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((q) => {
                                        const validity = getValidity(q)
                                        const pr = q.pr_number && q.pr_number !== '—' ? q.pr_number : null
                                        const category = q.category_name ?? '—'
                                        const department = q.department_name ?? '—'
                                        const plant = q.plant_name ?? '—'

                                        return (
                                            <tr
                                                key={q.id}
                                                className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/quotation/${q.id}`)}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="font-medium text-slate-900 text-sm">{q.ref_no}</div>
                                                </td>
                                                <td className="px-4 py-3 min-w-[200px]">
                                                    <div className="text-sm font-medium text-slate-900 truncate max-w-[250px]">{q.vendor_name}</div>
                                                    <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-tight">
                                                        {q.is_new_vendor ? (
                                                            <span className="flex items-center gap-1.5 font-bold text-amber-600">
                                                                NEW VENDOR
                                                                {q.vendor_gstin ? <span> • GSTIN: {q.vendor_gstin}</span> : null}
                                                            </span>
                                                        ) : (
                                                            q.vendor_gstin ? <span>GSTIN: {q.vendor_gstin}</span> : ""
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="text-xs text-muted-foreground">{category}</div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                                                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                                                        {department !== '—' ? department : plant !== '—' ? plant : '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900 text-xs tabular-nums">
                                                    {formatCurrency(q.total_amount)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground hidden lg:table-cell">
                                                    {q.created_at ? formatDate(q.created_at) : '—'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs hidden sm:table-cell">
                                                    {validity ? (
                                                        <span className={validity.daysLeft >= 0 && validity.daysLeft <= 7 ? 'text-red-600 font-medium' : 'text-slate-500'}>
                                                            {formatDate(validity.validUntil.toISOString())}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap hidden xl:table-cell">
                                                    {pr ? (
                                                        <span className="text-[10px] font-mono text-muted-foreground border px-1.5 py-0.5 rounded bg-slate-50">{pr}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <StatusBadge status={q.status} />
                                                </td>
                                                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                    {q.status === 'draft' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                            onClick={e => { e.stopPropagation(); setPendingDelete(q) }}
                                                        >
                                                            {deletingId === q.id
                                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                : <Trash2 className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    )}
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

            {/* Delete Confirmation Modal */}
            <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </span>
                            Delete draft quotation?
                        </DialogTitle>
                    </DialogHeader>

                    {pendingDelete && (
                        <div className="space-y-2 text-sm">
                            <p className="text-muted-foreground">This action cannot be undone. The quotation and all its line items will be permanently removed.</p>
                            <div className="rounded-md bg-slate-50 border p-3 space-y-1">
                                <p>
                                    <span className="text-muted-foreground">Quotation: </span>
                                    <span className="font-medium">{pendingDelete.quotation_no !== '—' ? pendingDelete.quotation_no : pendingDelete.ref_no}</span>
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Vendor: </span>
                                    <span className="font-medium">{pendingDelete.vendor_name}</span>
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Items: </span>
                                    <span className="font-medium tabular-nums">{pendingDelete.items_count}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPendingDelete(null)}
                            disabled={deleteMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className="gap-2"
                            disabled={deleteMutation.isPending}
                            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
                        >
                            {deleteMutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
