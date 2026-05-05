'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Download, Pencil, Plus, Search, Trash2, X, User, Star, Clock, ShieldCheck, MapPin } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'
import UploadFile from '../components/UploadFile'

interface FilterState {
    all: string;
    new: string;
    duplicates: string;
}
interface Category { id: number; hash_id: string; name: string; is_active: boolean }

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
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [quotation, setQuotation] = useState<any>(null)
    const [lineItems, setLineItems] = useState<any>([])
    const [vendors, setVendors] = useState<any>(null)
    const [dragging, setDragging] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [savedQuotationData, setSavedQuotationData] = useState<any>(null)
    const [showExportModal, setShowExportModal] = useState(false)
    const [plantId, setPlantId] = useState<string>('')
    const [departmentId, setDepartmentId] = useState<string>('')
    const [categoryId, setCategoryId] = useState<string>('')
    const [prLinkId, setPrLinkId] = useState<string>('')
    const [financialYear, setFinancialYear] = useState<string>('')
    const [showChangeVendorModal, setShowChangeVendorModal] = useState(false)
    const [vendorSearch, setVendorSearch] = useState('')
    const getApiErrorMessage = (error: any, fallback: string) => {
        const data = error?.response?.data
        let message = fallback

        if (data) {
            if (typeof data === 'string') message = data
            else if (typeof data?.error === 'string') message = data.error
            else if (typeof data?.message === 'string') message = data.message
            else if (typeof data?.detail === 'string') message = data.detail
            else message = Object.entries(data).map(([k, v]) => Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`).join(' | ')
        }

        const normalized = String(message || '').trim()
        if (normalized.toLowerCase().includes('vendor details are required')) {
            return 'Vendor details are required to submit the quotation'
        }

        return normalized || fallback
    }

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
    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['item-categories-active'],
        queryFn: async () => { const r = await apiClient.get('/procurement/categories/?active_only=true'); return r.data.results ?? r.data },
    })
    const { data: PRs = [] } = useQuery({
        queryKey: ['purchase-requisitions'],
        queryFn: async () => {
            const params = new URLSearchParams()
            params.set('status', 'approved')
            const { data } = await apiClient.get(`/procurement/?${params}`)
            return data.results || data
        },
        staleTime: 0,
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
    const handleRemoveTagState = () => {
        setPlantId('')
        setDepartmentId('')
        setCategoryId('')
        setPrLinkId('')
        setSelectedFile(null)
    }
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
            if (departmentId) formData.append('department_id', String(Number(departmentId)))
            if (plantId) formData.append('plant_id', String(Number(plantId)))
            if (categoryId) formData.append('category_id', String(Number(categoryId)))
            if (prLinkId) formData.append('pr_id', String(Number(prLinkId)))
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
            setPlantId(data.plant_id)
            setDepartmentId(data.department_id)

        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to upload quotation.')
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
            setPlantId('')
            setDepartmentId('')
            toast({
                title: 'Success',
                description: data?.message || 'Quotation saved successfully',
                variant: 'default',
            })

            router.push('/quotation')
        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to save quotation.')
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
            handleRemoveTagState()
        }
    }, [file])

    const category = useMemo(
        () => categories?.find((c: Category) => c?.id === Number(quotation?.category_id)),
        [categories, quotation?.category_id]
    )
    const linkedPR = useMemo(
        () => PRs?.find((c: Category) => c?.id === Number(quotation?.pr_id
        )),
        [PRs, quotation?.pr_id
        ]
    )
    // ── File helpers ─────────────────────────────────────────────────
    const addFile = (selectedFile: File | null) => {
        if (!selectedFile) return

        const isPdf =
            selectedFile.type === 'application/pdf' ||
            selectedFile.name.toLowerCase().endsWith('.pdf')

        if (!isPdf) {
            setErrorMessage('Only PDF files are allowed.')
            setFile(null)
            return
        }

        if (selectedFile.size === 0) {
            setErrorMessage('PDF file is empty.')
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

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)

        const droppedFile = e.dataTransfer.files?.[0] || null

        if (!droppedFile) return

        // Optional: validate PDF here early (better UX)
        const isPdf =
            droppedFile.type === 'application/pdf' ||
            droppedFile.name.toLowerCase().endsWith('.pdf')

        if (!isPdf) {
            setErrorMessage('Only PDF files are allowed.')
            return
        }

        setErrorMessage('')
        setSelectedFile(droppedFile)
    }

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
        <div className="relative min-h-screen space-y-4 mx-auto">

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-xl border bg-background px-5 py-4 text-sm text-muted-foreground shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {uploadMutation.isPending ? 'Extracting details…' : 'Saving quotation…'}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2">

                {/* Left */}
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        {hasData ? `${vendors?.company_name}  — Quote` : "Upload Quotation"}
                    </h1>

                    <p className="text-sm text-muted-foreground mt-0.5">
                        {hasData
                            ? `AI-extracted 12 Jan 2025 ${linkedPR?.pr_number ? `· Linked to ${linkedPR?.pr_number} ` : ""
                            } `
                            : "Drop a PDF — AI extracts vendor and items."}
                    </p>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2">

                    {quotation?.file_url && (
                        <a href={quotation.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Download className="w-3.5 h-3.5" />
                                Download
                            </Button>
                        </a>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/quotation')}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>

                </div>
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
                    <UploadFile
                        selectedFile={selectedFile}
                        setSelectedFile={setSelectedFile}
                        addFile={addFile}
                        handleRemoveTagState={handleRemoveTagState}
                        dragging={dragging}
                        handleDragOver={handleDragOver}
                        handleDragLeave={handleDragLeave}
                        handleDrop={handleDrop}
                        uploadMutation={uploadMutation}
                        plantId={plantId}
                        setPlantId={setPlantId}
                        departmentId={departmentId}
                        setDepartmentId={setDepartmentId}
                        categoryId={categoryId}
                        setCategoryId={setCategoryId}
                        prLinkId={prLinkId}
                        setPrLinkId={setPrLinkId}
                        financialYear={financialYear}
                        setFinancialYear={setFinancialYear} // Financial year is auto-detected from the document, so no setter needed here
                        plants={plants}
                        departments={departments}
                        categories={categories}
                        PRs={PRs}
                        formatSize={formatSize}
                    />
                ) : (
                    ""
                    // <div className="flex items-center gap-3 p-4 rounded-xl border bg-background">

                    //     {/* PDF Icon */}
                    //     <div className="w-10 h-8 rounded-lg border bg-muted/40 flex items-center justify-center text-xs font-bold text-foreground">
                    //         PDF
                    //     </div>

                    //     {/* File Info */}
                    //     <div className="flex-1 min-w-0">
                    //         <p className="font-medium text-foreground text-sm truncate">
                    //             {file?.name || 'Quotation File'}
                    //         </p>
                    //         <p className="text-xs text-muted-foreground">
                    //             {file
                    //                 ? `${formatSize(file.size)} · uploaded just now`
                    //                 : 'Uploaded from system'}
                    //         </p>
                    //     </div>

                    //     {/* Status */}
                    //     {(!hasData || !quotation?.file_url) && (
                    //         <Badge variant="secondary" className="text-xs">
                    //             {uploadMutation.isPending ? 'Processing…' : 'Waiting'}
                    //         </Badge>
                    //     )}
                    //     {hasData && quotation?.file_url && (
                    //         <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Ready</Badge>
                    //     )}

                    //     {/* REMOVE only for local file */}
                    //     {file && (
                    //         <Button
                    //             variant="ghost"
                    //             size="sm"
                    //             onClick={() => {
                    //                 setFile(null); handleRemoveTagState()
                    //             }}
                    //             className="shrink-0 text-muted-foreground hover:text-destructive"
                    //         >
                    //             Remove
                    //         </Button>
                    //     )}
                    // </div>
                )
                }
            </div>

            {!uploadMutation.isPending && hasData &&
                <>

                    <div className="grid grid-cols-[1fr_360px] gap-5 items-start">

                        <div className="flex flex-col gap-4">

                            {/* Vendor Card */}
                            {vendors && (
                                <>

                                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">

                                        {/* Banner */}
                                        <div className="bg-gradient-to-br from-[#000000] to-[#0A1E30] text-white p-5 flex items-center gap-4">

                                            {/* Monogram */}
                                            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-bold text-sm">
                                                {vendors.company_name
                                                    ? vendors.company_name.split(" ").map((w: any) => w[0]).slice(0, 2).join("")
                                                    : "MS"}
                                            </div>

                                            {/* Info */}
                                            <div>
                                                <div className="text-base font-bold">
                                                    {vendors.company_name || "-"}
                                                </div>

                                                {/* <div className="flex flex-wrap gap-3 text-xs text-white/70 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {vendors.address}, {vendors.pincode}, {vendors.city}, {vendors.state}, {vendors.country}
                                                    </span>
                                                </div> */}

                                                <div className="flex flex-wrap gap-3 text-xs text-white/70 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {vendors.is_new === false ? "Existing vendor" : "New vendor"}
                                                    </span>

                                                    <span className="flex items-center gap-1">
                                                        <Star className="w-3 h-3" />
                                                        Score {vendors.vendor_score || "94"}/100
                                                    </span>

                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {vendors.transaction_count || "12"} past transactions
                                                    </span>

                                                    <span className="flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3" />
                                                        {vendors.certification || "IATF 16949 Certified"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action */}
                                            <div className="ml-auto flex items-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex items-center gap-1.5 text-black"
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

                                        {/*  Scrollable Section */}
                                        <div className="overflow-auto max-h-[300px]">

                                            {/* Chips */}
                                            <div className="flex flex-wrap gap-2 px-4 py-3 border-b min-w-[700px]">
                                                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-semibold">
                                                    {vendors.tier || "Tier-1 Vendor"}
                                                </span>

                                                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                                                    {vendors.vendor_code || "SAP VND-00423"}
                                                </span>

                                                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-semibold">
                                                    {vendors.contract_status || "Rate Contract Active"}
                                                </span>

                                                {category?.name && (
                                                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 font-semibold">
                                                        {category?.name}
                                                    </span>
                                                )}

                                                <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                                                    {vendors.gst_number ? "GST Verified" : "GST Pending"}
                                                </span>
                                            </div>

                                            {/* Fields */}
                                            <div className="grid grid-cols-2 min-w-[700px]">
                                                {[
                                                    ["Legal Name", vendors.company_name || "-"],
                                                    ["GSTIN", vendors.gst_number || "-"],
                                                    ["PAN", vendors.pan_number || "-"],
                                                    [
                                                        "Contact Person",
                                                        vendors.contact_name
                                                            ? `${vendors.contact_name} — ${vendors.contact_phone || "-"}`
                                                            : vendors.contact_phone || "-",
                                                    ],
                                                    ["Payment Terms", vendors.payment_terms || "Net 30 days"],
                                                    [
                                                        "Bank Details",
                                                        vendors.bank_name || vendors.bank_ifsc
                                                            ? `${vendors.bank_name || "-"}${vendors.bank_ifsc ? ` — IFSC: ${vendors.bank_ifsc}` : ""}`
                                                            : "-"
                                                    ],
                                                    [
                                                        "Bank A/C",
                                                        vendors.bank_account || "-"
                                                    ],
                                                    [
                                                        "Delivery Terms",
                                                        vendors.delivery_terms || "FOR Destination — Manesar",
                                                    ],
                                                    [
                                                        "Quote Valid Until",
                                                        vendors.valid_until || "-",
                                                    ],
                                                    [
                                                        "Lead Time",
                                                        vendors.lead_time || "12 working days from PO",
                                                    ],
                                                ].map(([label, value], i) => (
                                                    <div
                                                        key={i}
                                                        className="p-3 border-b border-r last:border-r-0 text-sm"
                                                    >
                                                        <div className="text-gray-400 text-[11px] uppercase font-semibold">
                                                            {label}
                                                        </div>

                                                        <div
                                                            className={`font-semibold ${label === "Quote Valid Until"
                                                                ? "text-yellow-600"
                                                                : "text-gray-900"
                                                                }`}
                                                        >
                                                            {value}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
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
                                </>
                            )}

                            {/* Line Items */}
                            {lineItems.length > 0 && <div className="bg-white border rounded-xl shadow-sm w-full max-w-[calc(100vw-700px)] overflow-hidden">
                                {/* Header */}
                                <div className="flex justify-between items-center px-4 py-3 border-b">
                                    <div className="font-semibold text-sm">Line Items</div>

                                    <div className="flex items-center gap-2 text-sm">
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
                                                Matched
                                                <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold min-w-[18px] ${filters.duplicates === 'true' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{duplicatesCount}</span>
                                            </button>
                                        </div>
                                        <button className="px-3 py-1 border rounded-md text-xs text-black" onClick={() => {
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
                                        }}>
                                            + Add Line
                                        </button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExport}
                                            className="gap-1.5 h-6 text-xs font-medium hover:bg-black hover:text-white transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Export
                                        </Button>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="relative max-h-[400px] overflow-y-auto overflow-x-hidden">
                                    <table className="w-full text-sm min-w-[900px]">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="p-2">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="select-all-create-new"
                                                            checked={
                                                                filteredItems.length > 0 &&
                                                                filteredItems.every((item: any) => item.createNew)
                                                            }
                                                            onCheckedChange={(checked) => {
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
                                                        Create
                                                    </div>
                                                </th>
                                                <th className="p-2 text-left">Item</th>
                                                <th className="p-2 text-left">Master Item</th>
                                                <th className="p-2 text-left">HSN</th>
                                                <th className="p-2 text-left">Qty</th>
                                                <th className="p-2 text-left">UOM</th>
                                                <th className="p-2 text-left">Rate</th>
                                                <th className="p-2 text-left">Amount</th>
                                                <th className="py-2 px-3" />
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
                                                    <tr key={`${item.item_code || item.item_name}-${index}`} className="border-t">
                                                        <td className="p-2 text-gray-400">
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

                                                        <td className="p-2 max-w-[160px]">
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
                                                                    <p className="font-medium text-foreground truncate min-w-0" title={item.item_name}>
                                                                        {item.item_name}
                                                                    </p>
                                                                    {item.is_new && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 shrink-0">New</Badge>}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="p-2 max-w-[200px]">
                                                            {item.isPendingSearch || item.isCustomAdd ? null : item.createNew ? (
                                                                <div className="h-9 flex items-center px-3 rounded-md border border-dashed bg-blue-50/50 text-xs text-blue-700 truncate">
                                                                    Will create as new master item
                                                                </div>
                                                            ) : options.length === 0 ? (
                                                                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-xs text-muted-foreground truncate">
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

                                                        <td className="p-2 max-w-[80px] truncate">
                                                            {item.hsn_code
                                                                ?? item.suggestions?.find((s: any) => String(s.master_item_id) === String(item.selectedMasterId))?.hsn_code
                                                                ?? masterItems?.find((m: any) => String(m.id) === String(item.selectedMasterId))?.hsn_code
                                                                ?? item.suggestions?.[0]?.hsn_code
                                                                ?? '—'}
                                                        </td>
                                                        <td className="p-2">{Number(item.quantity) || 1}</td>
                                                        <td className="p-2 max-w-[60px] truncate">{item.unit_of_measure}</td>
                                                        <td className="p-2 whitespace-nowrap">₹ {Number(item.item_price ?? 0).toLocaleString('en-IN')}</td>
                                                        <td className="p-2 whitespace-nowrap">₹ {((Number(item.quantity) || 1) * (Number(item.item_price) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td className="p-2 text-right font-semibold">
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

                                        {(subtotal != null || cgstAmount != null || sgstAmount != null || igstAmount != null || grandTotal != null) &&
                                            <tfoot className="sticky bottom-0 z-10">
                                                <tr className="bg-gray-50">
                                                    <td colSpan={8} className="text-right p-2">Subtotal</td>
                                                    <td className="text-right p-2">₹ {subtotal?.toLocaleString('en-IN')}</td>
                                                </tr>
                                                {cgstAmount != null && <tr className="bg-gray-50">
                                                    <td colSpan={8} className="text-right p-2 text-gray-500">
                                                        CGST{cgstRate != null ? ` @ ${cgstRate}%` : ''}
                                                    </td>
                                                    <td className="text-right p-2 text-gray-500">
                                                        {cgstAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>}
                                                {sgstAmount != null && <tr className="bg-gray-50">
                                                    <td colSpan={8} className="text-right p-2 text-gray-500">
                                                        SGST{sgstRate != null ? ` @ ${sgstRate}%` : ''}
                                                    </td>
                                                    <td className="text-right p-2 text-gray-500">
                                                        {sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>}
                                                {igstAmount != null && <tr className="bg-gray-50">
                                                    <td colSpan={8} className="text-right p-2 text-gray-500">
                                                        IGST{igstRate != null ? ` @ ${igstRate}%` : ''}
                                                    </td>
                                                    <td className="text-right p-2 text-gray-500">
                                                        {igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>}
                                                {grandTotal != null && <tr className="bg-[#000000] text-white font-bold">
                                                    <td colSpan={8} className="text-right p-2">Total</td>
                                                    <td className="text-right p-2 text-lg">
                                                        {grandTotal.toLocaleString('en-IN')}
                                                    </td>
                                                </tr>}
                                            </tfoot>}
                                    </table>
                                </div>
                            </div>}
                            {vendors?.terms_and_conditions?.length > 0 && (
                                <div className="p-4">
                                    <h4 className="text-sm font-medium mb-2">Terms & Conditions</h4>
                                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                                        {vendors.terms_and_conditions.map((term: string, i: number) => (
                                            <li key={i}>{term}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {/* Actions */}
                            <div className="flex justify-end gap-3">

                                <button className="px-4 py-2 bg-green-700 text-white rounded-md text-sm font-semibold flex items-center gap-2" onClick={handleSubmit} disabled={isLoading}>
                                    ✓ Confirm & Proceed
                                </button>
                            </div>

                        </div>
                        <div className="flex flex-col gap-4">
                            {/* AI Panel */}
                            <div className="flex flex-col gap-4">
                                {/* AI Panel */}
                                <div className="rounded-xl overflow-hidden border border-orange-400 bg-[#fff7ed]">

                                    {/* Header */}
                                    <div className="flex items-center gap-2 px-4 py-3 bg-[#9a3412] text-white">
                                        <span className="text-sm">✦</span>
                                        <span className="font-semibold text-sm">AI Analysis</span>
                                        <span className="ml-auto text-[10px] font-bold px-2 py-[2px] rounded-full bg-white/20">
                                            96% confident
                                        </span>
                                    </div>

                                    {/* Section */}
                                    <div className="px-4 py-3 ">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a3412] mb-2">
                                            ✦ Extraction Notes
                                        </div>

                                        <div className="flex gap-2 bg-white border rounded-md p-2 text-xs mb-2">
                                            <span>✓</span>
                                            <span>
                                                All line items, quantities and HSN codes extracted correctly.
                                            </span>
                                        </div>

                                        <div className="flex gap-2 bg-amber-50 border border-amber-300 rounded-md p-2 text-xs">
                                            <span>⚠</span>
                                            <span>
                                                Line item 3 — unit price ₹328/MT — <strong>verify</strong>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Section */}
                                    <div className="px-4 py-3 ">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a3412] mb-2">
                                            ✦ Vendor Intelligence
                                        </div>

                                        <div className="flex gap-2 bg-green-50 border border-green-300 rounded-md p-2 text-xs mb-2">
                                            <span>★</span>
                                            <span>12 POs · OTD Rate: <strong>96.2%</strong></span>
                                        </div>

                                        <div className="flex gap-2 bg-green-50 border border-green-300 rounded-md p-2 text-xs">
                                            <span>✓</span>
                                            <span>IATF + ISO certifications valid</span>
                                        </div>
                                    </div>

                                    {/* Section */}
                                    <div className="px-4 py-3 ">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a3412] mb-2">
                                            ✦ Price Benchmark
                                        </div>

                                        <div className="flex gap-2 bg-white border rounded-md p-2 text-xs mb-2">
                                            <span>📊</span>
                                            <span>2mm coil +2.1% vs last purchase</span>
                                        </div>

                                        <div className="flex gap-2 bg-white border rounded-md p-2 text-xs">
                                            <span>📊</span>
                                            <span>Within LME range</span>
                                        </div>
                                    </div>

                                    {/* Section */}
                                    <div className="px-4 py-3">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a3412] mb-2">
                                            ✦ Validity Alert
                                        </div>

                                        <div className="flex gap-2 bg-amber-50 border border-amber-300 rounded-md p-2 text-xs">
                                            <span>⏱</span>
                                            <span>
                                                Valid until <strong>15 Mar 2025</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quote Details */}
                            <div className="bg-white border rounded-xl shadow-sm">
                                <div className="px-4 py-3 border-b font-semibold text-sm">
                                    Quote Details
                                </div>

                                <div>
                                    {[
                                        ["Quote Reference", quotation.vendor.quotation_no],
                                        ["Quote Date", quotation.vendor.quotation_date],
                                        ["Warranty", "12 months"],
                                        ["Advance Payment", "Not required"],
                                        ["Currency", "INR"],
                                        ["Source", "PDF — AI Extracted"],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="flex justify-between px-4 py-2 border-b last:border-none text-sm"
                                        >
                                            <span className="text-gray-500">{label}</span>
                                            <span className="font-semibold">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Activity */}
                            {/* <div className="bg-white border rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b font-semibold text-sm">
            Activity
        </div>

        <div className="px-4 py-4 relative">
            <div className="border-l pl-4 space-y-5">
                <div>
                    <div className="text-xs text-gray-400">12 Jan · 9:42 AM</div>
                    <div className="font-semibold text-sm">Quote uploaded</div>
                    <div className="text-xs text-gray-500">
                        Mahindra_Steel.pdf
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-400">12 Jan · 9:43 AM</div>
                    <div className="font-semibold text-sm">
                        AI extraction complete
                    </div>
                    <div className="text-xs text-gray-500">
                        96% confidence
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-400">12 Jan · 10:15 AM</div>
                    <div className="font-semibold text-sm text-green-600">
                        Confirmed
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-400">Pending</div>
                    <div className="font-semibold text-sm text-gray-400">
                        Submit for approval
                    </div>
                </div>
            </div>
        </div>
    </div>div className="bg-white border rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b font-semibold text-sm">
            Activity
        </div>

        <div className="px-4 py-4 relative">
            <div className="border-l pl-4 space-y-5">
                <div>
                    <div className="text-xs text-gray-400">12 Jan · 9:42 AM</div>
                    <div className="font-semibold text-sm">Quote uploaded</div>
                    <div className="text-xs text-gray-500">
                        Mahindra_Steel.pdf
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-400">12 Jan · 9:43 AM</div>
                    <div className="font-semibold text-sm">
                        AI extraction complete
                    </div>
                    <div className="text-xs text-gray-500">
                        96% confidence
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-400">12 Jan · 10:15 AM</div>
                    <div className="font-semibold text-sm text-green-600">
                        Confirmed
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-400">Pending</div>
                    <div className="font-semibold text-sm text-gray-400">
                        Submit for approval
                    </div>
                </div>
            </div>
        </div>
    </div> */}
                        </div>
                    </div>
                </>

            }

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
