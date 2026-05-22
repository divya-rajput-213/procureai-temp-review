'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, Loader2, X, Check, ChevronRight } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { CommonConfirmModal } from '@/components/shared/CommonModal'
import VerifyItemsStep from '../../components/VerifyItemsStep'
import ReviewSubmitStep from '../../components/ReviewSubmitStep'
import UploadFile from '../../components/UploadFile'

const STEPS = [
    { id: 0, label: 'Document & Details', sub: 'Vendor, plant & category' },
    { id: 1, label: 'Items & Matching', sub: 'Review & edit line items' },
    // { id: 2, label: 'Review & Submit', sub: 'Confirm & update quotation' },
]

export default function EditQuotationPage({ params }: Readonly<{ params: { quotationId: string } }>) {
    const { toast } = useToast()
    const router = useRouter()

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
    const [initialized, setInitialized] = useState(false)
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
        queryFn: async () => { const { data } = await apiClient.get('/procurement/?status=approved'); return data.results || data },
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
        setVendors(quotationData.vendor ?? null)
        setLineItems((quotationData.items || []).map((item: any) => ({
            ...item,
            createNew: !item.master_item_matched,
            selectedMasterId: item.master_item_matched && item.master_item_id ? String(item.master_item_id) : '',
        })))
        setPlantId(quotationData.plant ? String(quotationData.plant) : '')
        setDepartmentId(quotationData.department ? String(quotationData.department) : '')
        setCategoryId(quotationData.category ? String(quotationData.category) : '')
        setPrLinkId(quotationData.pr_no ? String(quotationData.pr_no) : '')
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
                    is_new: vendors?.is_new ?? false,
                },
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                category_id: categoryId ? Number(categoryId) : null,
                pr_id: prLinkId ? Number(prLinkId) : null,
                internal_notes: internalNotes || null,
                items: lineItems.map((item: any) => ({
                    item_code: item.item_code ?? item.code ?? null,
                    item_name: item.item_name,
                    item_price: item.item_price,
                    quantity: item.quantity || 1,
                    unit_of_measure: item.unit_of_measure ?? item.uom,
                    hsn_code: item.hsn_code ?? null,
                    create_new_item: item.createNew ?? false,
                    is_new: item.is_new ?? false,
                    is_duplicate: item.is_duplicate ?? false,
                    suggestions: item.createNew || !item.selectedMasterId
                        ? []
                        : [{ master_item_id: Number(item.selectedMasterId) }],
                })),
            }
            const { data } = await apiClient.patch(`/quotations/${params.quotationId}/`, payload)
            return data
        },
        onSuccess: () => {
            toast({ title: 'Saved', description: 'Quotation updated successfully' })
            setShowConfirm(false)
            router.push(`/quotation/detail/${params.quotationId}`)
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
                .qf-root .step-num{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
                .qf-root .sn-idle{background:var(--bg-t);color:var(--tx3)}
                .qf-root .sn-act{background:#1a1a18;color:#fff}
                .qf-root .sn-done{background:var(--grn-bg);color:var(--grn-tx)}
                .qf-root .step-lbl{font-size:12px;font-weight:600;color:var(--tx3)}
                .qf-root .step-item.active .step-lbl{color:var(--tx)}
                .qf-root .step-item.done .step-lbl{color:var(--tx2)}
                .qf-root .step-sub{font-size:11px;color:var(--tx3)}
                .qf-root .form-sec{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:16px}
                .qf-root .form-sec-head{padding:13px 18px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;gap:10px}
                .qf-root .fsh-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
                .qf-root .fsh-title{font-size:13px;font-weight:600}
                .qf-root .fsh-sub{font-size:11px;color:var(--tx3);margin-top:1px}
                .qf-root .form-body{padding:18px}
                .qf-root .fgrp{display:flex;flex-direction:column;gap:4px}
                .qf-root .lbl{font-size:12px;font-weight:600;color:var(--tx2)}
                .qf-root .req{color:var(--red-bd);margin-left:2px}
                .qf-root .inp{padding:8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;width:100%}
                .qf-root .inp:focus{border-color:#1a1a18}
                .qf-root .inp-extracted{padding:8px 12px;border-radius:var(--r);border:0.5px solid rgba(29,158,117,.4);background:var(--tel-bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tel-tx);outline:none;width:100%;font-weight:500}
                .qf-root .sel{padding:8px 32px 8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9a96'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;width:100%}
                .qf-root .sel:focus{border-color:#1a1a18}
                .qf-root .textarea{padding:8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;resize:vertical;min-height:70px;width:100%}
                .qf-root .extracted-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tel-tx);display:flex;align-items:center;gap:4px}
                .qf-root .card{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden}
                .qf-root .card-head{padding:13px 16px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
                .qf-root .card-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;color:var(--tx)}
                .qf-root .card-title i{font-size:14px;color:var(--tx3)}
                .qf-root .card-body{padding:16px}
                .qf-root .ci{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:0.5px solid var(--bd);font-size:12px}
                .qf-root .ci:last-child{border-bottom:none}
                .qf-root .ci-ok{color:var(--grn-tx)}
                .qf-root .ci-idle{color:var(--tx3)}
                .qf-root .sticky-bar{background:var(--bg);border-top:0.5px solid var(--bdm);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;bottom:0;z-index:100;margin-top:16px;}
                .qf-root .err-strip{background:var(--red-bg);border:0.5px solid var(--red-bd);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;color:var(--red-tx)}
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
                        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>Edit Quotation</div>
                        <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 2 }}>
                            {quotationData?.ref_no || ''}{vendors?.company_name ? ` · ${vendors.company_name}` : ''}
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/quotation/detail/${params.quotationId}`)}>
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
                    />
                )}

                {/* ── STEP 2: Review & Submit ── */}
                {/* {currentStep === 2 && (
                    <ReviewSubmitStep
                        quotation={quotationData}
                        lineItems={lineItems}
                        vendors={vendors}
                        plants={plants}
                        plantId={plantId}
                        PRs={PRs}
                        prLinkId={prLinkId}
                        setPrLinkId={setPrLinkId}
                        internalNotes={internalNotes}
                        setInternalNotes={setInternalNotes}
                        showTerms={false}
                    />
                )} */}

                {/* ── Action bar ── */}
                <div className="sticky-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                             <Button size="sm" onClick={() => setShowConfirm(true)} disabled={isSaving} className="gap-1.5">
                             {isSaving && <Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} />}
                             Save Changes
                         </Button>
                        )}

                    </div>
                </div>
            </div>

            {/* ── Confirm modal — outside qf-root so Tailwind styles are not overridden ── */}
            <CommonConfirmModal
                isOpen={showConfirm}
                title="Confirm Action"
                description={
                    <>
                        You are about to update this quotation from{' '}
                        <strong>{vendors?.company_name || 'the vendor'}</strong> with{' '}
                        <strong>{lineItems.length}</strong> line item{lineItems.length !== 1 ? 's' : ''}.
                    </>
                }
                confirmLabel="Yes, Submit"
                onClose={() => setShowConfirm(false)}
                onConfirm={() => quotationSaveMutation.mutate()}
                isPending={quotationSaveMutation.isPending}
            />
        </>
    )
}