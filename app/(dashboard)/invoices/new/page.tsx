'use client'

import { useState } from 'react'
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
  Upload, FileText, Sparkles, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const INVOICE_TYPES = [
  { value: 'standard', label: 'Standard Invoice' },
  { value: 'proforma', label: 'Proforma Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'advance', label: 'Advance Invoice' },
]

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description required'),
  hsn_code: z.string().optional(),
  quantity: z.number({ invalid_type_error: 'Enter qty' }).min(0.01),
  unit_rate: z.number({ invalid_type_error: 'Enter rate' }).min(0.01),
  tax_rate: z.number().optional().default(0),
  po_line: z.number().nullable().optional(),
  grn_line: z.number().nullable().optional(),
})

const schema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_type: z.string().default('standard'),
  vendor: z.number({ required_error: 'Vendor is required' }),
  po: z.number().nullable().optional(),
  grn: z.number().nullable().optional(),
  invoice_date: z.string().min(1, 'Invoice date required'),
  due_date: z.string().min(1, 'Due date required'),
  subtotal: z.number().optional().default(0),
  cgst_amount: z.number().optional().default(0),
  sgst_amount: z.number().optional().default(0),
  igst_amount: z.number().optional().default(0),
  tax_amount: z.number().optional().default(0),
  tds_amount: z.number().optional().default(0),
  total_amount: z.number({ invalid_type_error: 'Enter total' }).min(0.01),
  currency_code: z.string().default('INR'),
  vendor_gstin: z.string().optional(),
  vendor_pan: z.string().optional(),
  buyer_gstin: z.string().optional(),
  place_of_supply: z.string().optional(),
  notes: z.string().optional(),
  line_items_data: z.array(lineItemSchema).min(1, 'At least one line item required'),
})

type FormData = z.infer<typeof schema>

