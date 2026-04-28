'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, AlertCircle, ArrowLeft, ChevronRight, Loader2, CheckCircle2, Download } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'

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

export default function UploadQuotationPage() {
    const { toast } = useToast()
    const router = useRouter()

    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
    const [file, setFile] = useState<File | null>(null)
    const [quotation, setQuotation] = useState<any>(null)
    const [lineItems, setLineItems] = useState<any>([])
    const [vendors, setVendors] = useState<any>(null)
    const [dragging, setDragging] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [vendorId, setVendorId] = useState<number | null>(null)
    const [vendorSaved, setVendorSaved] = useState(false)
    const [quotationSaved, setQuotationSaved] = useState(false)
    const [savedQuotationData, setSavedQuotationData] = useState<any>(null)
    console.log('vendors', vendors)
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
            setVendors(data.vendor ?? null)
            setLineItems(data.items || [])
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

    const vendorSaveMutation = useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post('/quotations/vendor-save/', {
                vendor: {
                    company_name: vendors?.company_name,
                    contact_name: vendors?.contact_name,
                    contact_email: vendors?.contact_email,
                    contact_phone: vendors?.contact_phone,
                    address: vendors?.address,
                    city: vendors?.city,
                    state: vendors?.state,
                    pincode: vendors?.pincode,
                    country: vendors?.country ?? null,
                    gst_number: vendors?.gst_number,
                    pan_number: vendors?.pan_number ?? null,
                    bank_account: vendors?.bank_account ?? null,
                    bank_ifsc: vendors?.bank_ifsc ?? null,
                    bank_name: vendors?.bank_name ?? null,
                    gst_percentage: vendors?.gst_percentage ?? null,
                    quotation_no: quotation?.quotation_no ?? null,
                    quotation_date: quotation?.quotation_date ?? null,
                    terms_and_conditions: vendors?.terms_and_conditions ?? [],
                    is_new: vendors?.is_new ?? true,
                },
            })
            return data
        },
        onSuccess: (data: any) => {
            const id = data?.vendor_id ?? data?.id ?? data?.vendor?.id
            setVendorId(id)
            setVendorSaved(true)
        },
        onError: (error: any) => {
            const detail = error?.response?.data?.detail ?? error?.response?.data?.message ?? 'Failed to save vendor.'
            setErrorMessage(detail)
            toast({ title: 'Error', description: detail, variant: 'destructive' })
        },
    })

    const quotationSaveMutation = useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post('/quotations/save/', {
                vendor_id: vendorId,
                quotation_no: quotation?.quotation_no ?? null,
                quotation_date: quotation?.quotation_date ?? null,
                items: lineItems.map((item: any) => ({
                    item_code: item.item_code ?? item.code,
                    item_name: item.item_name,
                    item_price: item.item_price,
                    quantity: item.quantity || 1,
                    unit_of_measure: item.unit_of_measure ?? item.uom,
                    hsn_code: item.hsn_code ?? item.suggestions?.[0]?.hsn_code ?? null,
                    create_new_item: item.createNew || item.selectedMasterId === 'create_new',
                    master_item_id: item.createNew || item.selectedMasterId === 'create_new' ? null : Number(item.selectedMasterId) || null,
                    suggestions: item.createNew ? [] : item.suggestions || [],
                })),
            })
            return data
        },
        onSuccess: (data: any) => {
            setSavedQuotationData(data)
            setQuotationSaved(true)
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message ?? error?.response?.data?.detail ?? 'Failed to save quotation.'
            setErrorMessage(message)
            toast({ title: 'Error', description: message, variant: 'destructive' })
        },
    })

    useEffect(() => {
        if (!file) {
            setQuotation(null)
            setVendors(null)
            setLineItems([])
            setErrorMessage('')
            setVendorId(null)
            setVendorSaved(false)
            setQuotationSaved(false)
            setSavedQuotationData(null)
        }
    }, [file])

    const addFile = (incoming: FileList | null) => {
        if (!incoming || incoming.length === 0) return
        const selectedFile = incoming[0]
        const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            setErrorMessage('Only PDF files are allowed.')
            setFile(null)
            return
        }
        setErrorMessage('')
        setQuotation(null)
        setVendors(null)
        setLineItems([])
        setFile(selectedFile)
        if (!uploadMutation.isPending) {
            uploadMutation.mutate(selectedFile)
        }
    }

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); addFile(e.dataTransfer.files) }

    const handleSubmit = () => setShowConfirmModal(true)

    const confirmAndSubmit = () => {
        setShowConfirmModal(false)
        if (!vendorSaved) {
            vendorSaveMutation.mutate(undefined, {
                onSuccess: () => {
                    quotationSaveMutation.mutate()
                }
            })
        } else if (!quotationSaved) {
            quotationSaveMutation.mutate()
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const hasData = quotation && vendors && lineItems.length > 0

    // Auto-set default selectedMasterId from suggestions
    useEffect(() => {
        if (lineItems.length === 0) return;
        setLineItems((prev: any) => {
            let updated = false;
            const newItems = prev.map((item: any) => {
                if (!item.selectedMasterId && item.suggestions?.length > 0) {
                    updated = true;
                    return { ...item, selectedMasterId: String(item.suggestions[0].master_item_id) };
                }
                return item;
            });
            return updated ? newItems : prev;
        });
    }, [lineItems.length]);

    // ── Derived totals ──────────────────────────────────────────────
    const combinedTaxRate = vendors?.gst_percentage ?? 0
    const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 1) * (Number(item.item_price) || 0),
        0
    )
    const taxTotal = (subtotal * combinedTaxRate) / 100
    const sgst = taxTotal / 2
    const cgst = taxTotal / 2
    const grandTotal = subtotal + taxTotal
    const roundOff = Math.round(grandTotal) - grandTotal
    const finalTotal = grandTotal + roundOff

    const numberToWords = (num: number) => {
        const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
        const inWords = (n: number): string => {
            if (n < 20) return a[n]
            if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10]
            if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100)
            if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000)
            if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000)
            return ''
        }
        return inWords(Math.floor(num)) + ' Rupees only'
    }

    const filteredItems = lineItems.filter((item: any) => {
        if (filters.new === 'true') return item.is_new
        if (filters.duplicates === 'true') return item.is_duplicate
        return true
    })

    const allCount = lineItems.length
    const newCount = lineItems.filter((i: any) => i.is_new).length
    const duplicatesCount = lineItems.filter((i: any) => i.is_duplicate).length

    const handleExport = () => {
        const rows = [
            ['Item', 'Code', 'UOM', 'Master Item', 'Action'],
            ...lineItems.map((i: any) => [
                i.item_name,
                i.item_code ?? i.suggestions?.[0]?.code ?? '',
                i.unit_of_measure,
                i.selectedMasterId ?? '',
                i.createNew ? 'Create New' : 'Map to Master',
            ]),
        ]
        const csv = rows.map(r => r.map((c: any) => `"${c}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'quotation-items.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const isLoading = uploadMutation.isPending || vendorSaveMutation.isPending || quotationSaveMutation.isPending

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="space-y-6">

                {/* Loading overlay */}
                {isLoading && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 rounded-xl border bg-background px-5 py-4 text-sm text-muted-foreground shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {uploadMutation.isPending ? 'Extracting details…' : vendorSaveMutation.isPending ? 'Saving vendor…' : 'Saving quotation…'}
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Upload Quotation</h1>
                        <p className="text-sm text-gray-600">Upload a quotation file to extract vendors and items</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => router.push('/quotation')} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                </div>

                {/* Error */}
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-700 text-sm">{errorMessage}</p>
                    </div>
                )}

                {/* ── Section 1: Upload ── */}
                <div>
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
                            <h3 className="text-lg font-semibold text-foreground mb-1">Drop the quotation file here</h3>
                            <p className="text-sm text-muted-foreground mb-5">PDF — AI extracts everything.</p>
                            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); document.getElementById('quotation-file')?.click() }}>
                                Browse file
                            </Button>
                            <input id="quotation-file" type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => addFile(e.target.files)} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 rounded-xl border bg-background">
                            <div className="w-10 h-8 rounded-lg border bg-muted/40 flex items-center justify-center text-xs font-bold text-foreground">PDF</div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatSize(file.size)} · uploaded just now</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                                {uploadMutation.isPending ? 'Processing...' : hasData ? 'Ready' : 'Waiting'}
                            </Badge>
                            <Button variant="outline" onClick={() => setFile(null)} className="shrink-0">Remove</Button>
                        </div>
                    )}
                </div>

                {/* ── Section 2: Vendor + Quotation ── */}
                {!uploadMutation.isPending && hasData && vendors && (
                    <div className="mb-6">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Vendor extracted from this quotation
                        </p>

                        <div className="rounded-xl border bg-muted/5 p-4 flex flex-col md:flex-row gap-4">
                            {/* Left: Vendor Details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground flex-shrink-0">
                                        {vendors.company_name
                                            ? vendors.company_name
                                                .split(' ')
                                                .filter(Boolean)
                                                .slice(0, 2)
                                                .map((p: string) => p[0])
                                                .join('')
                                                .toUpperCase()
                                            : 'V'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-sm truncate text-foreground">
                                                {vendors.company_name ?? 'Vendor'}
                                            </h4>
                                            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0 text-xs font-medium">
                                                {vendors.is_new ? 'New vendor' : 'Existing vendor'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {[vendors.address, vendors.city, vendors.state, vendors.pincode].filter(Boolean).join(', ')}
                                        </p>
                                    </div>

                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                    <div>
                                        <p className="uppercase font-semibold">GSTIN</p>
                                        <p className="text-sm font-medium truncate">{vendors.gst_number ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="uppercase font-semibold">Email</p>
                                        <p className="text-sm font-medium truncate">{vendors.contact_email ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="uppercase font-semibold">Phone</p>
                                        <p className="text-sm font-medium truncate">{vendors.contact_phone ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="uppercase font-semibold">Bank</p>
                                        <p className="text-sm font-medium truncate">
                                            {vendors.bank_name
                                                ? `${vendors.bank_name} | A/C: ${vendors.bank_account ?? '—'} | IFSC: ${vendors.bank_ifsc ?? '—'}`
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Quotation Details */}
                            <div className="flex-1 min-w-0 border-l border-muted/20 pl-4 md:pl-6 flex flex-col justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                    Quotation Details
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                    <div>
                                        <p className="uppercase font-semibold">Quotation No</p>
                                        <p className="text-sm font-medium truncate">{vendors.quotation_no ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="uppercase font-semibold">Quotation Date</p>
                                        <p className="text-sm font-medium truncate">{vendors.quotation_date ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="uppercase font-semibold">GST %</p>
                                        <p className="text-sm font-medium truncate">{vendors.gst_percentage ?? '—'}</p>
                                    </div>
                                    <div>
                                        <p className="uppercase font-semibold">PAN</p>
                                        <p className="text-sm font-medium truncate">{vendors.pan_number ?? '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* ── Section 3: Line Items + Totals + T&C ── */}
                {!uploadMutation.isPending && hasData && lineItems.length > 0 && (
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Line Items</p>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleFilterChange('all', 'true')}
                                        className={`h-7 px-3 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${filters.all === 'true' ? 'bg-foreground text-background border-foreground' : 'bg-background hover:bg-muted border-border text-muted-foreground'}`}
                                    >
                                        All
                                        <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold min-w-[18px] ${filters.all === 'true' ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'}`}>{allCount}</span>
                                    </button>
                                    <button
                                        onClick={() => handleFilterChange('new', 'true')}
                                        className={`h-7 px-3 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${filters.new === 'true' ? 'bg-blue-600 text-white border-blue-600' : 'bg-background hover:bg-muted border-border text-muted-foreground'}`}
                                    >
                                        New
                                        <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold min-w-[18px] ${filters.new === 'true' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{newCount}</span>
                                    </button>
                                    <button
                                        onClick={() => handleFilterChange('duplicates', 'true')}
                                        className={`h-7 px-3 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${filters.duplicates === 'true' ? 'bg-amber-500 text-white border-amber-500' : 'bg-background hover:bg-muted border-border text-muted-foreground'}`}
                                    >
                                        Duplicates
                                        <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold min-w-[18px] ${filters.duplicates === 'true' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{duplicatesCount}</span>
                                    </button>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExport}
                                    className="gap-1.5 h-8 text-xs font-medium border-black text-black hover:bg-black hover:text-white transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5 text-black group-hover:text-white" />
                                    Export
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-xl border overflow-hidden">
                            <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                                <table className="w-full text-sm min-w-[600px]">
                                    <thead className="sticky top-0 z-10 bg-background">
                                        <tr className="border-b bg-muted/10">
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">UOM</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Master Item</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Create New Item</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-10 text-center text-muted-foreground text-sm">
                                                    No items match the selected filter.
                                                </td>
                                            </tr>
                                        ) : filteredItems.map((item: any) => {
                                            const options = [
                                                ...item.suggestions.map((s: any) => ({
                                                    value: String(s.master_item_id),
                                                    label: `${s.code} - ${s.description}`,
                                                    group: 'Matched Suggestions'
                                                })),
                                                ...masterItems.map((m: any) => ({
                                                    value: String(m.id),
                                                    label: `${m.code} - ${m.description}`,
                                                    group: 'All Items'
                                                })),
                                            ]
                                            return (
                                                <tr key={item.item_code || item.item_name} className="border-b hover:bg-muted/30 transition-colors">
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-gray-900 truncate">{item.item_name}</p>
                                                            {item.is_new && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">New</Badge>}
                                                            {item.is_duplicate && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Duplicate</Badge>}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-700 truncate">{item.item_code ?? item.suggestions?.[0]?.code ?? '—'}</td>
                                                    <td className="py-2 px-3 text-gray-700 text-right">{item.item_price}</td>
                                                    <td className="py-2 px-3 text-gray-700">{item.unit_of_measure}</td>
                                                    <td className="py-3 px-3">
                                                        {item.createNew ? (
                                                            <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                                                                New item will be created
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                {item.suggestions.length > 0 && (
                                                                    <Badge className="absolute -top-3 -right-3 z-10" variant="warning">
                                                                        {item.suggestions.length}
                                                                    </Badge>
                                                                )}
                                                                <Combobox
                                                                    options={options}
                                                                    value={item.selectedMasterId || ''}
                                                                    onValueChange={(value) =>
                                                                        setLineItems((prev: any) =>
                                                                            prev.map((i: any) =>
                                                                                i.item_code === item.item_code ? { ...i, selectedMasterId: value } : i
                                                                            )
                                                                        )
                                                                    }
                                                                    placeholder="Select master item..."
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 flex justify-center">
                                                        <Checkbox
                                                            id={`create-new-${item.item_code}`}
                                                            checked={item.createNew || false}
                                                            onCheckedChange={(checked) =>
                                                                setLineItems((prev: any) =>
                                                                    prev.map((i: any) =>
                                                                        i.item_code === item.item_code ? { ...i, createNew: Boolean(checked) } : i
                                                                    )
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Item count */}
                            <div className="px-3 py-2 border-t bg-muted/10 text-xs text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{filteredItems.length}</span> of <span className="font-medium text-foreground">{allCount}</span> items
                            </div>

                            {/* Totals — always visible, never scrolls */}
                            <div className="border-t bg-muted/5 overflow-x-auto">
                                <table className="w-full text-sm min-w-[600px]">
                                    <tbody>
                                        <tr>
                                            <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">Subtotal</td>
                                            <td className="py-2 px-3 text-right">₹ {subtotal.toLocaleString('en-IN')}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">SGST @ {combinedTaxRate / 2}%</td>
                                            <td className="py-2 px-3 text-right">₹ {sgst.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">CGST @ {combinedTaxRate / 2}%</td>
                                            <td className="py-2 px-3 text-right">₹ {cgst.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">Round off</td>
                                            <td className="py-2 px-3 text-right">{roundOff.toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-t">
                                            <td colSpan={5} className="text-right py-3 px-3 font-semibold text-base">Grand Total</td>
                                            <td className="py-3 px-3 font-bold text-right text-base">₹ {finalTotal.toLocaleString('en-IN')}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={6} className="py-2 px-3 text-sm italic text-muted-foreground">
                                                Amount in words: {numberToWords(finalTotal)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Terms & Conditions */}
                            {vendors?.terms_and_conditions?.length > 0 && (
                                <div className="p-4 border-t">
                                    <h4 className="text-sm font-medium mb-2">Terms & Conditions</h4>
                                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                                        {vendors.terms_and_conditions.map((term: string, i: number) => (
                                            <li key={i}>{term}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Submit / Done */}
                            <div className="flex justify-end p-4 border-t">
                                {quotationSaved ? (
                                    <Button onClick={() => router.push('/quotation')} className="gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Done
                                    </Button>
                                ) : (
                                    <Button onClick={handleSubmit} className="gap-2" disabled={isLoading}>
                                        Submit Quotation <ChevronRight className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Modal */}
                <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Submit Quotation?</DialogTitle>
                            <DialogDescription>
                                Once submitted, these items cannot be changed. Please verify that all selections are correct.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>Go Back</Button>
                            <Button onClick={confirmAndSubmit} disabled={isLoading}>
                                {isLoading ? 'Submitting...' : 'Yes, Submit'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )

}