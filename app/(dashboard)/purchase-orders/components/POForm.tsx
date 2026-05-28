'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Circle,
  Send, Save, Search, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import { CommonConfirmModal } from '@/components/shared/CommonModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type LinkedQuotation = {
  id: number
  ref_no: string
  quotation_no?: string
  vendor_id: number
  vendor_name: string
  status: string
  is_selected: boolean
  items_count: number
  total_amount: number
  items: Array<{
    id: number
    item_name: string
    item_code: string
    hsn_code: string | null
    quantity: number
    unit_of_measure: string
    item_price: number
    line_total: number
  }>
}

type PrDetail = {
  id: number
  hash_id: string
  pr_number: string
  description?: string
  plant_name: string
  department_name: string
  purchase_type: string
  tracking_code?: string
  tracking_id?: number
  linked_quotations: LinkedQuotation[]
  budget_info: {
    tracking_code: string
    priority?: 'low' | 'medium' | 'high'
    approved_amount: string
    consumed_amount: string
    remaining_amount: string
  } | null
}

type PrSummary = {
  id: number
  hash_id: string
  pr_number: string
  plant_name: string
  status: string
  total_amount: number
}

type ManualLineItem = {
  key: string
  masterItemId: number
  code: string
  description: string
  hsn_code: string
  unit_of_measure: string
  unit_rate: number
  quantity: number
}

type QuotationSummary = {
  id: number
  ref_no: string
  vendor_name?: string
  grand_total?: number | null
  status: string
}

const GST_RATE = 18

// ─── Edit schema ──────────────────────────────────────────────────────────────

const editSchema = z.object({
  po_type: z.string().min(1, 'PO type is required'),
  vendor: z.number({ required_error: 'Vendor is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  tracking_id: z.number().optional().nullable(),
  currency_code: z.string().default('INR'),
  payment_terms: z.string().optional(),
  incoterms: z.string().optional(),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
  freight_amount: z.number().optional(),
  discount_amount: z.number().optional(),
  advance_schedule: z.record(z.number()).optional(),
  exchange_rate: z.number().optional().nullable(),
  customs_duty_rate: z.number().optional().nullable(),
  freight_insurance: z.number().optional().nullable(),
})
type EditFormData = z.infer<typeof editSchema>

const PO_TYPES = [
  { value: 'NB', label: 'Standard PO' },
  { value: 'FO', label: 'Blanket / Framework Order' },
  { value: 'RO', label: 'Release Order' },
  { value: 'SV', label: 'Service PO' },
  { value: 'ZT', label: 'Tooling / Capex PO' },
  { value: 'IM', label: 'Import PO' },
  { value: 'SC', label: 'Subcontract PO' },
]

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  .po-root{font-family:'DM Sans',sans-serif;font-size:14px;display:flex;flex-direction:column;min-height:calc(100vh - 90px)}
  .po-root *{box-sizing:border-box}
  .po-root{
    --bg:#fff;--bg-s:#f8f8f6;--bg-t:#f0efea;
    --tx:#1a1a18;--tx2:#3d3d3a;--tx3:#9a9a96;
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
  .po-root .stepper{display:flex;background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:20px}
  .po-root .step-item{flex:1;padding:14px 16px;display:flex;align-items:center;gap:10px;border-right:0.5px solid var(--bd);background:transparent;border-top:none;border-left:none;border-bottom:none;cursor:pointer;transition:background 0.15s;user-select:none;text-align:left}
  .po-root .step-item:hover{background:var(--bg-t)}
  .po-root .step-item:last-child{border-right:none}
  .po-root .step-item.done{background:var(--bg-s)}
  .po-root .step-item.active{background:var(--bg)}
  .po-root .step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:var(--bg-t);color:var(--tx3)}
  .po-root .sn-act{background:#1a1a18;color:#fff}
  .po-root .sn-done{background:var(--grn-bg);color:var(--grn-tx)}
  .po-root .step-lbl{font-size:12px;font-weight:500;color:var(--tx3)}
  .po-root .step-item.active .step-lbl{color:var(--tx);font-weight:600}
  .po-root .step-item.done .step-lbl{color:var(--tx2)}
  .po-root .step-sub{font-size:11px;color:var(--tx3);margin-top:1px}
  .po-root .form-sec{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:16px}
  .po-root .form-sec-head{padding:14px 20px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;gap:10px}
  .po-root .fsh-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .po-root .fsh-title{font-size:14px;font-weight:600;color:var(--tx)}
  .po-root .fsh-sub{font-size:12px;color:var(--tx3);margin-top:1px}
  .po-root .form-body{padding:20px;display:flex;flex-direction:column;gap:14px}
  .po-root .lbl{font-size:13px;font-weight:600;color:var(--tx2);display:block;margin-bottom:4px}
  .po-root .req{color:var(--red-bd);margin-left:2px}
  .po-root .inp{padding:9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;width:100%}
  .po-root .inp:focus{border-color:hsl(var(--primary))}
  .po-root .inp.err{border-color:var(--red-bd)!important}
  .po-root .sel{padding:9px 32px 9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9a96'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;width:100%}
  .po-root .sel:focus{border-color:hsl(var(--primary))}
  .po-root .sel.err{border-color:var(--red-bd)!important}
  .po-root .textarea{padding:9px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--tx);outline:none;resize:vertical;min-height:80px;width:100%}
  .po-root .textarea:focus{border-color:hsl(var(--primary))}
  .po-root .card{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:12px}
  .po-root .card-head{padding:12px 16px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;gap:7px}
  .po-root .card-title{font-size:13px;font-weight:600;color:var(--tx);display:flex;align-items:center;gap:6px}
  .po-root .card-body{padding:14px}
  .po-root .ci{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:0.5px solid var(--bd);font-size:13px}
  .po-root .ci:last-child{border-bottom:none}
  .po-root .sticky-bar{background:var(--bg);border-top:0.5px solid var(--bdm);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:8px}
  .po-root .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .po-root .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .po-root .fgrp{display:flex;flex-direction:column;gap:4px}
  .po-root .err{font-size:12px;color:var(--red-tx);margin-top:3px}
  .po-root .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
  .po-root .info-cell{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--r);padding:10px 12px}
  .po-root .info-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:3px}
  .po-root .info-val{font-size:13px;font-weight:500;color:var(--tx)}
  .po-root .alert-err{display:flex;align-items:center;gap:8px;background:var(--red-bg);border:0.5px solid var(--red-bd);border-radius:var(--r);padding:10px 14px;font-size:13px;color:var(--red-tx);margin-top:10px}
  .po-root .alert-warn{display:flex;align-items:center;gap:8px;background:var(--amb-bg);border:0.5px solid var(--amb-bd);border-radius:var(--r);padding:10px 14px;font-size:13px;color:var(--amb-tx);margin-top:10px}
  .po-root .po-tbl{width:100%;border-collapse:collapse;font-size:13px}
  .po-root .po-tbl thead th{padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;background:var(--bg-s);border-bottom:0.5px solid var(--bd);white-space:nowrap}
  .po-root .po-tbl tbody tr{border-bottom:0.5px solid var(--bd)}
  .po-root .po-tbl tbody tr:last-child{border-bottom:none}
  .po-root .po-tbl td{padding:9px 12px;vertical-align:middle}
  .po-root .po-tbl tfoot td{padding:8px 12px;background:var(--bg-s);border-top:0.5px solid var(--bdm);font-size:13px}
  .po-root .chain-step{display:flex;gap:10px;align-items:flex-start;padding:5px 0}
  .po-root .chain-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
  .po-root .chain-line{width:1px;height:10px;background:var(--bd);margin-left:11px}
  .po-root .vendor-chip{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border:0.5px solid var(--bdm);border-radius:var(--r);background:var(--bg-s)}
  .po-root .stat-box{background:var(--bg-s);border:0.5px solid var(--bd);border-radius:8px;padding:10px 13px;margin-bottom:8px}
  .po-root .stat-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:3px}
  .po-root .stat-val{font-size:20px;font-weight:700}
  .po-root .btn-ghost{display:inline-flex;align-items:center;gap:6px;border:0.5px solid var(--bdm);background:var(--bg);border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;color:var(--tx2)}
  .po-root .btn-ghost:disabled{opacity:.4;cursor:default}
  .po-root .btn-primary{display:inline-flex;align-items:center;gap:6px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s}
  .po-root .btn-primary:hover:not(:disabled){background:hsl(var(--primary)/0.9)}
  .po-root .btn-primary:disabled{background:var(--bg-t);color:var(--tx3);cursor:default}
  @media(max-width:900px){
    .po-root .po-layout{grid-template-columns:1fr!important}
    .po-root .g2{grid-template-columns:1fr!important}
    .po-root .g3{grid-template-columns:1fr 1fr!important}
    .po-root .info-grid{grid-template-columns:1fr 1fr!important}
    .po-root .stepper{flex-direction:column}
    .po-root .step-item{border-right:none!important;border-bottom:0.5px solid var(--bd)}
    .po-root .step-item:last-child{border-bottom:none}
  }
  @media(max-width:600px){
    .po-root .g3{grid-template-columns:1fr!important}
    .po-root .sticky-bar{flex-wrap:wrap}
    .po-root .info-grid{grid-template-columns:1fr!important}
  }
