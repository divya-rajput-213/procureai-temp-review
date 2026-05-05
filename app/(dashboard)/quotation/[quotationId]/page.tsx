'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api/client'
import AIAnalysisPanel from '../new/components/AIAnalysisPanel'
import QuoteDetailsCard from '../new/components/QuoteDetailsCard'
import VendorHeaderCard from '../new/components/VendorHeaderCard'

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
  cgst_rate: number
  sgst_rate: number
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
    cgst_rate: toNumber(taxes.cgst_rate ?? raw.cgst_rate, 9),
    sgst_rate: toNumber(taxes.sgst_rate ?? raw.sgst_rate, 9),
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

export default function QuotationDetailsPage({ params }: Readonly<{ params: { quotationId: string } }>) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
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
  const [editPlantId, setEditPlantId] = useState<string>('')
  const [editDepartmentId, setEditDepartmentId] = useState<string>('')

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
    setAddItemOpen(false)
    setItemSearch('')
  }

  const editMutation = useMutation({
    mutationFn: async () => {
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
    setEditItems(items.map(it => ({ ...it })))
    setEditPlantId(quotation.plant_id ? String(quotation.plant_id) : '')
    setEditDepartmentId(quotation.department_id ? String(quotation.department_id) : '')
    setIsEditing(true)
  }
  const handleDownloadGeneratedPdf = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get(
        `/api/v1/quotations/${quotation?.id}/generate-pdf/`
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
  }

  // Reset edit state if data refetches while not editing (e.g. status changed)
  useEffect(() => {
    if (!isEditing) {
      setEditItems(items.map(it => ({ ...it })))
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
  const grandTotal = quotation?.grand_total ?? subtotal + cgstAmount + sgstAmount

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

  return (
    <div className="space-y-2">
      {/* Page header (title + actions) */}
      <div className="rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-4 bg-slate-50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {(vendor?.company_name || 'Quotation')} — Quote
            </h1>
            <p className="text-sm text-muted-foreground">
              {extractedOn ? `AI-extracted ${extractedOn}` : 'AI-extracted'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start">
            <StatusBadge status={quotation.status} />
            {quotation.status === 'draft' && !isEditing && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={enterEditMode}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {isEditing && (
              <span className="text-xs text-muted-foreground italic">Editing…</span>
            )}
            <select
              className="border rounded-md h-9 px-2 text-sm bg-white"
              onChange={(e) => {
                if (e.target.value === "original") {
                  window.open(quotation.pdf_url, "_blank")
                } else if (e.target.value === "generated") {
                  handleDownloadGeneratedPdf()
                }
                e.target.value = "" // reset
              }}
            >
              <option value="">Download PDF</option>
              {quotation.pdf_url && <option value="original">Original PDF</option>}
              <option value="generated">Generated PDF</option>
            </select>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <div>
          {/* Document */}
          <div className="bg-transparent p-6 shadow-sm text-sm text-foreground">

        {/* Vendor header (shared from new/upload page) */}
        {vendorHeaderData && (
          <div className="-mx-6 -mt-6 mb-4">
            <VendorHeaderCard vendors={vendorHeaderData} category={null} onChangeVendor={() => { }} />
          </div>
        )}

        {/* Plant & Department */}
        {(quotation.plant_name || quotation.department_name || isEditing) && (
          <div className="-mx-6 mb-4">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Plant &amp; Department <span className="font-normal normal-case text-[10px]">(optional)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plant</label>
                  {isEditing ? (
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
                  ) : (
                    <div className="mt-1 h-10 flex items-center px-3 rounded-md bg-muted/30 text-sm font-medium">
                      {quotation.plant_name || <span className="text-muted-foreground font-normal">—</span>}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Department</label>
                  {isEditing ? (
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
                  ) : (
                    <div className="mt-1 h-10 flex items-center px-3 rounded-md bg-muted/30 text-sm font-medium">
                      {quotation.department_name || <span className="text-muted-foreground font-normal">—</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Line Items (styled like new quotation UI) */}
	        <div className="-mx-6 mt-4 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
	          {/* Header */}
	          <div className="flex justify-between items-center px-4 py-3 border-b">
	            <div className="font-semibold text-sm">Line Items</div>

	            <div className="flex items-center gap-2 text-sm">
	              <Button
	                type="button"
	                variant="outline"
	                size="sm"
	                className="h-7 gap-1.5 text-xs"
	                disabled={!isEditing}
	                onClick={() => setAddItemOpen(true)}
	              >
	                <Plus className="h-3.5 w-3.5" />
	                Add Line
	              </Button>
	            </div>
	          </div>

          {/* Table */}
          <div className="max-h-[400px] overflow-auto">
            <div className="min-w-[900px]">
	              <table className="w-full text-sm">
	                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
	                  <tr>
	                    <th className="p-2 text-left">Item</th>
	                    <th className="p-2 text-left">HSN</th>
	                    <th className="p-2 text-left">Qty</th>
	                    <th className="p-2 text-left">Unit</th>
	                    <th className="p-2 text-left">Rate</th>
	                    <th className="p-2 text-left">Amount</th>
	                    {isEditing && <th className="py-2 px-3" />}
	                  </tr>
	                </thead>

	                <tbody>
	                  {displayItems.length === 0 ? (
	                    <tr>
	                      <td colSpan={isEditing ? 7 : 6} className="py-10 text-center text-muted-foreground text-sm">
	                        No line items available.
	                      </td>
	                    </tr>
	                  ) : displayItems.map((item) => {
	                    const globalIndex = displayItems.indexOf(item)
	                    const isMatched = item.master_item_id != null
	                    const lineAmount = isEditing
	                      ? Number(item.quantity || 0) * Number(item.price_per_unit || 0)
	                      : item.amount

	                    return (
	                      <tr key={`${quotation.id}-${item.id ?? item.line_no}`} className="border-t">
	                        <td className="p-2">
	                          <div className="flex items-center gap-2">
	                            {isEditing ? (
	                              <Input
	                                className="h-9 text-sm min-w-[260px]"
	                                value={item.item_name === '—' ? '' : item.item_name}
	                                onChange={e => updateEditItem(globalIndex, { item_name: e.target.value })}
	                                placeholder="Item"
	                              />
	                            ) : (
	                              <span className="font-semibold">{item.item_name}</span>
	                            )}
	                            {!isMatched && (
	                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
	                                New
	                              </span>
	                            )}
                          </div>
                          {item.item_sub_name && (
                            <div className="text-xs text-muted-foreground mt-0.5">({item.item_sub_name})</div>
                          )}
                        </td>

                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              type="text"
                              className="h-9 text-sm w-28"
                              value={item.hsn_sac === '—' ? '' : item.hsn_sac}
                              onChange={e => updateEditItem(globalIndex, { hsn_sac: e.target.value })}
                              placeholder="HSN"
                            />
                          ) : (
                            <span className="text-muted-foreground">{item.hsn_sac}</span>
                          )}
                        </td>

                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              className="h-9 text-sm w-20 text-right"
                              value={item.quantity}
                              onChange={e => updateEditItem(globalIndex, { quantity: Number(e.target.value) })}
                            />
                          ) : (
                            <span className="tabular-nums">{item.quantity}</span>
                          )}
                        </td>

                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              type="text"
                              className="h-9 text-sm w-20"
                              value={item.unit === '—' ? '' : item.unit}
                              onChange={e => updateEditItem(globalIndex, { unit: e.target.value })}
                              placeholder="Unit"
                            />
                          ) : (
                            <span className="text-muted-foreground">{item.unit}</span>
                          )}
                        </td>

                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-9 text-sm w-28 text-right"
                              value={item.price_per_unit}
                              onChange={e => updateEditItem(globalIndex, { price_per_unit: Number(e.target.value) })}
                            />
                          ) : (
                            <span className="tabular-nums">{formatINR(item.price_per_unit)}</span>
                          )}
                        </td>

                        <td className="p-2 tabular-nums">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-9 text-sm w-32 text-right"
                              value={Number(lineAmount || 0)}
                              onChange={e => {
                                const nextAmount = Number(e.target.value)
                                const qty = Number(item.quantity || 0)
                                updateEditItem(globalIndex, {
                                  amount: nextAmount,
                                  price_per_unit: qty > 0 ? nextAmount / qty : 0,
                                })
                              }}
                            />
                          ) : (
                            formatINR(lineAmount)
                          )}
                        </td>

                        {isEditing && (
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeEditItem(globalIndex)}
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        {quotation.amount_in_words && (
          <p className="mt-4">
            <span className="font-bold">Amount in words:</span> {quotation.amount_in_words}
          </p>
        )}

        {/* Footer: Bank + T&C */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 ">
          {/* Bank Details */}
          {/* <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Bank Details</p>
            {vendor?.bank_name ? (
              <div className="rounded-md bg-slate-50 p-3 text-xs space-y-1">
                <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium">{vendor.bank_name}</span>
                  {vendor.bank_account && <>
                    <span className="text-muted-foreground">A/C No.</span>
                    <span className="font-mono">{vendor.bank_account}</span>
                  </>}
                  {vendor.bank_ifsc && <>
                    <span className="text-muted-foreground">IFSC</span>
                    <span className="font-mono">{vendor.bank_ifsc}</span>
                  </>}
                  {vendor.company_name && <>
                    <span className="text-muted-foreground">Holder</span>
                    <span className="font-medium">{vendor.company_name.toUpperCase()}</span>
                  </>}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">—</p>
            )}
          </div> */}

		          {/* Terms & Conditions */}
		          <div className="space-y-2">
		            <p className="font-semibold text-sm">Terms &amp; Conditions</p>
		            {isEditing ? (
		              <textarea
		                className="w-full min-h-[140px] border rounded-md p-2 text-sm bg-white"
		                placeholder="One term per line"
		                value={editTerms}
		                onChange={e => setEditTerms(e.target.value)}
		              />
		            ) : displayTerms.length > 0 ? (
		              <ul className="pl-5 list-disc space-y-1 text-sm text-foreground">
		                {displayTerms.map((term, idx) => (
		                  <li key={`term-${idx}-${term.slice(0, 16)}`}>
		                    {term.replace(/^\d+[).]\s*/, '')}
		                  </li>
		                ))}
		              </ul>
	            ) : (
	              <p className="text-muted-foreground text-xs">—</p>
	            )}
	          </div>
        </div>

        {/* Bottom action bar (edit mode only) */}
        {isEditing && (
          <div className="mt-6 pt-4 border-t flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={editMutation.isPending}
              onClick={cancelEdit}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <AIAnalysisPanel />
          <QuoteDetailsCard quotation={quotation} />
	          {billTo && (
	            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b font-semibold text-sm">
                Billed To
              </div>

              <div>
                {[
                  ['Name', billTo.name],
                  ['Address', billTo.address],
                  ['Ref', billTo.ref],
                  ['Contact', billTo.contact_no],
                  ['Email', billTo.email],
                  ['State', billTo.state],
                  ['GST', billTo.gst_number],
                  ['PAN', billTo.pan_number],
                  ['Plant', billTo.plant_name],
                  ['Plant Code', billTo.plant_code],
                ]
                  .filter(([, value]) => Boolean(String(value ?? '').trim()))
                  .map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="flex justify-between gap-6 px-4 py-2 border-b last:border-none text-sm"
                    >
                      <span className="text-gray-500 shrink-0">{label}</span>
                      <span className="font-semibold text-right break-words">{String(value ?? '—')}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog
        open={addItemOpen}
        onOpenChange={(open) => { setAddItemOpen(open); if (!open) setItemSearch('') }}
      >
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
    </div>
  )
}
