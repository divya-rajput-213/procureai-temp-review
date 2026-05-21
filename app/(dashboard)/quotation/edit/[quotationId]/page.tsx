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

const STEPS = [
    { id: 0, label: 'Document & Details', sub: 'Vendor, plant & category' },
    { id: 1, label: 'Items & Matching', sub: 'Review & edit line items' },
    { id: 2, label: 'Review & Submit', sub: 'Confirm & update quotation' },
]

const AVATAR_COLORS = [
    { bg: 'var(--pur-bg)', tx: 'var(--pur-tx)' },
    { bg: 'var(--tel-bg)', tx: 'var(--tel-tx)' },
    { bg: 'var(--grn-bg)', tx: 'var(--grn-tx)' },
    { bg: 'var(--blu-bg)', tx: 'var(--blu-tx)' },
    { bg: 'var(--amb-bg)', tx: 'var(--amb-tx)' },
]
function vendorInitials(name: string) {
    return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase() || 'V'
}
function avatarColor(name: string) {
    return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}
function statusPill(status?: string) {
    if (!status) return { label: 'Unknown', bg: 'var(--gry-bg)', tx: 'var(--gry-tx)', dot: 'var(--gry-bd)' }
    const s = status.toLowerCase()
    if (s === 'approved') return { label: 'Approved', bg: 'var(--grn-bg)', tx: 'var(--grn-tx)', dot: 'var(--grn-bd)' }
    if (s.includes('pending')) return { label: 'Pending', bg: 'var(--amb-bg)', tx: 'var(--amb-tx)', dot: 'var(--amb-bd)' }
    if (s === 'rejected') return { label: 'Rejected', bg: 'var(--red-bg)', tx: 'var(--red-tx)', dot: 'var(--red-bd)' }
    return { label: status, bg: 'var(--gry-bg)', tx: 'var(--gry-tx)', dot: 'var(--gry-bd)' }
}

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
    const [showVendorSearch, setShowVendorSearch] = useState(false)
    const [vendorQuery, setVendorQuery] = useState('')

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
    const { data: categories = [] } = useQuery({
        queryKey: ['item-categories-active'],
        queryFn: async () => { const r = await apiClient.get('/procurement/categories/?active_only=true'); return r.data.results ?? r.data },
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

    const filteredVendors = useMemo(() => {
        if (!vendorQuery.trim()) return allApprovedVendors
        const q = vendorQuery.toLowerCase()
        return allApprovedVendors.filter((v: any) =>
            v.company_name?.toLowerCase().includes(q) ||
            v.city?.toLowerCase().includes(q) ||
            v.gst_number?.toLowerCase().includes(q)
        )
    }, [allApprovedVendors, vendorQuery])

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
                },
                quotation_no: quotationData?.quotation_no ?? null,
                quotation_date: quotationData?.quotation_date ?? null,
                terms_and_conditions: quotationData?.terms_and_conditions ?? null,
                plant_id: plantId ? Number(plantId) : null,
                department_id: departmentId ? Number(departmentId) : null,
                category: categoryId ? Number(categoryId) : null,
                items: lineItems.map((item: any) => ({
                    item_code: item.item_code ?? item.code ?? null,
                    item_name: item.item_name,
                    item_price: item.item_price,
                    quantity: item.quantity || 1,
                    unit_of_measure: item.unit_of_measure ?? item.uom,
                    hsn_code: item.hsn_code ?? null,
                    create_new_item: item.createNew ?? false,
                    is_new: item.is_new ?? false,
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
    const av = vendors ? avatarColor(vendors.company_name || '') : { bg: 'var(--pur-bg)', tx: 'var(--pur-tx)' }
    const sp = statusPill(vendors?.status)

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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
                        <div>
                            {/* Existing document (read-only) */}
                            <div className="form-sec">
                                <div className="form-sec-head">
                                    <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}>
                                        <i className="ti ti-file-type-pdf" />
                                    </div>
                                    <div>
                                        <div className="fsh-title">Quotation Document</div>
                                        <div className="fsh-sub">Original uploaded PDF — cannot be changed here</div>
                                    </div>
                                    {quotationData?.pdf_url && (
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => window.open(quotationData.pdf_url, '_blank')}
                                                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', color: 'var(--tx)' }}
                                            >
                                                <i className="ti ti-eye" style={{ fontSize: 12 }} /> Preview
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="form-body" style={{ padding: '14px 18px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-s)', borderRadius: 'var(--r)', border: '0.5px solid var(--bd)' }}>
                                        <i className="ti ti-file-text" style={{ fontSize: 20, color: 'var(--red-tx)', flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{quotationData?.ref_no || 'quotation.pdf'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                                                Uploaded {quotationData?.created_at ? new Date(quotationData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''} · {quotationData?.uploaded_by || ''}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}>
                                            <i className="ti ti-lock" style={{ fontSize: 10, marginRight: 3 }} />Read-only
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Quotation Details (read-only) + Vendor (editable) */}
                            <div className="form-sec">
                                <div className="form-sec-head">
                                    <div className="fsh-ic" style={{ background: 'var(--pur-bg)', color: 'var(--pur-tx)' }}>
                                        <i className="ti ti-file-invoice" />
                                    </div>
                                    <div>
                                        <div className="fsh-title">Quotation Details</div>
                                        <div className="fsh-sub">Quotation fields are read-only · vendor and routing can be changed</div>
                                    </div>
                                </div>
                                <div className="form-body">
                                    {/* Vendor section */}
                                    <div className="fgrp" style={{ marginBottom: 16 }}>
                                        <div className="extracted-lbl" style={{ marginBottom: 6 }}>
                                            <i className="ti ti-building-store" style={{ fontSize: 11 }} /> Vendor
                                        </div>
                                        {vendors && (
                                            <div style={{ border: '0.5px solid rgba(29,158,117,.4)', borderRadius: 'var(--r)', background: 'var(--bg)', overflow: 'hidden' }}>
                                                <div style={{ background: 'var(--tel-bg)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '0.5px solid rgba(29,158,117,.2)' }}>
                                                    <i className="ti ti-circle-check" style={{ fontSize: 14, color: 'var(--tel-tx)' }} />
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tel-tx)' }}>Vendor from quotation</span>
                                                    {vendors.vendor_code && (
                                                        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, color: 'var(--tel-tx)', opacity: 0.75 }}>{vendors.vendor_code}</span>
                                                    )}
                                                    <button
                                                        onClick={() => setShowVendorSearch(p => !p)}
                                                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: showVendorSearch ? 'var(--bg-t)' : 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', color: 'var(--tx)', marginLeft: vendors.vendor_code ? 8 : 'auto' }}
                                                    >
                                                        <i className="ti ti-refresh" style={{ fontSize: 11 }} /> Change
                                                    </button>
                                                </div>
                                                <div style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: av.bg, color: av.tx, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {vendorInitials(vendors.company_name || '')}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.3px' }}>{vendors.company_name || '—'}</span>
                                                            <span style={{ background: sp.bg, color: sp.tx, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sp.dot, flexShrink: 0 }} />{sp.label}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 10 }}>
                                                            <i className="ti ti-map-pin" style={{ fontSize: 11, marginRight: 2 }} />
                                                            {[vendors.city, vendors.state].filter(Boolean).join(', ') || '—'}
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                                                            {[
                                                                { label: 'GSTIN', value: vendors.gst_number || '—', mono: true },
                                                                { label: 'Contact', value: vendors.contact_name || vendors.contact_email || '—' },
                                                                { label: 'Phone', value: vendors.contact_phone || '—' },
                                                            ].map(({ label, value, mono }) => (
                                                                <div key={label} style={{ background: 'var(--bg-s)', borderRadius: 6, padding: '8px 10px' }}>
                                                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{label}</div>
                                                                    <div style={{ fontSize: mono ? 11 : 12, fontFamily: mono ? 'monospace' : 'inherit', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Vendor search dropdown */}
                                        {showVendorSearch && (
                                            <div style={{ marginTop: 8, border: '0.5px solid var(--bdm)', borderRadius: 'var(--r)', background: 'var(--bg)', overflow: 'hidden' }}>
                                                <div style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--bd)' }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', fontSize: 14, pointerEvents: 'none' }} />
                                                        <input autoFocus type="text" value={vendorQuery} onChange={e => setVendorQuery(e.target.value)}
                                                            placeholder="Search by name, GSTIN, city…" className="inp" style={{ paddingLeft: 32 }} />
                                                    </div>
                                                </div>
                                                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                                    {vendorsFetching && <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--tx3)' }}>Loading…</div>}
                                                    {!vendorsFetching && filteredVendors.length === 0 && (
                                                        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--tx3)' }}>No vendors found</div>
                                                    )}
                                                    {!vendorsFetching && filteredVendors.map((v: any) => {
                                                        const vav = avatarColor(v.company_name || '')
                                                        const vsp = statusPill(v.status)
                                                        return (
                                                            <button key={v.id}
                                                                onClick={() => { setVendors(v); setShowVendorSearch(false); setVendorQuery('') }}
                                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bd)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: vav.bg, color: vav.tx, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    {vendorInitials(v.company_name || '')}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.company_name}</div>
                                                                    <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{[v.city, v.state].filter(Boolean).join(', ')}{v.vendor_code ? ` · ${v.vendor_code}` : ''}</div>
                                                                </div>
                                                                <span style={{ background: vsp.bg, color: vsp.tx, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{vsp.label}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quotation fields (read-only) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                                        {[
                                            { label: 'Quotation Number', value: quotationData?.quotation_no || '' },
                                            { label: 'Quote Date', value: quotationData?.quotation_date || '' },
                                            { label: 'Valid Until', value: quotationData?.valid_until || '' },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="fgrp">
                                                <div className="extracted-lbl">
                                                    <i className="ti ti-lock" style={{ fontSize: 10 }} /> {label}
                                                    <span style={{ fontSize: 9, background: 'var(--gry-bg)', color: 'var(--gry-tx)', padding: '1px 5px', borderRadius: 20, fontWeight: 600, marginLeft: 4 }}>Read-only</span>
                                                </div>
                                                <input readOnly className="inp-extracted" placeholder="—" value={value} onChange={() => {}} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Plant, Department, Category */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                                        <div className="fgrp">
                                            <label className="lbl">Plant / Location <span className="req">*</span></label>
                                            <select className="sel" value={plantId} onChange={e => setPlantId(e.target.value)}>
                                                <option value="">Select plant</option>
                                                {plants.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="fgrp">
                                            <label className="lbl">Department <span className="req">*</span></label>
                                            <select className="sel" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                                                <option value="">Select department</option>
                                                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="fgrp">
                                            <label className="lbl">Category</label>
                                            <select className="sel" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                                <option value="">Select category</option>
                                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* PR Link */}
                                    <div className="fgrp" style={{ marginBottom: 16 }}>
                                        <label className="lbl">Link to Purchase Request</label>
                                        <select className="sel" value={prLinkId} onChange={e => setPrLinkId(e.target.value)}>
                                            <option value="">— Not specified —</option>
                                            {PRs.map((p: any) => <option key={p.id} value={p.id}>{p.pr_number || p.id}</option>)}
                                        </select>
                                    </div>

                                    {/* Internal Notes */}
                                    <div className="fgrp">
                                        <label className="lbl">Internal Notes</label>
                                        <textarea className="textarea" value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                                            placeholder="Negotiation points, context for approvers…" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="card">
                                <div className="card-head">
                                    <div className="card-title"><i className="ti ti-checklist" /> Checklist</div>
                                </div>
                                {[
                                    { ok: true, label: 'Document already uploaded' },
                                    { ok: !!vendors, label: 'Vendor selected' },
                                    { ok: !!plantId, label: 'Plant selected' },
                                    { ok: !!departmentId, label: 'Department selected' },
                                ].map(({ ok, label }) => (
                                    <div key={label} className={`ci ${ok ? 'ci-ok' : 'ci-idle'}`}>
                                        <i className={`ti ${ok ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize: 14 }} />
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="card">
                                <div className="card-head">
                                    <div className="card-title"><i className="ti ti-info-circle" /> What you can edit</div>
                                </div>
                                <div className="card-body" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.9 }}>
                                    {[
                                        { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Vendor (change to another)' },
                                        { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Plant / location' },
                                        { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Department & category' },
                                        { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'PR link' },
                                        { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Line items & quantities' },
                                        { icon: 'ti-lock', c: 'var(--gry-tx)', t: 'Quotation no. / date (read-only)' },
                                    ].map(({ icon, c, t }) => (
                                        <div key={t}><i className={`ti ${icon}`} style={{ color: c, marginRight: 4 }} />{t}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
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
                {currentStep === 2 && (
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
                )}

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
                            <Button size="sm" onClick={goNext} disabled={lineItems.length === 0} className="gap-1.5">
                                Review &amp; Submit
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </Button>
                        )}

                        {currentStep === 2 && (
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