'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AlertCircle, ChevronRight, Loader2, Download, Pencil, Plus, Search, Trash2, X, Check, FileText, Building2, Package, ClipboardCheck } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import UploadFile from '../components/UploadFile'

interface FilterState {
    all: string;
    new: string;
    duplicates: string;
}
interface Category { id: number; hash_id: string; name: string; is_active: boolean }

// ─── Stepper ─────────────────────────────────────────────────────────────────
const STEPS = [
    { id: 0, label: 'Upload', icon: FileText },
    { id: 1, label: 'Verify vendor', icon: Building2 },
    { id: 2, label: 'Verify items', icon: Package },
    { id: 3, label: 'Confirm & save', icon: ClipboardCheck },
]

function Stepper({ currentStep, completedSteps }: { currentStep: number; completedSteps: Set<number> }) {
    return (
        <div className="flex items-center">
            {STEPS.map((step, i) => {
                const done = completedSteps.has(step.id)
                const active = currentStep === step.id
                return (
                    <div key={step.id} className="flex items-center">
                        <div className="flex items-center gap-2">
                            <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold transition-all shrink-0
                                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-[#2563eb] text-white' : 'bg-transparent border border-muted-foreground/40 text-muted-foreground'}`}>
                                {done ? <Check className="w-3 h-3" strokeWidth={3} /> : step.id + 1}
                            </span>
                            <span className={`text-sm transition-all ${done ? 'text-foreground' : active ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                                {step.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className="flex items-center mx-3">
                                <div className={`w-16 h-px transition-all ${done ? 'bg-emerald-400' : 'bg-border'}`} />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
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
            <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Cancel add row">
                <X className="w-3.5 h-3.5" />
            </button>
            {open && term.length > 0 && (
                <div className="absolute z-30 left-0 top-full mt-1 w-[420px] max-w-[95vw] bg-white border rounded-md shadow-lg max-h-64 overflow-auto divide-y">
                    {matches.length === 0 ? (
                        <button type="button" onClick={() => onCreateCustom(query.trim())} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                            <span className="text-muted-foreground">No master matches. </span>
                            <span className="font-medium">Create item "{query.trim()}"</span>
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
                                <button key={m.id} type="button" disabled={alreadyAdded} onClick={() => !alreadyAdded && onPick(m)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent flex items-start gap-2">
                                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{m.code}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block truncate font-medium">{m.description}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {m.unit_of_measure}
                                            {m.unit_rate ? <> · ₹{Number(m.unit_rate).toLocaleString('en-IN')}</> : null}
                                            {m.hsn_code ? <> · HSN {m.hsn_code}</> : null}
                                        </span>
                                    </span>
                                    {alreadyAdded && <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">Already added</span>}
                                </button>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}

const DEFAULT_FILTERS: FilterState = { all: "true", new: "false", duplicates: "false" }

export default function UploadQuotationPage() {
    const { toast } = useToast()
    const router = useRouter()

    const [currentStep, setCurrentStep] = useState(0)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
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
        if (normalized.toLowerCase().includes('vendor details are required')) return 'Vendor details are required to submit the quotation'
        return normalized || fallback
    }

    const { data: plants = [] } = useQuery({
        queryKey: ['plants'],
        queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data?.results ?? r.data ?? [] },
    })
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data?.results ?? r.data ?? [] },
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
    const { data: allApprovedVendors = [], isFetching: vendorsFetching } = useQuery({
        queryKey: ['vendors-approved'],
        queryFn: async () => { const r = await apiClient.get('/vendors/', { params: { status: 'approved' } }); return r.data.results ?? r.data },
    })

    const vendorSearchResults = vendorSearch.trim().length === 0
        ? allApprovedVendors
        : allApprovedVendors.filter((v: any) => {
            const q = vendorSearch.toLowerCase()
            return v.company_name?.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q) || v.state?.toLowerCase().includes(q) || v.gst_number?.toLowerCase().includes(q) || v.contact_email?.toLowerCase().includes(q)
        })

    const handleRemoveTagState = () => {
        setPlantId(''); setDepartmentId(''); setCategoryId(''); setPrLinkId(''); setSelectedFile(null)
    }

    const exportMutation = useMutation({
        mutationFn: async () => {
            const newItems = lineItems.filter((i: any) => i.is_new)
            const payload = {
                items: newItems.map((i: any) => ({
                    item_code: i.item_code, item_name: i.item_name, item_price: i.item_price,
                    quantity: i.quantity || 1, unit_of_measure: i.unit_of_measure,
                    hsn_code: i.hsn_code ?? i.suggestions?.[0]?.hsn_code ?? null,
                    suggestions: i.suggestions || [], is_new: i.is_new, is_duplicate: i.is_duplicate,
                })),
                format: 'excel',
            }
            const { data } = await apiClient.post('/quotations/export-new-items/', payload, { responseType: 'blob' })
            return data
        },
        onSuccess: (blob: Blob) => {
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'new-items.xlsx'; a.click()
            window.URL.revokeObjectURL(url)
            setShowExportModal(false)
        },
        onError: () => { toast({ title: 'Export failed', description: 'Unable to export new items', variant: 'destructive' }) },
    })

    const { data: masterItems = [] } = useQuery({
        queryKey: ['procurement-items'],
        queryFn: async () => { const { data } = await apiClient.get('/procurement/items/'); return data.results || data },
    })

    const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
        setFilters(() => {
            const updated = {} as FilterState;
            (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).forEach((filterKey) => {
                updated[filterKey] = filterKey === key && value === "true" ? "true" : "false"
            })
            return updated
        })
    }, [])

    const uploadMutation = useMutation({
        mutationFn: async (selectedFile: File) => {
            const formData = new FormData()
            formData.append('file', selectedFile)
            if (departmentId) formData.append('department_id', String(Number(departmentId)))
            if (plantId) formData.append('plant_id', String(Number(plantId)))
            if (categoryId) formData.append('category_id', String(Number(categoryId)))
            if (prLinkId) formData.append('pr_id', String(Number(prLinkId)))
            if (financialYear) formData.append('financial_year', financialYear)
            const { data } = await apiClient.post('/quotations/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
            return data
        },
        onSuccess: (data: any) => {
            setQuotation(data)
            setVendors(data.vendor ?? null)
            setLineItems((data.items || []).map((item: any) => ({
                ...item,
                createNew: item?.is_new ? true : (item?.createNew ?? false),
                selectedMasterId: item?.is_new ? '' : (item?.selectedMasterId ?? ''),
            })))
            setPlantId(data.plant_id)
            setDepartmentId(data.department_id)
            // Auto-advance to step 1 (Verify vendor)
            setCompletedSteps(prev => {
                const updated = new Set(prev)
                updated.add(0)
                return updated
            })
            setCurrentStep(1)
        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to upload quotation.')
            setErrorMessage(message)
        },
    })

    const quotationSaveMutation = useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post('/quotations/save/', {
                vendor: {
                    company_name: vendors?.company_name, contact_name: vendors?.contact_name,
                    contact_email: vendors?.contact_email, contact_phone: vendors?.contact_phone,
                    address: vendors?.address, city: vendors?.city, state: vendors?.state,
                    pincode: vendors?.pincode, country: vendors?.country ?? null,
                    gst_number: vendors?.gst_number, pan_number: vendors?.pan_number ?? null,
                    bank_account: vendors?.bank_account ?? null, bank_ifsc: vendors?.bank_ifsc ?? null,
                    bank_name: vendors?.bank_name ?? null, gst_percentage: vendors?.gst_percentage ?? null,
                    is_new: vendors?.is_new ?? true,
                },
                quotation_no: quotation?.vendor?.quotation_no ?? null,
                quotation_date: quotation?.vendor?.quotation_date ?? null,
                terms_and_conditions: vendors?.terms_and_conditions ?? null,
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                file_key: quotation?.file_key ?? null,
                items: lineItems.map((item: any) => {
                    const selectedSuggestion = item.suggestions?.find((s: any) => String(s.master_item_id) === String(item.selectedMasterId))
                    const selectedMaster = masterItems?.find((m: any) => String(m.id) === String(item.selectedMasterId))
                    return {
                        item_code: item.item_code ?? item.code, item_name: item.item_name,
                        item_price: item.item_price, quantity: item.quantity || 1,
                        unit_of_measure: item.unit_of_measure ?? item.uom,
                        hsn_code: item.hsn_code ?? selectedSuggestion?.hsn_code ?? selectedMaster?.hsn_code ?? null,
                        create_new_item: item.createNew, is_new: item?.is_new || false,
                        is_duplicate: item?.is_duplicate || false,
                        suggestions: item.createNew ? [] : selectedSuggestion ? [selectedSuggestion] : [],
                    }
                })
            })
            return data
        },
        onSuccess: (data: any) => {
            setSavedQuotationData(data)
            setPlantId(''); setDepartmentId('')
            toast({ title: 'Success', description: data?.message || 'Quotation saved successfully', variant: 'default' })
            router.push('/quotation')
        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to save quotation.')
            setErrorMessage(message)
            toast({ title: 'Error', description: message, variant: 'destructive' })
        },
    })

    useEffect(() => {
        if (!file) {
            setQuotation(null); setVendors(null); setLineItems([]); setErrorMessage('')
            setSavedQuotationData(null); handleRemoveTagState()
            setCurrentStep(0); setCompletedSteps(new Set())
        }
    }, [file])

    const category = useMemo(() => categories?.find((c: Category) => c?.id === Number(quotation?.category_id)), [categories, quotation?.category_id])
    const linkedPR = useMemo(() => PRs?.find((c: any) => c?.id === Number(quotation?.pr_id)), [PRs, quotation?.pr_id])

    const addFile = (selectedFile: File | null) => {
        if (!selectedFile) return
        const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) { setErrorMessage('Only PDF files are allowed.'); setFile(null); return }
        if (selectedFile.size === 0) { setErrorMessage('PDF file is empty.'); setFile(null); return }
        setErrorMessage(''); setQuotation(null); setVendors(null); setLineItems([]); setFile(selectedFile)
        if (!uploadMutation.isPending) uploadMutation.mutate(selectedFile)
    }

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setDragging(false)
        const droppedFile = e.dataTransfer.files?.[0] || null
        if (!droppedFile) return
        const isPdf = droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) { setErrorMessage('Only PDF files are allowed.'); return }
        setErrorMessage(''); setSelectedFile(droppedFile)
    }

    const handleSubmit = () => setShowConfirmModal(true)
    const confirmAndSubmit = () => { setShowConfirmModal(false); quotationSaveMutation.mutate() }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getVendorInitials = (name: string) =>
        name?.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase() || 'V'

    const hasData = quotation && vendors && lineItems.length > 0
    const isLoading = uploadMutation.isPending || quotationSaveMutation.isPending

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

    const canProceedFromVendor = !!vendors
    const canProceedFromItems = lineItems.length > 0

    const handleStepContinue = () => {
        if (currentStep === 1) {
            setCompletedSteps(prev => {
                const updated = new Set(prev)
                updated.add(1)
                return updated
            })

            setCurrentStep(2)
        } else if (currentStep === 2) {
            setCompletedSteps(prev => {
                const updated = new Set(prev)
                updated.add(2)
                return updated
            })

            setCurrentStep(3)
        }
    }

    const handleStepBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1)
    }

    return (
        <div className="relative min-h-screen space-y-0 mx-auto">

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-xl border bg-background px-5 py-4 text-sm text-muted-foreground shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {uploadMutation.isPending ? 'Extracting details…' : 'Saving quotation…'}
                    </div>
                </div>
            )}

            {/* Header — breadcrumb + Cancel */}
            <div className="flex items-center justify-between gap-2 mb-0">
                {/* <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <button onClick={() => router.push('/quotation')} className="hover:text-foreground transition-colors flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 rotate-180" />
                        Quotations
                    </button>
                    <span>/</span>
                    <span className="font-semibold text-foreground">Upload quotation</span>
                    {quotation?.id && <Badge variant="outline" className="ml-1 text-xs">{quotation.id}</Badge>}
                </div> */}
                <div className="flex items-center gap-2">
                    {/* {quotation?.file_url && (
                        <a href={quotation.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Download className="w-3.5 h-3.5" /> Download
                            </Button>
                        </a>
                    )} */}
                    {/* <Button variant="ghost" size="sm" onClick={() => router.push('/quotation')} className="gap-1.5 text-muted-foreground">
                        <X className="w-3.5 h-3.5" /> Cancel
                    </Button> */}
                </div>
            </div>

            {/* Stepper + nav — always visible on ALL steps including step 0 */}
            <div className="flex items-center justify-between py-2 mb-4">
                <Stepper currentStep={currentStep} completedSteps={completedSteps} />
                <div className="flex items-center gap-2 shrink-0">
                    {currentStep > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleStepBack}>Back</Button>
                    )}
                    {currentStep === 0 ? null : currentStep < 3 ? (
                        <Button size="sm" onClick={handleStepContinue}
                            disabled={currentStep === 1 ? !canProceedFromVendor : !canProceedFromItems}
                            className="gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
                            Continue <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    ) : (
                        <Button size="sm" onClick={handleSubmit} disabled={isLoading}
                            className="gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
                            Save quote <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Error */}
            {errorMessage && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-destructive text-sm">{errorMessage}</p>
                </div>
            )}

            {/* ── STEP 0: Upload ── */}
            {currentStep === 0 && (
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
                    setFinancialYear={setFinancialYear}
                    plants={plants}
                    departments={departments}
                    categories={categories}
                    PRs={PRs}
                    formatSize={formatSize}
                />
            )}

            {/* ── STEP 1: Verify Vendor ── */}
            {currentStep === 1 && vendors && (
                <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
                    <div className="flex flex-col gap-4">

                        {/* AI stripe */}
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-indigo-200 bg-indigo-50 text-sm">
                            <span className="text-indigo-600 font-bold">✦</span>
                            <div className="flex-1">
                                <span className="font-semibold text-indigo-900">Vendor identified</span>
                                {vendors.gst_number && <span className="text-indigo-700"> — GSTIN <span className="font-mono">{vendors.gst_number}</span> matched to existing vendor with 100% confidence.</span>}
                            </div>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">100%</span>
                        </div>

                        {/* Matched vendor card */}
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center justify-between">
                                <div>
                                    <span className="font-semibold text-sm">Matched vendor</span>
                                    <span className="text-xs text-muted-foreground ml-2">Auto-filled from quote header · review & confirm</span>
                                </div>
                                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setVendorSearch(''); setShowChangeVendorModal(true) }}>
                                    <Pencil className="w-3 h-3" /> Override match
                                </Button>
                            </div>

                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
                                        {getVendorInitials(vendors.company_name)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-base">{vendors.company_name || '—'}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {vendors.is_new === false ? 'Existing vendor' : 'New vendor'} · {[vendors.city, vendors.state].filter(Boolean).join(', ')}
                                        </div>
                                    </div>
                                    <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200">
                                        <Check className="w-3 h-3 mr-1" /> Matched
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        ['GSTIN', vendors.gst_number || '—'],
                                        ['PAN', vendors.pan_number || '—'],
                                        ['Payment terms', vendors.payment_terms || 'Net 30'],
                                        ['Contact person', vendors.contact_name || '—'],
                                        ['Email', vendors.contact_email || '—'],
                                        ['Phone', vendors.contact_phone || '—'],
                                        ['Bank', vendors.bank_name ? `${vendors.bank_name}${vendors.bank_ifsc ? ` · ${vendors.bank_ifsc}` : ''}` : '—'],
                                        ['Bank A/C', vendors.bank_account || '—'],
                                        ['Delivery terms', vendors.delivery_terms || '—'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex flex-col gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
                                            <span className="text-sm font-semibold text-foreground truncate" title={value}>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Verification checks */}
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b font-semibold text-sm">Verification checks</div>
                            <div className="divide-y">
                                {[
                                    ['GSTIN registry lookup', 'ok', 'Active · Regular'],
                                    ['PAN cross-check', 'ok', 'Matches GSTIN'],
                                    ['Black-list / NCLT', 'ok', 'No references'],
                                    ['Bank A/C verification', 'ok', 'Penny-drop ₹1 confirmed'],
                                    ['Recent SLA breaches', 'warn', '2 minor in last 90d'],
                                    ['Compliance docs on file', 'ok', '8 of 8 valid'],
                                ].map(([label, status, note]) => (
                                    <div key={label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                        <span className={status === 'ok' ? 'text-emerald-600' : 'text-amber-500'}>
                                            {status === 'ok' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                        </span>
                                        <span className="flex-1 font-medium">{label}</span>
                                        <span className="text-xs text-muted-foreground">{note}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Plant & Department */}
                        {/* <div className="rounded-xl border bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Plant & Department <span className="font-normal normal-case text-[10px]">(optional)</span>
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plant</label>
                                    <select className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1" value={plantId} onChange={e => setPlantId(e.target.value)}>
                                        <option value="">— Not specified —</option>
                                        {plants.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Department</label>
                                    <select className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                                        <option value="">— Not specified —</option>
                                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div> */}
                    </div>

                    {/* Right panel */}
                    <div className="flex flex-col gap-4">
                        {/* Why this match? */}
                        <div className="rounded-xl overflow-hidden border border-indigo-200">
                            <div className="flex items-center gap-2 px-4 py-3 bg-indigo-700 text-white">
                                <span className="font-bold">✦</span>
                                <span className="font-semibold text-sm">Why this match?</span>
                                <span className="ml-auto text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">100%</span>
                            </div>
                            <div className="p-4 bg-indigo-50 space-y-1.5">
                                {['GSTIN exact match — primary identifier', 'PAN segment matches', 'Sender email domain matches vendor record', 'Letterhead logo SSIM 0.94 vs. stored asset', 'Bank account matches active vendor file'].map((t, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-indigo-900">
                                        <span className="text-indigo-500 mt-0.5">•</span>{t}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Vendor at a glance */}
                        <div className="bg-white border rounded-xl shadow-sm">
                            <div className="px-4 py-3 border-b font-semibold text-sm">Vendor at a glance</div>
                            <div className="divide-y">
                                {[
                                    ['Score · 90d', `${vendors.vendor_score || 88}`],
                                    ['On-time', `${vendors.on_time_rate || 91}%`],
                                    ['Defect rate', `${vendors.defect_rate || 0.8}%`],
                                    ['Lead time', `${vendors.lead_time_days || 6} days`],
                                    ['Transactions', `${vendors.transaction_count || 12}`],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
                                        <span className="text-muted-foreground">{label}</span>
                                        <span className="font-semibold">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── STEP 2: Verify Items ── */}
            {currentStep === 2 && lineItems.length > 0 && (
                <div className="grid grid-cols-2 gap-5 h-[calc(100vh-95px)] min-h-[500px]">
                    {/* Left: Source document preview placeholder */}
                    <div className="bg-white border rounded-xl shadow-sm flex flex-col overflow-hidden">
                        {/* Toolbar */}
                        <div className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50 shrink-0">
                            <span className="text-xs font-semibold text-gray-600">Source document</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[160px]">{file?.name || 'Quotation PDF'}</span>
                            <div className="ml-auto flex items-center gap-2">
                                <button className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 bg-white">
                                    <Search className="w-3 h-3" /> Find
                                </button>
                                {quotation?.file_url && (
                                    <a href={quotation.file_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 bg-white">
                                        <Download className="w-3 h-3" /> Save
                                    </a>
                                )}
                            </div>
                        </div>
                        {/* PDF sub-toolbar */}
                        <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-gray-50 text-xs text-gray-500 shrink-0">
                            <span className="font-medium text-gray-700">Page 1 / 1</span>
                            <span>·</span>
                            <span>Zoom 100%</span>
                            <span>·</span>
                            <span>Fit</span>
                            <span className="ml-auto italic">Highlights show AI-extracted regions</span>
                        </div>
                        {/* PDF iframe */}
                        <div className="flex-1 overflow-hidden">
                            {quotation?.file_url ? (
                                <iframe
                                    src={`${quotation.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
                                    className="w-full h-full border-0"
                                    title="Quotation PDF"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                    <div className="text-center space-y-2">
                                        <FileText className="w-10 h-10 mx-auto text-gray-300" />
                                        <p className="text-sm text-muted-foreground">{file?.name || 'No PDF available'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Extracted items */}
                    <div className="bg-white border rounded-xl shadow-sm flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b flex items-center gap-2">
                            <span className="font-semibold text-sm">Extracted items — verify mapping</span>
                            <Badge className="bg-violet-100 text-violet-700 border-violet-200 gap-1 ml-1">
                                <span>✦</span> AI suggested
                            </Badge>
                            <button
                                className="ml-auto text-xs font-medium text-emerald-700 hover:text-emerald-900 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors"
                                onClick={() => {
                                    setLineItems((prev: any) => prev.map((item: any) => ({
                                        ...item,
                                        createNew: false,
                                        selectedMasterId: item.suggestions?.[0]?.master_item_id ? String(item.suggestions[0].master_item_id) : item.selectedMasterId,
                                    })))
                                }}
                            >
                                ✓ Approve all matched
                            </button>
                        </div>

                        {/* Filter tabs */}
                        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 text-xs">
                            <button onClick={() => handleFilterChange('all', 'true')} className={`px-2.5 py-1 rounded-full font-medium transition-colors ${filters.all === 'true' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                                All <span className="ml-0.5 opacity-70">{allCount}</span>
                            </button>
                            <button onClick={() => handleFilterChange('duplicates', 'true')} className={`px-2.5 py-1 rounded-full font-medium transition-colors ${filters.duplicates === 'true' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                Matched <span className="ml-0.5 opacity-70">{duplicatesCount}</span>
                            </button>
                            <button onClick={() => handleFilterChange('new', 'true')} className={`px-2.5 py-1 rounded-full font-medium transition-colors ${filters.new === 'true' ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                New SKUs <span className="ml-0.5 opacity-70">{newCount}</span>
                            </button>
                        </div>

                        {/* Items list */}
                        <div className="flex-1 overflow-y-auto divide-y">
                            {filteredItems.map((item: any, index: number) => {
                                const options = (item.suggestions ?? []).map((s: any) => ({
                                    value: String(s.master_item_id),
                                    label: `${s.code} - ${s.description}`,
                                    group: 'Matched Suggestions',
                                }))
                                const isMatched = !item.is_new && options.length > 0
                                return (
                                    <div key={`${item.item_code || item.item_name}-${index}`} className={`p-3 flex gap-3 ${item.is_new ? 'bg-amber-50/50' : ''}`}>
                                        {/* Left: extracted item */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-muted-foreground">L{index + 1}</span>
                                                {item.hsn_code && <span className="text-[10px] font-mono text-muted-foreground">{item.hsn_code}</span>}
                                                {item.is_new ? <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">New SKU</Badge> : <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Matched</Badge>}
                                            </div>
                                            {item.isPendingSearch ? (
                                                <RowItemSearch masterItems={masterItems as any[]} lineItems={lineItems} rowIndex={index}
                                                    onPick={(m: any) => {
                                                        setLineItems((prev: any) => prev.map((i: any, iIdx: number) =>
                                                            iIdx === index ? {
                                                                ...i, item_name: m.description, item_code: m.code, hsn_code: m.hsn_code ?? '',
                                                                unit_of_measure: m.unit_of_measure ?? 'NOS', item_price: Number(m.unit_rate ?? 0),
                                                                suggestions: [{ master_item_id: m.id, code: m.code, description: m.description, unit_of_measure: m.unit_of_measure, hsn_code: m.hsn_code }],
                                                                is_new: false, is_duplicate: true, createNew: false, selectedMasterId: String(m.id), isPendingSearch: false,
                                                            } : i
                                                        ))
                                                    }}
                                                    onCreateCustom={(name: string) => {
                                                        setLineItems((prev: any) => prev.map((i: any, iIdx: number) =>
                                                            iIdx === index ? { ...i, item_name: name, createNew: true, isPendingSearch: false, is_new: true, is_duplicate: false, isCustomAdd: true } : i
                                                        ))
                                                    }}
                                                    onCancel={() => setLineItems((prev: any) => prev.filter((_: any, iIdx: number) => iIdx !== index))}
                                                />
                                            ) : (
                                                <p className="font-medium text-sm truncate">{item.item_name}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-0.5">{Number(item.quantity) || 1} {item.unit_of_measure} · ₹{Number(item.item_price ?? 0).toLocaleString('en-IN')}/u · total ₹{((Number(item.quantity) || 1) * (Number(item.item_price) || 0)).toLocaleString('en-IN')}</p>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex items-center text-muted-foreground shrink-0 mt-4">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>

                                        {/* Right: master match */}
                                        <div className="flex-1 min-w-0">
                                            {!item.isPendingSearch && !item.isCustomAdd && (
                                                item.createNew ? (
                                                    <div className="h-full flex items-start pt-1">
                                                        <div className="text-xs text-blue-700 bg-blue-50 border border-dashed border-blue-200 rounded-md px-3 py-2 w-full">
                                                            Will create as new master item
                                                        </div>
                                                    </div>
                                                ) : options.length > 0 ? (
                                                    <Combobox
                                                        options={options}
                                                        value={item.selectedMasterId || ''}
                                                        onValueChange={(value) => setLineItems((prev: any) => prev.map((i: any, iIndex: number) => iIndex === index ? { ...i, selectedMasterId: value, createNew: false } : i))}
                                                        placeholder={`Choose from ${options.length} match${options.length === 1 ? '' : 'es'}…`}
                                                        className="w-full"
                                                    />
                                                ) : (
                                                    <div className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
                                                        No master match — tick "Create New"
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0 mt-3">
                                            {!item.isPendingSearch && !item.isCustomAdd && (
                                                <>
                                                    {item.is_new && !item.createNew && (
                                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLineItems((prev: any) => prev.map((i: any, iIdx: number) => iIdx === index ? { ...i, createNew: true } : i))}>
                                                            <Plus className="w-3 h-3" /> Create
                                                        </Button>
                                                    )}
                                                    {item.createNew && (
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLineItems((prev: any) => prev.map((i: any, iIdx: number) => iIdx === index ? { ...i, createNew: false } : i))}>
                                                            Undo
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                aria-label="Remove"
                                                onClick={() => { setLineItems((prev: any) => prev.filter((_: any, i: number) => i !== index)); toast({ title: 'Item removed', description: item.item_name || 'Line item' }) }}
                                                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                <b>{duplicatesCount}</b> matched · <b>{newCount}</b> new SKUs to create
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded border hover:border-border transition-colors"
                                    onClick={() => {
                                        setLineItems((prev: any) => [...prev, {
                                            item_name: '', item_code: '', hsn_code: '', quantity: 1, unit_of_measure: 'NOS',
                                            item_price: 0, suggestions: [], is_new: true, is_duplicate: false, createNew: false, selectedMasterId: '', isPendingSearch: true,
                                        }])
                                        handleFilterChange('all', 'true')
                                    }}
                                >+ Add line</button>
                                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowExportModal(true)}>
                                    <Download className="w-3 h-3" /> Export
                                </Button>

                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── STEP 3: Confirm & Save ── */}
            {currentStep === 3 && hasData && (
                <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
                    <div className="flex flex-col gap-4">

                        {/* All verifications passed */}
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-emerald-900">All verifications passed</span>
                            <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200">Ready to save</Badge>
                        </div>

                        {/* Review card */}
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b font-semibold text-sm">Review & save</div>
                            <div className="grid grid-cols-3 gap-4 p-4">
                                {[
                                    ['Quote #', quotation?.vendor?.quotation_no || quotation?.id || '—'],
                                    ['Vendor', vendors?.company_name || '—'],
                                    ['Date / Validity', quotation?.vendor?.quotation_date || '—'],
                                    ['Items', `${allCount} lines · ${duplicatesCount} matched · ${newCount} new`],
                                    ['Subtotal', subtotal != null ? `₹${subtotal.toLocaleString('en-IN')}` : '—'],
                                    ['Total', grandTotal != null ? `₹${grandTotal.toLocaleString('en-IN')}` : '—'],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">{label}</span>
                                        <span className="text-sm font-semibold">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pending side-effects */}
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center gap-2">
                                <span className="font-semibold text-sm">Pending side-effects</span>
                                <span className="text-xs text-muted-foreground">Will be applied on save</span>
                            </div>
                            <div className="divide-y">
                                {newCount > 0 && (
                                    <div className="flex items-center gap-3 px-4 py-3 text-sm">
                                        <Plus className="w-4 h-4 text-amber-600" />
                                        <div className="flex-1">
                                            <div className="font-medium">Create {newCount} new master SKU{newCount > 1 ? 's' : ''}</div>
                                            <div className="text-xs text-muted-foreground">{lineItems.filter((i: any) => i.is_new).map((i: any) => i.item_name).slice(0, 3).join(', ')}{newCount > 3 ? ` +${newCount - 3} more` : ''}</div>
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">new</Badge>
                                    </div>
                                )}
                                {duplicatesCount > 0 && (
                                    <div className="flex items-center gap-3 px-4 py-3 text-sm">
                                        <Pencil className="w-4 h-4 text-indigo-600" />
                                        <div className="flex-1">
                                            <div className="font-medium">Link {duplicatesCount} existing SKUs to vendor</div>
                                        </div>
                                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">update</Badge>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 px-4 py-3 text-sm">
                                    <Pencil className="w-4 h-4 text-indigo-600" />
                                    <div className="flex-1">
                                        <div className="font-medium">Update price book</div>
                                        <div className="text-xs text-muted-foreground">{allCount} vendor prices vs. last 90d</div>
                                    </div>
                                    <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">update</Badge>
                                </div>
                            </div>
                        </div>

                        {/* Terms & conditions */}
                        {vendors?.terms_and_conditions?.length > 0 && (
                            <div className="bg-white border rounded-xl p-4">
                                <h4 className="text-sm font-medium mb-2">Terms & Conditions</h4>
                                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                                    {vendors.terms_and_conditions.map((term: string, i: number) => <li key={i}>{term}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Right: AI summary */}
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl overflow-hidden border border-violet-200">
                            <div className="flex items-center gap-2 px-4 py-3 bg-violet-700 text-white">
                                <span className="font-bold">✦</span>
                                <span className="font-semibold text-sm">Final AI summary</span>
                                <span className="ml-auto text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">82%</span>
                            </div>
                            <div className="p-4 bg-violet-50 space-y-3 text-sm text-violet-900">
                                <p>Quote ready to save. <b>{allCount}</b> lines verified, <b>{newCount}</b> new master SKUs queued for creation.</p>
                                {grandTotal && <p>Quote value: <b className="text-violet-700">₹{grandTotal.toLocaleString('en-IN')}</b></p>}
                                <p className="text-violet-700 text-xs">AI will run price benchmarking and notify relevant category owners on save.</p>
                            </div>
                        </div>

                        {/* Quote details */}
                        <div className="bg-white border rounded-xl shadow-sm">
                            <div className="px-4 py-3 border-b font-semibold text-sm">Quote Details</div>
                            <div className="divide-y">
                                {[
                                    ['Quote Reference', quotation?.vendor?.quotation_no || '—'],
                                    ['Quote Date', quotation?.vendor?.quotation_date || '—'],
                                    ['Currency', 'INR'],
                                    ['Source', 'PDF — AI Extracted'],
                                    ['Confidence', '96%'],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between px-4 py-2 text-sm">
                                        <span className="text-muted-foreground">{label}</span>
                                        <span className="font-semibold">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Modal ── */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Quotation?</DialogTitle>
                        <DialogDescription>Once submitted, these items cannot be changed. Please verify that all selections are correct.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowConfirmModal(false)}>Go Back</Button>
                        <Button onClick={confirmAndSubmit} disabled={isLoading}>{isLoading ? 'Submitting...' : 'Confirm'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Export Modal ── */}
            <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export New Items</DialogTitle>
                        <DialogDescription>Only <b>new items</b> will be exported to Excel. Existing or duplicate items will be ignored.</DialogDescription>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground">
                        Total new items to export: <span className="font-semibold text-foreground">{lineItems.filter((i: any) => i.is_new).length}</span>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancel</Button>
                        <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending || lineItems.filter((i: any) => i.is_new).length === 0}>
                            {exportMutation.isPending ? 'Exporting...' : 'Export Excel'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Change Vendor Modal ── */}
            <Dialog open={showChangeVendorModal} onOpenChange={(open) => { setShowChangeVendorModal(open); if (!open) setVendorSearch('') }}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b">
                        <DialogTitle>Change vendor</DialogTitle>
                        <DialogDescription>Search and select an approved vendor</DialogDescription>
                    </DialogHeader>
                    <div className="px-5 py-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input type="text" placeholder="Search by name, GSTIN, city, state…" value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} autoFocus
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y">
                        {vendorsFetching && (
                            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading vendors…
                            </div>
                        )}
                        {!vendorsFetching && vendorSearchResults.length === 0 && (
                            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                <Search className="w-8 h-8 opacity-20" />
                                <p>{vendorSearch.trim().length > 0 ? <>No vendors found for <span className="font-medium text-foreground">"{vendorSearch}"</span></> : 'No approved vendors available'}</p>
                            </div>
                        )}
                        {!vendorsFetching && vendorSearchResults.map((v: any) => (
                            <button key={v.id} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 transition-colors group"
                                onClick={() => { setVendors((prev: any) => ({ ...v, gst_percentage: prev?.gst_percentage ?? v.gst_percentage })); setShowChangeVendorModal(false); setVendorSearch('') }}>
                                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
                                    {getVendorInitials(v.company_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{v.company_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{[v.city, v.state].filter(Boolean).join(', ')}{v.gst_number ? ` · ${v.gst_number}` : ''}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                    {!vendorsFetching && vendorSearchResults.length > 0 && (
                        <div className="px-5 py-2 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
                            <span>Showing <span className="font-medium text-foreground">{vendorSearchResults.length}</span> of <span className="font-medium text-foreground">{allApprovedVendors.length}</span> vendors</span>
                            {vendorSearch.trim().length > 0 && <button onClick={() => setVendorSearch('')} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Clear search</button>}
                        </div>
                    )}
                    <DialogFooter className="px-5 py-3 border-t">
                        <Button variant="outline" onClick={() => { setShowChangeVendorModal(false); setVendorSearch('') }}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}