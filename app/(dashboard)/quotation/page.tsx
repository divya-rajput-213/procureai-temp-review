'use client'

import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import UploadQuotationModal from './components/UploadQuotationModal'

const DUMMY_QUOTATIONS = [
    {
        id: 1,
        hash_id: "q1",
        quotation_number: "QT-001",
        vendor_name: "ABC Pvt Ltd",
        pr_number: "PR-101",
        status: "approval_required",
        uploaded_by: "Divya",
        created_at: "2026-04-18",
    },
    {
        id: 2,
        hash_id: "q2",
        quotation_number: "QT-002",
        vendor_name: "XYZ Industries",
        pr_number: "PR-102",
        status: "approved",
        uploaded_by: "Rahul",
        created_at: "2026-04-17",
    },
    {
        id: 3,
        hash_id: "q3",
        quotation_number: "QT-003",
        vendor_name: "Global Supplies",
        pr_number: "PR-103",
        status: "rejected",
        uploaded_by: "Amit",
        created_at: "2026-04-16",
    },
]


export default function QuotationPage() {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [trackingFilter, setTrackingFilter] = useState('')
    const [isUploadQuotationModalOpen, setIsUploadQuotationModalOpen] = useState(false)

    const router = useRouter()

    //  Apply Filters
    const filtered = DUMMY_QUOTATIONS.filter((q) => {
        const matchesSearch =
            q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
            q.vendor_name.toLowerCase().includes(search.toLowerCase())

        const matchesStatus = statusFilter ? q.status === statusFilter : true

        const matchesTracking = trackingFilter
            ? q.pr_number.toLowerCase().includes(trackingFilter.toLowerCase())
            : true

        return matchesSearch && matchesStatus && matchesTracking
    })

    const hasFilters = search || statusFilter || trackingFilter

    return (
        <div className="space-y-4">

            {/* Filters */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">

                    {/* Search */}
                    <div className="relative min-w-[180px] max-w-xs flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search quotation or vendor"
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
                                setTrackingFilter('')
                            }}
                        >
                            <X className="w-3.5 h-3.5" /> Clear
                        </Button>
                    )}
                </div>

                {/* Upload Button */}
                <Button type="button" className="gap-2" onClick={() => setIsUploadQuotationModalOpen(true)}
                >
                    <Plus className="w-4 h-4" />
                    Upload Quotation
                </Button>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">

                    {filtered.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            {hasFilters ? 'No quotations match your filters.' : 'No quotations found.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">

                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs">Quotation No</th>
                                        <th className="px-4 py-3 text-left text-xs">Vendor</th>
                                        <th className="px-4 py-3 text-left text-xs">PR</th>
                                        <th className="px-4 py-3 text-left text-xs">Status</th>
                                        <th className="px-4 py-3 text-left text-xs">Uploaded By</th>
                                        <th className="px-4 py-3 text-left text-xs">Created</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>

                                <tbody className="divide-y">
                                    {filtered.map((q) => (
                                        <tr
                                            key={q.id}
                                            onClick={() => router.push(`/quotation/${q.hash_id}`)}
                                            className="hover:bg-slate-50 cursor-pointer"
                                        >
                                            <td className="px-4 py-3 font-mono text-xs">{q.quotation_number}</td>
                                            <td className="px-4 py-3">{q.vendor_name}</td>
                                            <td className="px-4 py-3">{q.pr_number}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={q.status} />
                                            </td>
                                            <td className="px-4 py-3 text-xs">{q.uploaded_by}</td>
                                            <td className="px-4 py-3 text-xs">{formatDate(q.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
            <UploadQuotationModal
                isOpen={isUploadQuotationModalOpen}
                onClose={() => setIsUploadQuotationModalOpen(false)}
                onSave={(data) => {
                    console.log("FINAL DATA:", data)
                    setIsUploadQuotationModalOpen(false)
                }}
            />
        </div>
    )
}
