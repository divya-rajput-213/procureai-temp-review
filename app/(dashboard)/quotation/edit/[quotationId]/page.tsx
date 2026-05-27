'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, Loader2, X, Check, ChevronRight } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { CommonConfirmModal } from '@/components/shared/CommonModal'
import VerifyItemsStep from '../../components/VerifyItemsStep'
import UploadFile from '../../components/UploadFile'

const STEPS = [
    { id: 0, label: 'Document & Details', sub: 'Vendor, plant & category' },
    { id: 1, label: 'Items & Matching', sub: 'Review & edit line items' },
]

export default function EditQuotationPage({ params }: Readonly<{ params: { quotationId: string } }>) {
    const { toast } = useToast()
    const router = useRouter()
    const queryClient = useQueryClient()

    const [currentStep, setCurrentStep] = useState(0)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
    const [lineItems, setLineItems] = useState<any[]>([])
    const [vendors, setVendors] = useState<any>(null)
    const [plantId, setPlantId] = useState<string>('')
    const [departmentId, setDepartmentId] = useState<string>('')
    const [categoryId, setCategoryId] = useState<string>('')
    const [internalNotes, setInternalNotes] = useState<string>('')
    const [prLinkId, setPrLinkId] = useState<string>('')
    const [errorMessage, setErrorMessage] = useState('')
    const [showConfirm, setShowConfirm] = useState(false)
    const [showExportModal, setShowExportModal] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [initialized, setInitialized] = useState(false)
    const [verifyStepValid, setVerifyStepValid] = useState(true)
    const [validUntil, setValidUntil] = useState<string>('')
    const [financialYear, setFinancialYear] = useState<string>('')

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
        return String(message || '').trim() || fallback
    }

    const { data: quotationData, isLoading: loadingQuotation, isError: loadError } = useQuery({
        queryKey: ['quotation-edit', params.quotationId],
        queryFn: async () => { const { data } = await apiClient.get(`/quotations/${params.quotationId}/`); return data },
    })
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
        queryFn: async () => { const { data } = await apiClient.get('/procurement/?status=draft'); return data.results || data },
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

    useEffect(() => {
        if (!quotationData || initialized) return
        const vendorObj = quotationData.vendor ?? null
        setVendors(vendorObj ? { ...vendorObj, id: vendorObj.id ?? quotationData.vendor_id } : null)
        setLineItems((quotationData.items || []).map((item: any) => ({
            ...item,
            createNew: !item.master_item_matched,
            selectedMasterId: item.master_item_matched && item.master_item_id ? String(item.master_item_id) : '',
        })))
        setPlantId(quotationData.plant_id ? String(quotationData.plant_id) : (quotationData.plant ? String(quotationData.plant) : ''))
        setDepartmentId(quotationData.department_id ? String(quotationData.department_id) : (quotationData.department ? String(quotationData.department) : ''))
        setCategoryId(quotationData.category_id ? String(quotationData.category_id) : (quotationData.category ? String(quotationData.category) : ''))
        setPrLinkId(quotationData.pr_id ? String(quotationData.pr_id) : (quotationData.pr ? String(quotationData.pr) : ''))
        setInternalNotes(quotationData.internal_notes || '')
        const vu = quotationData.vendor?.valid_until ?? quotationData.valid_until ?? ''
        if (vu) setValidUntil(vu)
        setInitialized(true)
    }, [quotationData, initialized])

    const quotationForDisplay = useMemo(() => {
        if (!quotationData) return null
        return {
            ...quotationData,
            vendor: {
                ...(quotationData.vendor || {}),
                quotation_no: quotationData.vendor?.quotation_no ?? quotationData.quotation_no,
                quotation_date: quotationData.vendor?.quotation_date ?? quotationData.quotation_date,
                valid_until: quotationData.vendor?.valid_until ?? quotationData.valid_until,
            },
        }
    }, [quotationData])

    const quotationSaveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                vendor_id: vendors?.id ? Number(vendors.id) : null,
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                category_id: categoryId ? Number(categoryId) : null,
                pr_id: prLinkId ? Number(prLinkId) : null,
                internal_notes: internalNotes || null,
                valid_until: validUntil || null,
            }
            const { data } = await apiClient.patch(`/quotations/${params.quotationId}/`, payload)
            return data
        },
        onSuccess: () => {
            toast({ title: 'Saved', description: 'Quotation updated successfully' })
            setShowConfirm(false)
            queryClient.invalidateQueries({ queryKey: ['quotations'] })
            router.push('/quotation')
        },
        onError: (error: any) => {
            const message = getApiErrorMessage(error, 'Failed to update quotation.')
            setErrorMessage(message)
            setShowConfirm(false)
            toast({ title: 'Error', description: message, variant: 'destructive' })
        },
    })

    const goNext = () => {
        setCompletedSteps(prev => { const u = new Set(prev); u.add(currentStep); return u })
        setCurrentStep(s => s + 1)
    }

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
            link.setAttribute('download', `quotation-items-${params.quotationId}.xlsx`)
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

    const isSaving = quotationSaveMutation.isPending

    if (loadingQuotation) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: '#9a9a96', fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                <Loader2 className="inline w-5 h-5 animate-spin mr-2" />Loading quotation…
            </div>
        )
    }
    if (loadError || !quotationData) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: '#A32D2D', fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                Failed to load quotation.{' '}
                <button onClick={() => router.push('/quotation')} style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}>Go back</button>
            </div>
        )
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
                .qf-root .fsh-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
                .qf-root .fsh-title{font-size:15px;font-weight:600}
                .qf-root .fsh-sub{font-size:12px;color:var(--tx3);margin-top:1px}
                .qf-root .form-body{padding:18px}
                .qf-root .fgrp{display:flex;flex-direction:column;gap:4px}
                .qf-root .lbl{font-size:13px;font-weight:600;color:var(--tx2)}
                .qf-root .req{color:var(--red-bd);margin-left:2px}
                .qf-root .inp{padding:9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;width:100%}
                .qf-root .inp:focus{border-color:#1a1a18}
                .qf-root .inp-extracted{padding:9px 12px;border-radius:var(--r);border:0.5px solid rgba(29,158,117,.4);background:var(--tel-bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tel-tx);outline:none;width:100%;font-weight:500}
                .qf-root .sel{padding:9px 32px 9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9a96'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;width:100%}
                .qf-root .sel:focus{border-color:#1a1a18}
                .qf-root .textarea{padding:9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;resize:vertical;min-height:70px;width:100%}
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
                .qf-root{display:flex;flex-direction:column;min-height:calc(100vh - 90px)}
                .qf-root .sticky-bar{background:var(--bg);border-top:0.5px solid var(--bdm);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;margin-top:auto;}
                .qf-root .err-strip{background:var(--red-bg);border:0.5px solid var(--red-bd);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:14px;color:var(--red-tx)}
                .qf-root .match-tbl{width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed;min-width:860px}
                .qf-root .match-tbl thead th{padding:9px 12px;text-align:left;font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;background:var(--bg-s);border-bottom:0.5px solid var(--bd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .qf-root .match-tbl tbody tr{border-bottom:0.5px solid var(--bd);cursor:default;transition:background .1s}
                .qf-root .match-tbl tbody tr:last-child{border-bottom:none}
                .qf-root .match-tbl tbody tr:hover{background:#fafaf8}
                .qf-root .match-tbl td{padding:10px 12px;vertical-align:middle;white-space:nowrap;overflow:hidden}
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
                    .qf-root .page-hd{flex-direction:column;align-items:flex-start!important;gap:10px}
                }
            `}</style>

            <div className="qf-root">
                {/* Page header */}
                <div className="page-hd" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>Edit Quotation</div>
                        <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 2 }}>
                            {quotationData?.ref_no || ''}{vendors?.company_name ? ` · ${vendors.company_name}` : ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/quotation/detail/${params.quotationId}`)}>
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

                {/* ── STEP 0: Document & Details ── */}
                {currentStep === 0 && (
                    <UploadFile
                        selectedFile={null}
                        setSelectedFile={() => {}}
                        handleRemoveTagState={() => {}}
                        dragging={false}
                        handleDragOver={() => {}}
                        handleDragLeave={() => {}}
                        handleDrop={() => {}}
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
                        formatSize={() => ''}
                        quotation={quotationForDisplay}
                        vendors={vendors}
                        isExtracting={false}
                        allVendors={allApprovedVendors}
                        vendorsFetching={vendorsFetching}
                        onSelectVendor={(v: any) => setVendors(v)}
                        disableUpload
                        pdfUrl={quotationData?.pdf_url}
                        pdfName={quotationData?.ref_no}
                        validUntil={validUntil}
                        setValidUntil={setValidUntil}
                    />
                )}

                {/* ── STEP 1: Items & Matching ── */}
                {currentStep === 1 && (
                    <VerifyItemsStep
                        file={null}
                        quotation={quotationData}
                        lineItems={lineItems}
                        setLineItems={setLineItems}
                        masterItems={masterItems}
                        onContinue={goNext}
                        onBack={() => setCurrentStep(0)}
                        hideMasterMatch
                        disableAddRow
                        onExport={lineItems.length > 0 ? () => setShowExportModal(true) : undefined}
                        onValidationChange={(isValid) => setVerifyStepValid(isValid)}
                    />
                )}


                {/* ── Action bar ── */}
                <div className="sticky-bar rounded-b-xl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {currentStep > 0 ? (
                            <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => s - 1)}>Back</Button>
                        ) : (
                            <div />
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 8px' }}>
                        <span style={{ fontSize: 12, color: 'var(--tx3)', marginRight: 4 }}>
                            Step {currentStep + 1} of {STEPS.length}
                        </span>

                        {currentStep === 0 && (
                            <Button size="sm" onClick={goNext} disabled={!vendors || !plantId} className="gap-1.5">
                                Next: Items &amp; Matching
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </Button>
                        )}

                        {currentStep === 1 && (
                            <Button size="sm" onClick={() => setShowConfirm(true)} disabled={isSaving || !verifyStepValid} className="gap-1.5">
                                {isSaving && <Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} />}
                                Save Changes
                            </Button>
                        )}

                    </div>
                </div>
            </div>

            {/* ── Export modal ── */}
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
                title="Save Quotation Changes"
                description={
                    <>
                        You&apos;re editing the quotation from <strong>{vendors?.company_name || 'the vendor'}</strong>.{' '}
                        <strong>{lineItems.length}</strong> line item{lineItems.length !== 1 ? 's' : ''} will be updated. This will overwrite the existing data.
                    </>
                }
                confirmLabel="Save Changes"
                onClose={() => setShowConfirm(false)}
                onConfirm={() => quotationSaveMutation.mutate()}
                isPending={quotationSaveMutation.isPending}
            />
        </>
    )
}