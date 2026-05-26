'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, X, Check, ChevronRight } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { CommonConfirmModal } from '@/components/shared/CommonModal'
import UploadFile from '../components/UploadFile'
import VerifyItemsStep from '../components/VerifyItemsStep'

interface Category { id: number; hash_id: string; name: string; is_active: boolean }

const STEPS = [
    { id: 0, label: 'Upload Document', sub: 'Upload & extract details' },
    { id: 1, label: 'Items & Matching', sub: 'Review & match line items' },
]

export default function UploadQuotationPage() {
    const { toast } = useToast()
    const router = useRouter()
    const queryClient = useQueryClient()

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
    const [showExportModal, setShowExportModal] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [verifyStepValid, setVerifyStepValid] = useState(true)
    const [validUntil, setValidUntil] = useState<string>('')

    const getApiErrorMessage = (error: any, fallback: string) => {
        const data = error?.response?.data
        let message = fallback
        if (data) {
            if (typeof data === 'string') message = data
            else if (typeof data?.error === 'string') message = data.error
            else if (typeof data?.message === 'string') message = data.message
            else if (typeof data?.detail === 'string') message = data.detail
            else message = Object.entries(data).map(([k, v]) => Array.isArray(v) ? `${k}: ${(v as string[]).join(', ')}` : `${k}: ${v}`).join(' | ')
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

      const { data: categories,  } = useQuery({
        queryKey: ['vendor-categories-manage'],
        queryFn: async () => {
          const r = await apiClient.get(`/vendors/categories/`)
          return r.data.results ?? r.data
        },
      })
    const { data: PRs = [] } = useQuery({
        queryKey: ['purchase-requisitions'],
        queryFn: async () => {
            const params = new URLSearchParams()
            params.set('status', 'draft')
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
            const { data } = await apiClient.post('/quotations/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
            return data
        },
        onSuccess: (data: any) => {
            setQuotation(data)
            setVendors(data.vendor ?? null)
            const extractedValidUntil = data.vendor?.valid_until ?? data.valid_until ?? ''
            if (extractedValidUntil) setValidUntil(extractedValidUntil)
            setLineItems((data.items || []).map((item: any) => ({
                ...item,
                createNew: item?.is_new ? true : (item?.createNew ?? false),
                selectedMasterId: item?.is_new ? '' : (item?.selectedMasterId ?? ''),
            })))
            if (data.plant_id) setPlantId(String(data.plant_id))
            if (data.department_id) setDepartmentId(String(data.department_id))
            setIsExtracting(false)
        },
        onError: (error: any) => {
            setIsExtracting(false)
            const message = error?.response?.data?.detail || error?.response?.data?.error || getApiErrorMessage(error, 'Failed to process quotation. Please check the PDF and try again.')
            setErrorMessage(message)
            setSelectedFile(null)
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
                    cgst_rate: vendors?.cgst_rate ?? null, sgst_rate: vendors?.sgst_rate ?? null,
                    igst_rate: vendors?.igst_rate ?? null, cgst_amount: vendors?.cgst_amount ?? null,
                    sgst_amount: vendors?.sgst_amount ?? null, igst_amount: vendors?.igst_amount ?? null,
                    subtotal_amount: vendors?.subtotal_amount ?? null, grand_total: vendors?.grand_total ?? null,
                    place_of_supply: vendors?.place_of_supply ?? null,
                    quotation_no: vendors?.quotation_no ?? quotation?.quotation_no ?? null,
                    quotation_date: vendors?.quotation_date ?? quotation?.quotation_date ?? null,
                    valid_until: validUntil || null,
                    delivery_lead_time_days: vendors?.delivery_lead_time_days ?? null,
                    delivery_terms: vendors?.delivery_terms ?? null,
                    freight_charges: vendors?.freight_charges ?? null,
                    terms_and_conditions: vendors?.terms_and_conditions ?? quotation?.terms_and_conditions ?? null,
                    warranty: vendors?.warranty ?? null,
                    is_new: vendors?.is_new ?? true,
                },
                valid_until: validUntil || null,
                grand_total: quotation?.grand_total ?? null,
                subtotal_amount: quotation?.subtotal_amount ?? null,
                cgst_rate: quotation?.cgst_rate ?? null,
                sgst_rate: quotation?.sgst_rate ?? null,
                igst_rate: quotation?.igst_rate ?? null,
                cgst_amount: quotation?.cgst_amount ?? null,
                sgst_amount: quotation?.sgst_amount ?? null,
                freight_charges: quotation?.freight_charges ?? null,
                delivery_terms: quotation?.delivery_terms ?? null,
                delivery_lead_time_days: quotation?.delivery_lead_time_days ?? null,
                warranty: quotation?.warranty ?? null,
                internal_notes: internalNotes || null,
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                category_id: categoryId ? Number(categoryId) : null,
                pr_id: prLinkId ? Number(prLinkId) : null,
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
            setShowConfirm(false)
            queryClient.invalidateQueries({ queryKey: ['quotations'] })
            router.push('/quotation')
        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to save quotation.')
            setShowConfirm(false)
            setErrorMessage(message)
            toast({ title: 'Error', description: message, variant: 'destructive' })
        },
    })

    // Reset all form state when file is removed
    useEffect(() => {
        if (!selectedFile) {
            setQuotation(null); setVendors(null); setLineItems([])
            setCurrentStep(0); setCompletedSteps(new Set()); setIsExtracting(false)
            setValidUntil('')
        }
    }, [selectedFile])

    // Auto-trigger extraction the moment a file is selected
    useEffect(() => {
        if (!selectedFile) return
        setErrorMessage('')
        setIsExtracting(true)
        uploadMutation.mutate(selectedFile)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFile])


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

    const handleStep0Continue = () => {
        if (!quotation || !vendors) return
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

    const handleExportExcel = async () => {
        try {
            setExporting(true)
            const response = await apiClient.post(
                '/quotations/export-new-items/',
                {
                    items: lineItems.map((item: any) => ({
                        item_code: item.item_code ?? item.code ?? '',
                        item_name: item.item_name ?? '',
                        item_price: item.item_price ?? 0,
                        quantity: item.quantity ?? 1,
                        unit_of_measure: item.unit_of_measure ?? item.uom ?? '',
                        hsn_code: item.hsn_code ?? '',
                        suggestions: item.suggestions ?? [],
                        is_new: item.is_new ?? item.createNew ?? false,
                        is_duplicate: item.is_duplicate ?? false,
                    })),
                    format: 'excel',
                },
                { responseType: 'blob' },
            )
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `quotation-items.xlsx`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            setShowExportModal(false)
        } catch (e) {
            console.error(e)
        } finally {
            setExporting(false)
        }
    }

    const step0ContinueLabel = () => {
        // if (uploadMutation.isPending || isExtracting) return 'Extracting…'
        return 'Continue'
    }

    return (
        <>
            <style>{`
                *,*::before,*::after{box-sizing:border-box}
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
                .qf-root .stepper{display:flex;background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:20px}
                .qf-root .step-item{flex:1;padding:14px 16px;display:flex;align-items:center;gap:10px;border-right:0.5px solid var(--bd);background:transparent;border-top:none;border-left:none;border-bottom:none}
                .qf-root .step-item:last-child{border-right:none}
                .qf-root .step-item.done{background:var(--bg-s)}
                .qf-root .step-num{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
                .qf-root .sn-idle{background:var(--bg-t);color:var(--tx3)}
                .qf-root .sn-act{background:#1a1a18;color:#fff}
                .qf-root .sn-done{background:var(--grn-bg);color:var(--grn-tx)}
                .qf-root .step-lbl{font-size:13px;font-weight:600;color:var(--tx3)}
                .qf-root .step-item.active .step-lbl{color:var(--tx)}
                .qf-root .step-item.done .step-lbl{color:var(--tx2)}
                .qf-root .step-sub{font-size:12px;color:var(--tx3)}
                .qf-root .form-sec{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:16px}
                .qf-root .form-sec-head{padding:13px 18px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;gap:10px}
                .qf-root .fsh-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
                .qf-root .fsh-title{font-size:15px;font-weight:600}
                .qf-root .fsh-sub{font-size:12px;color:var(--tx3);margin-top:1px}
                .qf-root .form-body{padding:18px}
                .qf-root .drop-zone{border:1.5px dashed var(--bdm);border-radius:var(--rl);padding:28px 24px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:var(--bg-s)}
                .qf-root .drop-zone:hover,.qf-root .drop-zone.drag-over{border-color:var(--blu-bd);background:var(--blu-bg)}
                .qf-root .drop-zone.has-file{border-style:solid;border-color:var(--grn-bd);background:var(--grn-bg);cursor:default;padding:14px 16px}
                .qf-root .dz-icon{font-size:28px;color:var(--tx3);margin-bottom:6px;display:block}
                .qf-root .dz-title{font-size:15px;font-weight:500}
                .qf-root .dz-sub{font-size:13px;color:var(--tx3);margin-top:3px}
                .qf-root .parse-bar{height:5px;background:var(--bg-t);border-radius:2px;overflow:hidden;margin:10px 0 8px}
                .qf-root .parse-fill{height:100%;background:var(--blu-bd);border-radius:2px;animation:qf-progress 2.5s ease-in-out infinite alternate}
                .qf-root .parse-step{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--tx3);padding:3px 0}
                .qf-root .parse-step.active-ps{color:var(--tx);font-weight:500}
                .qf-root .parse-step i{animation:spin 1s linear infinite}
                .qf-root .fgrp{display:flex;flex-direction:column;gap:4px}
                .qf-root .lbl{font-size:13px;font-weight:600;color:var(--tx2)}
                .qf-root .req{color:var(--red-bd);margin-left:2px}
                .qf-root .inp{padding:9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;width:100%}
                .qf-root .inp:focus{border-color:#1a1a18}
                .qf-root .inp-extracted{padding:9px 12px;border-radius:var(--r);border:0.5px solid rgba(29,158,117,.4);background:var(--tel-bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tel-tx);outline:none;width:100%;font-weight:500}
                .qf-root .sel{padding:9px 32px 9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9a96'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;width:100%}
                .qf-root .sel:focus{border-color:#1a1a18}
                .qf-root .textarea{padding:9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;resize:vertical;min-height:70px;width:100%}
                .qf-root .textarea:focus{border-color:#1a1a18}
                .qf-root .extracted-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tel-tx);display:flex;align-items:center;gap:4px}
                .qf-root .card{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden}
                .qf-root .card-head{padding:13px 16px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
                .qf-root .card-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:7px;color:var(--tx)}
                .qf-root .card-title i{font-size:15px;color:var(--tx3)}
                .qf-root .card-body{padding:16px}
                .qf-root .ci{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:0.5px solid var(--bd);font-size:13px}
                .qf-root .ci:last-child{border-bottom:none}
                .qf-root .ci-ok{color:var(--grn-tx)}
                .qf-root .ci-idle{color:var(--tx3)}
                .qf-root .sticky-bar{background:var(--bg);border-top:0.5px solid var(--bdm);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;}
                .qf-root .err-strip{background:var(--red-bg);border:0.5px solid var(--red-bd);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:14px;color:var(--red-tx)}
                .qf-root .match-tbl{width:100%;border-collapse:collapse;font-size:14px}
                .qf-root .match-tbl thead th{padding:9px 12px;text-align:left;font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;background:var(--bg-s);border-bottom:0.5px solid var(--bd);white-space:nowrap}
                .qf-root .match-tbl tbody tr{border-bottom:0.5px solid var(--bd);cursor:default;transition:background .1s}
                .qf-root .match-tbl tbody tr:last-child{border-bottom:none}
                .qf-root .match-tbl tbody tr:hover{background:#fafaf8}
                .qf-root .match-tbl td{padding:11px 12px;vertical-align:top}
                .qf-root .cell-inp{border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;width:100%}
                .qf-root .cell-inp:focus{background:var(--blu-bg);border-radius:4px;padding:2px 4px}
                .qf-root .cell-num{border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;width:60px;text-align:right}
                .qf-root .cell-num:focus{background:var(--blu-bg);border-radius:4px;padding:2px 4px}
                .qf-root td.match-tfoot{padding:10px 12px;font-size:13px;background:var(--bg-s);border-top:0.5px solid var(--bdm)}
                .qf-root .match-progress{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--tx2);background:var(--bg);border:0.5px solid var(--bd);padding:8px 14px;border-radius:var(--r);margin-bottom:12px}
                .qf-root .mp-bar{flex:1;height:5px;background:var(--bg-t);border-radius:3px;overflow:hidden}
                .qf-root .mp-fill{height:100%;border-radius:3px;background:#1a1a18;transition:width .3s}
                .qf-root .tag{font-size:12px;font-weight:600;padding:2px 8px;border-radius:20px;display:inline-block;white-space:nowrap}
                .qf-root .t-new{background:var(--grn-bg);color:var(--grn-tx)}
                .qf-root .t-match{background:var(--blu-bg);color:var(--blu-tx)}
                .qf-root .t-replace{background:var(--amb-bg);color:var(--amb-tx)}
                .qf-root .t-skip{background:var(--gry-bg);color:var(--gry-tx)}
                .qf-root .review-hero{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);padding:20px}
                .qf-root .rh-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:16px;padding-top:14px;border-top:0.5px solid var(--bd)}
                .qf-root .rhm-item{padding:0 14px;border-right:0.5px solid var(--bd)}
                .qf-root .rhm-item:first-child{padding-left:0}
                .qf-root .rhm-item:last-child{border-right:none}
                .qf-root .rhm-lbl{font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
                .qf-root .rhm-val{font-size:14px;font-weight:500}
                .qf-root .stat-mini{background:var(--bg-s);border-radius:var(--r);padding:12px 14px}
                .qf-root .sm-lbl{font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
                .qf-root .sm-val{font-size:24px;font-weight:600;letter-spacing:-.6px;line-height:1}
                .qf-root .pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:3px 9px;border-radius:20px}
                .qf-root .pill .dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
                .qf-root .p-draft{background:var(--gry-bg);color:var(--gry-tx)}
                .qf-root .p-draft .dot{background:var(--gry-bd)}
                .qf-root .ci-warn{color:var(--amb-tx)}
                @media(max-width:900px){
                    .qf-root .uf-grid{grid-template-columns:1fr!important}
                    .qf-root .g3{grid-template-columns:1fr 1fr!important}
                    .qf-root .g2{grid-template-columns:1fr 1fr!important}
                    .qf-root .g4v{grid-template-columns:1fr 1fr!important}
                    .qf-root .g3v{grid-template-columns:1fr 1fr!important}
                    .qf-root .uf-sidebar{flex-direction:row!important;flex-wrap:wrap}
                    .qf-root .uf-sidebar .card{flex:1;min-width:220px}
                    .qf-root .vi-grid{grid-template-columns:1fr!important}
                    .qf-root .rh-meta{grid-template-columns:1fr 1fr!important}
                    .qf-root .rhm-item:nth-child(2n){border-right:none}
                }
                @media(max-width:600px){
                    .qf-root .stepper{flex-direction:column}
                    .qf-root .step-item{border-right:none!important;border-bottom:0.5px solid var(--bd)}
                    .qf-root .step-item:last-child{border-bottom:none}
                    .qf-root .g3{grid-template-columns:1fr!important}
                    .qf-root .g2{grid-template-columns:1fr!important}
                    .qf-root .g4v{grid-template-columns:1fr 1fr!important}
                    .qf-root .g3v{grid-template-columns:1fr!important}
                    .qf-root .sticky-bar{flex-wrap:wrap;gap:8px}
                    .qf-root .sticky-bar>*{flex:1;min-width:120px}
                    .qf-root .uf-sidebar{flex-direction:column!important}
                    .qf-root .uf-sidebar .card{min-width:unset}
                    .qf-root .vi-sidebar{display:flex;flex-direction:row;flex-wrap:wrap;gap:12px}
                    .qf-root .vi-sidebar .card{flex:1;min-width:240px;margin-bottom:0!important}
                    .qf-root .rh-meta{grid-template-columns:1fr!important}
                    .qf-root .rhm-item{border-right:none;padding-left:0;border-bottom:0.5px solid var(--bd);padding-bottom:10px;margin-bottom:10px}
                    .qf-root .rhm-item:last-child{border-bottom:none;margin-bottom:0}
                    .qf-root .page-hd{flex-direction:column;align-items:flex-start!important;gap:10px}
                }
            `}</style>

            <div className="qf-root relative">
                {/* Page header */}
                <div className="page-hd" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>Add Quotation</div>
                        <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 2 }}>Upload document · Extract &amp; match items · Submit for approval</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/quotation')}>
                            <i className="ti ti-arrow-left" /> Back
                        </Button>
                    </div>
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
                        validUntil={validUntil}
                        setValidUntil={setValidUntil}
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
                        onExport={lineItems.length > 0 ? () => setShowExportModal(true) : undefined}
                        onValidationChange={(isValid) => setVerifyStepValid(isValid)}
                    />
                )}

                {/* ── Action bar ── */}
                <div className="sticky-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {currentStep > 0 ? (
                            <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => s - 1)}>
                                Back
                            </Button>
                        ) : (
                            <div />
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 8px' }}>
                        <span style={{ fontSize: 12, color: 'var(--tx3)', marginRight: 4 }}>
                            Step {currentStep + 1} of 2
                        </span>

                        {currentStep === 0 && (
                            <Button size="sm" onClick={handleStep0Continue} disabled={!quotation || !vendors || !plantId || !departmentId || !categoryId || uploadMutation.isPending || isExtracting} className="gap-1.5">

                                {step0ContinueLabel()}
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </Button>
                        )}

                        {currentStep === 1 && (
                            <Button
                                size="sm"
                                onClick={() => setShowConfirm(true)}
                                disabled={isSaving || !verifyStepValid}
                                className="gap-1.5"
                            >
                                {isSaving && <Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} />}
                                Submit
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <CommonConfirmModal
                isOpen={showExportModal}
                title="Export Line Items"
                description={
                    <>
                        Export <strong>{lineItems.length}</strong> line item{lineItems.length !== 1 ? 's' : ''} from this quotation as an Excel sheet?
                    </>
                }
                confirmLabel="Export Excel"
                onClose={() => setShowExportModal(false)}
                onConfirm={handleExportExcel}
                isPending={exporting}
            />

            {/* ── Confirm modal — outside qf-root so Tailwind styles are not overridden ── */}
            <CommonConfirmModal
                isOpen={showConfirm}
                title="Submit Quotation"
                description={
                    <>
                        Submit quotation from <strong>{vendors?.company_name || 'the vendor'}</strong> with{' '}
                        <strong>{lineItems.length}</strong> line item{lineItems.length !== 1 ? 's' : ''}?
                    </>
                }
                confirmLabel="Submit"
                onClose={() => setShowConfirm(false)}
                onConfirm={() => quotationSaveMutation.mutate()}
                isPending={quotationSaveMutation.isPending}
            />
        </>
    )
}