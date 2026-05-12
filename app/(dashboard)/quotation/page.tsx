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
        <div className="h-full min-h-0 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload, review, and manage vendor quotes for your procurement requests
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    <Link href="/quotation/new">
                        <Button type="button" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Upload Quote
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                    {
                        title: 'Total Quotes',
                        value: totalQuotes,
                        valueClass: '',
                        caption: (
                            <>
                                This month <span className="text-emerald-700 font-medium">+5</span>
                            </>
                        ),
                    },
                    {
                        title: 'Pending Review',
                        value: pendingReviewCount,
                        valueClass: 'text-amber-700',
                        caption: 'Awaiting confirmation',
                    },
                    {
                        title: 'Attached To PRs',
                        value: attachedCount,
                        valueClass: 'text-indigo-700',
                        caption: 'In approval process',
                    },
                    {
                        title: 'Expiring Soon',
                        value: expiringSoonCount,
                        valueClass: 'text-red-700',
                        caption: 'Within next 7 days',
                    },
                ].map((c) => (
                    <Card key={c.title} className="rounded-2xl border border-slate-200">
                        <CardContent className="p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.title}</p>
                            <p className={['text-3xl font-semibold mt-2', c.valueClass].filter(Boolean).join(' ')}>{c.value}</p>
                            <p className="text-xs text-muted-foreground mt-2">{c.caption}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs + Filters */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative w-full max-w-xxl flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search quotations..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="ml-auto flex items-center gap-2 flex-wrap">
                        <select
                            className="h-10 border rounded-md px-10 text-sm bg-background"
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
                            className="h-10 border rounded-md px-10 text-sm bg-background"
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
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex flex-wrap items-center gap-2">
                        {[
                            { key: 'all', label: `All (${totalQuotes})` },
                            { key: 'pending', label: `Pending Review (${pendingReviewCount})` },
                            { key: 'confirmed', label: `Confirmed (${confirmedCount})` },
                            { key: 'attached', label: `Attached to PR (${attachedCount})` },
                            { key: 'expiring', label: `Expiring (${expiringSoonCount})` },
                        ].map((t) => {
                            const active = view === (t.key as any)
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => {
                                        setView(t.key as any)
                                        setStatusFilterSource('tab')
                                        if (t.key === 'pending') setStatusFilter('pending_approval')
                                        else if (t.key === 'confirmed') setStatusFilter('approved')
                                        else setStatusFilter('')
                                    }}
                                    className={[
                                        'h-8 px-3 rounded-full border text-xs font-medium transition-colors',
                                        active
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-foreground',
                                    ].join(' ')}
                                >
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="ml-auto flex items-center gap-2 flex-wrap">
                        {showClear && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 text-muted-foreground gap-1"
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
                </div>
            </div>

            {/* List */}
            <div className="flex-1 min-h-0">
                {isLoading ? (
                    <Card className="h-full">
                        <CardContent className="h-full p-8 text-center text-muted-foreground flex items-center justify-center">
                            Loading quotations...
                        </CardContent>
                    </Card>
                ) : isError ? (
                    <Card className="h-full">
                        <CardContent className="h-full p-8 text-center text-destructive flex items-center justify-center">
                            Failed to load quotations.
                        </CardContent>
                    </Card>
                ) : filtered.length === 0 ? (
                    <Card className="h-full">
                        <CardContent className="h-full p-8 text-center text-muted-foreground flex items-center justify-center">
                            {hasFiltersForEmptyState ? 'No quotations match your filters.' : 'No quotations found.'}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="h-full rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="h-full overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-slate-50 text-muted-foreground">
                                <tr className="border-b border-slate-200">
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Quote Ref</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Vendor</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Category</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Department / Plant</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Total Value</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Submitted</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Valid Until</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">PR Linked</th>
                                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider px-4 py-3 whitespace-nowrap">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                                </thead>
                                <tbody>
                                {filtered.map((q) => {
                                    const validity = getValidity(q)
                                    const pr = q.pr_number && q.pr_number !== '—' ? q.pr_number : null
                                    const category = q.category_name ?? '—'
                                    const department = q.department_name ?? '—'
                                    const plant = q.plant_name ?? '—'
                                    const actionLabel = q.status === 'pending_approval' ? 'Review' : 'View'

                                    return (
                                        <tr key={q.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    className="text-blue-700 font-mono text-xs hover:underline"
                                                    onClick={() => router.push(`/quotation/${q.id}`)}
                                                >
                                                    {q.ref_no}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4 min-w-[240px]">
                                                <div className="font-medium">{q.vendor_name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {q.is_new_vendor ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <Badge variant="warning" className="h-5 px-2 py-0 text-[10px] font-semibold">New Vendor</Badge>
                                                            {q.vendor_gstin ? <span className="font-mono">GSTIN: {q.vendor_gstin}</span> : null}
                                                        </span>
                                                    ) : (
                                                        q.vendor_gstin ? <span className="font-mono">GSTIN: {q.vendor_gstin}</span> : <span>Existing vendor</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {category && category !== '—' ? (
                                                    <Badge variant="info" className="font-semibold border-0">
                                                        {category}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const hasDept = Boolean(department && department !== '—')
                                                    const hasPlant = Boolean(plant && plant !== '—')
                                                    if (!hasDept && !hasPlant) return <span className="text-muted-foreground">—</span>
                                                    return (
                                                        <>
                                                            {hasDept && (
                                                                <Badge variant="info" className="font-semibold border-0">
                                                                    {department}
                                                                </Badge>
                                                            )}
                                                            {hasPlant && (
                                                                <div className={hasDept ? 'mt-1' : ''}>
                                                                    <Badge variant="info" className="font-semibold border-0">
                                                                        {plant}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap tabular-nums font-semibold">{formatCurrency(q.total_amount)}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-xs text-muted-foreground">
                                                {q.created_at ? formatDate(q.created_at) : '—'}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-xs">
                                                {validity ? (
                                                    <span className={validity.daysLeft >= 0 && validity.daysLeft <= 7 ? 'text-red-700 font-medium' : 'text-foreground'}>
                                                        {formatDate(validity.validUntil.toISOString())}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {pr ? (
                                                    <Badge variant="info" className="font-mono font-semibold">{pr}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <StatusBadge status={q.status} />
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.push(`/quotation/${q.id}`)}
                                                        className="h-9"
                                                    >
                                                        {actionLabel}
                                                    </Button>
                                                    {q.status === 'draft' && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            disabled={deletingId === q.id}
                                                            onClick={() => setPendingDelete(q)}
                                                            aria-label="Delete pending quotation"
                                                        >
                                                            {deletingId === q.id
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Trash2 className="h-4 w-4" />}
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
                    </div>
                )}
            </div>

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
