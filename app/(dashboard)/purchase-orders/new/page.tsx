'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, Save, Search, Plus, Trash2,
  Sparkles, AlertTriangle, Star, MapPin,
} from 'lucide-react'
import apiClient from '@/lib/api/client'
import { formatCurrency } from '@/lib/utils'
import { useSettingsStore } from '@/lib/stores/settings.store'

const PO_TYPES = [
  { value: 'NB', label: 'Standard PO' },
  { value: 'FO', label: 'Blanket / Framework Order' },
  { value: 'RO', label: 'Release Order' },
  { value: 'SV', label: 'Service PO' },
  { value: 'ZT', label: 'Tooling / Capex PO' },
  { value: 'IM', label: 'Import PO' },
  { value: 'SC', label: 'Subcontract PO' },
]

const lineItemSchema = z.object({
  item_code: z.number({ required_error: 'Select an item' }),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number({ invalid_type_error: 'Enter quantity' }).min(0.01),
  unit_of_measure: z.string().min(1, 'UOM required'),
  unit_rate: z.number({ invalid_type_error: 'Enter rate' }).min(0.01),
  delivery_date: z.string().optional(),
  hsn_code: z.string().optional(),
  tax_rate: z.number().optional(),
})

const schema = z.object({
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
  justification: z.string().optional(),
  // Tooling PO
  advance_schedule: z.record(z.number()).optional(),
  // Import PO
  exchange_rate: z.number().optional().nullable(),
  customs_duty_rate: z.number().optional().nullable(),
  freight_insurance: z.number().optional().nullable(),
  line_items_data: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type FormData = z.infer<typeof schema>

type PrefillResult = {
  contract_found: boolean
  contract: { contract_id: string; payment_terms: string; incoterms: string; end_date: string } | null
  vendor_suggestion: { id: number; company_name: string; vendor_code: string; performance_score: number; risk_score: number; city: string; state: string; lead_time: number; payment_terms: string }[] | null
  line_prefills: { item_code_id: number; item_code: string; description: string; unit_of_measure: string; unit_rate: number; hsn_code: string; last_purchase_rate?: number; last_po_number?: string; price_warning?: boolean; price_variance_pct?: number }[]
  price_warnings: { item_code: string; current_rate: number; last_rate: number; variance_pct: number; last_po: string }[]
  suggested_delivery_date: string | null
  delivery_lead_days?: number
  payment_terms: string
  incoterms: string
  cost_center: string
  plant_id: number | null
  department_id: number | null
  delivery_address: string
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [vendorSearch, setVendorSearch] = useState('')
  const [itemSearches, setItemSearches] = useState<Record<number, string>>({})
  const [itemLabels, setItemLabels] = useState<Record<number, string>>({})
  const [showItemDropdown, setShowItemDropdown] = useState<number | null>(null)
  const [prefill, setPrefill] = useState<PrefillResult | null>(null)
  const [prefilling, setPrefilling] = useState(false)
  const [prLinked] = useState(() => searchParams.get('pr_id'))

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency_code: 'INR',
      po_type: '',
      justification: '',
      line_items_data: [{ item_code: undefined as any, description: '', quantity: 1, unit_of_measure: 'NOS', unit_rate: 0, delivery_date: '', hsn_code: '', tax_rate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items_data' })

  const selectedVendorId = watch('vendor')
  const selectedPlantId = watch('plant')
  const selectedPoType = watch('po_type')
  const selectedTrackingId = watch('tracking_id')
  const watchedItems = watch('line_items_data')
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))
  const combinedTaxRate = activeTaxes.reduce((s, t) => s + t.rate, 0)
  const subtotal = (watchedItems ?? []).reduce((s: number, li: any) => s + ((Number(li?.quantity) || 0) * (Number(li?.unit_rate) || 0)), 0)
  const taxTotal = subtotal * (combinedTaxRate / 100)
  const grandTotal = subtotal + taxTotal

  // Tooling PO advance schedule state
  const [advSchedule, setAdvSchedule] = useState({ po: 30, approval: 60, delivery: 10 })

  // Budget tracking
  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved'],
    queryFn: async () => { const r = await apiClient.get('/budget/tracking-ids/?status=approved'); return r.data.results ?? r.data },
  })
  const selectedTracking = (trackingIds || []).find((t: any) => t.id === selectedTrackingId)
  const budgetRemaining = selectedTracking ? (Number(selectedTracking.approved_amount || 0) - Number(selectedTracking.consumed_amount || 0)) : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
  })

  const normalizedVendorSearch = vendorSearch.trim()
  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved', normalizedVendorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (normalizedVendorSearch) params.set('search', normalizedVendorSearch)
      const r = await apiClient.get(`/vendors/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: normalizedVendorSearch.length >= 2,
  })

  const selectedVendor = (vendors || []).find((v: any) => v.id === selectedVendorId)

  // ── AI Pre-fill trigger ───────────────────────────────────────────────────

  const runAIPrefill = useCallback(async (vendorId?: number, itemCodeIds?: number[]) => {
    setPrefilling(true)
    try {
      const body: Record<string, any> = {}
      if (vendorId) body.vendor_id = vendorId
      if (itemCodeIds?.length) body.item_code_ids = itemCodeIds
      if (selectedPlantId) body.plant_id = selectedPlantId
      if (prLinked) body.pr_id = prLinked

      const { data } = await apiClient.post('/purchase-orders/ai-prefill/', body)
      setPrefill(data)

      // Auto-fill form fields from AI suggestions
      if (data.plant_id && !watch('plant')) {
        setValue('plant', data.plant_id)
      }
      if (data.department_id && !watch('department')) {
        setValue('department', data.department_id)
      }
      if (data.payment_terms && !watch('payment_terms')) {
        setValue('payment_terms', data.payment_terms)
      }
      if (data.incoterms && !watch('incoterms')) {
        setValue('incoterms', data.incoterms)
      }
      if (data.delivery_address && !watch('delivery_address')) {
        setValue('delivery_address', data.delivery_address)
      }
      if (data.suggested_delivery_date) {
        // Apply suggested delivery date to all line items that don't have one
        fields.forEach((_, idx) => {
          const current = watch(`line_items_data.${idx}.delivery_date`)
          if (!current) {
            setValue(`line_items_data.${idx}.delivery_date`, data.suggested_delivery_date)
          }
        })
      }
      // Apply line-level prefills (rate from contract / last purchase)
      if (data.line_prefills?.length) {
        data.line_prefills.forEach((lp: any) => {
          const idx = fields.findIndex((_, i) => watch(`line_items_data.${i}.item_code`) === lp.item_code_id)
          if (idx >= 0 && lp.unit_rate) {
            setValue(`line_items_data.${idx}.unit_rate`, lp.unit_rate)
            if (lp.hsn_code) setValue(`line_items_data.${idx}.hsn_code`, lp.hsn_code)
          }
        })
      }

      if (data.contract_found) {
        toast({ title: 'Active contract found — prices & terms pre-filled' })
      } else if (data.vendor_suggestion?.length) {
        toast({ title: `${data.vendor_suggestion.length} vendors suggested by AI` })
      }
    } catch {
      // silent — non-critical
    } finally {
      setPrefilling(false)
    }
  }, [selectedPlantId, prLinked, fields, watch, setValue, toast])

  // Trigger AI pre-fill when vendor is selected
  useEffect(() => {
    if (selectedVendorId) {
      const itemCodeIds = fields
        .map((_, i) => watch(`line_items_data.${i}.item_code`))
        .filter(Boolean) as number[]
      runAIPrefill(selectedVendorId, itemCodeIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId])

  // Trigger vendor suggestions when no vendor but plant selected
  useEffect(() => {
    if (!selectedVendorId && selectedPlantId) {
      runAIPrefill(undefined, [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlantId])

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = { ...data, trigger_source: prLinked ? 'pr_linked' : 'manual' }
      if (prLinked) payload.purchase_requisition = Number(prLinked)
      const { data: resp } = await apiClient.post('/purchase-orders/', payload)
      return resp
    },
    onSuccess: (resp) => {
      toast({ title: 'Purchase order created successfully' })
      router.push(`/purchase-orders/${resp.hash_id ?? resp.id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string' ? detail
        : detail?.detail || detail?.error || Object.values(detail || {}).flat().join(', ') || 'Failed to create'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const showJustification = !prLinked

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold">New Purchase Order</h1>
        {prLinked && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">PR-linked</span>
        )}
      </div>

      {/* AI Pre-fill status */}
      {prefilling && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          AI is analysing contracts, history & vendor data...
        </div>
      )}

      {/* Contract found banner */}
      {prefill?.contract_found && prefill.contract && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <Sparkles className="w-4 h-4 text-green-600" />
          <div className="text-sm">
            <span className="font-medium text-green-800">Active contract found:</span>{' '}
            <span className="text-green-700">{prefill.contract.contract_id}</span>
            <span className="text-green-600 ml-2">
              (expires {prefill.contract.end_date}) — prices, payment terms & incoterms pre-filled
            </span>
          </div>
        </div>
      )}

      {/* Price variance warnings */}
      {(prefill?.price_warnings?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Price Variance Alerts</span>
          </div>
          <div className="space-y-1">
            {prefill!.price_warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">
                <span className="font-mono font-medium">{w.item_code}</span>: current rate{' '}
                {formatCurrency(w.current_rate)} vs last purchase {formatCurrency(w.last_rate)} on {w.last_po}{' '}
                <span className="font-semibold">({w.variance_pct > 0 ? '+' : ''}{w.variance_pct}%)</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* AI Vendor Suggestions (when no vendor selected) */}
      {!selectedVendorId && (prefill?.vendor_suggestion?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">AI Vendor Suggestions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {prefill!.vendor_suggestion!.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{v.company_name}
                      <span className="ml-2 text-xs text-muted-foreground font-normal">{v.vendor_code}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {v.city}, {v.state}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="w-3 h-3" /> Score: {v.performance_score ?? '—'}
                      </span>
                      {v.lead_time && (
                        <span className="text-xs text-muted-foreground">Lead: {v.lead_time}d</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" type="button"
                    onClick={() => { setValue('vendor', v.id); setVendorSearch('') }}>
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(data => createMutation.mutate(data))} className="space-y-6">
        {/* PO Type + Vendor */}
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PO Type *</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  {...register('po_type')}>
                  <option value="">Select PO type</option>
                  {PO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {errors.po_type && <p className="text-xs text-destructive mt-1">{errors.po_type.message}</p>}
              </div>
              <div>
                <Label>Currency</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  {...register('currency_code')}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Vendor */}
            {selectedVendor ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <div>
                  <p className="font-medium">{selectedVendor.company_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedVendor.vendor_code} &middot; {selectedVendor.city}, {selectedVendor.state}</p>
                </div>
                <Button variant="ghost" size="sm" type="button"
                  onClick={() => { setValue('vendor', undefined as any); setVendorSearch(''); setPrefill(null) }}>Change</Button>
              </div>
            ) : (
              <div>
                <Label>Search Vendor *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Type vendor name..."
                    value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} />
                </div>
                {errors.vendor && <p className="text-xs text-destructive mt-1">{errors.vendor.message}</p>}
                {vendors && vendors.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {vendors.map((v: any) => (
                      <button key={v.id} type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setValue('vendor', v.id); setVendorSearch('') }}>
                        <p className="font-medium">{v.company_name}</p>
                        <p className="text-xs text-muted-foreground">{v.vendor_code} &middot; {v.city}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plant, Dept, Terms */}
        <Card>
          <CardHeader><CardTitle className="text-base">Location & Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Plant * {prefill?.plant_id && <span className="text-xs text-green-600 ml-1">(auto-filled)</span>}</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  {...register('plant', { valueAsNumber: true })}>
                  <option value="">Select plant</option>
                  {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.plant && <p className="text-xs text-destructive mt-1">{errors.plant.message}</p>}
              </div>
              <div>
                <Label>Department * {prefill?.department_id && <span className="text-xs text-green-600 ml-1">(auto-filled)</span>}</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  {...register('department', { valueAsNumber: true })}>
                  <option value="">Select department</option>
                  {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.department && <p className="text-xs text-destructive mt-1">{errors.department.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Payment Terms {prefill?.contract_found && <span className="text-xs text-green-600 ml-1">(from contract)</span>}</Label>
                <Input {...register('payment_terms')} placeholder="e.g. Net 30 days" />
              </div>
              <div>
                <Label>Incoterms {prefill?.contract_found && <span className="text-xs text-green-600 ml-1">(from contract)</span>}</Label>
                <Input {...register('incoterms')} placeholder="e.g. FOB, CIF" />
              </div>
            </div>
            {prefill?.suggested_delivery_date && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI suggested delivery date: <span className="font-medium">{prefill.suggested_delivery_date}</span>
                {prefill.delivery_lead_days && <span>(vendor avg lead time: {prefill.delivery_lead_days} days)</span>}
              </p>
            )}
            <div>
              <Label>Delivery Address</Label>
              <Input {...register('delivery_address')} placeholder="Delivery location / warehouse" />
            </div>
          </CardContent>
        </Card>

        {/* Budget Tracking */}
        <Card>
          <CardHeader><CardTitle className="text-base">Budget</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Tracking ID / Cost Center</Label>
              <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                {...register('tracking_id', { setValueAs: v => v ? Number(v) : null })}>
                <option value="">None (no budget link)</option>
                {(trackingIds || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.tracking_code} — {t.description} (Remaining: {formatCurrency((Number(t.approved_amount || 0) - Number(t.consumed_amount || 0)))})
                  </option>
                ))}
              </select>
            </div>
            {budgetExceeded && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-700">
                  Requested amount {formatCurrency(grandTotal)} exceeds remaining budget {formatCurrency(budgetRemaining ?? 0)}
                  {selectedTracking && <span> for cost center {selectedTracking.tracking_code}</span>}.
                  Reduce quantity or request a budget revision.
                </p>
              </div>
            )}
            {budgetRemaining !== null && !budgetExceeded && (
              <p className="text-xs text-muted-foreground">
                Budget remaining: <span className="font-medium text-emerald-700">{formatCurrency(budgetRemaining)}</span>
                {grandTotal > 0 && <span> (after this PO: {formatCurrency(budgetRemaining - grandTotal)})</span>}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tooling PO — Advance Payment Schedule */}
        {selectedPoType === 'ZT' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Advance Payment Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Define payment milestones. Percentages must sum to 100%.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">% at PO Issuance</Label>
                  <Input type="number" min="0" max="100" step="1" className="h-9"
                    value={advSchedule.po}
                    onChange={e => {
                      const v = Number(e.target.value) || 0
                      setAdvSchedule(prev => ({ ...prev, po: v }))
                      setValue('advance_schedule', { ...advSchedule, po: v })
                    }} />
                </div>
                <div>
                  <Label className="text-xs">% on Approval / Inspection</Label>
                  <Input type="number" min="0" max="100" step="1" className="h-9"
                    value={advSchedule.approval}
                    onChange={e => {
                      const v = Number(e.target.value) || 0
                      setAdvSchedule(prev => ({ ...prev, approval: v }))
                      setValue('advance_schedule', { ...advSchedule, approval: v })
                    }} />
                </div>
                <div>
                  <Label className="text-xs">% on Delivery</Label>
                  <Input type="number" min="0" max="100" step="1" className="h-9"
                    value={advSchedule.delivery}
                    onChange={e => {
                      const v = Number(e.target.value) || 0
                      setAdvSchedule(prev => ({ ...prev, delivery: v }))
                      setValue('advance_schedule', { ...advSchedule, delivery: v })
                    }} />
                </div>
              </div>
              {(() => {
                const total = advSchedule.po + advSchedule.approval + advSchedule.delivery
                return total !== 100 ? (
                  <p className="text-xs text-destructive">Total is {total}% — must equal 100%.</p>
                ) : (
                  <p className="text-xs text-emerald-600">Total: 100%</p>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Import PO — Currency & Duties */}
        {selectedPoType === 'IM' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Import Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Exchange Rate</Label>
                  <Input type="number" step="0.0001" placeholder="e.g. 83.25"
                    {...register('exchange_rate', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Customs Duty Rate (%)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 10"
                    {...register('customs_duty_rate', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Freight & Insurance</Label>
                  <Input type="number" step="0.01" placeholder="0.00"
                    {...register('freight_insurance', { valueAsNumber: true })} />
                </div>
              </div>
              {(() => {
                const customsRate = Number(watch('customs_duty_rate')) || 0
                const freight = Number(watch('freight_insurance')) || 0
                const customsAmt = subtotal * (customsRate / 100)
                const landed = subtotal + customsAmt + freight
                return (
                  <div className="bg-slate-50 border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Base Amount</span><span>{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Customs Duty ({customsRate}%)</span><span>{formatCurrency(customsAmt)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Freight & Insurance</span><span>{formatCurrency(freight)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-bold"><span>Landed Cost</span><span>{formatCurrency(landed)}</span></div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Line Items</CardTitle>
              <div className="flex items-center gap-2">
                {selectedVendorId && fields.some((_, i) => watch(`line_items_data.${i}.item_code`)) && (
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs"
                    disabled={prefilling}
                    onClick={() => {
                      const ids = fields.map((_, i) => watch(`line_items_data.${i}.item_code`)).filter(Boolean) as number[]
                      if (ids.length) runAIPrefill(selectedVendorId, ids)
                    }}>
                    <Sparkles className="w-3.5 h-3.5" /> Re-run AI Prefill
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0"
                  onClick={() => append({ item_code: undefined as any, description: '', quantity: 1, unit_of_measure: 'NOS', unit_rate: 0, delivery_date: '', hsn_code: '', tax_rate: 0 })}>
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {errors.line_items_data?.root && (
              <p className="text-xs text-destructive mb-2">{errors.line_items_data.root.message}</p>
            )}

            {/* Price variance warnings */}
            {(prefill?.price_warnings?.length ?? 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">Price Variance Alerts</span>
                </div>
                {prefill!.price_warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    <span className="font-mono font-medium">{w.item_code}</span>: current {formatCurrency(w.current_rate)} vs last {formatCurrency(w.last_rate)} on {w.last_po}{' '}
                    <span className="font-semibold">({w.variance_pct > 0 ? '+' : ''}{w.variance_pct}%)</span>
                  </p>
                ))}
              </div>
            )}

            <div className="border border-border rounded-lg overflow-visible">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[40%]">Item <span className="text-destructive">*</span></th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">Qty <span className="text-destructive">*</span></th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">UOM</th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[15%]">Rate <span className="text-destructive">*</span></th>
                    <th className="px-2 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide w-[15%]">Amount</th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fields.map((field, idx) => {
                    const activeSearch = showItemDropdown === idx ? (itemSearches[idx] ?? '') : ''
                    return (
                      <tr key={field.id} className="group">
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input
                              placeholder="Search item..."
                              value={itemSearches[idx] ?? (watch(`line_items_data.${idx}.item_code`) ? (itemLabels[idx] || watch(`line_items_data.${idx}.description`) || '') : '')}
                              onChange={e => { setItemSearches(prev => ({ ...prev, [idx]: e.target.value })); setShowItemDropdown(idx) }}
                              onFocus={() => setShowItemDropdown(idx)}
                              onBlur={() => setTimeout(() => setShowItemDropdown(null), 200)}
                              className="h-8 text-xs"
                            />
                            {showItemDropdown === idx && (
                              <ItemSearchDropdown
                                search={activeSearch}
                                onSelect={(item) => {
                                  const dupeIdx = (watchedItems ?? []).findIndex((li, i) => i !== idx && li.item_code === item.id)
                                  if (dupeIdx !== -1) {
                                    toast({ title: 'Duplicate item', description: `"${item.code} — ${item.description}" is already added in row ${dupeIdx + 1}.`, variant: 'destructive' })
                                    setShowItemDropdown(null)
                                    return
                                  }
                                  setValue(`line_items_data.${idx}.item_code`, item.id)
                                  setValue(`line_items_data.${idx}.description`, item.description)
                                  setValue(`line_items_data.${idx}.unit_of_measure`, item.unit_of_measure ?? 'EA')
                                  if (item.unit_rate) setValue(`line_items_data.${idx}.unit_rate`, Number(item.unit_rate))
                                  setValue(`line_items_data.${idx}.hsn_code`, item.sap_material_code || '')
                                  setItemLabels(prev => ({ ...prev, [idx]: `${item.code} — ${item.description}` }))
                                  setShowItemDropdown(null)
                                }}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min="0.01" step="0.01" placeholder="1" className="h-8 text-xs"
                            {...register(`line_items_data.${idx}.quantity`, { valueAsNumber: true })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input placeholder="EA" className="h-8 text-xs"
                            {...register(`line_items_data.${idx}.unit_of_measure`)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min="0.01" step="0.01" placeholder="0.00" className="h-8 text-xs"
                            {...register(`line_items_data.${idx}.unit_rate`, { valueAsNumber: true })} />
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm font-medium text-muted-foreground">
                          {formatCurrency((Number(watchedItems?.[idx]?.quantity) || 0) * (Number(watchedItems?.[idx]?.unit_rate) || 0))}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                        {/* Hidden fields */}
                        <input type="hidden" {...register(`line_items_data.${idx}.item_code`, { valueAsNumber: true })} />
                        <input type="hidden" {...register(`line_items_data.${idx}.description`)} />
                        <input type="hidden" {...register(`line_items_data.${idx}.hsn_code`)} />
                        <input type="hidden" {...register(`line_items_data.${idx}.tax_rate`, { valueAsNumber: true })} />
                        <input type="hidden" {...register(`line_items_data.${idx}.delivery_date`)} />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border border-border rounded-lg overflow-hidden mt-2">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</td>
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(subtotal)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Tax ({combinedTaxRate}%)</td>
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(taxTotal)}</td>
                  </tr>
                  <tr className="bg-slate-100 border-t-2">
                    <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold">Total</td>
                    <td className="px-3 py-2.5 text-right font-bold text-base">{formatCurrency(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Justification (manual POs without PR) */}
        {showJustification && (
          <Card>
            <CardHeader><CardTitle className="text-base">Justification *</CardTitle></CardHeader>
            <CardContent>
              <textarea className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-background resize-y"
                placeholder="Provide justification for creating a PO without a linked Purchase Requisition..."
                {...register('justification')} />
              {errors.justification && <p className="text-xs text-destructive mt-1">{errors.justification.message}</p>}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-background resize-y"
              placeholder="Additional notes..." {...register('notes')} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as Draft
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── Item Search Dropdown ───────────────────────────────────────────────────

function ItemSearchDropdown({ search, onSelect }: { search: string; onSelect: (item: any) => void }) {
  const normalized = search.trim()
  const { data: items } = useQuery({
    queryKey: ['item-codes-search', normalized],
    queryFn: async () => {
      const r = await apiClient.get('/procurement/items/', { params: { search: normalized, page_size: 20 } })
      return r.data.results ?? r.data
    },
    enabled: true,
  })

  return (
    <div className="absolute z-50 bottom-full mb-1 left-0 right-0 border rounded-md bg-background shadow-lg max-h-48 overflow-y-auto divide-y">
      {(items || []).map((item: any) => (
        <button key={item.id} type="button" onMouseDown={e => e.preventDefault()}
          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs flex items-center gap-2"
          onClick={() => onSelect(item)}>
          <span className="font-mono bg-slate-100 px-1 rounded">{item.code}</span>
          <span className="truncate">{item.description}</span>
          <span className="ml-auto text-muted-foreground shrink-0">{item.unit_of_measure}</span>
        </button>
      ))}
      {(items || []).length === 0 && (
        <p className="px-3 py-1.5 text-xs text-muted-foreground">No items found.</p>
      )}
    </div>
  )
}
