'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, FileText, User, MapPin, Phone, Mail, Building, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'

type Suggestion = {
    master_item_id: number
    code: string
    description: string
    unit_of_measure: string
    unit_rate?: number
    hsn_code?: string
    category?: string | null
}

type LineItem = {
    id: number
    quotationId: number
    name: string
    code: string
    uom: string
    hasMatch: boolean
    masterItemId: number | null
    suggestions: Suggestion[]
    selectedMasterId: string | null // 'create_new' or master_item_id
}

type ExtractedVendor = {
    id: string
    name: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    city?: string
    state?: string
    gstNumber?: string | null
    vendorCreated?: boolean
}

interface FilterState {
    all: string;
    new: string;
    duplicates: string;
}

const DEFAULT_FILTERS: FilterState = {
    all: "true",
    new: "false",
    duplicates: "false",
};

function toNumber(value: unknown): number | null {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function getQuotationId(response: any): number | null {
    return (
        toNumber(response?.quotation_id) ??
        toNumber(response?.quotation?.id) ??
        toNumber(response?.id)
    )
}

function getMasterItemId(item: any): number | null {
    return (
        toNumber(item?.master_item_id) ??
        toNumber(item?.master_item?.id) ??
        toNumber(item?.matched_item_id) ??
        toNumber(item?.matched_item?.id) ??
        toNumber(item?.match?.id)
    )
}

function mapLineItemsFromQuotationResponse(response: any): LineItem[] {
    const quotationId = getQuotationId(response)
    if (!quotationId) return []

    const items = Array.isArray(response?.items) ? response.items : []

    return items
        .map((item: any, index: number) => {
            const itemId =
                toNumber(item?.quotation_item_id) ??
                toNumber(item?.id) ??
                toNumber(item?.item_id)
            if (!itemId) return null

            const suggestions: Suggestion[] = Array.isArray(item?.suggestions)
                ? item.suggestions
                : []

            const masterItemId =
                suggestions.length > 0
                    ? toNumber(suggestions[0].master_item_id)
                    : getMasterItemId(item)

            const hasMatch = Boolean(
                item?.master_item_matched ??
                item?.has_match ??
                item?.matched ??
                item?.is_matched ??
                suggestions.length > 0
            )

            return {
                id: itemId,
                quotationId,
                name:
                    item?.item_name ?? item?.name ?? item?.description ?? `Item ${index + 1}`,
                code: item?.item_code ?? item?.code ?? 'No code',
                uom: item?.unit_of_measure ?? item?.uom ?? item?.unit ?? '—',
                hasMatch,
                masterItemId,
                suggestions,
                selectedMasterId: hasMatch ? String(suggestions[0].master_item_id) : 'ITEM - 123456789'
            }
        })
        .filter((item: LineItem | null): item is LineItem => item !== null)
}

export default function UploadQuotationPage() {
    const { toast } = useToast()
    const router = useRouter()
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [file, setFile] = useState<File | null>(null)
    const [quotation, setQuotation] = useState<any>(null)
    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [vendors, setVendors] = useState<ExtractedVendor[]>([])
    const [dragging, setDragging] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const { data: masterItems = [] } = useQuery({
        queryKey: ['master-items'],
        queryFn: async () => {
            const { data } = await apiClient.get('/master-items/')
            return data.results || data
        },
    })

    const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string) => {
        setFilters(() => {
            const updated = {} as FilterState;

            (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).forEach(
                (filterKey) => {
                    updated[filterKey] =
                        filterKey === key && value === "true"
                            ? "true"
                            : "false";
                }
            );

            return updated;
        });
    },
    []
);

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('Please upload a file')
            const formData = new FormData()
            formData.append('file', file)
            const { data } = await apiClient.post('/quotations/upload/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            return data
        },
        onSuccess: (data: any) => {
            setQuotation(data)

            const vendors = (data.vendor || []).map((v: any) => ({
                id: String(v.vendor_id),
                name: v.vendor_name,
                contactName: v.contact_name,
                contactEmail: v.contact_email,
                contactPhone: v.contact_phone,
                city: v.city,
                state: v.state,
                gstNumber: v.gst_number,
                vendorCreated: v.vendor_created,
            }))

            const mappedLineItems = mapLineItemsFromQuotationResponse(data)

            setVendors(vendors)
            setLineItems(mappedLineItems)
        },
        onError: (error: any) => {
            const data = error?.response?.data
            let message = 'Failed to upload quotation.'
            if (data) {
                if (typeof data === 'string') {
                    message = data
                } else if (data.detail) {
                    message = data.detail
                } else {
                    message = Object.entries(data)
                        .map(([key, value]) => {
                            if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
                            return `${key}: ${value}`
                        })
                        .join(' | ')
                }
            }
            setErrorMessage(message)
        },
    })

    const submitMutation = useMutation({
        mutationFn: async () => {
            const actions = lineItems.map(item => ({
                item_id: item.id,
                action: item.selectedMasterId === 'create_new' ? 'create_new' : 'approve',
                master_item_id: item.selectedMasterId === 'create_new' ? null : Number(item.selectedMasterId),
            }))

            await apiClient.patch(`/quotations/${quotation.quotation_id}/confirm-items/`, {
                actions,
            })
        },
        onSuccess: () => {
            toast({
                title: 'Quotation processed successfully',
                description: 'All items have been confirmed.',
            })
            router.push('/quotation')
        },
        onError: (error: any) => {
            const detail =
                error?.response?.data?.detail ??
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                'Failed to confirm items.'
            setErrorMessage(detail)
            toast({ title: 'Submission failed', description: detail, variant: 'destructive' })
        },
    })

    useEffect(() => {
        if (!file) {
            setQuotation(null)
            setVendors([])
            setLineItems([])
            setErrorMessage('')
        }
    }, [file])

    const addFile = (incoming: FileList | null) => {
        if (!incoming || incoming.length === 0) return
        const selectedFile = incoming[0]
        setErrorMessage('')
        setFile(selectedFile)
    }

    const removeFile = () => {
        setFile(null)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(true)
    }

    const handleDragLeave = () => setDragging(false)

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        addFile(e.dataTransfer.files)
    }

    const handleUpload = () => {
        if (!file || uploadMutation.isPending) return
        uploadMutation.mutate()
    }

    const handleSubmit = () => {
        if (submitMutation.isPending) return
        setShowConfirmModal(true)
    }

    const confirmSubmit = () => {
        setShowConfirmModal(false)
        submitMutation.mutate()
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const isNotEmpty = (val?: string | null) =>
        val && val !== 'N/A' && val.trim() !== ''

    const hasData = quotation && vendors.length > 0 && lineItems.length > 0

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col justify-items-start items-start gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/quotation')}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Quotations
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Upload Quotation</h1>
                    <p className="text-sm text-gray-600">Upload a quotation file to extract vendors and items</p>
                </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{errorMessage}</p>
                </div>
            )}

            {/* File Upload Section */}
            {!hasData && (
                <Card>
                    <CardContent className="p-6">
                        {!file ? (
                            <div
                                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                                onClick={() => document.getElementById('quotation-file')?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    {dragging ? 'Drop your file here' : 'Upload Quotation File'}
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Drag and drop your PDF file here, or click to browse
                                </p>
                                <p className="text-xs text-gray-500">Supports PDF files up to 25 MB</p>
                                <input
                                    id="quotation-file"
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    className="hidden"
                                    onChange={(e) => addFile(e.target.files)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-6 h-6 text-blue-500" />
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                                            <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={removeFile}>
                                        Remove
                                    </Button>
                                </div>
                                <Button
                                    onClick={handleUpload}
                                    disabled={uploadMutation.isPending}
                                    className="w-full"
                                >
                                    {uploadMutation.isPending ? 'Processing...' : 'Extract Data'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Extracted Data */}
            {hasData && (
                <div className="space-y-4">
                    {/* Vendor Details */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Building className="w-4 h-4" />
                                Quotation Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                {vendors.map((vendor) => (
                                    <div key={vendor.id} className="p-0 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <User className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-gray-900 text-sm truncate">{vendor.name}</h4>
                                                <div className="space-y-1 mt-2">
                                                    {isNotEmpty(vendor.contactEmail) && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <Mail className="w-3 h-3" />
                                                            <span className="truncate">{vendor.contactEmail}</span>
                                                        </div>
                                                    )}
                                                    {isNotEmpty(vendor.contactPhone) && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <Phone className="w-3 h-3" />
                                                            <span>{vendor.contactPhone}</span>
                                                        </div>
                                                    )}
                                                    {(isNotEmpty(vendor.city) || isNotEmpty(vendor.state)) && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <MapPin className="w-3 h-3" />
                                                            <span className="truncate">{[vendor.city, vendor.state].filter(Boolean).join(', ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div>
                                    <div className="flex flex-col items-end gap-3 text-sm leading-3">
                                        <span>
                                            Quotation No: <span className="font-small text-gray-900">TZ-2026-0421</span>
                                        </span>
                                        <span>
                                            Date: <span className="font-small text-gray-900">23 April 2026</span>
                                        </span>
                                        <span>
                                            Valid Till: <span className="font-small text-gray-900">07 May 2026</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CheckCircle className="w-4 h-4" />
                                Items ({lineItems.length})
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                                Review the extracted items and select the appropriate master item or choose to create a new one.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex items-center gap-1 my-1">
                                <button
                                    onClick={() =>
                                        handleFilterChange(
                                            "all",
                                            filters.all === "true" ? "false" : "true"
                                        )
                                    }
                                    className={`h-7 px-3 rounded-full text-xs border flex items-center gap-1.5
                                            ${filters.all === "true"
                                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                            : "bg-background hover:bg-muted border-border text-muted-foreground"
                                        }`}
                                >
                                    All <Badge>1</Badge>
                                </button>

                                <button
                                    onClick={() =>
                                        handleFilterChange(
                                            "new",
                                            filters.new === "false" ? "true" : "false"
                                        )
                                    }
                                    className={`h-7 px-3 rounded-full text-xs border flex items-center gap-1.5
                                            ${filters.new === "true"
                                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                            : "bg-background hover:bg-muted border-border text-muted-foreground"
                                        }`}
                                >
                                    New <Badge>0</Badge>
                                </button>

                                <button
                                    onClick={() =>
                                        handleFilterChange(
                                            "duplicates",
                                            filters.duplicates === "false" ? "true" : "false"
                                        )
                                    }
                                    className={`h-7 px-3 rounded-full text-xs border flex items-center gap-1.5
                                            ${filters.duplicates === "true"
                                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                            : "bg-background hover:bg-muted border-border text-muted-foreground"
                                        }`}
                                >
                                    Duplicates <Badge>1</Badge>
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">UOM</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Master Item</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((item) => {
                                            const options = [
                                                ...item.suggestions.map(s => ({
                                                    value: String(s.master_item_id),
                                                    label: `${s.code} - ${s.description}`,
                                                    group: 'Matched Suggestions'
                                                })),
                                                ...masterItems.map((m:any) => ({
                                                    value: String(m.id),
                                                    label: `${m.code} - ${m.description}`,
                                                    group: 'All Items'
                                                })),
                                                { value: 'create_new', label: 'Create New Item', group: 'Other' }
                                            ]

                                            return (
                                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                                    <td className="py-2 px-3">
                                                        <div>
                                                            <p className="font-medium text-gray-900">{item.name}</p>
                                                            {item.suggestions.length > 0 && (
                                                                <p className="text-xs text-gray-500 truncate max-w-xs">
                                                                    {item.suggestions[0].description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-700">{item.code}</td>
                                                    <td className="py-2 px-3 text-gray-700">{item.uom}</td>
                                                    <td className="py-5 px-3">
                                                        <div className='relative'>
                                                            <Badge className='absolute -top-3 -right-3' variant="warning">3</Badge>
                                                            <Combobox
                                                                options={options}
                                                                value={item.selectedMasterId || ''}
                                                                onValueChange={(value) =>
                                                                    setLineItems((prev) =>
                                                                        prev.map((i) =>
                                                                            i.id === item.id ? { ...i, selectedMasterId: value } : i
                                                                        )
                                                                    )
                                                                }
                                                                placeholder="Select master item..."
                                                                className="w-full"
                                                            />

                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-3">
                                                        <FieldGroup>
                                                        <Field className="flex flex-row items-center gap-2">
                                                        <Checkbox
                                                                    id="terms-checkbox-desc"
                                                                    name="terms-checkbox-desc"
                                                                />
                                                                <FieldContent>
                                                                    <FieldLabel htmlFor="terms-checkbox-desc">
                                                                        Create New Item
                                                                    </FieldLabel>
                                                                </FieldContent>
                                                            </Field>
                                                        </FieldGroup>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>

                                    {/* Totals of the quotation */}
                                    <tfoot>
                                        <tr>
                                            <td colSpan={4} className="text-right py-2 px-3 font-medium text-gray-900">Subtotal:</td>
                                            <td className="py-2 px-3 font-medium text-gray-900 text-right">62,990</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={4} className="text-right py-2 px-3 font-medium text-gray-900">GST (18%):</td>
                                            <td className="py-2 px-3 font-medium text-gray-900 text-right">11,338</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={4} className="text-right py-2 px-3 font-medium text-gray-900">Discount:</td>
                                            <td className="py-2 px-3 font-medium text-gray-900 text-right">-0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={4} className="text-right py-2 px-3 font-medium text-gray-900">Total:</td>
                                            <td className="py-2 px-3 font-medium text-gray-900 text-right">74,328</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={handleSubmit}
                            disabled={submitMutation.isPending}
                            size="lg"
                            className="px-6"
                        >
                            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Submission</DialogTitle>
                        <DialogDescription>
                            Once submitted, these items cannot be changed. Please verify that all selections are correct.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                            Go Back
                        </Button>
                        <Button onClick={confirmSubmit} disabled={submitMutation.isPending}>
                            {submitMutation.isPending ? 'Submitting...' : 'Yes, Proceed'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}