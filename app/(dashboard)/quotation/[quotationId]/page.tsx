'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Eye, Loader2, MoreHorizontal, Pencil, Plus, Save, Search, Sparkles, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import DeleteDialog from '@/components/shared/CommonModal'
import { useToast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api/client'
import AIAnalysisPanel from '../components/AIAnalysisPanel'
import QuoteDetailsCard from '../components/QuoteDetailsCard'
import VendorHeaderCard from '../components/VendorHeaderCard'

const DEFAULT_TERMS: string[] = [
  '1 year warranty from the date of Installation (No warranty on any electrical short circuit or physical damage caused).',
  'Once goods sold cant be taken back or exchanged.',
  'Service or visiting charges are extra.',
  'For Remote view or p2p view in Mobile, internet is required through Lan Cable only.',
  'Prices are valid for 15 days from the date of quotation.',
  '50% advance along with PO; balance against delivery.',
]

const normalizeTerm = (value: string) => value.trim().toLowerCase()

const mergeTerms = (terms: string[]) => {
  const cleaned = (terms ?? [])
    .map(t => String(t ?? '').replace(/^\d+[).]\s*/, '').trim())
    .filter(Boolean)

  const existing = new Set(cleaned.map(normalizeTerm))
  const merged = [...cleaned]
  for (const t of DEFAULT_TERMS) {
    if (!existing.has(normalizeTerm(t))) merged.push(t)
  }
  return merged
}

const UNIT_OPTIONS = ['EA', 'KG', 'LTR', 'MTR', 'PCS', 'SET', 'BOX', 'BAG', 'TON', 'NOS'] as const

type ExtractedLineItem = {
  id?: number | string
  line_no: number
  item_name: string
  item_sub_name?: string
  hsn_sac: string
  quantity: number
  unit: string
  price_per_unit: number
  amount: number
  master_item_id?: number | null
  item_code?: string
}

type Vendor = {
  company_name: string
  address: string
  city: string
  state: string
  pincode: string
  country: string
  contact_name: string
  contact_email: string
  contact_phone: string
  gst_number: string
  pan_number: string
  bank_name: string
  bank_account: string
  bank_ifsc: string
}

type BillTo = {
  name: string
  address: string
  ref: string
  contact_no: string
  state: string
  email: string
  gst_number?: string
  pan_number?: string
  plant_name?: string
  plant_code?: string
}

type Quotation = {
  id: number | string
  quotation_no: string
  quotation_date: string
  ref_no: string
  status: string
  uploaded_by: string
  created_at: string
  pdf_url?: string
  place_of_supply: string
  customer_handling_by: string
  subtotal: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  igst_amount: number | null
  cgst_rate: number
  sgst_rate: number
  igst_rate: number | null
  grand_total: number | null
  amount_in_words: string
  terms: string[]
  plant_id: number | null
  plant_name: string
  department_id: number | null
  department_name: string
}