export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [vendorSearch, setVendorSearch] = useState('')
  const [poSearch, setPoSearch] = useState('')
  const [selectedPO, setSelectedPO] = useState<any>(null)
  const [selectedGRN, setSelectedGRN] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [aiExtracted, setAiExtracted] = useState(false)

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoice_type: 'standard',
      currency_code: 'INR',
      subtotal: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0,
      tax_amount: 0, tds_amount: 0, total_amount: 0,
      po: null, grn: null,
      line_items_data: [{ description: '', hsn_code: '', quantity: 1, unit_rate: 0, tax_rate: 0, po_line: null, grn_line: null }],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'line_items_data' })
  const selectedVendorId = watch('vendor')
  const lineItems = watch('line_items_data')

  const computedSubtotal = lineItems.reduce((sum, li) => sum + (li.quantity || 0) * (li.unit_rate || 0), 0)
  const computedTax = lineItems.reduce((sum, li) => {
    const amt = (li.quantity || 0) * (li.unit_rate || 0)
    return sum + amt * ((li.tax_rate || 0) / 100)
  }, 0)

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
  const selectedVendor = (vendors || []).find((v: any) => v.id === selectedVendorId)

  // PO search — show all eligible POs, filter by search text + vendor
  const [showPODropdown, setShowPODropdown] = useState(false)
  const { data: pos } = useQuery({
    queryKey: ['po-search', poSearch, selectedVendorId],
    queryFn: async () => {
      const params: any = {}
      if (poSearch.trim()) params.search = poSearch.trim()
      if (selectedVendorId) params.vendor = selectedVendorId
      const r = await apiClient.get('/purchase-orders/', { params })
      const list: any[] = r.data.results ?? r.data
      // Only show POs that can receive invoices (exclude draft/cancelled)
      return list.filter((p: any) => !['draft', 'cancelled', 'pending_approval', 'rejected'].includes(p.status))
    },
    enabled: showPODropdown,
  })

  // Select PO and auto-fill
  const selectPO = async (po: any) => {
    setSelectedPO(po)
    setPoSearch('')
    setValue('po', po.id)
    setValue('vendor', po.vendor)
    setValue('currency_code', po.currency_code || 'INR')

    // Fetch PO detail for line items
    try {
      const { data: poDetail } = await apiClient.get(`/purchase-orders/${po.hash_id}/`)
      setValue('vendor_gstin', poDetail.vendor_gstin || '')

      // Auto-fill line items from PO
      const poLines = poDetail.line_items || []
      if (poLines.length > 0) {
        replace(poLines.map((li: any) => ({
          description: `${li.item_code_detail?.code || ''} — ${li.description}`,
          hsn_code: li.hsn_code || '',
          quantity: Number(li.quantity),
          unit_rate: Number(li.unit_rate),
          tax_rate: Number(li.tax_rate || 0),
          po_line: li.id,
          grn_line: null,
        })))
      }

      // Fetch GRNs for this PO
      const { data: grns } = await apiClient.get(`/purchase-orders/${po.hash_id}/grns/`)
      const grnList = grns.results ?? grns
      if (grnList.length > 0) {
        setSelectedGRN(grnList[0])
        setValue('grn', grnList[0].id)
      }

      toast({ title: `PO ${po.po_number} linked — line items auto-filled` })
    } catch {
      toast({ title: 'Failed to load PO details', variant: 'destructive' })
    }
  }

  // PDF Upload + AI Extraction
  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (selectedVendorId) formData.append('vendor_id', String(selectedVendorId))

      const { data } = await apiClient.post('/invoices/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Redirect to the created invoice for review
      toast({ title: 'Invoice uploaded — AI extraction complete' })
      router.push(`/invoices/${data.hash_id ?? data.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Upload failed'
      toast({ title: msg, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        subtotal: data.subtotal || computedSubtotal,
        tax_amount: data.tax_amount || computedTax,
        total_amount: data.total_amount || (computedSubtotal + computedTax),
      }
      const { data: resp } = await apiClient.post('/invoices/', payload)
      return resp
    },
    onSuccess: (resp) => {
      toast({ title: 'Invoice created as draft' })
      router.push(`/invoices/${resp.hash_id ?? resp.id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string' ? detail
        : detail?.detail || detail?.error || JSON.stringify(detail) || 'Failed to create'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold">New Invoice</h1>
      </div>

      {/* Upload Option */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Quick Upload (AI Extraction)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Upload an invoice PDF or image — AI will extract all data automatically (vendor, amounts, line items, GST).
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{uploading ? 'Uploading...' : 'Choose file (PDF, JPG, PNG)'}</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                disabled={uploading}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }} />
            </label>
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="flex-1 border-t" />
        <span className="text-xs uppercase">or enter manually</span>
        <div className="flex-1 border-t" />
      </div>

      <form onSubmit={handleSubmit(data => createMutation.mutate(data))} className="space-y-6">
        {/* Link PO */}
        <Card>
          <CardHeader><CardTitle className="text-base">Link to Purchase Order</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selectedPO ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">{selectedPO.po_number}</p>
                    <p className="text-xs text-blue-600">
                      {selectedPO.vendor_name} &middot; {formatCurrency(selectedPO.total_amount)}
                      {selectedGRN && ` &middot; GRN: ${selectedGRN.grn_number}`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" type="button"
                  onClick={() => { setSelectedPO(null); setSelectedGRN(null); setValue('po', null); setValue('grn', null) }}>
                  Change
                </Button>
              </div>
            ) : (
              <div>
                <Label>Search or Select PO</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Click to browse or type PO number..."
                    value={poSearch}
                    onChange={e => { setPoSearch(e.target.value); setShowPODropdown(true) }}
                    onFocus={() => setShowPODropdown(true)}
                    onBlur={() => setTimeout(() => setShowPODropdown(false), 200)} />
                </div>
                {showPODropdown && (
                  <div className="mt-2 border rounded-lg divide-y max-h-60 overflow-y-auto shadow-lg bg-background">
                    {!pos && (
                      <div className="px-3 py-3 text-center">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading POs...</span>
                      </div>
                    )}
                    {pos && pos.length === 0 && (
                      <p className="px-3 py-3 text-sm text-muted-foreground text-center">No eligible POs found.</p>
                    )}
                    {pos && pos.map((po: any) => (
                      <button key={po.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { selectPO(po); setShowPODropdown(false) }}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{po.po_number}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{po.status?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {po.vendor_name} &middot; {formatCurrency(po.total_amount)} &middot; {po.created_at?.slice(0, 10)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Linking a PO auto-fills vendor, line items, and enables 3-way matching.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Invoice Number *</Label>
                <Input {...register('invoice_number')} placeholder="Vendor's invoice number" />
                {errors.invoice_number && <p className="text-xs text-destructive mt-1">{errors.invoice_number.message}</p>}
              </div>
              <div>
                <Label>Invoice Type</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  {...register('invoice_type')}>
                  {INVOICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Invoice Date *</Label>
                <Input type="date" {...register('invoice_date')} />
                {errors.invoice_date && <p className="text-xs text-destructive mt-1">{errors.invoice_date.message}</p>}
              </div>
              <div>
                <Label>Due Date *</Label>
                <Input type="date" {...register('due_date')} />
                {errors.due_date && <p className="text-xs text-destructive mt-1">{errors.due_date.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendor (only if not auto-filled from PO) */}
        {!selectedPO && (
          <Card>
            <CardHeader><CardTitle className="text-base">Vendor</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedVendor ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium">{selectedVendor.company_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedVendor.vendor_code}{selectedVendor.gst_number && ` \u00B7 ${selectedVendor.gst_number}`}</p>
                  </div>
                  <Button variant="ghost" size="sm" type="button"
                    onClick={() => { setValue('vendor', undefined as any); setVendorSearch('') }}>Change</Button>
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
                          onClick={() => {
                            setValue('vendor', v.id); setValue('vendor_gstin', v.gst_number || ''); setValue('vendor_pan', v.pan_number || ''); setVendorSearch('')
                          }}>
                          <p className="font-medium">{v.company_name}</p>
                          <p className="text-xs text-muted-foreground">{v.vendor_code}{v.gst_number && ` \u00B7 ${v.gst_number}`}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tax Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Tax Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Vendor GSTIN</Label><Input {...register('vendor_gstin')} placeholder="22AAAAA0000A1Z5" /></div>
              <div><Label>Vendor PAN</Label><Input {...register('vendor_pan')} placeholder="AAAAA0000A" /></div>
              <div><Label>Buyer GSTIN</Label><Input {...register('buyer_gstin')} placeholder="Your GSTIN" /></div>
            </div>
            <div><Label>Place of Supply</Label><Input {...register('place_of_supply')} placeholder="e.g. Maharashtra" /></div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" className="gap-1.5"
                onClick={() => append({ description: '', hsn_code: '', quantity: 1, unit_rate: 0, tax_rate: 0, po_line: null, grn_line: null })}>
                <Plus className="w-3.5 h-3.5" /> Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {errors.line_items_data?.root && (
              <p className="text-xs text-destructive mb-2">{errors.line_items_data.root.message}</p>
            )}
            <div className="border border-border rounded-lg overflow-visible">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase w-8">#</th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase">Description *</th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase w-20">HSN</th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase w-16">Qty *</th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase w-24">Rate *</th>
                    <th className="px-2 py-2 text-right font-semibold text-muted-foreground uppercase w-24">Amount</th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fields.map((field, index) => {
                    const qty = watch(`line_items_data.${index}.quantity`) || 0
                    const rate = watch(`line_items_data.${index}.unit_rate`) || 0
                    return (
                      <tr key={field.id} className="group">
                        <td className="px-2 py-1.5 text-muted-foreground">{index + 1}</td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-xs" {...register(`line_items_data.${index}.description`)} placeholder="Item description" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-xs" {...register(`line_items_data.${index}.hsn_code`)} placeholder="HSN" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" step="0.01" className="h-8 text-xs"
                            {...register(`line_items_data.${index}.quantity`, { valueAsNumber: true })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" step="0.01" className="h-8 text-xs"
                            {...register(`line_items_data.${index}.unit_rate`, { valueAsNumber: true })} />
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm font-medium text-muted-foreground">
                          {formatCurrency(qty * rate)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(index)}
                              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
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
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(computedSubtotal)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Tax</td>
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(computedTax)}</td>
                  </tr>
                  <tr className="bg-slate-100 border-t-2">
                    <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold">Total</td>
                    <td className="px-3 py-2.5 text-right font-bold text-base">{formatCurrency(computedSubtotal + computedTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Amount Summary (GST breakdown) */}
        <Card>
          <CardHeader><CardTitle className="text-base">Amount Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Subtotal</Label>
                <Input type="number" step="0.01" {...register('subtotal', { valueAsNumber: true })}
                  placeholder={computedSubtotal.toFixed(2)} />
              </div>
              <div>
                <Label className="text-xs">CGST</Label>
                <Input type="number" step="0.01" {...register('cgst_amount', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-xs">SGST</Label>
                <Input type="number" step="0.01" {...register('sgst_amount', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-xs">IGST</Label>
                <Input type="number" step="0.01" {...register('igst_amount', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-xs">Total Tax</Label>
                <Input type="number" step="0.01" {...register('tax_amount', { valueAsNumber: true })}
                  placeholder={computedTax.toFixed(2)} />
              </div>
              <div>
                <Label className="text-xs">TDS</Label>
                <Input type="number" step="0.01" {...register('tds_amount', { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-xs">Total Amount *</Label>
                <Input type="number" step="0.01" {...register('total_amount', { valueAsNumber: true })}
                  placeholder={(computedSubtotal + computedTax).toFixed(2)} />
                {errors.total_amount && <p className="text-xs text-destructive mt-1">{errors.total_amount.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-background resize-y"
              placeholder="Additional notes or remarks..." {...register('notes')} />
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
