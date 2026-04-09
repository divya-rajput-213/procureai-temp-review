'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Loader2, Save, Search, AlertTriangle } from 'lucide-react'
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
  freight_amount: z.number().optional(),
  discount_amount: z.number().optional(),
  // Tooling
  advance_schedule: z.record(z.number()).optional(),
  // Import
  exchange_rate: z.number().optional().nullable(),
  customs_duty_rate: z.number().optional().nullable(),
  freight_insurance: z.number().optional().nullable(),
})

type FormData = z.infer<typeof schema>

export default function EditPurchaseOrderPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [vendorSearch, setVendorSearch] = useState('')
  const [formReady, setFormReady] = useState(false)

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => { const { data } = await apiClient.get(`/purchase-orders/${id}/`); return data },
    enabled: !!id,
  })

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
  })
  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved'],
    queryFn: async () => { const r = await apiClient.get('/budget/tracking-ids/?status=approved'); return r.data.results ?? r.data },
  })

  // Populate form when PO + reference data loads
  useEffect(() => {
    if (!po || formReady) return
    reset({
      po_type: po.po_type || '',
      vendor: po.vendor,
      plant: po.plant,
      department: po.department,
      tracking_id: po.tracking_id || null,
      currency_code: po.currency_code || 'INR',
      payment_terms: po.payment_terms || '',
      incoterms: po.incoterms || '',
      delivery_address: po.delivery_address || '',
      notes: po.notes || '',
      freight_amount: po.freight_amount ? Number(po.freight_amount) : 0,
      discount_amount: po.discount_amount ? Number(po.discount_amount) : 0,
      advance_schedule: po.advance_schedule || {},
      exchange_rate: po.exchange_rate ? Number(po.exchange_rate) : null,
      customs_duty_rate: po.customs_duty_rate ? Number(po.customs_duty_rate) : null,
      freight_insurance: po.freight_insurance ? Number(po.freight_insurance) : null,
    })
    setFormReady(true)
  }, [po, formReady, reset])

  const selectedVendorId = watch('vendor')
  const selectedPoType = watch('po_type')
  const selectedTrackingId = watch('tracking_id')

  // Tax + budget
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))
  const combinedTaxRate = activeTaxes.reduce((s, t) => s + t.rate, 0)
  const lineItems: any[] = po?.line_items || []
  const subtotal = lineItems.reduce((s: number, li: any) => s + (Number(li.quantity) || 0) * (Number(li.unit_rate) || 0), 0)
  const totalTax = lineItems.reduce((s: number, li: any) => s + (Number(li.tax_amount) || 0), 0)
  const grandTotal = Number(po?.total_amount || 0)

  const selectedTracking = (trackingIds || []).find((t: any) => t.id === selectedTrackingId)
  const budgetRemaining = selectedTracking ? (Number(selectedTracking.approved_amount || 0) - Number(selectedTracking.consumed_amount || 0)) : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  // Vendor search
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

  const vendorDisplayName = po?.vendor_name || ''
  const selectedVendorFromSearch = (vendors || []).find((v: any) => v.id === selectedVendorId)

  // Tooling advance schedule
  const [advSchedule, setAdvSchedule] = useState({ po: 30, approval: 60, delivery: 10 })
  useEffect(() => {
    if (po?.advance_schedule && Object.keys(po.advance_schedule).length) {
      setAdvSchedule({
        po: po.advance_schedule.po || 0,
        approval: po.advance_schedule.approval || 0,
        delivery: po.advance_schedule.delivery || 0,
      })
    }
  }, [po])

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: resp } = await apiClient.patch(`/purchase-orders/${id}/`, data)
      return resp
    },
    onSuccess: () => {
      toast({ title: 'Purchase order updated' })
      router.push(`/purchase-orders/${id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string' ? detail
        : detail?.detail || detail?.error || detail?.non_field_errors?.[0]
        || Object.values(detail || {}).flat().join(', ') || 'Failed to update'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }
  if (!po) {
    return <div className="text-center py-12 text-muted-foreground">Purchase order not found.</div>
  }
  if (po.status !== 'draft' && po.status !== 'pending_approval') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Only draft or pending-approval POs can be edited.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/purchase-orders/${id}`)}>Back to PO</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-xl font-semibold">Edit {po.po_number}</h1>
          <p className="text-sm text-muted-foreground">{vendorDisplayName}</p>
        </div>
        <Badge variant="secondary" className="ml-2">{po.status}</Badge>
      </div>

      <form onSubmit={handleSubmit(data => updateMutation.mutate(data))} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PO Type *</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" {...register('po_type')}>
                  <option value="">Select PO type</option>
                  {PO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {errors.po_type && <p className="text-xs text-destructive mt-1">{errors.po_type.message}</p>}
              </div>
              <div>
                <Label>Currency</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" {...register('currency_code')}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Vendor */}
            {selectedVendorId && !vendorSearch ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <div>
                  <p className="font-medium">{selectedVendorFromSearch?.company_name || vendorDisplayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedVendorFromSearch ? `${selectedVendorFromSearch.vendor_code} · ${selectedVendorFromSearch.city}, ${selectedVendorFromSearch.state}` : (po.vendor_hash_id || '')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" type="button" onClick={() => setVendorSearch(' ')}>Change</Button>
              </div>
            ) : (
              <div>
                <Label>Search Vendor *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Type vendor name..." value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} />
                </div>
                {errors.vendor && <p className="text-xs text-destructive mt-1">{errors.vendor.message}</p>}
                {vendors && vendors.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {vendors.map((v: any) => (
                      <button key={v.id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setValue('vendor', v.id, { shouldDirty: true }); setVendorSearch('') }}>
                        <p className="font-medium">{v.company_name}</p>
                        <p className="text-xs text-muted-foreground">{v.vendor_code} · {v.city}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location & Terms */}
        <Card>
          <CardHeader><CardTitle className="text-base">Location & Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Plant *</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" {...register('plant', { valueAsNumber: true })}>
                  <option value="">Select plant</option>
                  {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.plant && <p className="text-xs text-destructive mt-1">{errors.plant.message}</p>}
              </div>
              <div>
                <Label>Department *</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" {...register('department', { valueAsNumber: true })}>
                  <option value="">Select department</option>
                  {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.department && <p className="text-xs text-destructive mt-1">{errors.department.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Payment Terms</Label>
                <Input {...register('payment_terms')} placeholder="e.g. Net 30 days" />
              </div>
              <div>
                <Label>Incoterms</Label>
                <Input {...register('incoterms')} placeholder="e.g. FOB, CIF" />
              </div>
            </div>
            <div>
              <Label>Delivery Address</Label>
              <Input {...register('delivery_address')} placeholder="Delivery location / warehouse" />
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
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
                  PO total {formatCurrency(grandTotal)} exceeds remaining budget {formatCurrency(budgetRemaining ?? 0)}.
                </p>
              </div>
            )}
            {budgetRemaining !== null && !budgetExceeded && (
              <p className="text-xs text-muted-foreground">Budget remaining: <span className="font-medium text-emerald-700">{formatCurrency(budgetRemaining)}</span></p>
            )}
          </CardContent>
        </Card>

        {/* Tooling PO — Advance Schedule */}
        {selectedPoType === 'ZT' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Advance Payment Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Percentages must sum to 100%.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">% at PO Issuance</Label>
                  <Input type="number" min="0" max="100" className="h-9" value={advSchedule.po}
                    onChange={e => { const v = Number(e.target.value) || 0; setAdvSchedule(p => ({ ...p, po: v })); setValue('advance_schedule', { ...advSchedule, po: v }, { shouldDirty: true }) }} />
                </div>
                <div>
                  <Label className="text-xs">% on Approval</Label>
                  <Input type="number" min="0" max="100" className="h-9" value={advSchedule.approval}
                    onChange={e => { const v = Number(e.target.value) || 0; setAdvSchedule(p => ({ ...p, approval: v })); setValue('advance_schedule', { ...advSchedule, approval: v }, { shouldDirty: true }) }} />
                </div>
                <div>
                  <Label className="text-xs">% on Delivery</Label>
                  <Input type="number" min="0" max="100" className="h-9" value={advSchedule.delivery}
                    onChange={e => { const v = Number(e.target.value) || 0; setAdvSchedule(p => ({ ...p, delivery: v })); setValue('advance_schedule', { ...advSchedule, delivery: v }, { shouldDirty: true }) }} />
                </div>
              </div>
              {(() => {
                const total = advSchedule.po + advSchedule.approval + advSchedule.delivery
                return total !== 100
                  ? <p className="text-xs text-destructive">Total is {total}% — must equal 100%.</p>
                  : <p className="text-xs text-emerald-600">Total: 100%</p>
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
                  <Input type="number" step="0.0001" placeholder="e.g. 83.25" {...register('exchange_rate', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Customs Duty Rate (%)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 10" {...register('customs_duty_rate', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Freight & Insurance</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...register('freight_insurance', { valueAsNumber: true })} />
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
                    <div className="flex justify-between"><span className="text-muted-foreground">Customs ({customsRate}%)</span><span>{formatCurrency(customsAmt)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Freight & Insurance</span><span>{formatCurrency(freight)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-bold"><span>Landed Cost</span><span>{formatCurrency(landed)}</span></div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Amounts */}
        <Card>
          <CardHeader><CardTitle className="text-base">Adjustments</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Freight Amount</Label>
                <Input type="number" step="0.01" {...register('freight_amount', { valueAsNumber: true })} />
              </div>
              <div>
                <Label>Discount Amount</Label>
                <Input type="number" step="0.01" {...register('discount_amount', { valueAsNumber: true })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items (read-only) */}
        {lineItems.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Line Items ({lineItems.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 font-medium">Item / Description</th>
                      <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
                      <th className="text-left px-3 py-2 font-medium w-20">UOM</th>
                      <th className="text-right px-3 py-2 font-medium w-32">Unit Rate</th>
                      <th className="text-right px-3 py-2 font-medium w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((li: any, idx: number) => {
                      const amount = (Number(li.quantity) || 0) * (Number(li.unit_rate) || 0)
                      return (
                        <tr key={li.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium">{li.item_code_detail?.code ?? '—'}</span>
                            {li.description && <span className="block text-xs text-muted-foreground mt-0.5">{li.description}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">{li.quantity}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{li.unit_of_measure}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(li.unit_rate)}</td>
                          <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t">
                      <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(subtotal)}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Tax ({combinedTaxRate}%)</td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(totalTax)}</td>
                    </tr>
                    <tr className="bg-slate-100 border-t-2">
                      <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold">Total</td>
                      <td className="px-3 py-2.5 text-right font-bold text-base">{formatCurrency(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
          <Button type="button" variant="outline" onClick={() => router.push(`/purchase-orders/${id}`)}>Cancel</Button>
          <Button type="submit" disabled={updateMutation.isPending || !isDirty} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
