'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, X, Check, ChevronRight } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import UploadFile from '../components/UploadFile'
import VerifyItemsStep from '../components/VerifyItemsStep'
import ReviewSubmitStep from '../components/ReviewSubmitStep'

interface Category { id: number; hash_id: string; name: string; is_active: boolean }

const STEPS = [
    { id: 0, label: 'Upload Document', sub: 'Upload & extract details' },
    { id: 1, label: 'Items & Matching', sub: 'Review & match line items' },
    { id: 2, label: 'Review & Submit', sub: 'Confirm' },
]

function ConfirmModal({ open, onOpenChange, onConfirm, title, description, confirmText, isPending }: Readonly<{
    open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void
    title: string; description: string; confirmText: string; isPending?: boolean
}>) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-md shadow-xl w-full max-w-[520px] p-0 overflow-hidden relative">
                <div className="p-5 space-y-3">
                    <h2 className="text-xl font-semibold tracking-tight pr-10">{title}</h2>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 hover:text-slate-700 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{description}</div>
                </div>
                <div className="border-t px-5 py-3 flex items-center justify-end gap-4">
                    <Button variant="ghost" className="px-2 text-[#042348] hover:text-[#032B5C] hover:bg-transparent" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" disabled={isPending} onClick={onConfirm} className="gap-2 bg-[#042348] text-white hover:bg-[#032B5C] shadow-md rounded-md px-6 font-semibold">
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default function UploadQuotationPage() {
    const { toast } = useToast()
    const router = useRouter()

    const [currentStep, setCurrentStep] = useState(0)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [quotation, setQuotation] = useState<any>(null)
    const [lineItems, setLineItems] = useState<any[]>([])
    const [vendors, setVendors] = useState<any>(null)
    const [dragging, setDragging] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [plantId, setPlantId] = useState<string>('')
    const [departmentId, setDepartmentId] = useState<string>('')
    const [categoryId, setCategoryId] = useState<string>('')
    const [prLinkId, setPrLinkId] = useState<string>('')
    const [financialYear, setFinancialYear] = useState<string>('')
    const [internalNotes, setInternalNotes] = useState<string>('')
    const [isExtracting, setIsExtracting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

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
    const { data: masterItems = [] } = useQuery({
        queryKey: ['procurement-items'],
        queryFn: async () => { const { data } = await apiClient.get('/procurement/items/'); return data.results || data },
    })

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append('file', file)
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
            setPlantId(String(data.plant_id || ''))
            setDepartmentId(String(data.department_id || ''))
            setIsExtracting(false)
        },
        onError: (error: any) => {
            setIsExtracting(false)
            const message = error?.response?.data?.detail || error?.response?.data?.error || getApiErrorMessage(error, 'Failed to upload quotation.')
            setErrorMessage(message)
        },
    })

    const quotationSaveMutation = useMutation({
        mutationFn: async () => {
            const categoryName = categories.find((c: Category) => String(c.id) === String(categoryId))?.name ?? null
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
                terms_and_conditions: internalNotes || vendors?.terms_and_conditions || null,
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                category_name: categoryName,
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
                }),
            })
            return data
        },
        onSuccess: (data: any) => {
            toast({ title: 'Success', description: data?.message || 'Quotation saved successfully' })
            const id = data?.hash_id || data?.id
            router.push(id ? `/quotation/detail/${id}` : '/quotation')
        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to save quotation.')
            setErrorMessage(message)
            toast({ title: 'Error', description: message, variant: 'destructive' })
        },
    })

    useEffect(() => {
        if (!selectedFile) {
            setQuotation(null); setVendors(null); setLineItems([]); setErrorMessage('')
            setPlantId(''); setDepartmentId(''); setCategoryId(''); setPrLinkId('')
            setInternalNotes(''); setFinancialYear('')
            setCurrentStep(0); setCompletedSteps(new Set()); setIsExtracting(false)
        }
    }, [selectedFile])

    // Auto-select first option for each dropdown once data loads
    useEffect(() => { if (plants.length > 0 && !plantId) setPlantId(String(plants[0].id)) }, [plants])
    useEffect(() => { if (departments.length > 0 && !departmentId) setDepartmentId(String(departments[0].id)) }, [departments])
    useEffect(() => { if (categories.length > 0 && !categoryId) setCategoryId(String(categories[0].id)) }, [categories])
    useEffect(() => { if (PRs.length > 0 && !prLinkId) setPrLinkId(String(PRs[0].id)) }, [PRs])
    useEffect(() => { if (!financialYear) setFinancialYear('2025-26') }, [])

    useEffect(() => {
        if (lineItems.length === 0) return
        setLineItems(prev => {
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

    const computedSubtotal = lineItems.reduce((sum: number, item: any) => sum + (Number(item.item_price || 0) * Number(item.quantity || 1)), 0)
    const subtotal: number = vendors?.subtotal_amount != null ? Number(vendors.subtotal_amount) : computedSubtotal
    const gstPercentage = Number(vendors?.gst_percentage || 0)
    const grandTotal: number = vendors?.grand_total != null ? Number(vendors.grand_total) : subtotal + (subtotal * gstPercentage) / 100

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setDragging(false)
        const droppedFile = e.dataTransfer.files?.[0] || null
        if (!droppedFile) return
        if (droppedFile.type !== 'application/pdf' && !droppedFile.name.toLowerCase().endsWith('.pdf')) {
            setErrorMessage('Only PDF files are supported.'); return
        }
        setErrorMessage(''); setSelectedFile(droppedFile)
    }

    const handleExtract = () => {
        if (!selectedFile || uploadMutation.isPending) return
        if (!plantId) { setErrorMessage('Please select a Plant / Location before extracting.'); return }
        if (!departmentId) { setErrorMessage('Please select a Department before extracting.'); return }
        if (!categoryId) { setErrorMessage('Please select a Category before extracting.'); return }
        setErrorMessage(''); setIsExtracting(true)
        uploadMutation.mutate(selectedFile)
    }

    const handleStep0Continue = () => {
        if (!plantId) { setErrorMessage('Plant / Location is required.'); return }
        if (!departmentId) { setErrorMessage('Department is required.'); return }
        if (!categoryId) { setErrorMessage('Category is required.'); return }
        if (!vendors) { handleExtract(); return }
        setCompletedSteps(prev => { const u = new Set(prev); u.add(0); return u })
        setCurrentStep(1)
    }

    const handleStep1Continue = () => {
        setCompletedSteps(prev => { const u = new Set(prev); u.add(1); return u })
        setCurrentStep(2)
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const isSaving = quotationSaveMutation.isPending

    const step0ContinueLabel = () => {
        if (uploadMutation.isPending || isExtracting) return 'Extracting…'
        if (selectedFile && !vendors) return 'Extract & Continue'
        return 'Continue'
    }

    return (
        <>
            <style>{`
                *,*::before,*::after{box-sizing:border-box}
                .qf-root{font-family:'DM Sans',sans-serif;color:var(--tx,#1a1a18)}
                :root{
                    --bg:#fff;--bg-s:#f8f8f6;--bg-t:#f2f1ee;
                    --tx:#1a1a18;--tx2:#5a5a57;--tx3:#9a9a96;
                    --bd:rgba(0,0,0,0.08);--bdm:rgba(0,0,0,0.14);
                    --r:8px;--rl:12px;
                    --blu-bg:#E6F1FB;--blu-tx:#0C447C;--blu-bd:#185FA5;
                    --amb-bg:#FAEEDA;--amb-tx:#854F0B;--amb-bd:#BA7517;
                    --red-bg:#FCEBEB;--red-tx:#A32D2D;--red-bd:#E24B4A;
                    --grn-bg:#EAF3DE;--grn-tx:#3B6D11;--grn-bd:#639922;
                    --tel-bg:#E1F5EE;--tel-tx:#0F6E56;--tel-bd:#1D9E75;
                    --gry-bg:#F1EFE8;--gry-tx:#5F5E5A;--gry-bd:#888780;
                    --pur-bg:#EEEDFE;--pur-tx:#3C3489;--pur-bd:#7F77DD;
                }
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes qf-progress{from{width:30%}to{width:85%}}
                /* Stepper */
                .qf-root .stepper{display:flex;background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:20px}
                .qf-root .step-item{flex:1;padding:14px 16px;display:flex;align-items:center;gap:10px;border-right:0.5px solid var(--bd);background:transparent;border-top:none;border-left:none;border-bottom:none}
                .qf-root .step-item:last-child{border-right:none}
                .qf-root .step-item.done{background:var(--bg-s)}
                .qf-root .step-num{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
                .qf-root .sn-idle{background:var(--bg-t);color:var(--tx3)}
                .qf-root .sn-act{background:#1a1a18;color:#fff}
                .qf-root .sn-done{background:var(--grn-bg);color:var(--grn-tx)}
                .qf-root .step-lbl{font-size:12px;font-weight:600;color:var(--tx3)}
                .qf-root .step-item.active .step-lbl{color:var(--tx)}
                .qf-root .step-item.done .step-lbl{color:var(--tx2)}
                .qf-root .step-sub{font-size:11px;color:var(--tx3)}
                /* Form sections */
                .qf-root .form-sec{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:16px}
                .qf-root .form-sec-head{padding:13px 18px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;gap:10px}
                .qf-root .fsh-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
                .qf-root .fsh-title{font-size:13px;font-weight:600}
                .qf-root .fsh-sub{font-size:11px;color:var(--tx3);margin-top:1px}
                .qf-root .form-body{padding:18px}
                /* Drop zone */
                .qf-root .drop-zone{border:1.5px dashed var(--bdm);border-radius:var(--rl);padding:28px 24px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:var(--bg-s)}
                .qf-root .drop-zone:hover,.qf-root .drop-zone.drag-over{border-color:var(--blu-bd);background:var(--blu-bg)}
                .qf-root .drop-zone.has-file{border-style:solid;border-color:var(--grn-bd);background:var(--grn-bg);cursor:default;padding:14px 16px}
                .qf-root .dz-icon{font-size:28px;color:var(--tx3);margin-bottom:6px;display:block}
                .qf-root .dz-title{font-size:14px;font-weight:500}
                .qf-root .dz-sub{font-size:12px;color:var(--tx3);margin-top:3px}
                /* Parse progress */
                .qf-root .parse-bar{height:4px;background:var(--bg-t);border-radius:2px;overflow:hidden;margin:10px 0 8px}
                .qf-root .parse-fill{height:100%;background:var(--blu-bd);border-radius:2px;animation:qf-progress 2.5s ease-in-out infinite alternate}
                .qf-root .parse-step{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--tx3);padding:3px 0}
                .qf-root .parse-step.active-ps{color:var(--tx);font-weight:500}
                .qf-root .parse-step i{animation:spin 1s linear infinite}
                /* Fields */
                .qf-root .fgrp{display:flex;flex-direction:column;gap:4px}
                .qf-root .lbl{font-size:12px;font-weight:600;color:var(--tx2)}
                .qf-root .req{color:var(--red-bd);margin-left:2px}
                .qf-root .inp{padding:8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;width:100%}
                .qf-root .inp:focus{border-color:#1a1a18}
                .qf-root .inp-extracted{padding:8px 12px;border-radius:var(--r);border:0.5px solid rgba(29,158,117,.4);background:var(--tel-bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tel-tx);outline:none;width:100%;font-weight:500}
                .qf-root .sel{padding:8px 32px 8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9a96'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;width:100%}
                .qf-root .sel:focus{border-color:#1a1a18}
                .qf-root .textarea{padding:8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;resize:vertical;min-height:70px;width:100%}
                .qf-root .textarea:focus{border-color:#1a1a18}
                .qf-root .extracted-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tel-tx);display:flex;align-items:center;gap:4px}
                /* Sidebar cards */
                .qf-root .card{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden}
                .qf-root .card-head{padding:13px 16px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
                .qf-root .card-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;color:var(--tx)}
                .qf-root .card-title i{font-size:14px;color:var(--tx3)}
                .qf-root .card-body{padding:16px}
                /* Checklist */
                .qf-root .ci{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:0.5px solid var(--bd);font-size:12px}
                .qf-root .ci:last-child{border-bottom:none}
                .qf-root .ci-ok{color:var(--grn-tx)}
                .qf-root .ci-idle{color:var(--tx3)}
                /* Action bar */
                .qf-root .sticky-bar{background:var(--bg);border:0.5px solid var(--bd);border-top:0.5px solid var(--bdm);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;bottom:0;z-index:100;margin-top:16px;border-radius:0 0 var(--rl) var(--rl)}
                /* Error strip */
                .qf-root .err-strip{background:var(--red-bg);border:0.5px solid var(--red-bd);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;color:var(--red-tx)}
                /* Inline matching table */
                .qf-root .match-tbl{width:100%;border-collapse:collapse;font-size:13px}
                .qf-root .match-tbl thead th{padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;background:var(--bg-s);border-bottom:0.5px solid var(--bd);white-space:nowrap}
                .qf-root .match-tbl tbody tr{border-bottom:0.5px solid var(--bd);cursor:default;transition:background .1s}
                .qf-root .match-tbl tbody tr:last-child{border-bottom:none}
                .qf-root .match-tbl tbody tr:hover{background:#fafaf8}
                .qf-root .match-tbl td{padding:10px 12px;vertical-align:top}
                .qf-root .cell-inp{border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;width:100%}
                .qf-root .cell-inp:focus{background:var(--blu-bg);border-radius:4px;padding:2px 4px}
                .qf-root .cell-num{border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;width:60px;text-align:right}
                .qf-root .cell-num:focus{background:var(--blu-bg);border-radius:4px;padding:2px 4px}
                .qf-root td.match-tfoot{padding:9px 12px;font-size:12px;background:var(--bg-s);border-top:0.5px solid var(--bdm)}
                .qf-root .match-progress{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--tx2);background:var(--bg);border:0.5px solid var(--bd);padding:8px 14px;border-radius:var(--r);margin-bottom:12px}
                .qf-root .mp-bar{flex:1;height:5px;background:var(--bg-t);border-radius:3px;overflow:hidden}
                .qf-root .mp-fill{height:100%;border-radius:3px;background:#1a1a18;transition:width .3s}
                .qf-root .tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;display:inline-block;white-space:nowrap}
                .qf-root .t-new{background:var(--grn-bg);color:var(--grn-tx)}
                .qf-root .t-match{background:var(--blu-bg);color:var(--blu-tx)}
                .qf-root .t-replace{background:var(--amb-bg);color:var(--amb-tx)}
                .qf-root .t-skip{background:var(--gry-bg);color:var(--gry-tx)}
                /* Step 3 — Review Hero */
                .qf-root .review-hero{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);padding:20px}
                .qf-root .rh-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:16px;padding-top:14px;border-top:0.5px solid var(--bd)}
                .qf-root .rhm-item{padding:0 14px;border-right:0.5px solid var(--bd)}
                .qf-root .rhm-item:first-child{padding-left:0}
                .qf-root .rhm-item:last-child{border-right:none}
                .qf-root .rhm-lbl{font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
                .qf-root .rhm-val{font-size:13px;font-weight:500}
                .qf-root .stat-mini{background:var(--bg-s);border-radius:var(--r);padding:12px 14px}
                .qf-root .sm-lbl{font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
                .qf-root .sm-val{font-size:22px;font-weight:600;letter-spacing:-.6px;line-height:1}
                /* Pills (step 3 status) */
                .qf-root .pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px}
                .qf-root .pill .dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
                .qf-root .p-draft{background:var(--gry-bg);color:var(--gry-tx)}
                .qf-root .p-draft .dot{background:var(--gry-bd)}
                .qf-root .ci-warn{color:var(--amb-tx)}
            `}</style>

            <div className="qf-root relative">
                {/* Page header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>Add Quotation</div>
                        <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 2 }}>Upload document · Extract &amp; match items · Submit for approval</div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/quotation')}>
                        <i className="ti ti-arrow-left" /> Back
                    </Button>
                </div>

                {/* Stepper */}
                <div className="stepper">
                    {STEPS.map((step, i) => {
                        const isDone = completedSteps.has(i)
                        const isActive = currentStep === i
                        return (
                            <div key={step.id} className={`step-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
                                <div className={`step-num ${isDone ? 'sn-done' : isActive ? 'sn-act' : 'sn-idle'}`}>
                                    {isDone ? <Check style={{ width: 10, height: 10 }} /> : i + 1}
                                </div>
                                <div>
                                    <div className="step-lbl">{step.label}</div>
                                    <div className="step-sub">{step.sub}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Error */}
                {errorMessage && (
                    <div className="err-strip">
                        <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span>{errorMessage}</span>
                        <button type="button" onClick={() => setErrorMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-tx)' }}>
                            <X style={{ width: 14, height: 14 }} />
                        </button>
                    </div>
                )}

                {/* ── STEP 0: Upload Document ── */}
                {currentStep === 0 && (
                    <UploadFile
                        selectedFile={selectedFile}
                        setSelectedFile={setSelectedFile}
                        handleRemoveTagState={() => {
                            setPlantId(''); setDepartmentId(''); setCategoryId(''); setPrLinkId('')
                            setInternalNotes(''); setSelectedFile(null); setErrorMessage('')
                        }}
                        dragging={dragging}
                        handleDragOver={handleDragOver}
                        handleDragLeave={handleDragLeave}
                        handleDrop={handleDrop}
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
                        internalNotes={internalNotes}
                        setInternalNotes={setInternalNotes}
                        plants={plants}
                        departments={departments}
                        categories={categories}
                        PRs={PRs}
                        formatSize={formatSize}
                        quotation={quotation}
                        vendors={vendors}
                        isExtracting={isExtracting}
                        allVendors={allApprovedVendors}
                        vendorsFetching={vendorsFetching}
                        onSelectVendor={(v: any) => setVendors((prev: any) => ({ ...v, gst_percentage: prev?.gst_percentage ?? v.gst_percentage }))}
                    />
                )}

                {/* ── STEP 1: Items & Matching ── */}
                {currentStep === 1 && (
                    <VerifyItemsStep
                        file={selectedFile}
                        quotation={quotation}
                        lineItems={lineItems}
                        setLineItems={setLineItems}
                        masterItems={masterItems}
                        onContinue={handleStep1Continue}
                        onBack={() => setCurrentStep(0)}
                    />
                )}

                {/* ── STEP 2: Review & Submit ── */}
                {currentStep === 2 && (
                    <ReviewSubmitStep
                        quotation={quotation}
                        lineItems={lineItems}
                        vendors={vendors}
                        plants={plants}
                        plantId={plantId}
                        PRs={PRs}
                        prLinkId={prLinkId}
                        setPrLinkId={setPrLinkId}
                        internalNotes={internalNotes}
                        setInternalNotes={setInternalNotes}
                    />
                )}

                {/* ── Action bar ── */}
                <div className="sticky-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {currentStep > 0 ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentStep(s => s - 1)}
                            >
                                Back
                            </Button>
                        ) : (
                            <div />
                        )}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            paddingRight: 8,
                            borderRadius: '9999px', // curve
                            padding: '6px 8px',
                        }}
                    >
                        <span style={{ fontSize: 12, color: 'var(--tx3)', marginRight: 4 }}>
                            Step {currentStep + 1} of 3
                        </span>

                        {currentStep === 0 && (
                            <Button
                                size="sm"
                                onClick={handleStep0Continue}
                                disabled={!selectedFile || uploadMutation.isPending || isExtracting}
                                className="gap-1.5"
                            >
                                {(uploadMutation.isPending || isExtracting) && (
                                    <Loader2
                                        style={{
                                            width: 14,
                                            height: 14,
                                            animation: 'spin 0.8s linear infinite',
                                        }}
                                    />
                                )}
                                {step0ContinueLabel()}
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </Button>
                        )}

                        {currentStep === 1 && (
                            <Button
                                size="sm"
                                onClick={handleStep1Continue}
                                disabled={lineItems.length === 0}
                                className="gap-1.5"
                            >
                                Review &amp; Submit
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </Button>
                        )}

                        {currentStep === 2 && (
                            <Button
                                size="sm"
                                onClick={() => setShowConfirm(true)}
                                disabled={isSaving}
                                className="gap-1.5"
                            >
                                {isSaving && (
                                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} />
                                )}
                                Submit
                            </Button>
                        )}
                    </div>
                </div>

                <ConfirmModal
                    open={showConfirm}
                    onOpenChange={setShowConfirm}
                    onConfirm={() => quotationSaveMutation.mutate()}
                    title="Submit Quotation"
                    description={`You are about to save this quotation from ${vendors?.company_name || 'the vendor'} with ${lineItems.length} line item${lineItems.length !== 1 ? 's' : ''}.\n\nThis will create the quotation in Draft status and apply all item matching actions.`}
                    confirmText="Yes, Submit"
                    isPending={quotationSaveMutation.isPending}
                />
            </div>
        </>
    )
}
