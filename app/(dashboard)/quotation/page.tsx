'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import Link from 'next/link'

type Quotation = {
    id: number | string
    hash_id: string
    quotation_number: string
    vendor_name: string
    pr_number: string
    status: string
    uploaded_by: string
    created_at: string
}

function mapQuotation(raw: any): Quotation {
    return {
        id: raw.id ?? raw.hash_id,
        hash_id: raw.hash_id ?? raw.id,
        quotation_number: raw.ref_no ?? raw.quotation_number ?? raw.quote_number ?? raw.number ?? '—',
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
        created_at: raw.created_at ?? raw.uploaded_at ?? '',
    }
}


export default function QuotationPage() {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const router = useRouter()

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
        const matchesSearch =
            q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
            q.vendor_name.toLowerCase().includes(search.toLowerCase())

        const matchesStatus = statusFilter ? q.status === statusFilter : true

        return matchesSearch && matchesStatus
    })

    const hasFilters = search || statusFilter

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

                    {/* Status Filter */}
                    <select
                        className="h-10 border rounded-md px-3 text-sm bg-background"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="approval_required">Approval Required</option>
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
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Quotation No</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">PR Number</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Uploaded By</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Created</th>
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
                                                <p className="font-medium">{q.quotation_number}</p>
                                                <p className="text-xs text-muted-foreground">{q.vendor_name}</p>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{q.pr_number || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{q.uploaded_by}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={q.status} />
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(q.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
