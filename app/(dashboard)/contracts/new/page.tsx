'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, Save, Search, AlertTriangle,
  Eye, FileText,
} from 'lucide-react'
import apiClient from '@/lib/api/client'

const CONTRACT_TYPES = [
  { value: 'MSA', label: 'Master Supply Agreement (MSA)' },
  { value: 'LTA', label: 'Long-Term Agreement (LTA)' },
  { value: 'SLA', label: 'Service Level Agreement (SLA)' },
  { value: 'Tooling', label: 'Tooling Agreement' },
  { value: 'NDA', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'SOW', label: 'Statement of Work (SOW)' },
]

const schema = z.object({
  title: z.string().trim().min(3, 'Title is required (min 3 chars)'),
  contract_type: z.string().min(1, 'Contract type is required'),
  vendor: z.number({ required_error: 'Vendor is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  estimated_value: z.number({ invalid_type_error: 'Enter a valid amount' }).min(1),
  currency_code: z.string().default('INR'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  duration_months: z.number({ invalid_type_error: 'Enter duration' }).min(1),
  payment_terms: z.string().optional(),
  incoterms: z.string().optional(),
  body_content: z.string().optional(),
  template: z.number().nullable().optional(),
  category: z.number().nullable().optional(),
})

type FormData = z.infer<typeof schema>

function formatDocDate(d: string) {
  if (!d) return '___________'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function NewContractPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [vendorSearch, setVendorSearch] = useState('')
  const [previewTab, setPreviewTab] = useState<'preview' | 'edit'>('preview')

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency_code: 'INR',
      duration_months: 12,
      template: null,
      category: null,
      body_content: '',
    },
  })

  const selectedVendorId = watch('vendor')
  const selectedType = watch('contract_type')
  const bodyContent = watch('body_content') || ''
  const formTitle = watch('title')
  const formValue = watch('estimated_value')
  const formCurrency = watch('currency_code')
  const formStart = watch('start_date')
  const formEnd = watch('end_date')
  const formDuration = watch('duration_months')
  const formPayment = watch('payment_terms')
  const formIncoterms = watch('incoterms')

  // Auto-calculate end date from start date + duration
  useEffect(() => {
    if (formStart && formDuration && formDuration > 0) {
      const start = new Date(formStart)
      start.setMonth(start.getMonth() + formDuration)
      const endStr = start.toISOString().split('T')[0]
      if (endStr !== formEnd) {
        setValue('end_date', endStr)
      }
    }
  }, [formStart, formDuration, setValue, formEnd])

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

  const { data: templates } = useQuery({
    queryKey: ['contract-templates', selectedType],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedType) params.set('contract_type', selectedType)
      const r = await apiClient.get(`/contracts/templates/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: !!selectedType,
  })

  const selectedVendor = (vendors || []).find((v: any) => v.id === selectedVendorId)
  const selectedPlant = (plants || []).find((p: any) => p.id === watch('plant'))
  const selectedDept = (departments || []).find((d: any) => d.id === watch('department'))

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: resp } = await apiClient.post('/contracts/', data)
      return resp
    },
    onSuccess: (resp) => {
      toast({ title: 'Contract created — redirecting to editor' })
      router.push(`/contracts/${resp.hash_id}/edit`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string' ? detail
        : detail?.detail || detail?.error || Object.values(detail || {}).flat().join(', ') || 'Failed'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Auto-apply first template when type changes and templates load
  // Auto-apply first template when type changes
  const lastAutoAppliedType = useRef('')
  useEffect(() => {
    if (templates && templates.length > 0 && selectedType && selectedType !== lastAutoAppliedType.current) {
      lastAutoAppliedType.current = selectedType
      const first = templates[0]
      setValue('body_content', first.body_template, { shouldDirty: true })
      setValue('template', first.id)
    }
  }, [templates, selectedType, setValue])

  const applyTemplate = (template: any) => {
    setValue('body_content', template.body_template, { shouldDirty: true })
    setValue('template', template.id)
    toast({ title: `Template "${template.name}" applied` })
  }

  // Live document preview
  const documentHTML = useMemo(() => {
    const vendorName = selectedVendor?.company_name || '___________'
    const vendorGstin = selectedVendor?.gst_number || '___________'
    const vendorPan = selectedVendor?.pan_number || '___________'
    const vendorAddress = [selectedVendor?.address, selectedVendor?.city, selectedVendor?.state, selectedVendor?.pincode, selectedVendor?.country].filter(Boolean).join(', ') || '___________'
    const vendorCity = selectedVendor?.city || '___________'
    const vendorState = selectedVendor?.state || '___________'
    const vendorContact = selectedVendor?.contact_name || '___________'
    const vendorEmail = selectedVendor?.contact_email || '___________'
    const vendorPhone = selectedVendor?.contact_phone || selectedVendor?.phone || '___________'
    const plantName = selectedPlant?.name || '___________'
    const plantLocation = selectedPlant?.location || '___________'
    const deptName = selectedDept?.name || '___________'
    const typeFull = CONTRACT_TYPES.find(t => t.value === selectedType)?.label || selectedType || '___________'

    // Replace all template placeholders with actual values
    const replacements: Record<string, string> = {
      'vendor_name': vendorName,
      'vendor_company': vendorName,
      'vendor_gstin': vendorGstin,
      'vendor_gst': vendorGstin,
      'vendor_pan': vendorPan,
      'vendor_address': vendorAddress,
      'vendor_city': vendorCity,
      'vendor_state': vendorState,
      'vendor_contact': vendorContact,
      'vendor_email': vendorEmail,
      'vendor_phone': vendorPhone,
      'plant_name': plantName,
      'plant_location': plantLocation,
      'department_name': deptName,
      'contract_value': `${formCurrency || 'INR'} ${Number(formValue || 0).toLocaleString('en-IN')}`,
      'contract_type': typeFull,
      'start_date': formatDocDate(formStart),
      'end_date': formatDocDate(formEnd),
      'duration': `${formDuration || '___'} months`,
      'payment_terms': formPayment || '___________',
      'incoterms': formIncoterms || '___________',
    }

    let body = bodyContent
    for (const [key, val] of Object.entries(replacements)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val)
    }

    return `
      <div style="font-family: 'Times New Roman', serif; color: #1a1a1a;">
        <div style="text-align: center; border-bottom: 3px double #333; padding-bottom: 16px; margin-bottom: 24px;">
          <p style="font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; margin: 0;">Contract Agreement</p>
          <h1 style="font-size: 18px; font-weight: bold; margin: 8px 0 4px; text-transform: uppercase;">${typeFull}</h1>
          <p style="font-size: 14px; margin: 4px 0;">${formTitle || 'Untitled Contract'}</p>
          <p style="font-size: 11px; color: #666; margin: 4px 0;">Contract No: <strong>CLM-XXXX-XX-XXXXX</strong> (auto-generated on save)</p>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 1px;">Parties</h2>
          <table style="width: 100%; font-size: 12px;"><tr>
            <td style="width: 50%; vertical-align: top; padding-right: 16px;">
              <p style="font-weight: bold; margin: 0 0 4px;">BUYER (First Party)</p>
              <p style="margin: 2px 0;">Plant: ${plantName}</p>
              <p style="margin: 2px 0;">Location: ${plantLocation}</p>
              <p style="margin: 2px 0;">Department: ${deptName}</p>
            </td>
            <td style="width: 50%; vertical-align: top;">
              <p style="font-weight: bold; margin: 0 0 4px;">VENDOR (Second Party)</p>
              <p style="margin: 2px 0;"><strong>${vendorName}</strong></p>
              <p style="margin: 2px 0; font-size: 11px;">${vendorAddress}</p>
              <p style="margin: 2px 0; font-size: 11px;">GSTIN: ${vendorGstin}</p>
              <p style="margin: 2px 0; font-size: 11px;">PAN: ${vendorPan}</p>
              <p style="margin: 2px 0; font-size: 11px;">Contact: ${vendorContact} | ${vendorEmail} | ${vendorPhone}</p>
            </td>
          </tr></table>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 1px;">Key Terms</h2>
          <table style="width: 100%; font-size: 12px;">
            <tr><td style="padding: 4px 0; font-weight: bold; width: 35%;">Contract Value:</td><td>${formCurrency || 'INR'} ${Number(formValue || 0).toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Effective Date:</td><td>${formatDocDate(formStart)}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Expiry Date:</td><td>${formatDocDate(formEnd)}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Duration:</td><td>${formDuration || '___'} months</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Payment Terms:</td><td>${formPayment || 'As per agreement'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Incoterms:</td><td>${formIncoterms || 'N/A'}</td></tr>
          </table>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 1px;">Terms & Conditions</h2>
          <div style="font-size: 12px; line-height: 1.8; white-space: pre-wrap;">${body || '<em style="color: #999;">No contract body yet. Select a template or start typing to see the preview.</em>'}</div>
        </div>
        <div style="margin-top: 40px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 20px; letter-spacing: 1px;">Signatures</h2>
          <table style="width: 100%; font-size: 12px;"><tr>
            <td style="width: 50%; padding-right: 24px; vertical-align: top;">
              <p style="font-weight: bold; margin-bottom: 40px;">For and on behalf of the BUYER</p>
              <div style="border-bottom: 1px solid #333; margin-bottom: 4px;">&nbsp;</div>
              <p style="font-size: 10px; color: #666;">Authorized Signatory &nbsp;&nbsp; Date: ___________</p>
            </td>
            <td style="width: 50%; vertical-align: top;">
              <p style="font-weight: bold; margin-bottom: 40px;">For and on behalf of ${vendorName}</p>
              <div style="border-bottom: 1px solid #333; margin-bottom: 4px;">&nbsp;</div>
              <p style="font-size: 10px; color: #666;">Authorized Signatory &nbsp;&nbsp; Date: ___________</p>
            </td>
          </tr></table>
        </div>
      </div>
    `
  }, [bodyContent, formTitle, selectedType, formValue, formCurrency, formStart, formEnd, formDuration, formPayment, formIncoterms, selectedVendor, selectedPlant, selectedDept])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">New Contract</h1>
            <p className="text-xs text-muted-foreground">Fill the form on the right — document preview updates live on the left</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(data => createMutation.mutate(data))}>
        {/* Split screen */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>

          {/* ──── LEFT: Live Document Preview ──── */}
          <div className="border rounded-lg bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Document Preview</span>
              </div>
              <div className="flex gap-1">
                <button type="button"
                  className={`px-2 py-0.5 text-[10px] rounded ${previewTab === 'preview' ? 'bg-white shadow text-primary font-medium' : 'text-muted-foreground'}`}
                  onClick={() => setPreviewTab('preview')}>
                  <Eye className="w-3 h-3 inline mr-1" />Preview
                </button>
                <button type="button"
                  className={`px-2 py-0.5 text-[10px] rounded ${previewTab === 'edit' ? 'bg-white shadow text-primary font-medium' : 'text-muted-foreground'}`}
                  onClick={() => setPreviewTab('edit')}>
                  Raw Edit
                </button>
              </div>
            </div>

            {previewTab === 'preview' ? (
              <div className="flex-1 overflow-y-auto p-8 bg-white" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                <div dangerouslySetInnerHTML={{ __html: documentHTML }} />
              </div>
            ) : (
              <textarea
                className="flex-1 p-4 text-sm font-mono leading-relaxed resize-none border-0 focus:ring-0 focus:outline-none"
                style={{ minHeight: '600px' }}
                {...register('body_content')}
                placeholder="Type contract terms here, or switch to Preview to see the formatted document..."
              />
            )}
          </div>

          {/* ──── RIGHT: Form + Tools ──── */}
          <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>

            {/* Contract Info + Template */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Contract Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 pb-3">
                <div>
                  <Label className="text-xs">Title *</Label>
                  <Input className="h-8 text-sm" {...register('title')} placeholder="e.g. Annual Steel Supply Agreement" />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type *</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('contract_type')}>
                      <option value="">Select type</option>
                      {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {errors.contract_type && <p className="text-xs text-destructive mt-1">{errors.contract_type.message}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Template {selectedType && <span className="text-muted-foreground">(auto)</span>}</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                      value={watch('template') || ''}
                      onChange={e => {
                        const tid = e.target.value ? Number(e.target.value) : null
                        setValue('template', tid)
                        if (tid) {
                          const t = (templates || []).find((t: any) => t.id === tid)
                          if (t) applyTemplate(t)
                        }
                      }}>
                      <option value="">No template</option>
                      {(templates || []).map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Show applied template info */}
                {watch('template') && templates && (() => {
                  const applied = (templates || []).find((t: any) => t.id === watch('template'))
                  if (!applied) return null
                  return (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-800">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                      <span>Template: <strong>{applied.name}</strong> &middot; {applied.clause_count || 0} clauses &middot; {(applied.body_template || '').length.toLocaleString()} chars</span>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Vendor */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Vendor *</CardTitle></CardHeader>
              <CardContent className="pb-3">
                {selectedVendor ? (
                  <div className="flex items-center justify-between p-2.5 border rounded-lg bg-slate-50">
                    <div>
                      <p className="text-sm font-medium">{selectedVendor.company_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedVendor.vendor_code} &middot; {selectedVendor.city}
                        {selectedVendor.risk_score != null && ` \u00B7 Risk: ${selectedVendor.risk_score}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" type="button" className="h-7 text-xs"
                      onClick={() => { setValue('vendor', undefined as any); setVendorSearch('') }}>Change</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input className="pl-8 h-8 text-xs" placeholder="Search vendor..."
                        value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} />
                    </div>
                    {errors.vendor && <p className="text-xs text-destructive">{errors.vendor.message}</p>}
                    {vendors && vendors.length > 0 && (
                      <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                        {vendors.map((v: any) => (
                          <button key={v.id} type="button"
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs"
                            onClick={() => { setValue('vendor', v.id); setVendorSearch('') }}>
                            <p className="font-medium">{v.company_name}</p>
                            <p className="text-muted-foreground">{v.vendor_code} &middot; {v.city}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Value & Duration */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Value & Duration</CardTitle></CardHeader>
              <CardContent className="space-y-3 pb-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Value *</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" {...register('estimated_value', { valueAsNumber: true })} />
                    {errors.estimated_value && <p className="text-xs text-destructive mt-1">{errors.estimated_value.message}</p>}
                  </div>
                  <div><Label className="text-xs">Currency</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('currency_code')}>
                      <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div><Label className="text-xs">Duration (months) *</Label>
                    <Input type="number" className="h-8 text-sm" {...register('duration_months', { valueAsNumber: true })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Start Date *</Label>
                    <Input type="date" className="h-8 text-sm" {...register('start_date')} /></div>
                  <div><Label className="text-xs">End Date *</Label>
                    <Input type="date" className="h-8 text-sm" {...register('end_date')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Plant *</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('plant', { valueAsNumber: true })}>
                      <option value="">Select</option>
                      {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {errors.plant && <p className="text-xs text-destructive mt-1">{errors.plant.message}</p>}
                  </div>
                  <div><Label className="text-xs">Department *</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('department', { valueAsNumber: true })}>
                      <option value="">Select</option>
                      {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {errors.department && <p className="text-xs text-destructive mt-1">{errors.department.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Payment Terms</Label>
                    <Input className="h-8 text-sm" {...register('payment_terms')} placeholder="Net 30 days" /></div>
                  <div><Label className="text-xs">Incoterms</Label>
                    <Input className="h-8 text-sm" {...register('incoterms')} placeholder="FOB, CIF, DDP" /></div>
                </div>
              </CardContent>
            </Card>

            {/* LTA Warning */}
            {selectedType === 'LTA' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">LTA requires Price Revision Clause</p>
                  <p className="text-amber-700 mt-0.5">Included in the template. Verify in preview.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky save bar */}
        <div className="flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-sm py-3 px-4 -mx-4 border-t mt-4">
          <p className="text-xs text-muted-foreground">{bodyContent.length} chars</p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save as Draft
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Template Selector with preview ──────────────────────────────────────────

