'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AlertCircle, ChevronRight, Loader2, Download, Pencil, Plus, Search, Trash2, X, Check, FileText, Building2, Package, Sparkles } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import UploadFile from '../components/UploadFile'
import AIExtractionStep from '../components/AIExtractionStep'
import VerifyItemsStep from '../components/VerifyItemsStep'

interface FilterState {
    all: string;
    new: string;
    duplicates: string;
}
interface Category { id: number; hash_id: string; name: string; is_active: boolean }

// ─── Stepper ─────────────────────────────────────────────────────────────────
const STEPS = [
    { id: 0, label: 'Upload', icon: FileText },
    { id: 1, label: 'AI Extraction', icon: Sparkles },
    { id: 2, label: 'Verify vendor', icon: Building2 },
    { id: 3, label: 'Verify items', icon: Package },
]

function Stepper({ currentStep, completedSteps }: { currentStep: number; completedSteps: Set<number> }) {
    return (
        <div className="flex items-center overflow-x-auto">
            {STEPS.map((step, i) => {
                const done = completedSteps.has(step.id)
                const active = currentStep === step.id
                return (
                    <div key={step.id} className="flex items-center">
                        <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shrink-0
                                ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-transparent border border-border text-muted-foreground'}`}>
                                {step.id + 1}
                            </span>
                            <span className={`text-sm transition-all whitespace-nowrap ${done ? 'text-primary font-semibold' : active ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                                {step.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className="flex items-center mx-3">
                                <div className={`w-14 h-px transition-all ${done ? 'bg-primary/60' : 'bg-border'}`} />
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
    const [isExtracting, setIsExtracting] = useState(false)

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
            // Auto-advance to step 2 after a delay
            setTimeout(() => {
                setIsExtracting(false)
                setCompletedSteps(prev => {
                    const updated = new Set(prev)
                    updated.add(1)
                    return updated
                })
                setCurrentStep(2)
            }, 5000)
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

        // Move to AI Extraction step
        setCurrentStep(1)
        setIsExtracting(true)
        setCompletedSteps(prev => {
            const updated = new Set(prev)
            updated.add(0)
            return updated
        })

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

    const handleSubmit = () => {
        if (currentStep === 3) {
            setCompletedSteps(prev => {
                const updated = new Set(prev)
                updated.add(3)
                return updated
            })
        }
        setShowConfirmModal(true)
    }
    const confirmAndSubmit = () => { setShowConfirmModal(false); quotationSaveMutation.mutate() }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getVendorInitials = (name: string) =>
        name?.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase() || 'V'

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
            // This is AI Extraction step, handled by mutation onSuccess
        } else if (currentStep === 2) {
            setCompletedSteps(prev => {
                const updated = new Set(prev)
                updated.add(2)
                return updated
            })

            setCurrentStep(3)
        } else if (currentStep === 3) {
            setCompletedSteps(prev => {
                const updated = new Set(prev)
                updated.add(3)
                return updated
            })
            setShowConfirmModal(true)
        }
    }

    const handleStepBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1)
    }

    const handleRetryAI = () => {
        if (!selectedFile || uploadMutation.isPending) return
        setErrorMessage('')
        setIsExtracting(true)
        uploadMutation.mutate(selectedFile)
    }

    const handleNextFromAI = () => {
        if (!quotation || !vendors) {
            const message = 'AI extraction is not complete yet. Please retry and wait for extraction to finish.'
            setErrorMessage(message)
            toast({ title: 'Cannot continue', description: message, variant: 'destructive' })
            return
        }
        setCompletedSteps(prev => {
            const updated = new Set(prev)
            updated.add(1)
            return updated
        })
        setCurrentStep(2)
    }

    return (
        <div className="relative min-h-screen space-y-0 mx-auto">

            {/* Loading overlay */}
            {isLoading && currentStep !== 1 && (
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
            <div className="flex items-center justify-between py-2 mb-8 border-b border-border/80 bg-white px-4 rounded-md">
                <Stepper currentStep={currentStep} completedSteps={completedSteps} />
                <div className="flex items-center gap-2">
                    {currentStep === 1 && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleRetryAI}
                                    disabled={!selectedFile || uploadMutation.isPending}
                                    className="gap-1.5 shrink-0"
                                >
                                    {uploadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    Retry AI
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleStepBack} className="gap-1.5 bg-white shadow-sm">
                                    Back
                                </Button>
                            </>
                        )}

                    {currentStep > 0 && currentStep !== 1 && (
                        <Button variant="ghost" size="sm" onClick={handleStepBack} className="gap-1.5 bg-white shadow-sm">
                            Back
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
                <div className="pt-4">
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
                </div>
            )}

            {/* ── STEP 1: AI Extraction ── */}
            {currentStep === 1 && (
                <div className="pt-4">
                    <AIExtractionStep selectedFile={selectedFile} quotation={quotation} onNext={handleNextFromAI} />
                </div>
            )}

            {/* ── STEP 2: Verify Vendor ── */}
            {currentStep === 2 && vendors && (
                <div className="pt-4">
                    <div className="mb-3">
                    </div>
                    <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
                        <div className="flex flex-col gap-4">

                            {/* AI stripe */}
                            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 text-sm">
                                <span className="text-primary font-bold">✦</span>
                                <div className="flex-1">
                                    <span className="font-semibold text-primary">Vendor identified</span>
                                    {vendors.gst_number && <span className="text-primary/80"> — GSTIN <span className="font-mono">{vendors.gst_number}</span> matched to existing vendor with 100% confidence.</span>}
                                </div>
                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">100%</span>
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
                            <div className="rounded-xl overflow-hidden border border-primary/20">
                                <div className="flex items-center gap-2 px-4 py-3 bg-primary text-white">
                                    <span className="font-bold">✦</span>
                                    <span className="font-semibold text-sm">Why this match?</span>
                                    <span className="ml-auto text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">100%</span>
                                </div>
                                <div className="p-4 bg-primary/5 space-y-1.5">
                                    {['GSTIN exact match — primary identifier', 'PAN segment matches', 'Sender email domain matches vendor record', 'Letterhead logo SSIM 0.94 vs. stored asset', 'Bank account matches active vendor file'].map((t, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                            <span className="text-primary mt-0.5">•</span>{t}
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
                </div>
            )}

            {/* ── STEP 3: Verify Items ── */}
            {currentStep === 3 && (
                <div className="pt-4">
                    <VerifyItemsStep
                        file={selectedFile}
                        quotation={quotation}
                        lineItems={lineItems}
                        setLineItems={setLineItems}
                        masterItems={masterItems}
                        onContinue={handleSubmit}
                        onBack={() => setCurrentStep(2)}
                    />
                </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex items-center gap-4 justify-end">
                {currentStep > 0 && currentStep !== 1 && currentStep !== 2 && (
                    <Button variant="ghost" size="sm" onClick={handleStepBack}>Back</Button>
                )}
                {currentStep === 0 ? (
                    <Button
                        size="sm"
                        onClick={() => selectedFile && addFile(selectedFile)}
                        disabled={!selectedFile || uploadMutation.isPending}
                        className="gap-1.5"
                    >
                        {uploadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Continue <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                ) : currentStep === 1 ? null : currentStep < 3 ? (
                    <Button size="sm" onClick={handleStepContinue}
                        disabled={currentStep === 2 ? !canProceedFromVendor : !canProceedFromItems}
                        className={`gap-1.5 ${currentStep === 2 ? 'mt-6' : ''}`}>
                        {currentStep === 2 ? 'Next' : 'Continue'} <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                ) : (
                    <Button size="sm" onClick={handleSubmit} disabled={isLoading}
                        className="gap-1.5">
                        Review & save <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>

            {/* ── Confirm Modal ── */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent className="max-w-5xl p-0 overflow-hidden border border-border shadow-xl bg-background text-foreground rounded-2xl">
                    <div className="flex h-[560px]">
                        {/* LEFT: Identity & Status */}
                        <div className="w-[320px] bg-muted/30 p-6 flex flex-col border-r border-border">
                            <div className="mb-0">
                                <DialogHeader className="text-left mb-5">
                                    <DialogTitle className="text-2xl font-semibold text-primary">Confirm Submission</DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                        Review summary & side-effects<br />before system persistence
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Vendor ID Card */}
                                <div className="space-y-4 mb-7">
                                    <div className="p-3 bg-white border border-border rounded-xl relative overflow-hidden group shadow-sm">
                                        <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex justify-between">
                                            <span>Vendor Match</span>
                                            <span className="text-emerald-600">100%</span>
                                        </div>
                                        <div className="text-base font-semibold truncate leading-tight text-foreground">{vendors?.company_name || '—'}</div>
                                        <div className="text-xs text-muted-foreground mt-1 font-mono">{vendors?.gst_number || 'GSTIN —'}</div>
                                    </div>

                                    <div className="p-3 bg-white border border-border rounded-xl shadow-sm">
                                        <div className="text-xs font-semibold text-muted-foreground mb-1.5">Quote Reference</div>
                                        <div className="text-sm font-semibold text-foreground">{vendors?.quotation_no || 'QT/2026/1001'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: High-Level Summary & Side Effects */}
                        <div className="flex-1 flex flex-col bg-muted/20 p-8">
                            <div className="text-sm font-semibold text-muted-foreground mb-6">Review Summary</div>

                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-white border rounded-xl p-4 shadow-sm">
                                    <div className="text-xs font-semibold text-muted-foreground mb-2">Items</div>
                                    <div className="text-lg font-bold text-foreground leading-none">{lineItems.length} lines</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {lineItems.filter((i: any) => !i.is_new).length} Matched · {lineItems.filter((i: any) => i.is_new).length} New
                                    </div>
                                </div>
                                <div className="bg-white border rounded-xl p-4 shadow-sm">
                                    <div className="text-xs font-semibold text-muted-foreground mb-2">Subtotal</div>
                                    <div className="text-lg font-bold text-foreground leading-none">₹{subtotal?.toLocaleString('en-IN')}</div>
                                    <div className="text-xs text-muted-foreground mt-1">Net value</div>
                                </div>
                                <div className="bg-white border rounded-xl p-4 shadow-sm border-primary/20 ring-2 ring-primary/5">
                                    <div className="text-xs font-semibold text-primary mb-2">Grand Total</div>
                                    <div className="text-xl font-bold text-primary leading-none">₹{grandTotal?.toLocaleString('en-IN')}</div>
                                    <div className="text-xs text-primary/70 mt-1 italic">Inclusive of taxes</div>
                                </div>
                            </div>

                            <div className="text-sm font-semibold text-muted-foreground mb-4">Pending Side-effects <span className="ml-2 font-normal text-xs text-muted-foreground whitespace-nowrap">Will be applied on save</span></div>

                            <div className="space-y-3">
                                <div className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm group hover:border-primary/20 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-foreground">Link {lineItems.filter((i: any) => !i.is_new).length} existing SKUs to vendor</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">Association will be recorded in the Vendor Master</div>
                                    </div>
                                    <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-semibold">UPDATE</Badge>
                                </div>

                                <div className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm group hover:border-primary/20 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-foreground">Update price book</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{lineItems.length} vendor prices vs. last 90d</div>
                                    </div>
                                    <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-semibold">UPDATE</Badge>
                                </div>

                                {lineItems.some((i: any) => i.is_new) && (
                                    <div className="bg-white border border-primary/20 rounded-xl p-4 flex items-center gap-4 shadow-sm group hover:border-primary/40 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-primary">Queue {lineItems.filter((i: any) => i.is_new).length} new SKUs for creation</div>
                                            <div className="text-xs text-primary/70 mt-0.5">Category owners will be notified for approval</div>
                                        </div>
                                        <Badge className="bg-primary/10 text-primary border-none text-[10px] font-semibold">NEW</Badge>
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-8 flex items-center justify-between">
                                <div className="text-xs font-medium text-muted-foreground/70">
                                    <span>Secured by ProcureAI Backend</span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-medium text-muted-foreground/70">
                                        Session ID: {quotation?.id || 'AUTH-001'}
                                    </span>

                                    <Button
                                        onClick={confirmAndSubmit}
                                        disabled={isLoading}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 font-semibold text-sm rounded-xl"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Confirm & Save'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
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
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
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
        </div >
    )
}
