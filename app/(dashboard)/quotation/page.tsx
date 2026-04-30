'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import Link from 'next/link'

type Quotation = {
    id: number | string
    hash_id: string
    ref_no: string
    quotation_no: string
    quotation_date: string
    vendor_name: string
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


export default function QuotationPage() {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [vendorFilter, setVendorFilter] = useState('')
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
        queryKey: ['quotations', search, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (statusFilter) params.set('status', statusFilter)

            const queryString = params.toString()
            const { data } = await apiClient.get(`/quotations/${queryString ? `?${queryString}` : ''}`)
            const records = data?.results || data || []
            return Array.isArray(records) ? records.map(mapQuotation) : []
        },
    })

    //  Apply Filters
    const allQuotations = data || []
    const filtered = allQuotations.filter((q: Quotation) => {
        const term = search.toLowerCase()
        const matchesSearch =
            q.ref_no.toLowerCase().includes(term) ||
            q.quotation_no.toLowerCase().includes(term) ||
            q.vendor_name.toLowerCase().includes(term)

        const matchesStatus = statusFilter ? q.status === statusFilter : true
        const matchesVendor = vendorFilter.trim()
            ? q.vendor_name.toLowerCase().includes(vendorFilter.toLowerCase())
            : true

        return matchesSearch && matchesStatus && matchesVendor
    })

    const hasFilters = search || statusFilter || vendorFilter

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">

                    {/* Search */}
                    <div className="relative min-w-[180px] max-w-xs flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search quotations..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Vendor Filter */}
                    <Input
                        placeholder="Filter by vendor..."
                        className="min-w-[180px] max-w-xs flex-1"
                        value={vendorFilter}
                        onChange={(e) => setVendorFilter(e.target.value)}
                    />

                    {/* Status Filter */}
                    <select
                        className="h-10 border rounded-md px-3 text-sm bg-background"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending_approval">Approval Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>


                    {/* Clear */}
                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground gap-1"
                            onClick={() => {
                                setSearch('')
                                setStatusFilter('')
                                setVendorFilter('')
                            }}
                        >
                            <X className="w-3.5 h-3.5" /> Clear
                        </Button>
                    )}
                </div>

                {/* Upload Button */}
                <Link href="/quotation/new">
                <Button type="button" className="gap-2 shrink-0">
                    <Plus className="w-4 h-4" />
                    Upload Quotation
                </Button>
                </Link>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Loading quotations...
                        </div>
                    ) : isError ? (
                        <div className="p-8 text-center text-destructive">
                            Failed to load quotations.
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            {hasFilters ? 'No quotations match your filters.' : 'No quotations found.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">

                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Quotation</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Vendor</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden xl:table-cell">Quotation Date</th>
                                        <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Items</th>
                                        <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Total</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">PR</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Uploaded By</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Created</th>
                                        <th className="px-4 py-3 w-10" />
                                    </tr>
                                </thead>

                                <tbody className="divide-y">
                                    {filtered.map((q) => (
                                        <tr
                                            key={q.id}
                                            onClick={() => router.push(`/quotation/${q.id}`)}
                                            className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{q.quotation_no !== '—' ? q.quotation_no : q.ref_no}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{q.ref_no}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs hidden lg:table-cell">{q.vendor_name}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">{q.quotation_date}</td>
                                            <td className="px-4 py-3 text-xs text-right tabular-nums hidden md:table-cell">{q.items_count}</td>
                                            <td className="px-4 py-3 text-xs text-right tabular-nums hidden md:table-cell">{formatCurrency(q.total_amount)}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{q.pr_number || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{q.uploaded_by}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={q.status} />
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(q.created_at)}</td>
                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                {q.status === 'draft' && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        disabled={deletingId === q.id}
                                                        onClick={() => setPendingDelete(q)}
                                                        aria-label="Delete draft quotation"
                                                    >
                                                        {deletingId === q.id
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <Trash2 className="h-4 w-4" />}
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
