'use client'

import { useState, useRef } from 'react'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle, Send, Save, ChevronDown, ChevronRight, Upload, X, Plus, FileText } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'

const SRF_FIELD_LABELS: Record<string, string> = {
  company_name:  'Company Name',
  address:       'Address',
  city:          'City',
  state:         'State',
  pincode:       'PIN Code',
  contact_name:  'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  gst_number:    'GST Number',
  pan_number:    'PAN Number',
  bank_account:  'Bank Account No',
  bank_ifsc:     'Bank IFSC',
  bank_name:     'Bank Name',
  msme_number:   'MSME Number',
}

type SrfMatchRow = { field: string; label: string; value: string; confidence: number; include: boolean }

const OTHER_DOC_TYPE_OPTIONS = [
  { value: 'quality_certificate', label: 'Quality Certificate' },
  { value: 'iso_certificate',     label: 'ISO Certificate' },
  { value: 'trade_license',       label: 'Trade License' },
  { value: 'insurance',           label: 'Insurance Document' },
  { value: 'nda',                 label: 'NDA / Agreement' },
  { value: 'warranty',            label: 'Warranty Document' },
  { value: 'other',               label: 'Other' },
]

const steps = ['Company Details', 'Compliance & Docs', 'Approver & Submit']

const STEP_FIELDS: (keyof VendorForm)[][] = [
  ['category', 'plant', 'company_name', 'contact_name', 'contact_email', 'contact_phone', 'address', 'city', 'state', 'pincode'],
  ['gst_number', 'pan_number', 'bank_account', 'bank_ifsc', 'bank_name'],
  [],
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-1">{children}</p>
  )
}

function stepCircleClass(i: number, current: number): string {
  if (i === current) return 'bg-primary text-white'
  if (i < current) return 'bg-green-500 text-white'
  return 'bg-slate-200 text-slate-500'
}

function inputClass(hasError: boolean, isExtracted: boolean): string {
  if (hasError) return 'border-destructive'
  if (isExtracted) return 'border-purple-200 bg-purple-50'
  return ''
}

