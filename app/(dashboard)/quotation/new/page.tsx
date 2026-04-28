'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, FileText, User, MapPin, Phone, Mail, Building, CheckCircle, AlertCircle, ArrowLeft, ChevronRight, Package, ClipboardList, Loader2 } from 'lucide-react'
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
    selectedMasterId: string | null
    createNew?: boolean
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

const STEPS = [
    { id: 1, label: 'Upload Quotation', icon: Upload },
    { id: 2, label: 'Review Items', icon: Package },
    { id: 3, label: 'Summary', icon: ClipboardList },
]

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
                name: item?.item_name ?? item?.name ?? item?.description ?? `Item ${index + 1}`,
                code: item?.item_code ?? item?.code ?? 'No code',
                uom: item?.unit_of_measure ?? item?.uom ?? item?.unit ?? '—',
                hasMatch,
                masterItemId,
                suggestions,
                selectedMasterId: hasMatch ? String(suggestions[0].master_item_id) : 'ITEM - 123456789',
                createNew: false,
            }
        })
        .filter((item: LineItem | null): item is LineItem => item !== null)
}

export default function UploadQuotationPage() {
    const { toast } = useToast()
    const router = useRouter()

    const [currentStep, setCurrentStep] = useState(1)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [pendingStep, setPendingStep] = useState<number | null>(null)

    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
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
                (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).forEach((filterKey) => {
                    updated[filterKey] = filterKey === key && value === "true" ? "true" : "false"
                })
                return updated
            })
        }, []
    )

    const uploadMutation = useMutation({
        mutationFn: async (selectedFile: File) => {
            const formData = new FormData()
            formData.append('file', selectedFile)
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
            setVendors(vendors)
            setLineItems(mapLineItemsFromQuotationResponse(data))
        },
        onError: (error: any) => {
            const data = error?.response?.data
            let message = 'Failed to upload quotation.'
            if (data) {
                if (typeof data === 'string') message = data
                else if (data.detail) message = data.detail
                else message = Object.entries(data).map(([k, v]) => Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`).join(' | ')
            }
            setErrorMessage(message)
        },
    })

    const submitMutation = useMutation({
        mutationFn: async () => {
            const actions = lineItems.map(item => ({
                item_id: item.id,
                action: item.selectedMasterId === 'create_new' || item.createNew ? 'create_new' : 'approve',
                master_item_id: item.selectedMasterId === 'create_new' || item.createNew ? null : Number(item.selectedMasterId),
            }))
            await apiClient.patch(`/quotations/${quotation.quotation_id}/confirm-items/`, { actions })
        },
        onSuccess: () => {
            toast({ title: 'Quotation processed successfully', description: 'All items have been confirmed.' })
            router.push('/quotation')
        },
        onError: (error: any) => {
            const detail = error?.response?.data?.detail ?? error?.response?.data?.message ?? error?.response?.data?.error ?? 'Failed to confirm items.'
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
        setQuotation(null)
        setVendors([])
        setLineItems([])
        setFile(selectedFile)
        if (!uploadMutation.isPending) {
            uploadMutation.mutate(selectedFile)
        }
    }

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); addFile(e.dataTransfer.files) }

    const handleUpload = () => {
        if (!file || uploadMutation.isPending) return
        uploadMutation.mutate(file)
    }

    // Called when user clicks Next on any step
    const handleNextClick = () => {
        setPendingStep(currentStep + 1)
        setShowConfirmModal(true)
    }

    const confirmAndProceed = () => {
        setShowConfirmModal(false)
        if (pendingStep === 4) {
            // final submit
            submitMutation.mutate()
        } else if (pendingStep !== null) {
            setCurrentStep(pendingStep)
        }
        setPendingStep(null)
    }

    const cancelConfirm = () => {
        setShowConfirmModal(false)
        setPendingStep(null)
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const isNotEmpty = (val?: string | null) => val && val !== 'N/A' && val.trim() !== ''

    const hasData = quotation && vendors.length > 0 && lineItems.length > 0

    const confirmModalContent = () => {
        if (currentStep === 1) return {
            title: 'Proceed to Review Items?',
            description: 'The quotation has been extracted. You will now review the line items and map them to master items.',
        }
        if (currentStep === 2) return {
            title: 'Proceed to Summary?',
            description: 'Please confirm you have reviewed all items and their mappings before proceeding to the summary.',
        }
        return {
            title: 'Submit Quotation?',
            description: 'Once submitted, these items cannot be changed. Please verify that all selections are correct.',
        }
    }

    // Step indicator
    const StepIndicator = () => (
        <div className="flex items-center gap-0 mb-6">
            {STEPS.map((step, idx) => {
                const isCompleted = currentStep > step.id
                const isActive = currentStep === step.id
                const Icon = step.icon
                return (
                    <div key={step.id} className="flex items-center">
                        <div className="flex items-center gap-2">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                                ${isCompleted ? 'bg-primary text-primary-foreground' : ''}
                                ${isActive ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' : ''}
                                ${!isCompleted && !isActive ? 'bg-muted text-muted-foreground' : ''}
                            `}>
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <span>{step.id}</span>}
                            </div>
                            <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {step.label}
                            </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`h-px w-8 sm:w-16 mx-2 transition-all ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                        )}
                    </div>
                )
            })}
        </div>
    )

    // ── STEP 1: Upload ──────────────────────────────────────────────
    const StepUpload = () => (
        <Card>
            <CardContent className="p-6">
                {!file ? (
                    <div
                        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'hover:border-border'}`}
                        onClick={() => document.getElementById('quotation-file')?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="w-14 h-14 rounded-full border bg-background flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                            Drop the quotation file here
                        </h3>
                        <p className="text-sm text-muted-foreground mb-5">
                            PDF, image (PNG/JPG), Excel — any layout. AI extracts everything.
                        </p>
                        <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); document.getElementById('quotation-file')?.click() }}>
                            Browse file
                        </Button>
                        <input
                            id="quotation-file"
                            type="file"
                            accept=".pdf,application/pdf,image/*,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="hidden"
                            onChange={(e) => addFile(e.target.files)}
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uploads</p>
                        <div className="flex items-center gap-3 p-4 rounded-xl border bg-background">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-8 rounded-lg border bg-muted/40 flex items-center justify-center text-xs font-bold text-foreground">
                                    PDF
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatSize(file.size)} · uploaded just now</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                                {uploadMutation.isPending ? 'Processing...' : hasData ? 'Ready' : 'Waiting'}
                            </Badge>
                            
                            <Button variant="outline" onClick={() => setFile(null)} className="shrink-0">
                                Remove 
                            </Button>
                        </div>

                        {!uploadMutation.isPending && hasData && (
                            <>
                                <div className="pt-2">
                                    <div className="my-4 h-px w-full bg-border" />
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        Vendor extracted from this quotation
                                    </p>
                                    <div className="rounded-xl border bg-indigo-50/40 px-4 py-3 flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                        <p className="text-sm font-medium text-indigo-900 truncate">
                                            AI extraction complete — vendor identified, {lineItems.length} line items found
                                        </p>
                                    </div>

                                    <div className="mt-3 rounded-xl border bg-background overflow-hidden">
                                        <div className="p-4 flex items-start gap-3">
                                            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-semibold text-foreground">
                                                {vendors?.[0]?.name
                                                    ? vendors[0].name.trim().split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
                                                    : 'V'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h4 className="font-semibold text-sm truncate text-foreground">
                                                            {vendors?.[0]?.name ?? 'Vendor'}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                                            {[vendors?.[0]?.city, vendors?.[0]?.state].filter(Boolean).join(', ')}
                                                        </p>
                                                    </div>
                                                    <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0 text-xs font-medium">
                                                        {vendors?.[0]?.vendorCreated ? 'Existing vendor' : 'New vendor'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 border-t">
                                            <div className="p-4">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">GSTIN</p>
                                                <p className="text-sm mt-1 truncate text-foreground font-medium">{vendors?.[0]?.gstNumber ?? '—'}</p>
                                            </div>
                                            <div className="p-4 border-l">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">State</p>
                                                <p className="text-sm mt-1 truncate text-foreground font-medium">{vendors?.[0]?.state ?? '—'}</p>
                                            </div>
                                            <div className="p-4 border-l">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Phone</p>
                                                <p className="text-sm mt-1 truncate text-foreground font-medium">{vendors?.[0]?.contactPhone ?? '—'}</p>
                                            </div>
                                        </div>

                                        <div className="border-t p-4">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email</p>
                                            <p className="text-sm mt-1 truncate text-foreground font-medium">{vendors?.[0]?.contactEmail ?? '—'}</p>
                                        </div>

                                        <div className="relative h-9">
                                            <button
                                                type="button"
                                                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border bg-background flex items-center justify-center"
                                                aria-label="Expand"
                                            >
                                                <ChevronRight className="w-4 h-4 rotate-90 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button onClick={handleNextClick} className="gap-2">
                                        Review Items <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* (removed old vendor preview) */}
                    </div>
                )}
            </CardContent>
        </Card>
    )

    // ── STEP 2: Review Items ────────────────────────────────────────
    const StepReviewItems = () => (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle className="w-4 h-4" />
                    Items ({lineItems.length})
                </CardTitle>
                <p className="text-sm text-gray-600">Review the extracted items and select the appropriate master item or choose to create a new one.</p>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-center gap-1 my-2">
                    {(['all', 'new', 'duplicates'] as (keyof FilterState)[]).map((key) => (
                        <button
                            key={key}
                            onClick={() => handleFilterChange(key, filters[key] === "true" ? "false" : "true")}
                            className={`h-7 px-3 rounded-full text-xs border flex items-center gap-1.5 capitalize
                                ${filters[key] === "true"
                                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                    : "bg-background hover:bg-muted border-border text-muted-foreground"
                                }`}
                        >
                            {key} <Badge>{key === 'all' ? lineItems.length : key === 'new' ? lineItems.filter(i => !i.hasMatch).length : lineItems.filter(i => i.hasMatch && i.suggestions.length > 1).length}</Badge>
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">UOM</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Master Item</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Create New</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item) => {
                                const options = [
                                    ...item.suggestions.map(s => ({
                                        value: String(s.master_item_id),
                                        label: `${s.code} - ${s.description}`,
                                    })),
                                    ...masterItems.map((m: any) => ({
                                        value: String(m.id),
                                        label: `${m.code} - ${m.description}`,
                                    })),
                                    { value: 'create_new', label: 'Create New Item' }
                                ]

                                return (
                                    <tr key={item.id} className="border-b hover:bg-gray-50">
                                        <td className="py-2 px-3">
                                            <p className="font-medium text-gray-900">{item.name}</p>
                                            {item.suggestions.length > 0 && (
                                                <p className="text-xs text-gray-500 truncate max-w-xs">{item.suggestions[0].description}</p>
                                            )}
                                        </td>
                                        <td className="py-2 px-3 text-gray-700">{item.code}</td>
                                        <td className="py-2 px-3 text-gray-700">{item.uom}</td>
                                        <td className="py-3 px-3">
                                            <div className="relative">
                                                {item.suggestions.length > 1 && (
                                                    <Badge className="absolute -top-3 -right-3 z-10" variant="warning">{item.suggestions.length}</Badge>
                                                )}
                                                <Combobox
                                                    options={options}
                                                    value={item.createNew ? 'create_new' : (item.selectedMasterId || '')}
                                                    onValueChange={(value) =>
                                                        setLineItems(prev => prev.map(i =>
                                                            i.id === item.id ? { ...i, selectedMasterId: value, createNew: value === 'create_new' } : i
                                                        ))
                                                    }
                                                    placeholder="Select master item..."
                                                    className="w-full"
                                                    disabled={item.createNew}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <FieldGroup>
                                                <Field className="flex flex-row items-center gap-2">
                                                    <Checkbox
                                                        id={`create-new-${item.id}`}
                                                        checked={!!item.createNew}
                                                        onCheckedChange={(checked) =>
                                                            setLineItems(prev => prev.map(i =>
                                                                i.id === item.id ? { ...i, createNew: !!checked, selectedMasterId: checked ? 'create_new' : null } : i
                                                            ))
                                                        }
                                                    />
                                                    <FieldContent>
                                                        <FieldLabel htmlFor={`create-new-${item.id}`}>Create New</FieldLabel>
                                                    </FieldContent>
                                                </Field>
                                            </FieldGroup>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <Button onClick={handleNextClick} className="gap-2">
                        View Summary <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )

    // ── STEP 3: Summary ─────────────────────────────────────────────
    const StepSummary = () => {
        const newItems = lineItems.filter(i => i.createNew || i.selectedMasterId === 'create_new')
        const mappedItems = lineItems.filter(i => !i.createNew && i.selectedMasterId && i.selectedMasterId !== 'create_new')

        return (
            <div className="space-y-4">
                {/* Vendor summary */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Building className="w-4 h-4" /> Quotation Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vendors.map((vendor) => (
                                <div key={vendor.id} className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 text-sm">{vendor.name}</h4>
                                        <div className="space-y-1 mt-1">
                                            {isNotEmpty(vendor.contactEmail) && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600"><Mail className="w-3 h-3" />{vendor.contactEmail}</div>
                                            )}
                                            {isNotEmpty(vendor.contactPhone) && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600"><Phone className="w-3 h-3" />{vendor.contactPhone}</div>
                                            )}
                                            {(isNotEmpty(vendor.city) || isNotEmpty(vendor.state)) && (
                                                <div className="flex items-center gap-2 text-xs text-gray-600"><MapPin className="w-3 h-3" />{[vendor.city, vendor.state].filter(Boolean).join(', ')}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="flex flex-col items-end gap-2 text-sm text-gray-600">
                                <span>Quotation No: <span className="font-medium text-gray-900">TZ-2026-0421</span></span>
                                <span>Date: <span className="font-medium text-gray-900">23 April 2026</span></span>
                                <span>Valid Till: <span className="font-medium text-gray-900">07 May 2026</span></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Items summary */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Package className="w-4 h-4" /> Items Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                                <p className="text-2xl font-bold text-gray-900">{lineItems.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Total Items</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <p className="text-2xl font-bold text-emerald-600">{mappedItems.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Mapped to Master</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <p className="text-2xl font-bold text-blue-600">{newItems.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">Create New</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">UOM</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item) => (
                                        <tr key={item.id} className="border-b hover:bg-gray-50">
                                            <td className="py-2 px-3 font-medium text-gray-900">{item.name}</td>
                                            <td className="py-2 px-3 text-gray-700">{item.code}</td>
                                            <td className="py-2 px-3 text-gray-700">{item.uom}</td>
                                            <td className="py-2 px-3">
                                                {item.createNew || item.selectedMasterId === 'create_new' ? (
                                                    <Badge variant="secondary">Create New</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">Mapped</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr><td colSpan={3} className="text-right py-2 px-3 font-medium text-gray-900">Subtotal:</td><td className="py-2 px-3 font-medium text-gray-900">62,990</td></tr>
                                    <tr><td colSpan={3} className="text-right py-2 px-3 font-medium text-gray-900">GST (18%):</td><td className="py-2 px-3 font-medium text-gray-900">11,338</td></tr>
                                    <tr><td colSpan={3} className="text-right py-2 px-3 font-medium text-gray-900">Discount:</td><td className="py-2 px-3 font-medium text-gray-900">-0</td></tr>
                                    <tr><td colSpan={3} className="text-right py-2 px-3 font-medium text-gray-900 text-base">Total:</td><td className="py-2 px-3 font-bold text-gray-900 text-base">74,328</td></tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <Button onClick={handleNextClick} disabled={submitMutation.isPending} size="lg" className="px-6 gap-2">
                        {submitMutation.isPending ? 'Submitting...' : 'Submit Quotation'} <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        )
    }

    const modal = confirmModalContent()

    return (
        <div className="space-y-4">
            {uploadMutation.isPending && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-xl border bg-background px-5 py-4 text-sm text-muted-foreground shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting details…
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Upload Quotation
                    </h1>
                    <p className="text-sm text-gray-600">
                        Upload a quotation file to extract vendors and items
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/quotation')}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Quotations
                </Button>
            </div>


            {/* Step Indicator */}
            <StepIndicator />

            {/* Error Message */}
            {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{errorMessage}</p>
                </div>
            )}

            {/* Step Content */}
            {currentStep === 1 && <StepUpload />}
            {currentStep === 2 && <StepReviewItems />}
            {currentStep === 3 && <StepSummary />}

            {/* Confirm Modal */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{modal.title}</DialogTitle>
                        <DialogDescription>{modal.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={cancelConfirm}>Go Back</Button>
                        <Button onClick={confirmAndProceed} disabled={submitMutation.isPending}>
                            {submitMutation.isPending ? 'Submitting...' : 'Yes, Proceed'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