`

// ─── Steps config ─────────────────────────────────────────────────────────────

const CREATE_STEPS = [
  { n: 1, label: 'Select Source',  sub: 'PR, Quotation or Vendor' },
  { n: 2, label: 'PO Details',     sub: 'Dates, terms and items' },
  { n: 3, label: 'Review & Issue', sub: 'Confirm and issue the PO' },
]

const EDIT_STEPS = [
  { n: 1, label: 'Basic Info',     sub: 'PO type, currency and vendor' },
  { n: 2, label: 'Details',        sub: 'Location, terms and budget' },
  { n: 3, label: 'Review & Save',  sub: 'Line items, notes and finalize' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface POFormProps {
  mode: 'create' | 'edit'
  poId?: string
  initialPrId?: number | null
}

export default function POForm({ mode, poId, initialPrId = null }: POFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  // ── Step state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [editStep, setEditStep] = useState(1)

  // ── Create method ────────────────────────────────────────────────────────
  const [createMethod, setCreateMethod] = useState<'pr' | 'quotation' | 'vendor' | null>(
    initialPrId ? 'pr' : null,
  )

  // ── Create mode state ─────────────────────────────────────────────────────
  const [selectedPrId, setSelectedPrId] = useState<number | null>(initialPrId)
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null)
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [paymentTermsCreate, setPaymentTermsCreate] = useState('Net 30 Days')
  const [billingAddress, setBillingAddress] = useState('')
  const [terms, setTerms] = useState(
    '1. All items per agreed specifications.\n'
    + '2. Vendor to provide packing list and delivery challan.\n'
    + '3. Invoice only after delivery confirmation.\n'
    + '4. Rejected goods returned at vendor cost.',
  )

  // ── Quotation flow state ──────────────────────────────────────────────────
  const [qtSearch, setQtSearch] = useState('')
  const [directQtId, setDirectQtId] = useState<number | null>(null)

  // ── Vendor manual flow state ──────────────────────────────────────────────
  const [manualVendorSearch, setManualVendorSearch] = useState('')
  const [manualVendorId, setManualVendorId] = useState<number | null>(null)
  const [manualVendorName, setManualVendorName] = useState('')
  const [manualItems, setManualItems] = useState<ManualLineItem[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [pendingItem, setPendingItem] = useState<{ id: number; code: string; description: string; hsn_code: string; unit_of_measure: string; unit_rate: number } | null>(null)
  const [pendingQty, setPendingQty] = useState('1')

  // ── Edit mode state ───────────────────────────────────────────────────────
  const [vendorSearch, setVendorSearch] = useState('')
  const [formReady, setFormReady] = useState(false)
  const [advSchedule, setAdvSchedule] = useState({ po: 30, approval: 60, delivery: 10 })

  // ── React Hook Form ───────────────────────────────────────────────────────
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  })

  // ── Edit queries ──────────────────────────────────────────────────────────
  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: async () => { const { data } = await apiClient.get(`/purchase-orders/${poId}/`); return data },
    enabled: mode === 'edit' && !!poId,
  })
  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
    enabled: mode === 'edit',
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
    enabled: mode === 'edit',
  })
  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved'],
    queryFn: async () => { const r = await apiClient.get('/budget/tracking-ids/?status=approved'); return r.data.results ?? r.data },
    enabled: mode === 'edit',
  })

  const selectedVendorId = watch('vendor')
  const selectedPoType = watch('po_type')
  const selectedTrackingId = watch('tracking_id')
  const selectedPlant = watch('plant')
  const selectedDepartment = watch('department')

  const normalizedVendorSearch = vendorSearch.trim()
  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved', normalizedVendorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (normalizedVendorSearch) params.set('search', normalizedVendorSearch)
      const r = await apiClient.get(`/vendors/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: mode === 'edit' && normalizedVendorSearch.length >= 2,
  })

  useEffect(() => {
    if (mode !== 'edit' || !po || formReady) return
    reset({
      po_type: po.po_type || '', vendor: po.vendor, plant: po.plant,
      department: po.department, tracking_id: po.tracking_id || null,
      currency_code: po.currency_code || 'INR', payment_terms: po.payment_terms || '',
      incoterms: po.incoterms || '', delivery_address: po.delivery_address || '',
      notes: po.notes || '', freight_amount: po.freight_amount ? Number(po.freight_amount) : 0,
      discount_amount: po.discount_amount ? Number(po.discount_amount) : 0,
      advance_schedule: po.advance_schedule || {},
      exchange_rate: po.exchange_rate ? Number(po.exchange_rate) : null,
      customs_duty_rate: po.customs_duty_rate ? Number(po.customs_duty_rate) : null,
      freight_insurance: po.freight_insurance ? Number(po.freight_insurance) : null,
    })
    setFormReady(true)
  }, [po, formReady, reset, mode])

  useEffect(() => {
    if (mode !== 'edit' || !po?.advance_schedule) return
    if (Object.keys(po.advance_schedule).length) {
      setAdvSchedule({ po: po.advance_schedule.po || 0, approval: po.advance_schedule.approval || 0, delivery: po.advance_schedule.delivery || 0 })
    }
  }, [po, mode])

  // Edit computed
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))
  const combinedTaxRate = activeTaxes.reduce((s, t) => s + t.rate, 0)
  const editLineItems: any[] = po?.line_items || []
  const editSubtotal = editLineItems.reduce((s: number, li: any) => s + (Number(li.quantity) || 0) * (Number(li.unit_rate) || 0), 0)
  const editTotalTax = editLineItems.reduce((s: number, li: any) => s + (Number(li.tax_amount) || 0), 0)
  const editGrandTotal = Number(po?.total_amount || 0)
  const selectedTracking = (trackingIds || []).find((t: any) => t.id === selectedTrackingId)
  const budgetRemainingEdit = selectedTracking ? (Number(selectedTracking.approved_amount || 0) - Number(selectedTracking.consumed_amount || 0)) : null
  const budgetExceededEdit = budgetRemainingEdit !== null && editGrandTotal > budgetRemainingEdit
  const vendorDisplayName = po?.vendor_name || ''
  const selectedVendorFromSearch = (vendors || []).find((v: any) => v.id === selectedVendorId)

  // ── Create queries ────────────────────────────────────────────────────────
  const { data: eligiblePrs } = useQuery<PrSummary[]>({
    queryKey: ['prs-eligible-for-po'],
    queryFn: async () => {
      const r = await apiClient.get('/procurement/?status=approved')
      return r.data.results ?? r.data
    },
    enabled: mode === 'create',
  })

  const { data: prDetail } = useQuery<PrDetail | null>({
    queryKey: ['pr-detail', selectedPrId],
    queryFn: async () => {
      if (!selectedPrId) return null
      const pr = (eligiblePrs || []).find((p) => p.id === selectedPrId)
      if (!pr) return null
      const { data } = await apiClient.get(`/procurement/${pr.hash_id ?? pr.id}/`)
      return data
    },
    enabled: mode === 'create' && !!selectedPrId && !!eligiblePrs,
  })

  useEffect(() => {
    if (mode !== 'create' || !prDetail) { if (mode === 'create') setSelectedQuotationId(null); return }
    const quotes = prDetail.linked_quotations || []
    const selected = quotes.find(q => q.is_selected) || quotes.find(q => q.status !== 'po_raised' && q.status !== 'rejected')
    setSelectedQuotationId(selected?.id ?? null)
  }, [prDetail, mode])

  const selectedQuotation = mode === 'create'
    ? (prDetail?.linked_quotations || []).find(q => q.id === selectedQuotationId)
    : undefined

  const { data: vendorCreate } = useQuery({
    queryKey: ['vendor', selectedQuotation?.vendor_id],
    queryFn: async () => { const { data } = await apiClient.get(`/vendors/${selectedQuotation!.vendor_id}/`); return data },
    enabled: mode === 'create' && !!selectedQuotation?.vendor_id,
  })

  useEffect(() => {
    if (mode !== 'create' || !vendorCreate) return
    if (vendorCreate.payment_terms) {
      const labels: Record<string, string> = { net15: 'Net 15 Days', net30: 'Net 30 Days', net45: 'Net 45 Days', net60: 'Net 60 Days', advance: 'Advance Payment' }
      setPaymentTermsCreate(labels[vendorCreate.payment_terms] || vendorCreate.payment_terms || 'Net 30 Days')
    }
    const parts = [vendorCreate.company_name, vendorCreate.address, [vendorCreate.city, vendorCreate.state, vendorCreate.pincode].filter(Boolean).join(', '), vendorCreate.country].filter(Boolean)
    if (parts.length) setBillingAddress(parts.join('\n'))
  }, [vendorCreate, mode])

  useEffect(() => {
    if (mode !== 'create') return
    const p = prDetail?.budget_info?.priority
    if (p === 'low' || p === 'medium' || p === 'high') setPriority(p)
  }, [prDetail, mode])

  // Quotation flow: submitted quotations list
  const normalizedQtSearch = qtSearch.trim()
  const { data: submittedQuotations } = useQuery<QuotationSummary[]>({
    queryKey: ['quotations-submitted', normalizedQtSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'submitted' })
      if (normalizedQtSearch) params.set('search', normalizedQtSearch)
      const r = await apiClient.get(`/quotations/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: mode === 'create' && createMethod === 'quotation',
  })

  // Quotation flow: full detail when one is selected
  const { data: directQtDetail } = useQuery({
    queryKey: ['quotation-detail-direct', directQtId],
    queryFn: async () => { const { data } = await apiClient.get(`/quotations/${directQtId}/`); return data },
    enabled: mode === 'create' && createMethod === 'quotation' && !!directQtId,
  })

  // Vendor manual flow: approved vendor search
  const normalizedManualVendorSearch = manualVendorSearch.trim()
  const { data: manualVendors } = useQuery({
    queryKey: ['vendors-approved-manual', normalizedManualVendorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (normalizedManualVendorSearch) params.set('search', normalizedManualVendorSearch)
      const r = await apiClient.get(`/vendors/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: mode === 'create' && createMethod === 'vendor' && normalizedManualVendorSearch.length >= 2,
  })

  // Vendor manual flow: master item search
  const normalizedItemSearch = itemSearch.trim()
  const { data: masterItems } = useQuery({
    queryKey: ['master-items-search', normalizedItemSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (normalizedItemSearch) params.set('search', normalizedItemSearch)
      const r = await apiClient.get(`/procurement/items/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: mode === 'create' && createMethod === 'vendor' && addingItem,
  })

  // Auto-fill from quotation detail (vendor address + payment terms)
  useEffect(() => {
    if (mode !== 'create' || !directQtDetail || createMethod !== 'quotation') return
    if (directQtDetail.payment_terms) setPaymentTermsCreate(directQtDetail.payment_terms)
    const v = directQtDetail.vendor
    if (v) {
      const parts = [v.company_name, v.address, [v.city, v.state, v.pincode].filter(Boolean).join(', '), v.country].filter(Boolean)
      if (parts.length) setBillingAddress(parts.join('\n'))
    }
  }, [directQtDetail, createMethod, mode])

  // Create computed — PR flow
  const eligibleQuotes = (prDetail?.linked_quotations || []).filter(q => q.status !== 'po_raised' && q.status !== 'rejected')
  const budgetInfo = prDetail?.budget_info
  const remainingBudget = budgetInfo ? Number(budgetInfo.remaining_amount) : null
  const subTotal = selectedQuotation ? Number(selectedQuotation.total_amount || 0) : 0
  const gstAmount = useMemo(() => subTotal * (GST_RATE / 100), [subTotal])
  const grandTotal = subTotal + gstAmount
  const budgetWillExceed = remainingBudget !== null && grandTotal > remainingBudget
  const budgetAfterPO = remainingBudget !== null && selectedQuotation ? remainingBudget - grandTotal : null

  // Create computed — Quotation flow
  const qtItems = useMemo(() => (directQtDetail?.items || []).map((it: any, i: number) => ({
    id: it.id ?? i,
    item_name: it.item_name ?? '—',
    item_code: it.item_code ?? '',
    hsn_code: it.hsn_code ?? it.hsn_sac ?? '—',
    quantity: Number(it.quantity) || 0,
    unit_of_measure: it.unit_of_measure ?? it.unit ?? '—',
    item_price: Number(it.item_price ?? it.price_per_unit ?? it.unit_price) || 0,
    line_total: Number(it.total_price ?? it.amount ?? it.line_total) || (Number(it.quantity) || 0) * (Number(it.item_price ?? it.price_per_unit ?? it.unit_price) || 0),
  })), [directQtDetail])
  const qtSubtotal = qtItems.reduce((s: number, it: any) => s + it.line_total, 0)
  const qtGrandTotal = Number(directQtDetail?.grand_total) || qtSubtotal
  const qtVendorName: string = directQtDetail?.vendor?.company_name ?? directQtDetail?.vendor_name ?? ''

  // Create computed — Vendor manual flow
  const manualSubtotal = manualItems.reduce((s, it) => s + it.unit_rate * it.quantity, 0)
  const manualGstAmount = manualSubtotal * (GST_RATE / 100)
  const manualGrandTotal = manualSubtotal + manualGstAmount

  // Unified helpers for step 3
  const createVendorName = createMethod === 'pr' ? (selectedQuotation?.vendor_name ?? '') : createMethod === 'quotation' ? qtVendorName : manualVendorName
  const step3GrandTotal = createMethod === 'pr' ? grandTotal : createMethod === 'quotation' ? qtGrandTotal : manualGrandTotal
  const canIssue = createMethod === 'pr' ? !!selectedPrId : createMethod === 'quotation' ? !!directQtId : (!!manualVendorId && manualItems.length > 0)

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const common = { payment_terms: paymentTermsCreate, delivery_address: billingAddress, notes: terms }
      if (createMethod === 'pr') {
        if (!selectedPrId) throw new Error('No PR selected')
        const body: Record<string, any> = { pr_id: selectedPrId, ...common }
        if (selectedQuotationId) body.quotation_id = selectedQuotationId
        const { data } = await apiClient.post('/purchase-orders/create-from-pr/', body)
        return data
      }
      if (createMethod === 'quotation') {
        if (!directQtId) throw new Error('No quotation selected')
        const { data } = await apiClient.post('/purchase-orders/create-from-quotation/', { quotation_id: directQtId, ...common })
        return data
      }
      if (createMethod === 'vendor') {
        if (!manualVendorId) throw new Error('No vendor selected')
        const { data } = await apiClient.post('/purchase-orders/create-manual/', {
          vendor: manualVendorId,
          ...common,
          line_items: manualItems.map(it => ({
            item_id: it.masterItemId,
            quantity: it.quantity,
            unit_rate: it.unit_rate,
            unit_of_measure: it.unit_of_measure,
            hsn_code: it.hsn_code,
            description: it.description,
          })),
        })
        return data
      }
      throw new Error('No creation method selected')
    },
    onSuccess: (resp) => {
      toast({ title: `PO ${resp.po_number} created — review & issue` })
      router.push(`/purchase-orders/${resp.hash_id ?? resp.id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      toast({ title: typeof detail === 'string' ? detail : detail?.error || detail?.detail || 'Failed to create PO', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const { data: resp } = await apiClient.patch(`/purchase-orders/${poId}/`, data)
      return resp
    },
    onSuccess: () => { toast({ title: 'Purchase order updated' }); router.push(`/purchase-orders/${poId}`) },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string' ? detail : detail?.detail || detail?.error || detail?.non_field_errors?.[0] || Object.values(detail || {}).flat().join(', ') || 'Failed to update'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  // ── Step validation ───────────────────────────────────────────────────────
  const [step1Error, setStep1Error] = useState('')
  const [step2Errors, setStep2Errors] = useState<{ poDate?: string; deliveryDate?: string }>({})
  const [showIssueConfirm, setShowIssueConfirm] = useState(false)
  const [editStepErrors, setEditStepErrors] = useState<Record<string, string>>({})

  const handleNextStep = () => {
    if (step === 1) {
      if (!createMethod) { setStep1Error('Please choose a creation method.'); return }
      if (createMethod === 'pr' && !selectedPrId) { setStep1Error('Please select a purchase request.'); return }
      if (createMethod === 'quotation' && !directQtId) { setStep1Error('Please select a quotation.'); return }
      if (createMethod === 'vendor' && !manualVendorId) { setStep1Error('Please select a vendor.'); return }
      setStep1Error('')
      setStep(s => s + 1)
    } else if (step === 2) {
      const errs: { poDate?: string; deliveryDate?: string; items?: string } = {}
      if (!poDate) errs.poDate = 'PO date is required.'
      if (!deliveryDate) errs.deliveryDate = 'Delivery date is required.'
      if (createMethod === 'vendor' && manualItems.length === 0) errs.items = 'Add at least one line item.'
      if (Object.keys(errs).length) { setStep2Errors(errs); return }
      setStep2Errors({})
      setStep(s => s + 1)
    } else {
      setStep(s => s + 1)
    }
  }

  const handleEditNextStep = () => {
    if (editStep === 1) {
      const errs: Record<string, string> = {}
      if (!selectedPoType) errs.po_type = 'PO Type is required.'
      if (!selectedVendorId) errs.vendor = 'Vendor is required.'
      if (Object.keys(errs).length) { setEditStepErrors(errs); return }
      setEditStepErrors({})
      setEditStep(s => s + 1)
    } else if (editStep === 2) {
      const errs: Record<string, string> = {}
      if (!selectedPlant) errs.plant = 'Plant is required.'
      if (!selectedDepartment) errs.department = 'Department is required.'
      if (Object.keys(errs).length) { setEditStepErrors(errs); return }
      setEditStepErrors({})
      setEditStep(s => s + 1)
    }
  }

  // ── Edit guards ───────────────────────────────────────────────────────────
  if (mode === 'edit') {
    if (poLoading) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: "'DM Sans',sans-serif" }}>
        <Loader2 style={{ width: 22, height: 22, color: '#9a9a96' }} className="animate-spin" />
      </div>
    )
    if (!po) return <div style={{ textAlign: 'center', padding: '48px 0', color: '#9a9a96', fontFamily: "'DM Sans',sans-serif" }}>Purchase order not found.</div>
    if (po.status !== 'draft' && po.status !== 'pending_approval') return (
      <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: "'DM Sans',sans-serif" }}>
        <p style={{ color: '#9a9a96', marginBottom: 12 }}>Only draft or pending-approval POs can be edited.</p>
        <button onClick={() => router.push(`/purchase-orders/${poId}`)} style={{ border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Back to PO</button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="po-root">
      <style>{CSS}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px', color: 'var(--tx)' }}>
            {mode === 'create' ? 'Create Purchase Order' : `Edit ${po?.po_number || 'Purchase Order'}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 2 }}>
            {mode === 'create' ? 'Choose a source — PR, Quotation or Vendor — then fill details' : po?.vendor_name || ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mode === 'edit' && po?.status && (
            <span style={{ background: 'var(--gry-bg)', color: 'var(--gry-tx)', border: '0.5px solid var(--gry-bd)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
              {po.status.replace(/_/g, ' ')}
            </span>
          )}
          <button type="button" onClick={() => router.back()} className="btn-ghost">
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back
          </button>
        </div>
      </div>

      {/* ── Stepper ── */}
      <div className="stepper">
        {(mode === 'create' ? CREATE_STEPS : EDIT_STEPS).map(s => {
          const cur = mode === 'create' ? step : editStep
          const setCur = mode === 'create' ? setStep : setEditStep
          return (
            <button
              key={s.n}
              type="button"
              className={`step-item${cur === s.n ? ' active' : ''}${cur > s.n ? ' done' : ''}`}
              onClick={() => cur > s.n && setCur(s.n)}
              style={{ cursor: cur > s.n ? 'pointer' : 'default' }}
            >
              <div className={`step-num ${cur === s.n ? 'sn-act' : cur > s.n ? 'sn-done' : ''}`}>
                {cur > s.n ? <i className="ti ti-check" style={{ fontSize: 11 }} /> : s.n}
              </div>
              <div>
                <div className="step-lbl">{s.label}</div>
                <div className="step-sub">{s.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── 2-col layout ── */}
      <div className="po-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, flex: 1 }}>

        {/* ── Main ── */}
        <div style={{ minWidth: 0 }}>

          {/* ════════ CREATE STEP 1 — Select Source ════════ */}
          {mode === 'create' && step === 1 && (
            <>
              {/* Method picker */}
              <div className="form-sec">
                <div className="form-sec-head">
                  <div className="fsh-ic" style={{ background: 'var(--pur-bg)', color: 'var(--pur-tx)' }}><i className="ti ti-route" /></div>
                  <div>
                    <div className="fsh-title">How would you like to create this PO?</div>
                    <div className="fsh-sub">Select one method — only one can be used per order</div>
                  </div>
                </div>
                <div className="form-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {([
                      { m: 'pr' as const,        icon: 'ti-git-fork',        label: 'Purchase Request', desc: 'Link to an approved PR and auto-load vendor & items', clr: 'pur' },
                      { m: 'quotation' as const,  icon: 'ti-file-invoice',    label: 'Quotation',        desc: 'Create from a submitted quotation directly',          clr: 'blu' },
                      { m: 'vendor' as const,     icon: 'ti-building-store',  label: 'Vendor (Manual)',  desc: 'Choose a vendor and add items from the master catalog', clr: 'grn' },
                    ] as const).map(({ m, icon, label, desc, clr }) => (
                      <button key={m} type="button"
                        onClick={() => {
                          if (createMethod !== m) {
                            setCreateMethod(m)
                            setSelectedPrId(null)
                            setDirectQtId(null); setQtSearch('')
                            setManualVendorId(null); setManualVendorName(''); setManualVendorSearch('')
                            setManualItems([]); setAddingItem(false); setItemSearch('')
                            setPendingItem(null)
                            setStep1Error('')
                          }
                        }}
                        style={{
                          padding: 16, border: createMethod === m ? `1.5px solid var(--${clr}-bd)` : '0.5px solid var(--bd)',
                          borderRadius: 10, background: createMethod === m ? `var(--${clr}-bg)` : 'var(--bg)',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `var(--${clr}-bg)`, color: `var(--${clr}-tx)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10, border: createMethod === m ? `1px solid var(--${clr}-bd)` : 'none' }}>
                          <i className={`ti ${icon}`} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: createMethod === m ? `var(--${clr}-tx)` : 'var(--tx)', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 12, color: createMethod === m ? `var(--${clr}-tx)` : 'var(--tx3)', lineHeight: 1.4 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                  {step1Error && !createMethod && <div className="err" style={{ marginTop: 6 }}>{step1Error}</div>}
                </div>
              </div>

              {/* ── PR sub-form ── */}
              {createMethod === 'pr' && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--pur-bg)', color: 'var(--pur-tx)' }}><i className="ti ti-git-fork" /></div>
                    <div><div className="fsh-title">Select Purchase Request</div><div className="fsh-sub">Choose from approved PRs — vendor, quotation and budget load automatically</div></div>
                  </div>
                  <div className="form-body">
                    <div className="fgrp">
                      <label className="lbl">Purchase Request <span className="req">*</span></label>
                      <select className={`sel${step1Error && !selectedPrId ? ' err' : ''}`} value={selectedPrId ?? ''}
                        onChange={e => { setSelectedPrId(e.target.value ? Number(e.target.value) : null); setStep1Error('') }}>
                        <option value="">— Select an approved PR —</option>
                        {(eligiblePrs || []).map(pr => (
                          <option key={pr.id} value={pr.id}>{pr.pr_number} — {pr.plant_name ?? '—'} · {formatCurrency(pr.total_amount)}</option>
                        ))}
                      </select>
                      {step1Error && !selectedPrId && <div className="err">{step1Error}</div>}
                      {(eligiblePrs?.length ?? 0) === 0 && <p style={{ fontSize: 12, color: 'var(--tx3)' }}>No approved PRs available.</p>}
                    </div>
                    {prDetail && (
                      <div style={{ background: 'var(--pur-bg)', border: '0.5px solid rgba(127,119,221,.3)', borderRadius: 10, padding: 14 }}>
                        {prDetail.description && <p style={{ fontSize: 13, color: 'var(--pur-tx)', marginBottom: 10 }}>{prDetail.description}</p>}
                        <div className="info-grid">
                          <div className="info-cell"><div className="info-lbl">PR Code</div><Link href={`/procurement/${prDetail.hash_id ?? prDetail.id}`} style={{ color: 'var(--pur-tx)', fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>{prDetail.pr_number}</Link></div>
                          <div className="info-cell"><div className="info-lbl">Tracking ID</div>
                            {prDetail.tracking_id
                              ? <Link href={`/budget/${prDetail.tracking_id}`} style={{ color: 'var(--blu-tx)', fontFamily: 'monospace', textDecoration: 'none', fontSize: 13 }}>{prDetail.tracking_code || '—'}</Link>
                              : <div className="info-val" style={{ fontFamily: 'monospace' }}>{prDetail.tracking_code || '—'}</div>}
                          </div>
                          <div className="info-cell"><div className="info-lbl">Budget Remaining</div><div className="info-val" style={{ color: budgetWillExceed ? 'var(--red-tx)' : 'var(--tel-tx)', fontWeight: 700 }}>{budgetInfo ? formatCurrency(budgetInfo.remaining_amount) : '—'}</div></div>
                          <div className="info-cell"><div className="info-lbl">Vendor</div>{selectedQuotation ? <Link href={`/vendors/${selectedQuotation.vendor_id}`} style={{ color: 'var(--blu-tx)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{selectedQuotation.vendor_name}</Link> : <div style={{ fontSize: 13, color: 'var(--tx3)' }}>No quotation on PR</div>}</div>
                          <div className="info-cell"><div className="info-lbl">Quotation</div>{selectedQuotation ? <Link href={`/quotation/${selectedQuotation.id}`} style={{ color: 'var(--pur-tx)', fontFamily: 'monospace', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>{selectedQuotation.quotation_no || selectedQuotation.ref_no}</Link> : <div style={{ fontSize: 13, color: 'var(--tx3)' }}>—</div>}</div>
                          <div className="info-cell"><div className="info-lbl">QT Total</div><div className="info-val" style={{ color: 'var(--tel-tx)', fontWeight: 700 }}>{selectedQuotation ? formatCurrency(selectedQuotation.total_amount) : '—'}</div></div>
                        </div>
                        {!selectedQuotation && eligibleQuotes.length === 0 && <div className="alert-warn"><AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} /> No eligible quotation on this PR. PO from PR estimates.</div>}
                        {selectedQuotation && budgetWillExceed && <div className="alert-err"><AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} /> Quotation total exceeds budget by {formatCurrency(grandTotal - (remainingBudget ?? 0))}</div>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Quotation sub-form ── */}
              {createMethod === 'quotation' && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}><i className="ti ti-file-invoice" /></div>
                    <div><div className="fsh-title">Select Quotation</div><div className="fsh-sub">Search submitted quotations by Ref ID or vendor name</div></div>
                  </div>
                  <div className="form-body">
                    {directQtId ? (
                      <div className="vendor-chip">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{directQtDetail?.ref_no || `QT-${directQtId}`}</div>
                          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{qtVendorName}{directQtDetail?.grand_total ? ` · ${formatCurrency(directQtDetail.grand_total)}` : ''}</div>
                        </div>
                        <button type="button" onClick={() => { setDirectQtId(null); setQtSearch('') }} style={{ background: 'var(--bg)', border: '0.5px solid var(--bdm)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", color: 'var(--tx2)' }}>Change</button>
                      </div>
                    ) : (
                      <div className="fgrp">
                        <label className="lbl">Quotation <span className="req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--tx3)' }} />
                          <input className={`inp${step1Error && !directQtId ? ' err' : ''}`} style={{ paddingLeft: 32 }} placeholder="Search by Ref ID or vendor name…" value={qtSearch}
                            onChange={e => { setQtSearch(e.target.value); setStep1Error('') }} />
                        </div>
                        {step1Error && !directQtId && <div className="err">{step1Error}</div>}
                        {submittedQuotations && submittedQuotations.length > 0 && (
                          <div style={{ border: '0.5px solid var(--bdm)', borderRadius: 8, overflow: 'hidden', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                            {submittedQuotations.map((qt: QuotationSummary) => (
                              <button key={qt.id} type="button"
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bd)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
                                onClick={() => { setDirectQtId(qt.id); setQtSearch('') }}>
                                <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{qt.ref_no}</div>
                                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{qt.vendor_name ?? '—'}{qt.grand_total ? ` · ${formatCurrency(qt.grand_total)}` : ''}</div>
                              </button>
                            ))}
                          </div>
                        )}
                        {submittedQuotations && submittedQuotations.length === 0 && normalizedQtSearch.length >= 1 && (
                          <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>No submitted quotations found.</p>
                        )}
                      </div>
                    )}
                    {/* Quotation detail preview */}
                    {directQtId && directQtDetail && (
                      <div style={{ background: 'var(--blu-bg)', border: '0.5px solid rgba(24,95,165,.3)', borderRadius: 10, padding: 14 }}>
                        <div className="info-grid">
                          <div className="info-cell"><div className="info-lbl">Ref No</div><div className="info-val" style={{ fontFamily: 'monospace', color: 'var(--blu-tx)', fontWeight: 700 }}>{directQtDetail.ref_no}</div></div>
                          <div className="info-cell"><div className="info-lbl">Vendor</div><div className="info-val">{qtVendorName || '—'}</div></div>
                          <div className="info-cell"><div className="info-lbl">Grand Total</div><div className="info-val" style={{ color: 'var(--tel-tx)', fontWeight: 700 }}>{formatCurrency(qtGrandTotal)}</div></div>
                          <div className="info-cell"><div className="info-lbl">Items</div><div className="info-val">{qtItems.length} line items</div></div>
                          <div className="info-cell"><div className="info-lbl">Plant</div><div className="info-val">{directQtDetail.plant_name || '—'}</div></div>
                          <div className="info-cell"><div className="info-lbl">Dept</div><div className="info-val">{directQtDetail.department_name || '—'}</div></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Vendor (manual) sub-form ── */}
              {createMethod === 'vendor' && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}><i className="ti ti-building-store" /></div>
                    <div><div className="fsh-title">Select Vendor</div><div className="fsh-sub">Search approved vendors — you will add items in step 2</div></div>
                  </div>
                  <div className="form-body">
                    {manualVendorId ? (
                      <div className="vendor-chip">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{manualVendorName}</div>
                          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Approved vendor</div>
                        </div>
                        <button type="button" onClick={() => { setManualVendorId(null); setManualVendorName(''); setManualVendorSearch('') }} style={{ background: 'var(--bg)', border: '0.5px solid var(--bdm)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", color: 'var(--tx2)' }}>Change</button>
                      </div>
                    ) : (
                      <div className="fgrp">
                        <label className="lbl">Vendor <span className="req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--tx3)' }} />
                          <input className={`inp${step1Error && !manualVendorId ? ' err' : ''}`} style={{ paddingLeft: 32 }} placeholder="Type vendor name (min 2 chars)…" value={manualVendorSearch}
                            onChange={e => { setManualVendorSearch(e.target.value); setStep1Error('') }} />
                        </div>
                        {step1Error && !manualVendorId && <div className="err">{step1Error}</div>}
                        {manualVendors && manualVendors.length > 0 && (
                          <div style={{ border: '0.5px solid var(--bdm)', borderRadius: 8, overflow: 'hidden', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                            {manualVendors.map((v: any) => (
                              <button key={v.id} type="button"
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bd)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
                                onClick={() => { setManualVendorId(v.id); setManualVendorName(v.company_name); setManualVendorSearch(''); setStep1Error('') }}>
                                <div style={{ fontWeight: 600 }}>{v.company_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{v.vendor_code} · {v.city}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════ CREATE STEP 2 — PO Details ════════ */}
          {mode === 'create' && step === 2 && (
            <>
              {/* Vendor flow: item management */}
              {createMethod === 'vendor' && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}><i className="ti ti-package" /></div>
                    <div>
                      <div className="fsh-title">Line Items <span style={{ fontWeight: 400, color: 'var(--tx3)' }}>({manualItems.length})</span></div>
                      <div className="fsh-sub">Select from master catalog only — fields auto-populate on selection</div>
                    </div>
                  </div>
                  <div className="form-body">
                    {/* Existing items table */}
                    {manualItems.length > 0 && (
                      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                        <table className="po-tbl">
                          <thead>
                            <tr>
                              <th style={{ width: 36 }}>#</th>
                              <th>Item</th>
                              <th>HSN</th>
                              <th style={{ textAlign: 'right', width: 70 }}>Qty</th>
                              <th style={{ width: 60 }}>UOM</th>
                              <th style={{ textAlign: 'right', width: 110 }}>Unit Rate</th>
                              <th style={{ textAlign: 'right', width: 110 }}>Total</th>
                              <th style={{ width: 36 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {manualItems.map((it, i) => (
                              <tr key={it.key}>
                                <td style={{ fontFamily: 'monospace', color: 'var(--tx3)', fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</td>
                                <td>
                                  <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{it.code}</div>
                                  <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 1 }}>{it.description}</div>
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--tx3)' }}>{it.hsn_code || '—'}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <input type="number" min="1" value={it.quantity}
                                    onChange={e => setManualItems(prev => prev.map(x => x.key === it.key ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))}
                                    style={{ width: 60, padding: '4px 6px', border: '0.5px solid var(--bdm)', borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 13, textAlign: 'right' }} />
                                </td>
                                <td style={{ color: 'var(--tx3)' }}>{it.unit_of_measure}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(it.unit_rate)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(it.unit_rate * it.quantity)}</td>
                                <td>
                                  <button type="button" onClick={() => setManualItems(p => p.filter(x => x.key !== it.key))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-tx)', padding: '2px 4px', fontSize: 16, lineHeight: 1 }}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr><td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--tx2)' }}>Sub Total</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(manualSubtotal)}</td><td /></tr>
                            <tr><td colSpan={6} style={{ textAlign: 'right', color: 'var(--tx3)' }}>IGST @ {GST_RATE}%</td><td style={{ textAlign: 'right', color: 'var(--tx3)' }}>{formatCurrency(manualGstAmount)}</td><td /></tr>
                            <tr style={{ background: 'var(--bg-t)' }}>
                              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, borderTop: '0.5px solid var(--bdm)' }}>Grand Total</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)' }}>{formatCurrency(manualGrandTotal)}</td>
                              <td style={{ borderTop: '0.5px solid var(--bdm)' }} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {(step2Errors as any).items && <div className="err" style={{ marginBottom: 8 }}>{(step2Errors as any).items}</div>}

                    {/* Item search / add panel */}
                    {addingItem ? (
                      <div style={{ background: 'var(--bg-s)', border: '0.5px solid var(--bdm)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--tx2)' }}>Search master catalog</div>
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--tx3)' }} />
                          <input className="inp" style={{ paddingLeft: 32 }} placeholder="Search by code or description…"
                            value={itemSearch} onChange={e => { setItemSearch(e.target.value); setPendingItem(null) }} autoFocus />
                        </div>
                        {masterItems && masterItems.length > 0 && !pendingItem && (
                          <div style={{ border: '0.5px solid var(--bdm)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
                            {masterItems.map((item: any) => (
                              <button key={item.id} type="button"
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bd)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
                                onClick={() => setPendingItem({ id: item.id, code: item.code, description: item.description, hsn_code: item.hsn_code || '', unit_of_measure: item.unit_of_measure, unit_rate: Number(item.unit_rate) || 0 })}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--blu-tx)' }}>{item.code}</span>
                                    <span style={{ marginLeft: 8, color: 'var(--tx2)' }}>{item.description}</span>
                                  </div>
                                  <span style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap', marginLeft: 12 }}>{item.unit_of_measure} · {formatCurrency(item.unit_rate)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {masterItems && masterItems.length === 0 && normalizedItemSearch.length >= 1 && (
                          <p style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>No items found for "{normalizedItemSearch}".</p>
                        )}

                        {/* Quantity input for selected item */}
                        {pendingItem && (
                          <div style={{ background: 'var(--pur-bg)', border: '0.5px solid rgba(127,119,221,.3)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pur-tx)', marginBottom: 6 }}>
                              <span style={{ fontFamily: 'monospace' }}>{pendingItem.code}</span> — {pendingItem.description}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 10 }}>
                              HSN: {pendingItem.hsn_code || '—'} · UOM: {pendingItem.unit_of_measure} · Rate: {formatCurrency(pendingItem.unit_rate)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <label className="lbl" style={{ margin: 0, whiteSpace: 'nowrap' }}>Quantity</label>
                              <input type="number" min="1" value={pendingQty}
                                onChange={e => setPendingQty(e.target.value)}
                                style={{ width: 80, padding: '6px 10px', border: '0.5px solid var(--bdm)', borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }} />
                              <span style={{ fontSize: 13, color: 'var(--tx3)' }}>{pendingItem.unit_of_measure}</span>
                              <button type="button" className="btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}
                                onClick={() => {
                                  const qty = Math.max(1, Number(pendingQty) || 1)
                                  setManualItems(prev => [...prev, { key: Date.now().toString(), masterItemId: pendingItem.id, code: pendingItem.code, description: pendingItem.description, hsn_code: pendingItem.hsn_code, unit_of_measure: pendingItem.unit_of_measure, unit_rate: pendingItem.unit_rate, quantity: qty }])
                                  setPendingItem(null); setPendingQty('1'); setItemSearch(''); setAddingItem(false)
                                  setStep2Errors(p => ({ ...p, items: undefined } as any))
                                }}>
                                Add to PO
                              </button>
                              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx3)' }} onClick={() => setPendingItem(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                        <button type="button" className="btn-ghost" style={{ fontSize: 12 }}
                          onClick={() => { setAddingItem(false); setItemSearch(''); setPendingItem(null) }}>
                          Cancel search
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn-ghost" onClick={() => { setAddingItem(true); setPendingQty('1') }}>
                        <i className="ti ti-plus" style={{ fontSize: 14 }} /> Add Item from Catalog
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* PO dates / terms — common to all methods */}
              <div className="form-sec">
                <div className="form-sec-head">
                  <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}><i className="ti ti-file-text" /></div>
                  <div><div className="fsh-title">PO Details</div><div className="fsh-sub">Dates, priority, payment terms and delivery address</div></div>
                </div>
                <div className="form-body">
                  <div className="g3">
                    <div className="fgrp">
                      <label className="lbl">PO Date <span className="req">*</span></label>
                      <input type="date" className={`inp${step2Errors.poDate ? ' err' : ''}`} value={poDate}
                        onChange={e => { setPoDate(e.target.value); setStep2Errors(p => ({ ...p, poDate: undefined })) }} />
                      {step2Errors.poDate && <div className="err">{step2Errors.poDate}</div>}
                    </div>
                    <div className="fgrp">
                      <label className="lbl">Delivery Date <span className="req">*</span></label>
                      <input type="date" className={`inp${step2Errors.deliveryDate ? ' err' : ''}`} value={deliveryDate}
                        onChange={e => { setDeliveryDate(e.target.value); setStep2Errors(p => ({ ...p, deliveryDate: undefined })) }} />
                      {step2Errors.deliveryDate && <div className="err">{step2Errors.deliveryDate}</div>}
                    </div>
                    <div className="fgrp">
                      <label className="lbl">Priority</label>
                      <select className="sel" value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="fgrp">
                    <label className="lbl">Payment Terms</label>
                    <input className="inp" value={paymentTermsCreate} onChange={e => setPaymentTermsCreate(e.target.value)} />
                  </div>
                  <div className="fgrp">
                    <label className="lbl">Billing / Delivery Address</label>
                    <textarea className="textarea" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Vendor address auto-fills when quotation is loaded" />
                  </div>
                  <div className="fgrp">
                    <label className="lbl">Terms &amp; Conditions</label>
                    <textarea className="textarea" style={{ minHeight: 100 }} value={terms} onChange={e => setTerms(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════ CREATE STEP 3 — Review & Issue ════════ */}
          {mode === 'create' && step === 3 && (() => {
            // Normalise items for all 3 methods
            const items3 = createMethod === 'pr'
              ? (selectedQuotation?.items || []).map(it => ({ id: it.id, name: it.item_name, code: it.item_code, hsn: it.hsn_code || '—', qty: it.quantity, uom: it.unit_of_measure, price: it.item_price, total: it.line_total }))
              : createMethod === 'quotation'
              ? qtItems?.map((it:any) => ({ id: it?.id, name: it?.item_name, code: it?.item_code, hsn: it?.hsn_code, qty: it?.quantity, uom: it?.unit_of_measure, price: it?.item_price, total: it?.line_total }))
              : manualItems.map(it => ({ id: it.key, name: it?.code, code: it?.description, hsn: it?.hsn_code, qty: it?.quantity, uom: it?.unit_of_measure, price: it?.unit_rate, total: it?.unit_rate * it?.quantity }))
            const s3sub = createMethod === 'pr' ? subTotal : createMethod === 'quotation' ? qtSubtotal : manualSubtotal
            const s3gst = createMethod === 'pr' ? gstAmount : createMethod === 'quotation' ? (qtGrandTotal - qtSubtotal) : manualGstAmount
            const s3total = step3GrandTotal
            const s3label = createMethod === 'pr' ? `PR ${prDetail?.pr_number ?? ''}` : createMethod === 'quotation' ? (directQtDetail?.ref_no ?? '') : manualVendorName
            return (
              <>
                <div style={{ background: 'var(--grn-bg)', border: '0.5px solid rgba(99,153,34,.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 13, color: 'var(--grn-tx)' }}>
                  <i className="ti ti-sparkles" style={{ fontSize: 16, flexShrink: 0 }} />
                  <span><strong>Ready to issue.</strong> Review the line items below and click "Issue Purchase Order".</span>
                </div>
                {items3.length > 0 ? (
                  <div className="form-sec">
                    <div className="form-sec-head">
                      <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}><i className="ti ti-package" /></div>
                      <div><div className="fsh-title">Line Items</div><div className="fsh-sub">{s3label}{createVendorName && ` · ${createVendorName}`}</div></div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="po-tbl">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>Item</th>
                            <th>HSN</th>
                            <th style={{ textAlign: 'right' }}>Qty</th>
                            <th>UOM</th>
                            <th style={{ textAlign: 'right' }}>Unit Price</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items3?.map((it:any, i:any) => (
                            <tr key={it?.id}>
                              <td style={{ fontFamily: 'monospace', color: 'var(--tx3)', fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{it.name}</div>
                                {it.code && <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'monospace' }}>{it?.code}</div>}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--tx3)' }}>{it?.hsn}</td>
                              <td style={{ textAlign: 'right' }}>{it?.qty}</td>
                              <td style={{ color: 'var(--tx3)' }}>{it?.uom}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(it?.price)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(it?.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr><td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--tx2)' }}>Sub Total</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(s3sub)}</td></tr>
                          <tr><td colSpan={6} style={{ textAlign: 'right', color: 'var(--tx3)' }}>IGST @ {GST_RATE}%</td><td style={{ textAlign: 'right', color: 'var(--tx3)' }}>{formatCurrency(s3gst)}</td></tr>
                          <tr style={{ background: 'var(--bg-t)' }}>
                            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, borderTop: '0.5px solid var(--bdm)' }}>Grand Total</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)' }}>{formatCurrency(s3total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="form-sec">
                    <div className="form-body" style={{ textAlign: 'center', color: 'var(--tx3)', padding: 32 }}>
                      {createMethod === 'pr' ? 'No quotation linked — PO will be created from PR estimates.' : 'No line items.'}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {/* ════════ EDIT STEP 1 — Basic Info ════════ */}
          {mode === 'edit' && editStep === 1 && (
            <div className="form-sec">
              <div className="form-sec-head">
                <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}><i className="ti ti-file-text" /></div>
                <div><div className="fsh-title">Basic Information</div><div className="fsh-sub">PO type, currency and vendor</div></div>
              </div>
              <div className="form-body">
                <div className="g2">
                  <div className="fgrp">
                    <label className="lbl">PO Type <span className="req">*</span></label>
                    <select className={`sel${editStepErrors.po_type ? ' err' : ''}`} {...register('po_type')} onChange={e => { register('po_type').onChange(e); setEditStepErrors(p => ({ ...p, po_type: '' })) }}>
                      <option value="">Select PO type</option>
                      {PO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {editStepErrors.po_type && <div className="err">{editStepErrors.po_type}</div>}
                  </div>
                  <div className="fgrp">
                    <label className="lbl">Currency</label>
                    <select className="sel" {...register('currency_code')}>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div className="fgrp">
                  <label className="lbl">Vendor <span className="req">*</span></label>
                  {selectedVendorId && !vendorSearch ? (
                    <div className="vendor-chip">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedVendorFromSearch?.company_name || vendorDisplayName}</div>
                        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
                          {selectedVendorFromSearch ? `${selectedVendorFromSearch.vendor_code} · ${selectedVendorFromSearch.city}, ${selectedVendorFromSearch.state}` : ''}
                        </div>
                      </div>
                      <button type="button" onClick={() => setVendorSearch(' ')} style={{ background: 'var(--bg)', border: '0.5px solid var(--bdm)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", color: 'var(--tx2)' }}>Change</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--tx3)' }} />
                        <input className={`inp${editStepErrors.vendor ? ' err' : ''}`} style={{ paddingLeft: 32 }} placeholder="Type vendor name (min 2 chars)…" value={vendorSearch} onChange={e => { setVendorSearch(e.target.value); setEditStepErrors(p => ({ ...p, vendor: '' })) }} />
                      </div>
                      {editStepErrors.vendor && <div className="err">{editStepErrors.vendor}</div>}
                      {vendors && vendors.length > 0 && (
                        <div style={{ border: '0.5px solid var(--bdm)', borderRadius: 8, overflow: 'hidden', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                          {vendors.map((v: any) => (
                            <button key={v.id} type="button" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bd)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
                              onClick={() => { setValue('vendor', v.id, { shouldDirty: true }); setVendorSearch(''); setEditStepErrors(p => ({ ...p, vendor: '' })) }}>
                              <div style={{ fontWeight: 600 }}>{v.company_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{v.vendor_code} · {v.city}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {editStepErrors.vendor && !vendorSearch && <div className="err">{editStepErrors.vendor}</div>}
                </div>
              </div>
            </div>
          )}

          {/* ════════ EDIT STEP 2 — Details ════════ */}
          {mode === 'edit' && editStep === 2 && (
            <>
              {/* Location & Terms */}
              <div className="form-sec">
                <div className="form-sec-head">
                  <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}><i className="ti ti-map-pin" /></div>
                  <div><div className="fsh-title">Location &amp; Terms</div><div className="fsh-sub">Plant, department, payment and delivery</div></div>
                </div>
                <div className="form-body">
                  <div className="g2">
                    <div className="fgrp">
                      <label className="lbl">Plant <span className="req">*</span></label>
                      <select className={`sel${editStepErrors.plant ? ' err' : ''}`} {...register('plant', { valueAsNumber: true })} onChange={e => { register('plant', { valueAsNumber: true }).onChange(e); setEditStepErrors(p => ({ ...p, plant: '' })) }}>
                        <option value="">Select plant</option>
                        {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {editStepErrors.plant && <div className="err">{editStepErrors.plant}</div>}
                    </div>
                    <div className="fgrp">
                      <label className="lbl">Department <span className="req">*</span></label>
                      <select className={`sel${editStepErrors.department ? ' err' : ''}`} {...register('department', { valueAsNumber: true })} onChange={e => { register('department', { valueAsNumber: true }).onChange(e); setEditStepErrors(p => ({ ...p, department: '' })) }}>
                        <option value="">Select department</option>
                        {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      {editStepErrors.department && <div className="err">{editStepErrors.department}</div>}
                    </div>
                  </div>
                  <div className="g2">
                    <div className="fgrp">
                      <label className="lbl">Payment Terms</label>
                      <input className="inp" placeholder="e.g. Net 30 days" {...register('payment_terms')} />
                    </div>
                    <div className="fgrp">
                      <label className="lbl">Incoterms</label>
                      <input className="inp" placeholder="e.g. FOB, CIF" {...register('incoterms')} />
                    </div>
                  </div>
                  <div className="fgrp">
                    <label className="lbl">Delivery Address</label>
                    <input className="inp" placeholder="Delivery location / warehouse" {...register('delivery_address')} />
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div className="form-sec">
                <div className="form-sec-head">
                  <div className="fsh-ic" style={{ background: 'var(--amb-bg)', color: 'var(--amb-tx)' }}><i className="ti ti-chart-bar" /></div>
                  <div><div className="fsh-title">Budget</div><div className="fsh-sub">Tracking ID / cost center link</div></div>
                </div>
                <div className="form-body">
                  <div className="fgrp">
                    <label className="lbl">Tracking ID / Cost Center</label>
                    <select className="sel" {...register('tracking_id', { setValueAs: v => v ? Number(v) : null })}>
                      <option value="">None (no budget link)</option>
                      {(trackingIds || []).map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.tracking_code} — {t.description} (Remaining: {formatCurrency(Number(t.approved_amount || 0) - Number(t.consumed_amount || 0))})
                        </option>
                      ))}
                    </select>
                  </div>
                  {budgetExceededEdit && (
                    <div className="alert-err">
                      <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                      PO total {formatCurrency(editGrandTotal)} exceeds remaining budget {formatCurrency(budgetRemainingEdit ?? 0)}.
                    </div>
                  )}
                  {budgetRemainingEdit !== null && !budgetExceededEdit && (
                    <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 8 }}>
                      Budget remaining: <span style={{ fontWeight: 600, color: 'var(--tel-tx)' }}>{formatCurrency(budgetRemainingEdit)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Tooling */}
              {selectedPoType === 'ZT' && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--gry-bg)', color: 'var(--gry-tx)' }}><i className="ti ti-calendar-dollar" /></div>
                    <div><div className="fsh-title">Advance Payment Schedule</div><div className="fsh-sub">Percentages must sum to 100%</div></div>
                  </div>
                  <div className="form-body">
                    <div className="g3" style={{ marginBottom: 10 }}>
                      {([['po', '% at PO Issuance'], ['approval', '% on Approval'], ['delivery', '% on Delivery']] as const).map(([key, label]) => (
                        <div key={key} className="fgrp">
                          <label className="lbl">{label}</label>
                          <input type="number" className="inp" min="0" max="100" value={advSchedule[key]}
                            onChange={e => { const v = Number(e.target.value) || 0; setAdvSchedule(p => ({ ...p, [key]: v })); setValue('advance_schedule', { ...advSchedule, [key]: v }, { shouldDirty: true }) }} />
                        </div>
                      ))}
                    </div>
                    {(() => { const t = advSchedule.po + advSchedule.approval + advSchedule.delivery; return t !== 100 ? <p style={{ fontSize: 12, color: 'var(--red-tx)' }}>Total is {t}% — must equal 100%.</p> : <p style={{ fontSize: 12, color: 'var(--grn-tx)' }}>Total: 100% ✓</p> })()}
                  </div>
                </div>
              )}

              {/* Import */}
              {selectedPoType === 'IM' && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}><i className="ti ti-world" /></div>
                    <div><div className="fsh-title">Import Details</div></div>
                  </div>
                  <div className="form-body">
                    <div className="g3">
                      <div className="fgrp"><label className="lbl">Exchange Rate</label><input type="number" step="0.0001" className="inp" placeholder="e.g. 83.25" {...register('exchange_rate', { valueAsNumber: true })} /></div>
                      <div className="fgrp"><label className="lbl">Customs Duty Rate (%)</label><input type="number" step="0.01" className="inp" placeholder="e.g. 10" {...register('customs_duty_rate', { valueAsNumber: true })} /></div>
                      <div className="fgrp"><label className="lbl">Freight &amp; Insurance</label><input type="number" step="0.01" className="inp" placeholder="0.00" {...register('freight_insurance', { valueAsNumber: true })} /></div>
                    </div>
                    {(() => {
                      const cr = Number(watch('customs_duty_rate')) || 0, fr = Number(watch('freight_insurance')) || 0
                      const ca = editSubtotal * (cr / 100), landed = editSubtotal + ca + fr
                      return (
                        <div style={{ background: 'var(--bg-s)', border: '0.5px solid var(--bd)', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
                          {[['Base Amount', formatCurrency(editSubtotal)], [`Customs (${cr}%)`, formatCurrency(ca)], ['Freight & Insurance', formatCurrency(fr)]].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--tx3)' }}>{k}</span><span>{v}</span></div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px solid var(--bdm)', paddingTop: 6, fontWeight: 700 }}><span>Landed Cost</span><span>{formatCurrency(landed)}</span></div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Adjustments */}
              <div className="form-sec">
                <div className="form-sec-head">
                  <div className="fsh-ic" style={{ background: 'var(--tel-bg)', color: 'var(--tel-tx)' }}><i className="ti ti-adjustments" /></div>
                  <div><div className="fsh-title">Adjustments</div></div>
                </div>
                <div className="form-body">
                  <div className="g2">
                    <div className="fgrp"><label className="lbl">Freight Amount</label><input type="number" step="0.01" className="inp" {...register('freight_amount', { valueAsNumber: true })} /></div>
                    <div className="fgrp"><label className="lbl">Discount Amount</label><input type="number" step="0.01" className="inp" {...register('discount_amount', { valueAsNumber: true })} /></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════ EDIT STEP 3 — Review & Save ════════ */}
          {mode === 'edit' && editStep === 3 && (
            <>
              {/* Summary banner */}
              <div style={{ background: 'var(--blu-bg)', border: '0.5px solid rgba(24,95,165,.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 13, color: 'var(--blu-tx)' }}>
                <i className="ti ti-checks" style={{ fontSize: 16, flexShrink: 0 }} />
                <span><strong>Review your changes</strong> and click "Save Changes" to update the purchase order.</span>
              </div>

              {/* Line Items */}
              {editLineItems.length > 0 && (
                <div className="form-sec">
                  <div className="form-sec-head">
                    <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}><i className="ti ti-package" /></div>
                    <div><div className="fsh-title">Line Items ({editLineItems.length})</div><div className="fsh-sub">Read-only</div></div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="po-tbl">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th>Item / Description</th>
                          <th style={{ textAlign: 'right', width: 80 }}>Qty</th>
                          <th style={{ width: 80 }}>UOM</th>
                          <th style={{ textAlign: 'right', width: 120 }}>Unit Rate</th>
                          <th style={{ textAlign: 'right', width: 120 }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editLineItems.map((li: any, idx: number) => {
                          const amount = (Number(li.quantity) || 0) * (Number(li.unit_rate) || 0)
                          return (
                            <tr key={li.id}>
                              <td style={{ color: 'var(--tx3)', fontFamily: 'monospace', fontSize: 12 }}>{idx + 1}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{li.item_code_detail?.code ?? '—'}</div>
                                {li.description && <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{li.description}</div>}
                              </td>
                              <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                              <td style={{ color: 'var(--tx3)' }}>{li.unit_of_measure}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(li.unit_rate)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(amount)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr><td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--tx2)' }}>Subtotal</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(editSubtotal)}</td></tr>
                        <tr><td colSpan={5} style={{ textAlign: 'right', color: 'var(--tx3)' }}>Tax ({combinedTaxRate}%)</td><td style={{ textAlign: 'right', color: 'var(--tx3)' }}>{formatCurrency(editTotalTax)}</td></tr>
                        <tr style={{ background: 'var(--bg-t)' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, borderTop: '0.5px solid var(--bdm)' }}>Total</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)' }}>{formatCurrency(editGrandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="form-sec">
                <div className="form-sec-head">
                  <div className="fsh-ic" style={{ background: 'var(--bg-t)', color: 'var(--tx3)' }}><i className="ti ti-notes" /></div>
                  <div><div className="fsh-title">Notes</div></div>
                </div>
                <div className="form-body">
                  <textarea className="textarea" placeholder="Additional notes…" {...register('notes')} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div>

          {/* ── PO Summary — step + method aware ── */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <i className="ti ti-eye" style={{ fontSize: 14 }} />
                {mode === 'create' ? (step === 2 ? 'Cost Preview' : 'PO Summary') : 'PO Summary'}
              </div>
            </div>
            <div className="card-body">

              {/* CREATE — no method chosen yet */}
              {mode === 'create' && !createMethod && (
                <p style={{ fontSize: 13, color: 'var(--tx3)' }}>Choose a creation method to see the cost summary.</p>
              )}

              {/* CREATE — PR flow */}
              {mode === 'create' && createMethod === 'pr' && step === 1 && !selectedQuotation && (
                <p style={{ fontSize: 13, color: 'var(--tx3)' }}>{selectedPrId ? 'No quotation on this PR — PO from estimates.' : 'Select a PR to see the total.'}</p>
              )}
              {mode === 'create' && createMethod === 'pr' && (step === 1 ? !!selectedQuotation : true) && selectedQuotation && (
                <>
                  {step >= 2 && <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 10 }}>{selectedQuotation.vendor_name}</p>}
                  {step === 2 && [
                    { lbl: 'Sub Total', val: formatCurrency(subTotal) },
                    { lbl: `GST @ ${GST_RATE}%`, val: formatCurrency(gstAmount) },
                  ].map(({ lbl, val }) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: 'var(--tx3)' }}>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                  <div className="stat-box" style={{ marginTop: step === 2 ? 4 : 0 }}>
                    <div className="stat-lbl">Grand Total (incl. GST {GST_RATE}%)</div>
                    <div className="stat-val" style={{ color: 'var(--tel-tx)' }}>{formatCurrency(grandTotal)}</div>
                  </div>
                  {budgetAfterPO !== null && (
                    <div className="stat-box" style={{ background: budgetAfterPO < 0 ? 'var(--red-bg)' : 'var(--bg-s)', borderColor: budgetAfterPO < 0 ? 'var(--red-bd)' : 'var(--bd)' }}>
                      <div className="stat-lbl">Budget After PO</div>
                      <div className="stat-val" style={{ fontSize: 16, color: budgetAfterPO < 0 ? 'var(--red-tx)' : 'var(--grn-tx)' }}>{formatCurrency(budgetAfterPO)}</div>
                    </div>
                  )}
                </>
              )}

              {/* CREATE — Quotation flow */}
              {mode === 'create' && createMethod === 'quotation' && !directQtId && (
                <p style={{ fontSize: 13, color: 'var(--tx3)' }}>Select a quotation to see the cost.</p>
              )}
              {mode === 'create' && createMethod === 'quotation' && !!directQtId && (
                <>
                  {qtVendorName && <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 10 }}>{qtVendorName}</p>}
                  {step >= 2 && [
                    { lbl: 'Sub Total', val: formatCurrency(qtSubtotal) },
                    { lbl: 'Tax', val: formatCurrency(qtGrandTotal - qtSubtotal) },
                  ].map(({ lbl, val }) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: 'var(--tx3)' }}>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                  <div className="stat-box">
                    <div className="stat-lbl">Grand Total</div>
                    <div className="stat-val" style={{ color: 'var(--tel-tx)' }}>{formatCurrency(qtGrandTotal)}</div>
                  </div>
                </>
              )}

              {/* CREATE — Vendor manual flow */}
              {mode === 'create' && createMethod === 'vendor' && !manualVendorId && (
                <p style={{ fontSize: 13, color: 'var(--tx3)' }}>Select a vendor to get started.</p>
              )}
              {mode === 'create' && createMethod === 'vendor' && !!manualVendorId && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 10 }}>{manualVendorName}</p>
                  {manualItems.length === 0
                    ? <p style={{ fontSize: 13, color: 'var(--tx3)' }}>Add items in step 2 to see the total.</p>
                    : (
                      <>
                        {[
                          { lbl: 'Sub Total', val: formatCurrency(manualSubtotal) },
                          { lbl: `GST @ ${GST_RATE}%`, val: formatCurrency(manualGstAmount) },
                        ].map(({ lbl, val }) => (
                          <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                            <span style={{ color: 'var(--tx3)' }}>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                          </div>
                        ))}
                        <div className="stat-box">
                          <div className="stat-lbl">Grand Total (incl. GST {GST_RATE}%)</div>
                          <div className="stat-val" style={{ color: 'var(--tel-tx)' }}>{formatCurrency(manualGrandTotal)}</div>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>{manualItems.length} item{manualItems.length !== 1 ? 's' : ''} added</p>
                      </>
                    )}
                </>
              )}

              {/* EDIT mode */}
              {mode === 'edit' && (
                <>
                  <div className="stat-box"><div className="stat-lbl">Grand Total</div><div className="stat-val" style={{ color: 'var(--tel-tx)' }}>{formatCurrency(editGrandTotal)}</div></div>
                  {budgetRemainingEdit !== null && (
                    <div className="stat-box" style={{ background: budgetExceededEdit ? 'var(--red-bg)' : 'var(--bg-s)', borderColor: budgetExceededEdit ? 'var(--red-bd)' : 'var(--bd)' }}>
                      <div className="stat-lbl">Budget Remaining</div>
                      <div className="stat-val" style={{ fontSize: 16, color: budgetExceededEdit ? 'var(--red-tx)' : 'var(--grn-tx)' }}>{formatCurrency(budgetRemainingEdit)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Checklist — step-aware (create only) ── */}
          {mode === 'create' && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  <i className="ti ti-list-check" style={{ fontSize: 14 }} />
                  {step === 1 ? 'Step 1 — Select PR' : step === 2 ? 'Step 2 — PO Details' : 'Step 3 — Final Check'}
                </div>
              </div>
              <div>
                {step === 1 && [
                  { done: !!selectedPrId, label: 'PR selected', req: true },
                  { done: !!selectedQuotation, label: 'Quotation linked', req: false },
                  { done: !!selectedQuotation && !budgetWillExceed, label: 'Within budget', req: false },
                ].map(({ done, label, req }) => (
                  <div key={label} className="ci" style={{ color: done ? 'var(--grn-tx)' : req ? 'var(--red-tx)' : 'var(--tx3)' }}>
                    {done ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Circle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13 }}>{label}</span>
                    {req && !done && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 'auto' }}>Required</span>}
                  </div>
                ))}

                {step === 2 && [
                  { done: !!poDate, label: 'PO date set', req: true },
                  { done: !!deliveryDate, label: 'Delivery date set', req: true },
                  { done: !!paymentTermsCreate, label: 'Payment terms', req: false },
                  { done: !!billingAddress, label: 'Billing address', req: false },
                ].map(({ done, label, req }) => (
                  <div key={label} className="ci" style={{ color: done ? 'var(--grn-tx)' : req ? 'var(--red-tx)' : 'var(--tx3)' }}>
                    {done ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Circle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13 }}>{label}</span>
                    {req && !done && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 'auto' }}>Required</span>}
                  </div>
                ))}

                {step === 3 && [
                  { done: !!selectedPrId, label: 'PR selected' },
                  { done: !!selectedQuotation, label: 'Quotation linked' },
                  { done: !!poDate, label: 'PO date set' },
                  { done: !!deliveryDate, label: 'Delivery date set' },
                  { done: !!selectedQuotation && !budgetWillExceed, label: 'Within budget' },
                ].map(({ done, label }) => (
                  <div key={label} className="ci" style={{ color: done ? 'var(--grn-tx)' : 'var(--tx3)' }}>
                    {done ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Circle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Checklist (edit mode — step-aware) ── */}
          {mode === 'edit' && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  <i className="ti ti-list-check" style={{ fontSize: 14 }} />
                  {editStep === 1 ? 'Step 1 — Basic Info' : editStep === 2 ? 'Step 2 — Details' : 'Step 3 — Final Check'}
                </div>
              </div>
              <div>
                {editStep === 1 && [
                  { done: !!selectedPoType, label: 'PO Type set', req: true },
                  { done: !!selectedVendorId, label: 'Vendor assigned', req: true },
                ].map(({ done, label, req }) => (
                  <div key={label} className="ci" style={{ color: done ? 'var(--grn-tx)' : req ? 'var(--red-tx)' : 'var(--tx3)' }}>
                    {done ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Circle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13 }}>{label}</span>
                    {req && !done && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 'auto' }}>Required</span>}
                  </div>
                ))}
                {editStep === 2 && [
                  { done: !!selectedPlant, label: 'Plant selected', req: true },
                  { done: !!selectedDepartment, label: 'Department selected', req: true },
                  { done: !!watch('payment_terms'), label: 'Payment terms', req: false },
                  { done: !!watch('delivery_address'), label: 'Delivery address', req: false },
                ].map(({ done, label, req }) => (
                  <div key={label} className="ci" style={{ color: done ? 'var(--grn-tx)' : req ? 'var(--red-tx)' : 'var(--tx3)' }}>
                    {done ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Circle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13 }}>{label}</span>
                    {req && !done && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 'auto' }}>Required</span>}
                  </div>
                ))}
                {editStep === 3 && [
                  { done: !!selectedPoType, label: 'PO Type set' },
                  { done: !!selectedVendorId, label: 'Vendor assigned' },
                  { done: !!selectedPlant, label: 'Plant selected' },
                  { done: !!selectedDepartment, label: 'Department selected' },
                  { done: !budgetExceededEdit, label: 'Within budget' },
                ].map(({ done, label }) => (
                  <div key={label} className="ci" style={{ color: done ? 'var(--grn-tx)' : 'var(--tx3)' }}>
                    {done ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Circle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Document Chain — step-aware ── */}
          <div className="card">
            <div className="card-head">
              <div className="card-title"><i className="ti ti-git-fork" style={{ fontSize: 14 }} /> Document Chain</div>
            </div>
            <div className="card-body">
              {mode === 'create' ? (() => {
                // dot styles based on active step
                const prStyle = step === 1
                  ? { background: 'var(--pur-bg)', color: 'var(--pur-tx)', outline: '2px solid var(--pur-bd)' }
                  : { background: 'var(--grn-bg)', color: 'var(--grn-tx)' }
                const qtStyle = step === 1
                  ? { background: 'var(--bg-t)', color: 'var(--tx3)' }
                  : step === 2
                    ? { background: 'var(--pur-bg)', color: 'var(--pur-tx)', outline: '2px solid var(--pur-bd)' }
                    : { background: 'var(--grn-bg)', color: 'var(--grn-tx)' }
                const poStyle = step < 3
                  ? { background: 'var(--bg-t)', color: 'var(--tx3)' }
                  : { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', outline: '2px solid hsl(var(--primary)/0.4)' }
                return (
                  <>
                    <div className="chain-step">
                      <div className="chain-dot" style={prStyle}>PR</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: step === 1 ? 600 : 500, color: prDetail ? 'var(--tx)' : 'var(--tx3)' }}>{prDetail?.pr_number || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{step === 1 ? 'Select this step' : 'Purchase Request'}</div>
                      </div>
                    </div>
                    <div className="chain-line" />
                    <div className="chain-step">
                      <div className="chain-dot" style={qtStyle}>QT</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: step === 2 ? 600 : 500, color: selectedQuotation ? 'var(--tx)' : 'var(--tx3)' }}>{selectedQuotation?.quotation_no || selectedQuotation?.ref_no || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{step === 2 ? 'Fill PO details' : selectedQuotation ? selectedQuotation.vendor_name : 'Quotation'}</div>
                      </div>
                    </div>
                    <div className="chain-line" />
                    <div className="chain-step">
                      <div className="chain-dot" style={poStyle}>PO</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: step === 3 ? 600 : 500, color: step === 3 ? 'var(--tx)' : 'var(--tx3)' }}>This Purchase Order</div>
                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{step === 3 ? 'Review & issue' : 'Being created'}</div>
                      </div>
                    </div>
                  </>
                )
              })() : (
                <>
                  {po?.pr_number && (<><div className="chain-step"><div className="chain-dot" style={{ background: 'var(--pur-bg)', color: 'var(--pur-tx)' }}>PR</div><div><div style={{ fontSize: 13, fontWeight: 500 }}>{po.pr_number}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>Purchase Request</div></div></div><div className="chain-line" /></>)}
                  {po?.qt_number && (<><div className="chain-step"><div className="chain-dot" style={{ background: 'var(--bg-t)', color: 'var(--tx3)' }}>QT</div><div><div style={{ fontSize: 13, fontWeight: 500 }}>{po.qt_number}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>Quotation</div></div></div><div className="chain-line" /></>)}
                  <div className="chain-step">
                    <div className="chain-dot" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>PO</div>
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>{po?.po_number}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{po?.vendor_name}</div></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="sticky-bar rounded-b-xl">
        <div style={{ display: 'flex', gap: 8 }}>
          {mode === 'create' && step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="btn-ghost">
              <ChevronLeft style={{ width: 14, height: 14 }} /> Previous
            </button>
          )}
          {mode === 'edit' && editStep === 1 && (
            <button type="button" onClick={() => router.back()} className="btn-ghost">
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back
            </button>
          )}
          {mode === 'edit' && editStep > 1 && (
            <button type="button" onClick={() => setEditStep(s => s - 1)} className="btn-ghost">
              <ChevronLeft style={{ width: 14, height: 14 }} /> Previous
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {mode === 'create' && step < 3 && (
            <button type="button" onClick={handleNextStep} className="btn-primary">
              Next <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          )}
          {mode === 'create' && step === 3 && (
            <button type="button" disabled={isPending} onClick={() => setShowIssueConfirm(true)} className="btn-primary">
              {isPending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
              Issue Purchase Order
            </button>
          )}
          {mode === 'edit' && editStep < 3 && (
            <button type="button" onClick={handleEditNextStep} className="btn-primary">
              Next <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          )}
          {mode === 'edit' && editStep === 3 && (
            <button type="button" disabled={isPending || !isDirty} onClick={handleSubmit(data => updateMutation.mutate(data))} className="btn-primary" style={{ opacity: !isDirty ? 0.5 : 1 }}>
              {isPending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />}
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ── Issue PO confirmation — outside po-root so Tailwind styles aren't overridden ── */}
    <CommonConfirmModal
      isOpen={showIssueConfirm}
      title="Issue Purchase Order?"
      description={
        <>
          You are about to issue this Purchase Order to{' '}
          <strong>{selectedQuotation?.vendor_name || 'the vendor'}</strong>
          {selectedQuotation && (
            <> for <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(grandTotal)}</strong></>
          )}
          .<br /><br />
          Once issued, the vendor will be notified and the order will be locked for changes. Are you sure you want to proceed?
        </>
      }
      confirmLabel="Yes, Issue PO"
      onClose={() => setShowIssueConfirm(false)}
      onConfirm={() => { setShowIssueConfirm(false); createMutation.mutate() }}
      isPending={isPending}
    />
    </>
  )
}