function DocFileInput({ chosen, onSelect, onClear, hasError }: {
  chosen: File | null
  onSelect: (file: File) => void
  onClear: () => void
  hasError?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[36px] ${hasError ? 'border-destructive' : ''}`}>
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
        {chosen?.name ?? 'No file chosen'}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-slate-50 transition-colors">
            <Upload className="w-3 h-3" /> Choose
          </span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onSelect(file)
              e.target.value = ''
            }}
          />
        </label>
        {chosen && (
          <button type="button" onClick={onClear} className="text-red-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

const schema = z.object({
  company_name:  z.string().min(2),
  gst_number:    z.string().length(15, 'GST must be 15 characters'),
  pan_number:    z.string().min(10).max(10, 'PAN must be 10 characters'),
  bank_account:  z.string().min(5),
  bank_ifsc:     z.string().min(11).max(11, 'IFSC must be 11 characters'),
  bank_name:     z.string().min(2),
  contact_name:  z.string().min(2),
  contact_email: z.string().email(),
  contact_phone: z.string().min(10),
  address:       z.string().min(5),
  city:          z.string().min(2),
  state:         z.string().min(2),
  pincode:       z.string().length(6, 'PIN must be 6 digits'),
  category:      z.number({ required_error: 'Category is required' }),
  plant:         z.number({ required_error: 'Plant is required' }),
  is_msme:       z.boolean().optional(),
  msme_number:   z.string().optional(),
  is_sez:        z.boolean().optional(),
})

type VendorForm = z.infer<typeof schema>

export default function NewVendorPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [srfExtracting, setSrfExtracting] = useState(false)
  const [extractedFields, setExtractedFields] = useState<Record<string, { value: string; confidence: number }> | null>(null)
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const submitModeRef = useRef<'draft' | 'approval'>('draft')
  const srfInputRef = useRef<HTMLInputElement>(null)
  const [pendingDocs, setPendingDocs] = useState<{ doc_type: string; file: File; title?: string }[]>([])
  const [otherDocRows, setOtherDocRows] = useState<{ id: number; doc_type: string; title: string; file: File | null }[]>([])
  const [complianceTab, setComplianceTab] = useState<'compliance' | 'other'>('compliance')
  const [docErrors, setDocErrors] = useState<Record<string, string>>({})

  const setDocFile = (doc_type: string, file: File | null) => {
    if (file) {
      setPendingDocs(prev => [
        ...prev.filter(d => d.doc_type !== doc_type),
        { doc_type, file }
      ])
      setDocErrors(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== doc_type)))
    } else {
      setPendingDocs(prev => prev.filter(d => d.doc_type !== doc_type))
    }
  }

  const addOtherDocRow = () =>
    setOtherDocRows(prev => [...prev, { id: Date.now(), doc_type: 'other', title: '', file: null }])

  const updateOtherDocRow = (id: number, patch: Partial<{ doc_type: string; title: string; file: File | null }>) =>
    setOtherDocRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const removeOtherDocRow = (id: number) =>
    setOtherDocRows(prev => prev.filter(r => r.id !== id))

  const { data: categories } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/categories/')
      return r.data.results ?? r.data
    },
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      const r = await apiClient.get('/users/plants/')
      return r.data.results ?? r.data
    },
  })

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'vendor_onboarding'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/?matrix_type=vendor_onboarding&is_active=true')
      return r.data.results ?? r.data
    },
    enabled: step === 2,
  })

  const {
    register, handleSubmit, setValue, watch, trigger, getValues,
    formState: { errors },
  } = useForm<VendorForm>({ resolver: zodResolver(schema) })

  const hasDoc = (docType: string) => pendingDocs.some(d => d.doc_type === docType)

  const validateComplianceDocs = (): Record<string, string> => {
    const vals = getValues()
    const errs: Record<string, string> = {}
    if (vals.gst_number && !hasDoc('gst_certificate'))
      errs.gst_certificate = 'Please upload the GST Certificate'
    if (vals.pan_number && !hasDoc('pan_card'))
      errs.pan_card = 'Please upload the PAN Card'
    if ((vals.bank_account || vals.bank_ifsc || vals.bank_name) && !hasDoc('bank_details'))
      errs.bank_details = 'Please upload bank document / cancelled cheque'
    if (watchedIsMsme && vals.msme_number && !hasDoc('msme_certificate'))
      errs.msme_certificate = 'Please upload the MSME Certificate'
    return errs
  }

  const handleNextStep = async () => {
    const isValid = await trigger(STEP_FIELDS[step])
    if (step === 1 && isValid) {
      const dErrors = validateComplianceDocs()
      setDocErrors(dErrors)
      if (Object.keys(dErrors).length > 0) {
        setComplianceTab('compliance')
        return
      }
    }
    if (isValid) setStep(prev => prev + 1)
  }
  
  const watchedCategory = watch('category')
  const watchedPlant = watch('plant')
  const watchedIsMsme = watch('is_msme')
  const watchedIsSez = watch('is_sez')

  const onValidationError = (errs: FieldErrors<VendorForm>) => {
    for (let i = 0; i < STEP_FIELDS.length; i++) {
      if (STEP_FIELDS[i].some(f => errs[f])) {
        setStep(i)
        return
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: async (data: VendorForm) => {
      const mode = submitModeRef.current
      const { data: vendor } = await apiClient.post('/vendors/', data)
      // Upload compliance docs
      for (const doc of pendingDocs) {
        const fd = new FormData()
        fd.append('file', doc.file)
        fd.append('doc_type', doc.doc_type)
        if (doc.title) fd.append('title', doc.title)
        try {
          await apiClient.post(`/vendors/${vendor.id}/documents/`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        } catch { /* non-fatal */ }
      }
      // Upload other docs (those with a file selected)
      for (const row of otherDocRows.filter(r => r.file)) {
        const fd = new FormData()
        fd.append('file', row.file as File)
        fd.append('doc_type', row.doc_type)
        fd.append('title', row.title.trim() || (row.file as File).name)
        try {
          await apiClient.post(`/vendors/${vendor.id}/documents/`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        } catch { /* non-fatal */ }
      }
      if (mode === 'approval') {
        const body: Record<string, any> = {}
        if (selectedMatrix) body.matrix_id = selectedMatrix
        await apiClient.post(`/vendors/${vendor.id}/submit-for-approval/`, body)
      }
      return { vendor, mode }
    },
    onSuccess: ({ vendor, mode }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      if (mode === 'approval') {
        toast({ title: 'Vendor submitted for approval', description: `${vendor.company_name} is pending approval.` })
      } else {
        toast({ title: 'Vendor saved as draft', description: `${vendor.company_name} saved. You can submit for approval later.` })
      }
      router.push('/vendors')
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.gst_number?.[0] || err?.response?.data?.error || 'Something went wrong.'
      toast({ title: 'Failed to save vendor', description: detail, variant: 'destructive' })
    },
  })

  const handleSaveAsDraft = () => {
    submitModeRef.current = 'draft'
    handleSubmit((data) => createMutation.mutate(data), onValidationError)()
  }

  const handleSubmitForApproval = () => {
    submitModeRef.current = 'approval'
    handleSubmit((data) => createMutation.mutate(data), onValidationError)()
  }

  const [srfMatchRows, setSrfMatchRows] = useState<SrfMatchRow[]>([])
  const [showSrfMatch, setShowSrfMatch] = useState(false)

  const handleSrfFile = async (file: File) => {
    setSrfExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await apiClient.post('/vendors/extract-srf/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const rows: SrfMatchRow[] = Object.entries(data)
        .filter(([key, fieldData]: [string, any]) => fieldData?.value && key in SRF_FIELD_LABELS)
        .map(([key, fieldData]: [string, any]) => ({
          field: key,
          label: SRF_FIELD_LABELS[key],
          value: fieldData.value,
          confidence: fieldData.confidence ?? 0,
          include: true,
        }))
      setSrfMatchRows(rows)
      setShowSrfMatch(true)
    } catch {
      toast({ title: 'SRF extraction failed', variant: 'destructive' })
    } finally {
      setSrfExtracting(false)
    }
  }

  const applySrfMatches = () => {
    const applied: Record<string, { value: string; confidence: number }> = {}
    srfMatchRows.filter(r => r.include).forEach(r => {
      setValue(r.field as any, r.value)
      applied[r.field] = { value: r.value, confidence: r.confidence }
    })
    setExtractedFields(applied)
    setShowSrfMatch(false)
    toast({ title: 'Fields applied', description: 'Review highlighted fields below.' })
  }

  const updateSrfRowInclude = (i: number, checked: boolean) =>
    setSrfMatchRows(prev => prev.map((r, j) => j === i ? { ...r, include: checked } : r))

  const updateSrfRowValue = (i: number, value: string) =>
    setSrfMatchRows(prev => prev.map((r, j) => j === i ? { ...r, value } : r))

  const srfConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="success" className="text-xs">High</Badge>
    if (confidence >= 0.5) return <Badge variant="warning" className="text-xs">Check</Badge>
    return <Badge variant="secondary" className="text-xs">Low</Badge>
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="success" className="text-xs ml-1">High</Badge>
    if (confidence >= 0.5) return <Badge variant="warning" className="text-xs ml-1">Check</Badge>
    return null
  }

  return (
    <div className="space-y-4">
      {srfExtracting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-3" />
          <p className="text-sm font-medium text-foreground">Extracting with AI…</p>
          <p className="text-xs text-muted-foreground mt-1">Analysing SRF Excel file</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Register New Vendor</h1>

        <div className="flex items-center gap-2">
          {step === 0 && (
            <>
              {extractedFields && !showSrfMatch && (
                <span className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Fields applied
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={srfExtracting}
                onClick={() => srfInputRef.current?.click()}
              >
                {srfExtracting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                  : <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
                {srfExtracting ? 'Extracting…' : 'Upload SRF for AI Fill'}
              </Button>
              <input
                ref={srfInputRef}
                type="file"
                className="hidden"
                accept=".xlsx"
                disabled={srfExtracting}
                onChange={e => { const f = e.target.files?.[0]; if (f) { handleSrfFile(f) } e.target.value = '' }}
              />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/vendors')}
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 flex-wrap">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${stepCircleClass(i, step)}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-4 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Company Details ──────────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardContent className="space-y-5 pt-6">

            {/* SRF Matching Table */}
            {showSrfMatch && srfMatchRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    AI Extracted Fields — Review &amp; Apply
                  </p>
                  <button type="button" onClick={() => setShowSrfMatch(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y max-h-72 overflow-y-auto">
                  {/* Header row */}
                  <div className="grid grid-cols-[auto_1fr_2fr_auto] gap-3 px-4 py-2 bg-slate-50/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span className="w-4" />
                    <span>Field</span>
                    <span>Extracted Value</span>
                    <span className="w-16 text-right">Confidence</span>
                  </div>
                  {srfMatchRows.map((row, i) => (
                    <div key={row.field} className="grid grid-cols-[auto_1fr_2fr_auto] gap-3 px-4 py-2 items-center">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={e => updateSrfRowInclude(i, e.target.checked)}
                        className="accent-primary w-4 h-4"
                      />
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <Input
                        value={row.value}
                        onChange={e => updateSrfRowValue(i, e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="w-16 flex justify-end">
                        {srfConfidenceBadge(row.confidence)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-slate-50 border-t flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {srfMatchRows.filter(r => r.include).length} of {srfMatchRows.length} fields selected
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowSrfMatch(false)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" className="gap-1.5" onClick={applySrfMatches}>
                      <CheckCircle className="w-3.5 h-3.5" /> Apply to Form
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Classification */}
            <div>
              <SectionTitle>General Information</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Vendor Category *</Label>
                  <select
                    className={`w-full h-10 border rounded-md px-3 text-sm bg-background ${errors.category ? 'border-destructive' : ''}`}
                    value={watchedCategory ?? ''}
                    onChange={e => setValue('category', e.target.value ? Number(e.target.value) : (undefined as any), { shouldValidate: true })}
                  >
                    <option value="">Select category</option>
                    {(categories || []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.series_code} — {c.name}</option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-xs text-destructive">{errors.category.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Plant *</Label>
                  <select
                    className={`w-full h-10 border rounded-md px-3 text-sm bg-background ${errors.plant ? 'border-destructive' : ''}`}
                    value={watchedPlant ?? ''}
                    onChange={e => setValue('plant', e.target.value ? Number(e.target.value) : (undefined as any), { shouldValidate: true })}
                  >
                    <option value="">Select plant</option>
                    {(plants || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                  {errors.plant && (
                    <p className="text-xs text-destructive">{errors.plant.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Profile */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'company_name', label: 'Company Name *', placeholder: 'Acme Pvt Ltd' },
                  { name: 'address',      label: 'Address *',      placeholder: '123, Industrial Area' },
                  { name: 'city',         label: 'City *',         placeholder: 'Mumbai' },
                  { name: 'state',        label: 'State *',        placeholder: 'Maharashtra' },
                  { name: 'pincode',      label: 'PIN Code *',     placeholder: '400001' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name} className="space-y-1">
                    <Label className="text-xs">
                      {label}
                      {extractedFields?.[name] && getConfidenceBadge(extractedFields[name].confidence)}
                    </Label>
                    <Input
                      placeholder={placeholder}
                      {...register(name as keyof VendorForm)}
                      className={extractedFields?.[name] ? 'border-purple-200 bg-purple-50' : ''}
                    />
                    {errors[name as keyof VendorForm] && (
                      <p className="text-xs text-destructive">{(errors[name as keyof VendorForm] as any)?.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Primary Contact */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'contact_name',  label: 'Contact Person *', placeholder: 'John Doe' },
                  { name: 'contact_email', label: 'Contact Email *',   placeholder: 'john@acme.com' },
                  { name: 'contact_phone', label: 'Contact Phone *',   placeholder: '+91 98765 43210' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name} className="space-y-1">
                    <Label className="text-xs">
                      {label}
                      {extractedFields?.[name] && getConfidenceBadge(extractedFields[name].confidence)}
                    </Label>
                    <Input
                      placeholder={placeholder}
                      {...register(name as keyof VendorForm)}
                      className={extractedFields?.[name] ? 'border-purple-200 bg-purple-50' : ''}
                    />
                    {errors[name as keyof VendorForm] && (
                      <p className="text-xs text-destructive">{(errors[name as keyof VendorForm] as any)?.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleNextStep} className="gap-1">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Compliance & Documents ──────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance &amp; Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Enter regulatory numbers and upload supporting documents alongside each field.
              Documents can also be uploaded later from the vendor detail page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Tabs */}
            <div className="flex gap-1 border-b">
              {(['compliance'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setComplianceTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    complianceTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'compliance' ? 'Compliance' : 'Other Documents'}
                </button>
              ))}
            </div>

            {complianceTab === 'compliance' && <>

            {/* GST */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
              <div className="space-y-1">
                <Label className="text-xs">
                  GST Number *{extractedFields?.gst_number && getConfidenceBadge(extractedFields.gst_number.confidence)}
                </Label>
                <Input
                  placeholder="27AAAAA0000A1Z5"
                  {...register('gst_number')}
                  className={inputClass(!!errors.gst_number, !!extractedFields?.gst_number)}
                />
                {errors.gst_number && <p className="text-xs text-destructive">{errors.gst_number.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GST Certificate <span className="text-destructive">*</span></Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'gst_certificate')?.file ?? null}
                  onSelect={f => setDocFile('gst_certificate', f)}
                  onClear={() => setDocFile('gst_certificate', null)}
                  hasError={!!docErrors.gst_certificate}
                />
                {docErrors.gst_certificate && <p className="text-xs text-destructive">{docErrors.gst_certificate}</p>}
              </div>
            </div>

            {/* PAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
              <div className="space-y-1">
                <Label className="text-xs">
                  PAN Number *{extractedFields?.pan_number && getConfidenceBadge(extractedFields.pan_number.confidence)}
                </Label>
                <Input
                  placeholder="AAAAA9999A"
                  {...register('pan_number')}
                  className={inputClass(!!errors.pan_number, !!extractedFields?.pan_number)}
                />
                {errors.pan_number && <p className="text-xs text-destructive">{errors.pan_number.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PAN Card <span className="text-destructive">*</span></Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'pan_card')?.file ?? null}
                  onSelect={f => setDocFile('pan_card', f)}
                  onClear={() => setDocFile('pan_card', null)}
                  hasError={!!docErrors.pan_card}
                />
                {docErrors.pan_card && <p className="text-xs text-destructive">{docErrors.pan_card}</p>}
              </div>
            </div>

            {/* Bank Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
              <div className="space-y-2">
                {[
                  { name: 'bank_account', label: 'Bank Account No *', placeholder: '12345678901234' },
                  { name: 'bank_ifsc',    label: 'Bank IFSC *',       placeholder: 'HDFC0001234' },
                  { name: 'bank_name',    label: 'Bank Name *',       placeholder: 'HDFC Bank' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name} className="space-y-1">
                    <Label className="text-xs">
                      {label}{extractedFields?.[name] && getConfidenceBadge(extractedFields[name].confidence)}
                    </Label>
                    <Input
                      placeholder={placeholder}
                      {...register(name as keyof VendorForm)}
                      className={inputClass(!!errors[name as keyof VendorForm], !!extractedFields?.[name])}
                    />
                    {errors[name as keyof VendorForm] && (
                      <p className="text-xs text-destructive">{(errors[name as keyof VendorForm] as any)?.message}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bank Details / Cancelled Cheque <span className="text-destructive">*</span></Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'bank_details')?.file ?? null}
                  onSelect={f => setDocFile('bank_details', f)}
                  onClear={() => setDocFile('bank_details', null)}
                  hasError={!!docErrors.bank_details}
                />
                {docErrors.bank_details && <p className="text-xs text-destructive">{docErrors.bank_details}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4 pt-2 sm:col-span-2 lg:col-span-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" {...register('is_msme')} className="rounded" />
                    <span>MSME Registered</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" {...register('is_sez')} className="rounded" />
                    <span>SEZ Unit</span>
                  </label>
                </div>
            {/* MSME (conditional) */}
            {watchedIsMsme && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
                <div className="space-y-1">
                  <Label className="text-xs">MSME Number</Label>
                  <Input placeholder="UDYAM-MH-00-0000000" {...register('msme_number')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MSME Certificate <span className="text-destructive">*</span></Label>
                  <DocFileInput
                    chosen={pendingDocs.find(d => d.doc_type === 'msme_certificate')?.file ?? null}
                    onSelect={f => setDocFile('msme_certificate', f)}
                    onClear={() => setDocFile('msme_certificate', null)}
                    hasError={!!docErrors.msme_certificate}
                  />
                  {docErrors.msme_certificate && <p className="text-xs text-destructive">{docErrors.msme_certificate}</p>}
                </div>
              </div>
            )}

            {/* SEZ (conditional) */}
            {watchedIsSez && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">SEZ Unit</Label>
                  <p className="text-sm text-muted-foreground">SEZ registered vendor</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SEZ Certificate <span className="text-destructive">*</span></Label>
                  <DocFileInput
                    chosen={pendingDocs.find(d => d.doc_type === 'sez_certificate')?.file ?? null}
                    onSelect={f => setDocFile('sez_certificate', f)}
                    onClear={() => setDocFile('sez_certificate', null)}
                  />
                </div>
              </div>
            )}

            {/* Incorporation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Incorporation Certificate</p>
                <p className="text-sm">Company registration / MOA documents</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Incorporation Certificate <span className="text-destructive">*</span></Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'incorporation')?.file ?? null}
                  onSelect={f => setDocFile('incorporation', f)}
                  onClear={() => setDocFile('incorporation', null)}
                />
              </div>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Other Documents</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quality certs, trade licences, NDAs, insurance, etc.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addOtherDocRow}>
                  <Plus className="w-3.5 h-3.5" /> Add Document
                </Button>
              </div>
              {otherDocRows.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No additional documents added.</p>
              )}
              {otherDocRows.map(row => (
                <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end border rounded-md p-3 bg-slate-50/60">
                  <div className="space-y-1">
                    <Label className="text-xs">Document Type</Label>
                    <select
                      value={row.doc_type}
                      onChange={e => updateOtherDocRow(row.id, { doc_type: e.target.value })}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                    >
                      {OTHER_DOC_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={row.title}
                      onChange={e => updateOtherDocRow(row.id, { title: e.target.value })}
                      placeholder="e.g. ISO 9001 — 2024"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">File</Label>
                    <DocFileInput
                      chosen={row.file}
                      onSelect={f => updateOtherDocRow(row.id, { file: f })}
                      onClear={() => updateOtherDocRow(row.id, { file: null })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOtherDocRow(row.id)}
                    className="h-9 w-9 flex items-center justify-center text-red-400 hover:text-red-600 border rounded-md hover:bg-red-50 transition-colors shrink-0"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {otherDocRows.some(r => !r.file) && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Rows without a file selected will be skipped on save.
                </p>
              )}
            </div>
            </>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(0)}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>

              <Button
                type="button"
                onClick={handleNextStep}
                className="gap-1"
              >
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Approver & Submit ─────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Select Approval Matrix</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Save as draft to continue editing later, or select an approval matrix and submit for approval now.
            </p>

            {/* Approval Matrix Table */}
            <div>

              {matrices === undefined && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices...
                </div>
              )}
              {matrices && matrices.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No active vendor onboarding matrices configured. You can still save as draft and submit later.
                </p>
              )}
              {matrices && matrices.length > 0 && (
                <MatrixSelectorTable
                  matrices={matrices}
                  selectedMatrix={selectedMatrix}
                  expandedMatrix={expandedMatrix}
                  onSelect={(id) => {
                    setSelectedMatrix(id)
                    setExpandedMatrix(id) // Expands the matrix when selected
                  }}
                  onToggleExpand={(id) => {
                    setExpandedMatrix(prev => (prev === id ? null : id)) // Toggles expand/collapse
                  }}
                />
              )}

            </div>

            <div className="flex  justify-end gap-3 pt-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={createMutation.isPending}
                  className="gap-2"
                >
                  {createMutation.isPending && submitModeRef.current === 'draft'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />
                  }
                  Save as Draft
                </Button>

                <Button
                  type="button"
                  onClick={handleSubmitForApproval}
                  disabled={createMutation.isPending || (selectedMatrix === null && matrices && matrices.length > 0)}
                  className="gap-2"
                >
                  {createMutation.isPending && submitModeRef.current === 'approval'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                  Submit for Approval
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