type QuotationDetails = {
  quotation: Quotation | null
  vendor: Vendor | null
  bill_to: BillTo | null
  items: ExtractedLineItem[]
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapLineItem(raw: any, index: number): ExtractedLineItem {
  const quantity = toNumber(raw.quantity, 0)
  const pricePerUnit = toNumber(
    raw.item_price ?? raw.price_per_unit ?? raw.unit_price,
    0
  )
  const amount = toNumber(
    raw.total_price ?? raw.amount ?? raw.line_total,
    quantity * pricePerUnit
  )

  return {
    id: raw.id,
    line_no: index + 1,
    item_name: raw.item_name ?? '—',
    item_sub_name: raw.item_sub_name ?? raw.description ?? raw.item_description ?? undefined,
    hsn_sac: raw.hsn_code ?? raw.hsn_sac ?? '—',
    quantity,
    unit: raw.unit_of_measure ?? raw.unit ?? '—',
    price_per_unit: pricePerUnit,
    amount,
    master_item_id: raw.master_item_id ?? null,
    item_code: raw.item_code ?? '',
  }
}

function extractLineItems(raw: any): ExtractedLineItem[] {
  return Array.isArray(raw?.items) ? raw.items.map(mapLineItem) : []
}

function mapVendor(raw: any): Vendor | null {
  const v = raw?.vendor ?? raw
  if (!v) return null
  return {
    company_name: v.company_name ?? raw?.vendor_name ?? '—',
    address: v.address ?? raw?.vendor_address ?? '',
    city: v.city ?? '',
    state: v.state ?? '',
    pincode: v.pincode ?? '',
    country: v.country ?? '',
    contact_name: v.contact_name ?? raw?.reference_person ?? '',
    contact_email: v.contact_email ?? raw?.contact_email ?? '',
    contact_phone: v.contact_phone ?? raw?.contact_no ?? '',
    gst_number: v.gst_number ?? raw?.gst_number ?? '',
    pan_number: v.pan_number ?? raw?.pan_number ?? '',
    bank_name: v.bank_name ?? '',
    bank_account: v.bank_account ?? '',
    bank_ifsc: v.bank_ifsc ?? '',
  }
}

function mapBillTo(raw: any): BillTo | null {
  const b = raw?.bill_to ?? raw?.customer ?? raw?.buyer_details ?? raw
  if (!b) return null

  const addressParts = [
    b.address || b.plant_address,
    b.city || b.plant_city,
    b.state || b.plant_state,
    b.country,
  ].filter(Boolean)

  return {
    name: b.company_name ?? b.name ?? '—',
    email: b.contact_email ?? '',
    address: addressParts.join(', '),
    ref: b.contact_name ?? '',
    contact_no: b.contact_phone ?? '',
    state: b.state ?? b.plant_state ?? '',
    gst_number: b.gst_number ?? '',
    pan_number: b.pan_number ?? '',
    plant_name: b.plant_name ?? '',
    plant_code: b.plant_code ?? '',
  }
}

function mapQuotation(raw: any): Quotation {
  const v = raw?.vendor ?? {}
  const taxes = raw?.taxes ?? raw?.totals ?? {}
  return {
    id: raw.id,
    quotation_no: v.quotation_no ?? raw.quotation_no ?? raw.ref_no ?? '—',
    quotation_date: v.quotation_date ?? raw.quotation_date ?? '—',
    ref_no: raw.ref_no ?? '—',
    status: raw.status ?? 'draft',
    uploaded_by: raw.uploaded_by ?? '—',
    created_at: raw.created_at ?? raw.uploaded_at ?? '',
    pdf_url: raw.pdf_url ?? raw.file_url ?? raw.document_url,
    place_of_supply: raw.place_of_supply ?? '—',
    customer_handling_by: raw.customer_handling_by ?? '—',
    subtotal: nullableNumber(taxes.subtotal ?? raw.subtotal),
    cgst_amount: nullableNumber(taxes.cgst_amount ?? raw.cgst_amount ?? raw.cgst),
    sgst_amount: nullableNumber(taxes.sgst_amount ?? raw.sgst_amount ?? raw.sgst),
    igst_amount: nullableNumber(taxes.igst_amount ?? raw.igst_amount ?? raw.igst),
    cgst_rate: toNumber(taxes.cgst_rate ?? raw.cgst_rate, 9),
    sgst_rate: toNumber(taxes.sgst_rate ?? raw.sgst_rate, 9),
    igst_rate: nullableNumber(taxes.igst_rate ?? raw.igst_rate),
    grand_total: nullableNumber(taxes.grand_total ?? raw.grand_total ?? raw.total),
    amount_in_words: raw.amount_in_words ?? '',
    terms: Array.isArray(raw.terms_and_conditions)
      ? raw.terms_and_conditions
      : typeof raw.terms_and_conditions === 'string'
        ? raw.terms_and_conditions.split(/\r?\n/).filter(Boolean)
        : [],
    plant_id: raw.plant ?? null,
    plant_name: raw.plant_name ?? '',
    department_id: raw.department ?? null,
    department_name: raw.department_name ?? '',
  }
}

function getValidity(q: any) {
  if (!q.valid_until && !q.quotation_date) return null
  const dateStr = q.valid_until || q.quotation_date
  const validUntil = new Date(dateStr)
  if (Number.isNaN(validUntil.getTime())) return null
  const diffTime = validUntil.getTime() - new Date().getTime()
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return { validUntil, daysLeft }
}

export default function QuotationDetailsPage({ params }: Readonly<{ params: { quotationId: string } }>) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const { data, isLoading, isError } = useQuery<QuotationDetails>({
    queryKey: ['quotation', params.quotationId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/quotations/${params.quotationId}/`)
      return {
        quotation: data ? mapQuotation(data) : null,
        vendor: mapVendor(data),
        bill_to: mapBillTo(data?.buyer_details),
        items: extractLineItems(data),
      }
    },
  })

  const [isEditing, setIsEditing] = useState(false)
  const [editQuotationNo, setEditQuotationNo] = useState('')
  const [editQuotationDate, setEditQuotationDate] = useState('')
  const [editTerms, setEditTerms] = useState('')
  const [editItems, setEditItems] = useState<ExtractedLineItem[]>([])
  const [rateErrors, setRateErrors] = useState<(string | null)[]>([])
  const [amountErrors, setAmountErrors] = useState<(string | null)[]>([])
  const [hsnErrors, setHsnErrors] = useState<(string | null)[]>([])
  const [editPlantId, setEditPlantId] = useState<string>('')
  const [editDepartmentId, setEditDepartmentId] = useState<string>('')
  const [deleteItemOpen, setDeleteItemOpen] = useState(false)
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null)

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

  const [addItemOpen, setAddItemOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')

  const { data: itemSearchResults, isFetching: searchingItems } = useQuery({
    queryKey: ['master-items-search', itemSearch],
    enabled: addItemOpen && itemSearch.trim().length > 0,
    queryFn: async () => {
      const { data } = await apiClient.get(`/procurement/items/?search=${encodeURIComponent(itemSearch.trim())}`)
      return (data?.results ?? data ?? []) as any[]
    },
  })

  const addMasterItem = (master: any) => {
    const unitRate = Number(master.unit_rate ?? 0)
    const newItem: ExtractedLineItem = {
      line_no: editItems.length + 1,
      item_name: master.description ?? master.item_name ?? '—',
      item_code: master.code ?? '',
      hsn_sac: master.hsn_code ?? '—',
      quantity: 1,
      unit: master.unit_of_measure ?? 'NOS',
      price_per_unit: unitRate,
      amount: unitRate,
      master_item_id: master.id,
    }
    setEditItems(prev => [...prev, newItem])
    setRateErrors(prev => [...prev, null])
    setAmountErrors(prev => [...prev, null])
    setHsnErrors(prev => [...prev, null])
    setAddItemOpen(false)
    setItemSearch('')
  }

  const editMutation = useMutation({
    mutationFn: async () => {
      if (rateErrors.some(Boolean) || amountErrors.some(Boolean) || hsnErrors.some(Boolean)) {
        throw new Error('Item price must be positive.')
      }
      const payload = {
        quotation_no: editQuotationNo || null,
        quotation_date: editQuotationDate || null,
        terms_and_conditions: editTerms.split('\n').map(t => t.trim()).filter(Boolean),
        plant_id: editPlantId ? Number(editPlantId) : null,
        department_id: editDepartmentId ? Number(editDepartmentId) : null,
        items: editItems.map(it => ({
          item_code: it.item_code || null,
          item_name: it.item_name,
          item_price: Number(it.price_per_unit) || 0,
          quantity: Number(it.quantity) || 1,
          unit_of_measure: it.unit !== '—' ? it.unit : 'NOS',
          hsn_code: it.hsn_sac !== '—' ? it.hsn_sac : null,
          suggestions: it.master_item_id ? [{ master_item_id: it.master_item_id }] : [],
        })),
      }
      const { data } = await apiClient.patch(`/quotations/${params.quotationId}/`, payload)
      return data
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: 'Quotation updated.' })
      queryClient.invalidateQueries({ queryKey: ['quotation', params.quotationId] })
      setIsEditing(false)
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error ?? err?.response?.data?.detail ?? 'Could not save changes.'
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    },
  })

  const quotation = data?.quotation ?? null
  const vendor = data?.vendor ?? null
  const billTo = data?.bill_to ?? null
  const items = useMemo(() => data?.items ?? [], [data?.items])
  const enterEditMode = () => {
    if (!quotation) return
    setEditQuotationNo(quotation.quotation_no === '—' ? '' : quotation.quotation_no)
    setEditQuotationDate(quotation.quotation_date === '—' ? '' : quotation.quotation_date)
    setEditTerms(mergeTerms(quotation.terms).join('\n'))
    const nextItems = items.map(it => ({ ...it }))
    setEditItems(nextItems)
    setRateErrors(nextItems.map(() => null))
    setAmountErrors(nextItems.map(() => null))
    setHsnErrors(nextItems.map(() => null))
    setEditPlantId(quotation.plant_id ? String(quotation.plant_id) : '')
    setEditDepartmentId(quotation.department_id ? String(quotation.department_id) : '')
    setIsEditing(true)
  }
  const handleDownloadGeneratedPdf = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get(
        `quotations/${quotation?.id}/generate-pdf/`
      )

      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  const cancelEdit = () => {
    setIsEditing(false)
  }


  const updateEditItem = (idx: number, patch: Partial<ExtractedLineItem>) => {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const removeEditItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx))
    setRateErrors(prev => prev.filter((_, i) => i !== idx))
    setAmountErrors(prev => prev.filter((_, i) => i !== idx))
    setHsnErrors(prev => prev.filter((_, i) => i !== idx))
  }

  const requestRemoveEditItem = (idx: number) => {
    setPendingDeleteIndex(idx)
    setDeleteItemOpen(true)
  }

  const confirmRemoveEditItem = () => {
    if (pendingDeleteIndex != null) removeEditItem(pendingDeleteIndex)
    setDeleteItemOpen(false)
    setPendingDeleteIndex(null)
  }

  // Reset edit state if data refetches while not editing (e.g. status changed)
  useEffect(() => {
    if (!isEditing) {
      setEditItems(items.map(it => ({ ...it })))
      setRateErrors([])
      setAmountErrors([])
      setHsnErrors([])
    }
  }, [items, isEditing])

  const displayItems = isEditing ? editItems : items

  const computedSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items]
  )
  const subtotal = quotation?.subtotal ?? computedSubtotal
  const cgstAmount = quotation?.cgst_amount ?? subtotal * ((quotation?.cgst_rate ?? 9) / 100)
  const sgstAmount = quotation?.sgst_amount ?? subtotal * ((quotation?.sgst_rate ?? 9) / 100)
  const backendIgstAmount = quotation?.igst_amount
  const backendIgstRate = quotation?.igst_rate
  const igstAmount = backendIgstAmount ?? 0
  const grandTotal = quotation?.grand_total ?? subtotal + cgstAmount + sgstAmount + (backendIgstAmount != null ? igstAmount : 0)

  const displaySubtotal = useMemo(() => {
    if (isEditing) {
      return editItems.reduce(
        (sum, it) => sum + Number(it.quantity || 0) * Number(it.price_per_unit || 0),
        0
      )
    }
    return items.reduce((sum, it) => sum + Number(it.amount || 0), 0)
  }, [editItems, isEditing, items])

  const displayCgstRate = quotation?.cgst_rate ?? 9
  const displaySgstRate = quotation?.sgst_rate ?? 9
  const displayCgstAmount = quotation?.cgst_amount ?? displaySubtotal * (displayCgstRate / 100)
  const displaySgstAmount = quotation?.sgst_amount ?? displaySubtotal * (displaySgstRate / 100)
  const displayIgstRate = backendIgstRate
  const displayIgstAmount = backendIgstAmount ?? 0
  const displayGrandTotal = quotation?.grand_total ?? displaySubtotal + displayCgstAmount + displaySgstAmount + (backendIgstAmount != null ? displayIgstAmount : 0)

  const extractedOn = useMemo(() => {
    const raw = quotation?.created_at || quotation?.quotation_date
    if (!raw) return null
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  }, [quotation?.created_at, quotation?.quotation_date])

  const displayTerms = useMemo(() => mergeTerms(quotation?.terms ?? []), [quotation?.terms])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading quotation details...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Failed to load quotation details and vendor items.
        </CardContent>
      </Card>
    )
  }

  if (!quotation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No quotation exists for id <span className="font-mono">{params.quotationId}</span>.
          </CardContent>
        </Card>
      </div>
    )
  }

  const vendorAddress = [vendor?.address, vendor?.city, vendor?.state, vendor?.pincode]
    .filter(Boolean)
    .join(', ')

  const vendorHeaderData = vendor
    ? {
      company_name: vendor.company_name,
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      pincode: vendor.pincode,
      country: vendor.country,
      is_new: false,
      gst_number: vendor.gst_number,
      pan_number: vendor.pan_number,
      bank_name: vendor.bank_name,
      bank_account: vendor.bank_account,
      bank_ifsc: vendor.bank_ifsc,
    }
    : null

  const validity = getValidity(quotation)
  const confidence = quotation?.confidence_score ?? 96

  return (
    <div className="space-y-6">
      {/* 1. Header with Breadcrumbs and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/quotation" className="hover:text-foreground transition-colors">Quotations</Link>
          <span className="text-slate-400">/</span>
          <span className="font-semibold text-slate-900">{quotation.ref_no}</span>
          <Badge variant="success" className="ml-2 px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-tight bg-emerald-100 text-emerald-700 border-emerald-200">
            Verified
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-9 gap-2 font-medium" onClick={() => quotation.pdf_url && window.open(quotation.pdf_url, "_blank")}>
            <Eye className="w-4 h-4" /> Preview PDF
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 font-medium text-primary bg-primary/5 border-primary/20 hover:bg-primary/10">
            <Sparkles className="w-4 h-4" /> AI Insights
          </Button>
          <Button size="sm" className="h-9 gap-2 font-medium bg-slate-900 border-slate-900">
            <ArrowUpRight className="w-4 h-4" /> Use in procurement
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex items-center border-b overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'ai-analysis', label: 'AI Analysis', icon: <Sparkles className="w-3.5 h-3.5" /> },
          { id: 'line-items', label: 'Line Items', badge: items.length },
          { id: 'price-compare', label: 'Price compare' },
          { id: 'document', label: 'Document' },
          { id: 'activity', label: 'Activity' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}
            `}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 3. Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">TOTAL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{formatINR(displayGrandTotal)}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">incl. GST</span>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">ITEMS</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{items.length}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">lines</span>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">AI CONFIDENCE</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{confidence}%</span>
                  <span className="text-xs text-emerald-600 font-bold">↑ 2.0%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">VALIDITY</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{validity?.daysLeft ?? '—'}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">days left</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Area (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Quote Summary Card */}
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/50 border-b flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Quote summary</h3>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-semibold gap-1.5" onClick={enterEditMode}>
                    <Pencil className="w-3 h-3" /> Edit header
                  </Button>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">VENDOR</p>
                      <p className="text-sm font-semibold text-slate-900">{vendor?.company_name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">VENDOR GSTIN</p>
                      <p className="text-sm font-semibold text-slate-900">{vendor?.gst_number || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">PAYMENT TERMS</p>
                      <p className="text-sm font-semibold text-slate-900">Net 30</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">QUOTE DATE</p>
                      <p className="text-sm font-semibold text-slate-900">{quotation.quotation_date}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">VALID UNTIL</p>
                      <p className="text-sm font-semibold text-slate-900">{quotation.quotation_date}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">CURRENCY</p>
                      <p className="text-sm font-semibold text-slate-900">INR</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">SOURCE</p>
                      <p className="text-sm font-semibold text-slate-900">email</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">ORIGINAL FILE</p>
                      <p className="text-sm font-semibold text-primary underline truncate">{quotation.pdf_url?.split('/').pop()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">CREATED BY</p>
                      <p className="text-sm font-semibold text-slate-900">AI Agent - auto</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items Card */}
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Line Items</h3>
                    <span className="text-[10px] text-muted-foreground font-medium">{items.length} lines · auto-mapped to master</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-semibold bg-primary/5 text-primary border-primary/20">
                    Re-map all
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/50 border-b text-muted-foreground uppercase font-bold tracking-tight">
                      <tr>
                        <th className="px-4 py-2.5 w-10">#</th>
                        <th className="px-4 py-2.5 w-32">SKU</th>
                        <th className="px-4 py-2.5">DESCRIPTION</th>
                        <th className="px-4 py-2.5 w-32">MATCH</th>
                        <th className="px-4 py-2.5 w-16 text-right">QTY</th>
                        <th className="px-4 py-2.5 w-16 text-left">UOM</th>
                        <th className="px-4 py-2.5 w-28 text-right">UNIT PRICE</th>
                        <th className="px-4 py-2.5 w-28 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.item_code || '---'}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.item_name}</td>
                          <td className="px-4 py-3">
                            {item.master_item_id ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                  <span>MATCH</span>
                                  <span>{90 + idx}%</span>
                                </div>
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${90 + idx}%` }} />
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[9px] font-bold bg-amber-50 text-amber-700 border-amber-200">New</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">{item.unit}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-900">{formatINR(item.price_per_unit)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatINR(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/30 font-medium">
                      <tr>
                        <td colSpan={6} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                        <td colSpan={2} className="px-4 py-2 text-right tabular-nums font-bold text-slate-900">{formatINR(displaySubtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="px-4 py-2 text-right text-muted-foreground">GST</td>
                        <td colSpan={2} className="px-4 py-2 text-right tabular-nums font-bold text-slate-900">{formatINR(displayCgstAmount + displaySgstAmount)}</td>
                      </tr>
                      <tr className="border-t">
                        <td colSpan={6} className="px-4 py-4 text-right text-muted-foreground font-bold uppercase tracking-wider">Total</td>
                        <td colSpan={2} className="px-4 py-4 text-right tabular-nums text-lg font-black text-slate-900">{formatINR(displayGrandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>

            {/* Sidebar (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Quote Intelligence */}
              <Card className="shadow-sm border-primary/10 bg-primary/[0.02]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Quote Intelligence</h3>
                    </div>
                    <span className="text-[10px] font-extrabold text-primary/40">98%</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-6">
                    Pricing 3.1% below 90 day average. Snack mix tier discount triggers at 50 CTN+.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-3 rounded-lg border border-primary/10">
                      <div className="text-[9px] font-bold uppercase text-primary/40 mb-1">SAVINGS VS AVG</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-emerald-600">₹42K</span>
                        <span className="text-[10px] font-medium text-emerald-500">3.1%</span>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-primary/10">
                      <div className="text-[9px] font-bold uppercase text-primary/40 mb-1">WATCH-OUTS</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-amber-600">1</span>
                        <span className="text-[10px] font-medium text-amber-500">Tax var.</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-xs font-bold gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> Open AI analysis
                    </Button>
                    <Button variant="outline" className="w-full h-9 text-xs font-bold gap-2 text-slate-700 bg-white">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Use in PR
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Vendor Snapshot */}
              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vendor snapshot</h3>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold gap-1 text-slate-400">Open <Plus className="w-2.5 h-2.5" /></Button>
                  </div>

                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm">SS</div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{vendor?.company_name}</h4>
                      <p className="text-[10px] text-slate-400 font-medium italic">Strategic · Snacks & Confectionery</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-5">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">SCORE / 100</p>
                      <p className="text-sm font-bold text-slate-900">92 <span className="text-emerald-500 font-bold ml-1 text-[10px]">▲ +3</span></p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">ON-TIME</p>
                      <p className="text-sm font-bold text-slate-900">96%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">RISK</p>
                      <p className="text-sm font-bold text-slate-400 italic">Low - L1</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">LEAD TIME</p>
                      <p className="text-sm font-bold text-slate-900">4 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price history */}
              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4">Price history <span className="font-normal text-slate-400 lowercase italic">Top 4 SKUs</span></h3>

                  <div className="space-y-4">
                    {items.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-900 truncate">{item.item_name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">avg ₹735</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-black text-slate-900">₹{item.price_per_unit.toLocaleString()}</div>
                          <div className="text-[9px] font-bold text-emerald-600">-3.1%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'ai-analysis' && <AIAnalysisPanel quotation={quotation} />}

      {activeTab === 'price-compare' && (
        <Card className="p-12 text-center shadow-sm border-slate-200 bg-slate-50/30">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900">Price Comparison</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Comparing this quotation against historical and market benchmarks to ensure optimal pricing.
              </p>
            </div>
            <Badge variant="outline" className="bg-white text-primary border-primary/20">Coming Soon</Badge>
          </div>
        </Card>
      )}

      {activeTab === 'document' && (
        <Card className="h-[800px] shadow-sm border-slate-200 overflow-hidden">
          {quotation.pdf_url ? (
            <iframe src={quotation.pdf_url} className="w-full h-full border-none" title="Quotation Document" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No document available</div>
          )}
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card className="shadow-sm border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-6">Activity Log</h3>
          <div className="space-y-6">
            {[
              { time: 'Just now', action: 'Quotation verified by AI Agent', user: 'system' },
              { time: '2 hours ago', action: 'Vendor details updated', user: 'Asha R.' },
              { time: 'May 14, 2026', action: 'Document uploaded via email', user: 'system' }
            ].map((log, i) => (
              <div key={i} className="flex gap-4 relative">
                {i < 2 && <div className="absolute left-[11px] top-6 bottom-[-24px] w-[2px] bg-slate-100" />}
                <div className="h-6 w-6 rounded-full bg-primary/10 border-4 border-white shadow-sm flex items-center justify-center shrink-0 z-10">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900">{log.action}</p>
                  <p className="text-[10px] text-muted-foreground">{log.time} · {log.user}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals & Dialogs (Hidden by default) */}
      <Dialog open={addItemOpen} onOpenChange={(open) => { setAddItemOpen(open); if (!open) setItemSearch('') }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by code or description…"
                className="pl-9"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
              {searchingItems && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="border rounded-md max-h-72 overflow-auto divide-y">
              {itemSearch.trim().length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">Start typing to search master items.</p>
              ) : !itemSearchResults || itemSearchResults.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  {searchingItems ? 'Searching…' : 'No items found.'}
                </p>
              ) : (
                itemSearchResults.map((item: any) => {
                  const alreadyAdded = editItems.some(it => it.master_item_id === item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addMasterItem(item)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-3"
                    >
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{item.code}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">{item.description}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.unit_of_measure}
                          {item.unit_rate ? <> · ₹{Number(item.unit_rate).toLocaleString('en-IN')}</> : null}
                          {item.hsn_code ? <> · HSN {item.hsn_code}</> : null}
                        </span>
                      </span>
                      {alreadyAdded && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 mt-1">Added</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Line Item Confirm */}
      <DeleteDialog
        open={deleteItemOpen}
        onOpenChange={(open) => {
          setDeleteItemOpen(open)
          if (!open) setPendingDeleteIndex(null)
        }}
        onConfirm={confirmRemoveEditItem}
      />

      {/* Full Edit Overlay */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Quotation Header</DialogTitle>
            <DialogDescription>Modify global header details, plant/department, and terms.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 my-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quotation No</label>
              <Input value={editQuotationNo} onChange={e => setEditQuotationNo(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quotation Date</label>
              <Input type="date" value={editQuotationDate} onChange={e => setEditQuotationDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Plant</label>
              <select
                className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1"
                value={editPlantId}
                onChange={e => setEditPlantId(e.target.value)}
              >
                <option value="">— Not specified —</option>
                {plants.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Department</label>
              <select
                className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background mt-1"
                value={editDepartmentId}
                onChange={e => setEditDepartmentId(e.target.value)}
              >
                <option value="">— Not specified —</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Terms & Conditions</label>
              <textarea
                className="w-full min-h-[160px] border rounded-md p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="One term per line"
                value={editTerms}
                onChange={e => setEditTerms(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit} className="h-10 px-6">Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="h-10 px-8 bg-slate-900">
              {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
