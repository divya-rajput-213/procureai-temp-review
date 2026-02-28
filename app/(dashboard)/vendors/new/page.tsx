'use client'

import { useState, useCallback, useRef } from 'react'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, ArrowRight, Loader2, Sparkles, FileSpreadsheet, CheckCircle, Send, Save, ChevronDown, ChevronRight, Upload, X } from 'lucide-react'
import apiClient from '@/lib/api/client'

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

function DocFileInput({ chosen, onSelect, onClear }: {
  chosen: File | null
  onSelect: (file: File) => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[36px]">
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
  const [pendingDocs, setPendingDocs] = useState<{ doc_type: string; file: File }[]>([])

  const setDocFile = (doc_type: string, file: File | null) => {
    if (file) {
      setPendingDocs(prev => [
        ...prev.filter(d => d.doc_type !== doc_type),
        { doc_type, file }
      ])
    } else {
      setPendingDocs(prev => prev.filter(d => d.doc_type !== doc_type))
    }
  }

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
    register, handleSubmit, setValue, watch,  trigger,
    formState: { errors },
  } = useForm<VendorForm>({ resolver: zodResolver(schema) })
  const handleNextStep = async () => {
    const fields = STEP_FIELDS[step]
  
    const isValid = await trigger(fields)
  
    if (isValid) {
      setStep(prev => prev + 1)
    }
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
      for (const doc of pendingDocs) {
        const fd = new FormData()
        fd.append('file', doc.file)
        fd.append('doc_type', doc.doc_type)
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

  const onSRFDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setSrfExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await apiClient.post('/vendors/extract-srf/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setExtractedFields(data)
      Object.entries(data).forEach(([key, fieldData]: [string, any]) => {
        if (fieldData?.value && key in schema.shape) {
          setValue(key as any, fieldData.value)
        }
      })
      toast({ title: 'AI extracted vendor details', description: 'Review and edit as needed.' })
    } catch {
      toast({ title: 'SRF extraction failed', variant: 'destructive' })
    } finally {
      setSrfExtracting(false)
    }
  }, [setValue, toast])

  const { getRootProps: getSRFRootProps, getInputProps: getSRFInputProps } = useDropzone({
    onDrop: onSRFDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
  })

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="success" className="text-xs ml-1">High</Badge>
    if (confidence >= 0.5) return <Badge variant="warning" className="text-xs ml-1">Check</Badge>
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Register New Vendor
        </h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/vendors')}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
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
          <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* SRF Upload */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <p className="text-sm font-medium mb-2">
                <Sparkles className="w-4 h-4 inline mr-1 text-purple-500" />
                Upload SRF Excel (Optional — AI will pre-fill details)
              </p>
              <div
                {...getSRFRootProps()}
                className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-purple-400 transition-colors"
              >
                <input {...getSRFInputProps()} />
                {srfExtracting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    <span className="text-sm">Extracting with AI...</span>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Drop SRF .xlsx here</p>
                  </div>
                )}
              </div>
              {extractedFields && (
                <p className="text-xs text-green-700 mt-2">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  AI extracted vendor details — review fields below
                </p>
              )}
            </div>

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
                <Label className="text-xs text-muted-foreground">GST Certificate</Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'gst_certificate')?.file ?? null}
                  onSelect={f => setDocFile('gst_certificate', f)}
                  onClear={() => setDocFile('gst_certificate', null)}
                />
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
                <Label className="text-xs text-muted-foreground">PAN Card</Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'pan_card')?.file ?? null}
                  onSelect={f => setDocFile('pan_card', f)}
                  onClear={() => setDocFile('pan_card', null)}
                />
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
                <Label className="text-xs text-muted-foreground">Bank Details / Cancelled Cheque</Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'bank_details')?.file ?? null}
                  onSelect={f => setDocFile('bank_details', f)}
                  onClear={() => setDocFile('bank_details', null)}
                />
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
                  <Label className="text-xs text-muted-foreground">MSME Certificate</Label>
                  <DocFileInput
                    chosen={pendingDocs.find(d => d.doc_type === 'msme_certificate')?.file ?? null}
                    onSelect={f => setDocFile('msme_certificate', f)}
                    onClear={() => setDocFile('msme_certificate', null)}
                  />
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
                  <Label className="text-xs text-muted-foreground">SEZ Certificate</Label>
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
                <Label className="text-xs text-muted-foreground">Incorporation Certificate</Label>
                <DocFileInput
                  chosen={pendingDocs.find(d => d.doc_type === 'incorporation')?.file ?? null}
                  onSelect={f => setDocFile('incorporation', f)}
                  onClear={() => setDocFile('incorporation', null)}
                />
              </div>
            </div>

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
                Review <ArrowRight className="w-4 h-4" />
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
                <div className="border rounded-lg overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto] items-center bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b gap-3">
                    <span className="w-4" />
                    <span>Matrix Name</span>
                    <span>Plant</span>
                    <span className="w-20 text-right">Levels</span>
                  </div>

                  {matrices.map((m: any) => {
                    const isSelected = selectedMatrix === m.id
                    const isExpanded = expandedMatrix === m.id
                    const levelCount = m.levels?.length ?? 0
                    return (
                      <div key={m.id} className={`border-t first:border-t-0 ${isSelected ? 'bg-primary/5' : ''}`}>
                        {/* Matrix row — <label> wrapping a radio is the correct accessible pattern */}
                        <label
                          htmlFor={`matrix-radio-${m.id}`}
                          className={`grid grid-cols-[auto_1fr_auto_auto] items-center px-3 py-3 gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors ${isSelected ? 'hover:bg-primary/5' : ''}`}
                        >
                          <input
                            type="radio"
                            id={`matrix-radio-${m.id}`}
                            name="matrix"
                            checked={isSelected}
                            onChange={() => { setSelectedMatrix(m.id); setExpandedMatrix(m.id) }}
                            className="accent-primary w-4 h-4"
                          />
                          <div>
                            <p className="text-sm font-medium">{m.name}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {m.plant_name || 'All Plants'}
                          </span>
                          <div className="flex items-center gap-1 w-20 justify-end">
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                              {levelCount} level{levelCount === 1 ? '' : 's'}
                            </span>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setExpandedMatrix(prev => (prev === m.id ? null : m.id)) }}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>
                        </label>

                        {/* Expanded levels */}
                        {isExpanded && (
                          <div className="border-t bg-slate-50/60 px-4 py-2 space-y-0">
                            {levelCount === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">No levels configured.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left py-1.5 font-medium w-12">Level</th>
                                    <th className="text-left py-1.5 font-medium">Approver</th>
                                    <th className="text-left py-1.5 font-medium">Role</th>
                                    <th className="text-right py-1.5 font-medium w-20">SLA</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.levels.map((lvl: any) => (
                                    <tr key={lvl.id} className="border-t border-slate-200/60">
                                      <td className="py-1.5">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                          {lvl.level_number}
                                        </span>
                                      </td>
                                      <td className="py-1.5 font-medium text-slate-700">{lvl.user_name}</td>
                                      <td className="py-1.5 text-muted-foreground">{lvl.role_name}</td>
                                      <td className="py-1.5 text-right text-muted-foreground">{lvl.sla_hours}h</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
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
