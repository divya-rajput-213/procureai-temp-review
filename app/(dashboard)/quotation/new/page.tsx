'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, AlertCircle, ArrowLeft, ChevronRight, Loader2, CheckCircle2, Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'

interface FilterState {
    all: string;
    new: string;
    duplicates: string;
}

// ─── Inline row-level master item search ─────────────────────────────────────
function RowItemSearch({ masterItems, lineItems, rowIndex, onPick, onCreateCustom, onCancel }: {
    masterItems: any[]
    lineItems: any[]
    rowIndex: number
    onPick: (m: any) => void
    onCreateCustom: (name: string) => void
    onCancel: () => void
}) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(true)
    const wrapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    const term = query.trim().toLowerCase()
    const matches = term
        ? masterItems.filter((m: any) => `${m.code} ${m.description}`.toLowerCase().includes(term)).slice(0, 30)
        : []

    return (
        <div ref={wrapRef} className="relative flex items-center gap-1.5">
            <input
                autoFocus
                type="text"
                placeholder="Search master item or type to create…"
                className="h-8 px-2 text-sm border border-primary rounded-md bg-background flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                onKeyDown={e => {
                    if (e.key === 'Escape') onCancel()
                    if (e.key === 'Enter' && term && matches.length === 0) onCreateCustom(query.trim())
                }}
            />
            <button
                type="button"
                onClick={onCancel}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Cancel add row"
            >
                <X className="w-3.5 h-3.5" />
            </button>
            {open && term.length > 0 && (
                <div className="absolute z-30 left-0 top-full mt-1 w-[420px] max-w-[95vw] bg-white border rounded-md shadow-lg max-h-64 overflow-auto divide-y">
                    {matches.length === 0 ? (
                        <button
                            type="button"
                            onClick={() => onCreateCustom(query.trim())}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                            <span className="text-muted-foreground">No master matches. </span>
                            <span className="font-medium">Create item “{query.trim()}”</span>
                        </button>
                    ) : (
                        matches.map((m: any) => {
                            const alreadyAdded = lineItems.some((li: any, i: number) =>
                                i !== rowIndex && (
                                    String(li.selectedMasterId) === String(m.id) ||
                                    (li.item_code && m.code && String(li.item_code).toLowerCase() === String(m.code).toLowerCase()) ||
                                    (li.hsn_code && m.hsn_code && String(li.hsn_code).toLowerCase() === String(m.hsn_code).toLowerCase())
                                )
                            )
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    disabled={alreadyAdded}
                                    onClick={() => !alreadyAdded && onPick(m)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent flex items-start gap-2"
                                >
                                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{m.code}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block truncate font-medium">{m.description}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {m.unit_of_measure}
                                            {m.unit_rate ? <> · ₹{Number(m.unit_rate).toLocaleString('en-IN')}</> : null}
                                            {m.hsn_code ? <> · HSN {m.hsn_code}</> : null}
                                        </span>
                                    </span>
                                    {alreadyAdded && (
                                        <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">Already added</span>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
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
    const [savedQuotationData, setSavedQuotationData] = useState<any>(null)
    const [showExportModal, setShowExportModal] = useState(false)
    const [plantId, setPlantId] = useState<string>('')
    const [departmentId, setDepartmentId] = useState<string>('')
    // ── Change Vendor Modal ──────────────────────────────────────────
    const [showChangeVendorModal, setShowChangeVendorModal] = useState(false)
    const [vendorSearch, setVendorSearch] = useState('')

    const { data: plants = [] } = useQuery({
        queryKey: ['plants'],
        queryFn: async () => {
            const r = await apiClient.get('/users/plants/')
            return r.data?.results ?? r.data ?? []
        },
    })

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const r = await apiClient.get('/users/departments/')
            return r.data?.results ?? r.data ?? []
        },
    })

    // Fetch ALL approved vendors once — filter client-side by search string
    const { data: allApprovedVendors = [], isFetching: vendorsFetching } = useQuery({
        queryKey: ['vendors-approved'],
        queryFn: async () => {
            const r = await apiClient.get('/vendors/', {
                params: { status: 'approved' },
            })
            return r.data.results ?? r.data
        },
    })

    // Client-side filter: show all when search is empty
    const vendorSearchResults = vendorSearch.trim().length === 0
        ? allApprovedVendors
        : allApprovedVendors.filter((v: any) => {
            const q = vendorSearch.toLowerCase()
            return (
                v.company_name?.toLowerCase().includes(q) ||
                v.city?.toLowerCase().includes(q) ||
                v.state?.toLowerCase().includes(q) ||
                v.gst_number?.toLowerCase().includes(q) ||
                v.contact_email?.toLowerCase().includes(q)
            )
        })

    // ── Export Mutation ──────────────────────────────────────────────
    const exportMutation = useMutation({
        mutationFn: async () => {
            const newItems = lineItems.filter((i: any) => i.is_new)
            const payload = {
                items: newItems.map((i: any) => ({
                    item_code: i.item_code,
                    item_name: i.item_name,
                    item_price: i.item_price,
                    quantity: i.quantity || 1,
                    unit_of_measure: i.unit_of_measure,
                    hsn_code: i.hsn_code ?? i.suggestions?.[0]?.hsn_code ?? null,
                    suggestions: i.suggestions || [],
                    is_new: i.is_new,
                    is_duplicate: i.is_duplicate,
                })),
                format: 'excel',
            }
            const { data } = await apiClient.post('/quotations/export-new-items/', payload, { responseType: 'blob' })
            return data
        },
        onSuccess: (blob: Blob) => {
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'new-items.xlsx'
            a.click()
            window.URL.revokeObjectURL(url)
            setShowExportModal(false)
        },
        onError: () => {
            toast({ title: 'Export failed', description: 'Unable to export new items', variant: 'destructive' })
        },
    })

    const handleExport = () => setShowExportModal(true)

    // ── Master Items ─────────────────────────────────────────────────
    const { data: masterItems = [] } = useQuery({
        queryKey: ['procurement-items'],
        queryFn: async () => {
            const { data } = await apiClient.get('/procurement/items/')
            return data.results || data
        },
    })

    // ── Filter ───────────────────────────────────────────────────────
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

    // ── Upload Mutation ──────────────────────────────────────────────
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
            setLineItems(
                (data.items || []).map((item: any) => ({
                    ...item,
                    createNew: item?.is_new ? true : (item?.createNew ?? false),
                    selectedMasterId: item?.is_new ? '' : (item?.selectedMasterId ?? ''),
                }))
            )
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
    // ── Quotation Save Mutation ──────────────────────────────────────
    const quotationSaveMutation = useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post('/quotations/save/', {
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
                    is_new: vendors?.is_new ?? true,
                },
                quotation_no: quotation?.vendor?.quotation_no ?? null,
                quotation_date: quotation?.vendor?.quotation_date ?? null,
                terms_and_conditions: vendors?.terms_and_conditions ?? null,
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                file_key: quotation?.file_key ?? null,
                items: lineItems.map((item: any) => {
                    const selectedSuggestion = item.suggestions?.find(
                        (s: any) => String(s.master_item_id) === String(item.selectedMasterId)
                    )
                    const selectedMaster = masterItems?.find(
                        (m: any) => String(m.id) === String(item.selectedMasterId)
                    )

                    return {
                        item_code: item.item_code ?? item.code,
                        item_name: item.item_name,
                        item_price: item.item_price,
                        quantity: item.quantity || 1,
                        unit_of_measure: item.unit_of_measure ?? item.uom,
                        hsn_code: item.hsn_code ?? selectedSuggestion?.hsn_code ?? selectedMaster?.hsn_code ?? null,
                        create_new_item: item.createNew,
                        is_new: item?.is_new || false,
                        is_duplicate: item?.is_duplicate || false,
                        suggestions: item.createNew
                            ? []
                            : selectedSuggestion
                                ? [selectedSuggestion]
                                : [],
                    }
                })

            })
            return data
        },
        onSuccess: (data: any) => {
            setSavedQuotationData(data)

            toast({
                title: 'Success',
                description: data?.message || 'Quotation saved successfully',
                variant: 'default',
            })

            router.push('/quotation')
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message ?? error?.response?.data?.detail ?? 'Failed to save quotation.'
            setErrorMessage(message)
            toast({ title: 'Error', description: message, variant: 'destructive' })
        },
    })

    // ── Reset on file remove ─────────────────────────────────────────
    useEffect(() => {
        if (!file) {
            setQuotation(null)
            setVendors(null)
            setLineItems([])
            setErrorMessage('')
            setSavedQuotationData(null)
        }
    }, [file])

    // ── File helpers ─────────────────────────────────────────────────
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

    // ── Submit ───────────────────────────────────────────────────────
    const handleSubmit = () => setShowConfirmModal(true)

    const confirmAndSubmit = () => {
        setShowConfirmModal(false)
        quotationSaveMutation.mutate()
    }

    // ── Helpers ──────────────────────────────────────────────────────
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getVendorInitials = (name: string) =>
        name?.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase() || 'V'

    const hasData = quotation && vendors && lineItems.length > 0

    // ── Auto-set default selectedMasterId from suggestions ───────────
    useEffect(() => {
        if (lineItems.length === 0) return
        setLineItems((prev: any) => {
            let updated = false
            const newItems = prev.map((item: any) => {
                if (!item.selectedMasterId && item.suggestions?.length > 0) {
                    updated = true
                    return { ...item, selectedMasterId: String(item.suggestions[0].master_item_id) }
                }
                return item
            })
            return updated ? newItems : prev
        })
    }, [lineItems.length])

    // ── Extracted values from the document (no client-side computation) ─
    const subtotal: number | null = vendors?.subtotal_amount != null ? Number(vendors.subtotal_amount) : null
    const cgstRate: number | null = vendors?.cgst_rate != null ? Number(vendors.cgst_rate) : null
    const sgstRate: number | null = vendors?.sgst_rate != null ? Number(vendors.sgst_rate) : null
    const igstRate: number | null = vendors?.igst_rate != null ? Number(vendors.igst_rate) : null
    const cgstAmount: number | null = vendors?.cgst_amount != null ? Number(vendors.cgst_amount) : null
    const sgstAmount: number | null = vendors?.sgst_amount != null ? Number(vendors.sgst_amount) : null
    const igstAmount: number | null = vendors?.igst_amount != null ? Number(vendors.igst_amount) : null
    const grandTotal: number | null = vendors?.grand_total != null ? Number(vendors.grand_total) : null

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

    const isLoading = uploadMutation.isPending || quotationSaveMutation.isPending

    return (
        <div className="space-y-6 mx-auto">

            {/* Loading overlay */}
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-xl border bg-background px-5 py-4 text-sm text-muted-foreground shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {uploadMutation.isPending ? 'Extracting details…' : 'Saving quotation…'}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Upload Quotation</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Drop a PDF — AI extracts vendor and items.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push('/quotation')} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                </Button>
            </div>

            {/* Error */}
            {errorMessage && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-destructive text-sm">{errorMessage}</p>
                </div>
            )}

            {/* ── Section 1: Upload ── */}
            <div>
                {!file ? (
                    <div
                        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors bg-white ${dragging ? 'border-primary bg-primary/5' : 'hover:border-border'}`}
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

                        {/* PDF Icon */}
                        <div className="w-10 h-8 rounded-lg border bg-muted/40 flex items-center justify-center text-xs font-bold text-foreground">
                            PDF
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                                {file?.name || 'Quotation File'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {file
                                    ? `${formatSize(file.size)} · uploaded just now`
                                    : 'Uploaded from system'}
                            </p>
                        </div>
                        {/* Quotation meta on the right */}
                        <div className="flex items-start gap-4 shrink-0 mr-2">
                            {(quotation?.vendor?.quotation_no || quotation?.vendor?.quotation_no === 0) && (
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Quotation No</p>
                                    <p className="text-sm font-semibold text-foreground">{quotation.vendor.quotation_no}</p>
                                </div>
                            )}
                            {quotation?.vendor?.quotation_date && (
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Date</p>
                                    <p className="text-sm font-semibold text-foreground">{quotation.vendor.quotation_date}</p>
                                </div>
                            )}
                        </div>
                        {/* Status */}
                        {(!hasData || !quotation?.file_url) && (
                            <Badge variant="secondary" className="text-xs">
                                {uploadMutation.isPending ? 'Processing…' : 'Waiting'}
                            </Badge>
                        )}
                        {hasData && quotation?.file_url && (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Ready</Badge>
                        )}

                        {quotation?.file_url && (
                            <a href={quotation.file_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="gap-1.5">
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                </Button>
                            </a>
                        )}

                        {/* REMOVE only for local file */}
                        {file && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFile(null)}
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                                Remove
                            </Button>
                        )}
                    </div>
                )
                }
            </div>
            {/* ── Plant + Department (optional) ── */}
            {!uploadMutation.isPending && hasData && vendors && (
                <div className="rounded-xl border bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Plant & Department <span className="font-normal normal-case text-[10px]">(optional)</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plant</label>
                            <select
                                className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1"
                                value={plantId}
                                onChange={e => setPlantId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {plants.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Department</label>
                            <select
                                className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1"
                                value={departmentId}
                                onChange={e => setDepartmentId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {departments.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Section 2: Vendor + Quotation ── */}
            {!uploadMutation.isPending && hasData && vendors && (
                <div className="mb-6">
                    {/* Label row with Change Vendor button */}
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Vendor extracted from this quotation
                        </p>
                
                    </div>

                    <div className="rounded-xl border bg-white overflow-hidden">
                        {/* Header strip: avatar + name + badge + meta on the right */}
                        <div className="flex items-start justify-between gap-3 p-4 border-b bg-slate-50/40">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                    {getVendorInitials(vendors.company_name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-semibold text-base text-foreground truncate">{vendors.company_name ?? 'Vendor'}</h4>
                                        <Badge className={vendors.is_new
                                            ? "bg-blue-50 text-blue-700 border border-blue-200 shrink-0 text-[11px] font-medium"
                                            : "bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 text-[11px] font-medium"}>
                                            {vendors.is_new ? 'New vendor' : 'Existing vendor'}
                                        </Badge>
                                    </div>
                                    {[vendors.address, vendors.city, vendors.state, vendors.pincode].some(Boolean) && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {[vendors.address, vendors.city, vendors.state, vendors.pincode].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => {
                                setVendorSearch('')
                                setShowChangeVendorModal(true)
                            }}
                        >
                            <Pencil className="w-3 h-3" />
                            Change vendor
                        </Button>
                            </div>


                        </div>

                        {/* Body: contact / tax / bank — only show what was extracted */}
                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Contact */}
                            {(vendors.contact_name || vendors.contact_email || vendors.contact_phone) && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Contact</p>
                                    {vendors.contact_name && <p className="text-sm font-medium text-foreground truncate" title={vendors.contact_name}>{vendors.contact_name}</p>}
                                    {vendors.contact_email && <p className="text-muted-foreground truncate" title={vendors.contact_email}>{vendors.contact_email}</p>}
                                    {vendors.contact_phone && <p className="text-muted-foreground tabular-nums">{vendors.contact_phone}</p>}
                                </div>
                            )}

                            {/* Tax IDs */}
                            {(vendors.gst_number || vendors.pan_number || vendors.country) && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Tax & Identity</p>
                                    {vendors.gst_number && <p className="text-sm"><span className="text-muted-foreground">GSTIN </span><span className="font-mono font-medium text-foreground">{vendors.gst_number}</span></p>}
                                    {vendors.pan_number && <p className="text-sm"><span className="text-muted-foreground">PAN </span><span className="font-mono font-medium text-foreground">{vendors.pan_number}</span></p>}
                                    {vendors.country && <p className="text-muted-foreground">{vendors.country}</p>}
                                </div>
                            )}

                            {/* Bank */}
                            {vendors.bank_name && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Bank</p>
                                    <p className="text-sm font-medium text-foreground truncate" title={vendors.bank_name}>{vendors.bank_name}</p>
                                    {vendors.bank_account && <p className="text-xs"><span className="text-muted-foreground">A/C </span><span className="font-mono">{vendors.bank_account}</span></p>}
                                    {vendors.bank_ifsc && <p className="text-xs"><span className="text-muted-foreground">IFSC </span><span className="font-mono">{vendors.bank_ifsc}</span></p>}
                                </div>
                            )}
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
                                onClick={() => {
                                    setLineItems((prev: any) => [
                                        ...prev,
                                        {
                                            item_name: '',
                                            item_code: '',
                                            hsn_code: '',
                                            quantity: 1,
                                            unit_of_measure: 'NOS',
                                            item_price: 0,
                                            suggestions: [],
                                            is_new: true,
                                            is_duplicate: false,
                                            createNew: false,
                                            selectedMasterId: '',
                                            isPendingSearch: true,
                                        },
                                    ])
                                    handleFilterChange('all', 'true')
                                }}
                                className="gap-1.5 h-8 text-xs font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Row
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                className="gap-1.5 h-8 text-xs font-medium border-black text-black hover:bg-black hover:text-white transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Export
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden bg-white">
                        <div>
                            <table className="w-full text-sm table-fixed">
                                {/* ── bg-muted/5 items header as requested ── */}
                                <thead className="sticky top-0 z-10 bg-background">
                                    <tr className="border-b bg-muted/5">
                                    <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[11%]">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="select-all-create-new"
                                                    checked={
                                                        filteredItems.length > 0 &&
                                                        filteredItems.every((item: any) => item.createNew)
                                                    }
                                                    onCheckedChange={(checked) => {
                                                        // Build a Set of filtered item references by index in lineItems
                                                        const filteredSet = new Set(
                                                            filteredItems.map((fi: any) =>
                                                                lineItems.findIndex(
                                                                    (li: any, idx: number) => li === fi
                                                                )
                                                            )
                                                        )
                                                        setLineItems((prev: any) =>
                                                            prev.map((item: any, idx: number) =>
                                                                filteredSet.has(idx)
                                                                    ? {
                                                                        ...item,
                                                                        createNew: Boolean(checked),
                                                                        selectedMasterId: checked ? '' : item.selectedMasterId,
                                                                    }
                                                                    : item
                                                            )
                                                        )
                                                    }}
                                                />
                                                Create New
                                            </div>
                                        </th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[22%]">Item</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[20%]">Master Item</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[9%]">HSN</th>
                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground w-[6%]">Qty</th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[6%]">UOM</th>
                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground w-[10%]">Rate</th>
                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground w-[10%]">Amount</th>                          
                                        <th className="w-[5%] py-2 px-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-10 text-center text-muted-foreground text-sm">
                                                No items match the selected filter.
                                            </td>
                                        </tr>
                                    ) : filteredItems.map((item: any, index: number) => {
                                        const options = (item.suggestions ?? []).map((s: any) => ({
                                            value: String(s.master_item_id),
                                            label: `${s.code} - ${s.description}`,
                                            group: 'Matched Suggestions',
                                        }))
                                        return (
                                            <tr key={`${item.item_code || item.item_name}-${index}`} className="border-b hover:bg-muted/30 transition-colors">
                                                    <td className="py-3 px-3 align-middle text-start">
                                                    {!item.isCustomAdd && !item.isPendingSearch ? (
                                                        <Checkbox
                                                            id={`create-new-${item.item_code}`}
                                                            checked={item.createNew || false}
                                                            onCheckedChange={(checked) =>
                                                                setLineItems((prev: any) =>
                                                                    prev.map((i: any, iIndex: number) =>
                                                                        iIndex === index
                                                                            ? {
                                                                                ...i,
                                                                                createNew: Boolean(checked),
                                                                                selectedMasterId: checked ? '' : i.selectedMasterId,
                                                                            }
                                                                            : i
                                                                    )
                                                                )
                                                            }
                                                        />
                                                    ) : null}
                                                </td>
                                                <td className="py-2 px-3 min-w-0">
                                                    {item.isPendingSearch ? (
                                                        <RowItemSearch
                                                            masterItems={masterItems as any[]}
                                                            lineItems={lineItems}
                                                            rowIndex={index}
                                                            onPick={(m: any) => {
                                                                setLineItems((prev: any) => prev.map((i: any, iIdx: number) =>
                                                                    iIdx === index
                                                                        ? {
                                                                            ...i,
                                                                            item_name: m.description,
                                                                            item_code: m.code,
                                                                            hsn_code: m.hsn_code ?? '',
                                                                            unit_of_measure: m.unit_of_measure ?? 'NOS',
                                                                            item_price: Number(m.unit_rate ?? 0),
                                                                            suggestions: [{
                                                                                master_item_id: m.id,
                                                                                code: m.code,
                                                                                description: m.description,
                                                                                unit_of_measure: m.unit_of_measure,
                                                                                hsn_code: m.hsn_code,
                                                                            }],
                                                                            is_new: false,
                                                                            is_duplicate: true,
                                                                            createNew: false,
                                                                            selectedMasterId: String(m.id),
                                                                            isPendingSearch: false,
                                                                        }
                                                                        : i
                                                                ))
                                                            }}
                                                            onCreateCustom={(name: string) => {
                                                                setLineItems((prev: any) => prev.map((i: any, iIdx: number) =>
                                                                    iIdx === index
                                                                        ? { ...i, item_name: name, createNew: true, isPendingSearch: false, is_new: true, is_duplicate: false, isCustomAdd: true }
                                                                        : i
                                                                ))
                                                            }}
                                                            onCancel={() => {
                                                                setLineItems((prev: any) => prev.filter((_: any, iIdx: number) => iIdx !== index))
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <p className="font-medium text-foreground truncate min-w-0" title={item.item_name}>{item.item_name}</p>
                                                            {item.is_new && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">New</Badge>}
                                                            {item.is_duplicate && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Duplicate</Badge>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    {item.isPendingSearch || item.isCustomAdd ? null : item.createNew ? (
                                                        <div className="h-9 flex items-center px-3 rounded-md border border-dashed bg-blue-50/50 text-xs text-blue-700">
                                                            Will create as new master item
                                                        </div>
                                                    ) : options.length === 0 ? (
                                                        <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-xs text-muted-foreground">
                                                            No matching master — tick "Create New"
                                                        </div>
                                                    ) : (
                                                        <Combobox
                                                            options={options}
                                                            value={item.selectedMasterId || ''}
                                                            onValueChange={(value) =>
                                                                setLineItems((prev: any) =>
                                                                    prev.map((i: any, iIndex: number) =>
                                                                        iIndex === index
                                                                            ? { ...i, selectedMasterId: value, createNew: false }
                                                                            : i
                                                                    )
                                                                )
                                                            }
                                                            placeholder={`Choose from ${options.length} match${options.length === 1 ? '' : 'es'}…`}
                                                            className="w-full"
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-muted-foreground truncate">{
                                                    item.hsn_code
                                                    ?? item.suggestions?.find((s: any) => String(s.master_item_id) === String(item.selectedMasterId))?.hsn_code
                                                    ?? masterItems?.find((m: any) => String(m.id) === String(item.selectedMasterId))?.hsn_code
                                                    ?? item.suggestions?.[0]?.hsn_code
                                                    ?? '—'
                                                }</td>
                                              
                                                <td className="py-2 px-3 text-foreground text-right tabular-nums">{Number(item.quantity) || 1}</td>
                                                <td className="py-2 px-3 text-muted-foreground">{item.unit_of_measure}</td>
                                                <td className="py-2 px-3 text-foreground text-right tabular-nums">₹ {Number(item.item_price ?? 0).toLocaleString('en-IN')}</td>
                                                <td className="py-2 px-3 text-foreground text-right tabular-nums font-medium">₹ {((Number(item.quantity) || 1) * (Number(item.item_price) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        
                                            
                                                <td className="py-3 px-3 align-middle">
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            type="button"
                                                            aria-label="Remove line item"
                                                            onClick={() => {
                                                                setLineItems((prev: any) => prev.filter((_: any, i: number) => i !== index))
                                                                toast({ title: 'Item removed', description: item.item_name || 'Line item' })
                                                            }}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Item count */}
                        {/* <div className="px-3 py-2 border-t bg-muted/10 text-xs text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{filteredItems.length}</span> of <span className="font-medium text-foreground">{allCount}</span> items
                            </div> */}

                        {/* Totals — only what was extracted from the PDF */}
                        {(subtotal != null || cgstAmount != null || sgstAmount != null || igstAmount != null || grandTotal != null) && (
                            <div className="border-t bg-muted/5">
                                <table className="w-full text-sm">
                                    <tbody>
                                        {subtotal != null && (
                                            <tr>
                                                <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">Subtotal</td>
                                                <td className="py-2 px-3 text-right">₹ {subtotal.toLocaleString('en-IN')}</td>
                                            </tr>
                                        )}
                                        {cgstAmount != null && (
                                            <tr>
                                                <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">CGST{cgstRate != null ? ` @ ${cgstRate}%` : ''}</td>
                                                <td className="py-2 px-3 text-right">₹ {cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        )}
                                        {sgstAmount != null && (
                                            <tr>
                                                <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">SGST{sgstRate != null ? ` @ ${sgstRate}%` : ''}</td>
                                                <td className="py-2 px-3 text-right">₹ {sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        )}
                                        {igstAmount != null && (
                                            <tr>
                                                <td colSpan={5} className="text-right py-2 px-3 text-muted-foreground">IGST{igstRate != null ? ` @ ${igstRate}%` : ''}</td>
                                                <td className="py-2 px-3 text-right">₹ {igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        )}
                                        {grandTotal != null && (
                                            <tr className="border-t">
                                                <td colSpan={5} className="text-right py-3 px-3 font-semibold text-base">Grand Total</td>
                                                <td className="py-3 px-3 font-bold text-right text-base">₹ {grandTotal.toLocaleString('en-IN')}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

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

                            <Button onClick={handleSubmit} className="gap-2" disabled={isLoading}>
                                Submit Quotation
                            </Button>

                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Modal ── */}
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
                            {isLoading ? 'Submitting...' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Export Modal ── */}

            <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export New Items</DialogTitle>
                        <DialogDescription>
                            Only <b>new items</b> will be exported to Excel. Existing or duplicate items will be ignored.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground">
                        Total new items to export:{" "}
                        <span className="font-semibold text-foreground">
                            {lineItems.filter((i: any) => i.is_new).length}
                        </span>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancel</Button>
                        <Button
                            onClick={() => exportMutation.mutate()}
                            disabled={exportMutation.isPending || lineItems.filter((i: any) => i.is_new).length === 0}
                        >
                            {exportMutation.isPending ? 'Exporting...' : 'Export Excel'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Change Vendor Modal ── */}
            <Dialog
                open={showChangeVendorModal}
                onOpenChange={(open) => {
                    setShowChangeVendorModal(open)
                    if (!open) setVendorSearch('')
                }}
            >
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b">
                        <DialogTitle>Change vendor</DialogTitle>
                        <DialogDescription>
                            Search and select an approved vendor
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search input */}
                    <div className="px-5 py-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by name, GSTIN, city, state…"
                                value={vendorSearch}
                                onChange={(e) => setVendorSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>

                    {/* Results list */}
                    <div className="max-h-72 overflow-y-auto divide-y">

                        {/* Loading */}
                        {vendorsFetching && (
                            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading vendors…
                            </div>
                        )}

                        {/* No results */}
                        {!vendorsFetching && vendorSearchResults.length === 0 && (
                            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                <Search className="w-8 h-8 opacity-20" />
                                <p>
                                    {vendorSearch.trim().length > 0
                                        ? <>No vendors found for <span className="font-medium text-foreground">"{vendorSearch}"</span></>
                                        : 'No approved vendors available'
                                    }
                                </p>
                            </div>
                        )}

                        {/* Vendor rows */}
                        {!vendorsFetching && vendorSearchResults.map((v: any) => (
                            <button
                                key={v.id}
                                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 transition-colors group"
                                onClick={() => {
                                    // ── Preserve gst_percentage from the original extracted quotation ──
                                    // Only update vendor identity fields; quotation-level fields
                                    // (gst_percentage, quotation_no, quotation_date) stay intact.
                                    setVendors((prev: any) => ({
                                        ...v,
                                        gst_percentage: prev?.gst_percentage ?? v.gst_percentage,
                                    }))
                                    setShowChangeVendorModal(false)
                                    setVendorSearch('')
                                }}
                            >
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
                                    {getVendorInitials(v.company_name)}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{v.company_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {[v.city, v.state].filter(Boolean).join(', ')}
                                        {v.gst_number ? ` · ${v.gst_number}` : ''}
                                    </p>
                                </div>

                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>

                    {/* Result count + clear search */}
                    {!vendorsFetching && vendorSearchResults.length > 0 && (
                        <div className="px-5 py-2 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
                            <span>
                                Showing{' '}
                                <span className="font-medium text-foreground">{vendorSearchResults.length}</span>
                                {' '}of{' '}
                                <span className="font-medium text-foreground">{allApprovedVendors.length}</span>
                                {' '}vendors
                            </span>
                            {vendorSearch.trim().length > 0 && (
                                <button
                                    onClick={() => setVendorSearch('')}
                                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    )}

                    <DialogFooter className="px-5 py-3 border-t">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowChangeVendorModal(false)
                                setVendorSearch('')
                            }}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}