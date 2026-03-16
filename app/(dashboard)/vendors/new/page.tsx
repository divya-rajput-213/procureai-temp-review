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
import { ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle, Send, Save, X, Plus, FileText, ExternalLink, Upload } from 'lucide-react'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
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

const steps = ['Company Details', 'Compliance & Docs', 'Review & Submit']

// Step 0 fields — always required
const STEP0_FIELDS: (keyof VendorForm)[] = [
  'category', 'plant', 'company_name', 'contact_name', 'contact_email',
  'contact_phone', 'address', 'city', 'state', 'pincode',
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-1">{children}</p>
}

function stepCircleClass(i: number, current: number): string {
  if (i === current) return 'bg-primary text-white'
  if (i < current) return 'bg-green-500 text-white'
  return 'bg-slate-200 text-slate-500'
}

function inputCls(hasError: boolean, isExtracted: boolean): string {
  if (hasError) return 'border-destructive'
  if (isExtracted) return 'border-purple-200 bg-purple-50'
  return ''
}

function DocFileInput({ chosen, onSelect, onClear, hasError }: Readonly<{
  chosen: File | null
  onSelect: (file: File) => void
  onClear: () => void
  hasError?: boolean
}>) {
  return (
    <div className={`flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[36px] ${hasError ? 'border-destructive' : ''}`}>
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{chosen?.name ?? 'No file chosen'}</span>
      <div className="flex items-center gap-1 shrink-0">
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-slate-50 transition-colors">Choose</span>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
        </label>
        {chosen && (
          <button type="button" onClick={onClear} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  )
}

function DocUploadWidget({ vendorId, docType, doc, onRefresh }: {
  vendorId: string
  docType: string
  doc: any | null
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('doc_type', docType)
      await apiClient.post(`/vendors/${vendorId}/documents/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onRefresh()
      toast({ title: 'Document uploaded.' })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally { setUploading(false) }
  }

  const remove = async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await apiClient.delete(`/vendors/${vendorId}/documents/${doc.hash_id ?? doc.id}/`)
      onRefresh()
      toast({ title: 'Document removed.' })
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  if (doc) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[36px]">
        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs truncate flex-1 min-w-0">{doc.original_filename}</span>
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noreferrer" className="shrink-0">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </a>
        )}
        <button type="button" onClick={remove} disabled={deleting}
          className="shrink-0 text-red-400 hover:text-red-600 disabled:opacity-50">
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[36px]">
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">No file chosen</span>
      <label className="cursor-pointer shrink-0">
        <span className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-slate-50 transition-colors">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Choose
        </span>
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      </label>
    </div>
  )
}

// ── Schema ────────────────────────────────────────────────────────────────────
const ALPHANUM_WITH_SPACES = /^[a-z0-9 ]+$/i
const ALPHANUM_ONLY = /^[a-z0-9]+$/i
const DIGITS_ONLY = /^[0-9]+$/

// Compliance fields (GST, PAN, bank) are optional at creation.
// They are enforced by the backend only at submit-for-approval time.
const schema = z.object({
  company_name:  z.string().min(2, 'Company name is required'),
  contact_name:  z.string().min(2, 'Contact person is required'),
  contact_email: z.string().email('Valid email required'),
  contact_phone: z.string()
    .min(10, 'Contact phone must be at least 10 digits')
    .regex(DIGITS_ONLY, 'Contact phone must contain only numbers'),
  address:       z.string().min(5, 'Address is required'),
  city:          z.string()
    .min(1, 'City is required')
    .max(50, 'City must be at most 50 characters')
    .regex(ALPHANUM_WITH_SPACES, 'City must be alphanumeric'),
  state:         z.string()
    .min(1, 'State is required')
    .max(50, 'State must be at most 50 characters')
    .regex(ALPHANUM_WITH_SPACES, 'State must be alphanumeric'),
  pincode:       z.string()
    .min(1, 'PIN Code is required')
    .regex(ALPHANUM_ONLY, 'PIN Code must be alphanumeric'),
  category:      z.number({ required_error: 'Category is required' }),
  plant:         z.number({ required_error: 'Plant is required' }),
  // Optional at creation, required before approval
  gst_number:    z.string().optional().or(z.literal('')),
  pan_number:    z.string().optional().or(z.literal('')),
  bank_account:  z.string().optional().or(z.literal('')),
  bank_ifsc:     z.string().optional().or(z.literal('')),
  bank_name:     z.string().optional().or(z.literal('')),
  is_msme:       z.boolean().optional(),
  msme_number:   z.string().optional(),
  is_sez:        z.boolean().optional(),
})

type VendorForm = z.infer<typeof schema>

function missingComplianceFields(v: Partial<VendorForm>): string[] {
  const m: string[] = []
  if (!v.gst_number)   m.push('GST Number')
  if (!v.pan_number)   m.push('PAN Number')
  if (!v.bank_account || !v.bank_ifsc || !v.bank_name) m.push('Bank Details')
  return m
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewVendorPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState('')

  // SRF
  const [srfExtracting, setSrfExtracting] = useState(false)
  const [extractedFields, setExtractedFields] = useState<Record<string, { value: string; confidence: number }> | null>(null)
  const [srfMatchRows, setSrfMatchRows] = useState<SrfMatchRow[]>([])
  const [showSrfMatch, setShowSrfMatch] = useState(false)
  const srfInputRef = useRef<HTMLInputElement>(null)

  // Docs
  const [pendingDocs, setPendingDocs] = useState<{ doc_type: string; file: File }[]>([])
  const [otherDocRows, setOtherDocRows] = useState<{ id: number; doc_type: string; title: string; file: File | null }[]>([])

  const setDocFile = (doc_type: string, file: File | null) => {
    if (file) setPendingDocs(prev => [...prev.filter(d => d.doc_type !== doc_type), { doc_type, file }])
    else setPendingDocs(prev => prev.filter(d => d.doc_type !== doc_type))
  }
  const addOtherDocRow = () => setOtherDocRows(prev => [...prev, { id: Date.now(), doc_type: 'other', title: '', file: null }])
  const updateOtherDocRow = (id: number, patch: Partial<{ doc_type: string; title: string; file: File | null }>) =>
    setOtherDocRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  const removeOtherDocRow = (id: number) => setOtherDocRows(prev => prev.filter(r => r.id !== id))

  const { data: categories } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => { const r = await apiClient.get('/vendors/categories/'); return Array.isArray(r.data) ? r.data : r.data.results ?? [] },
  })
  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return Array.isArray(r.data) ? r.data : r.data.results ?? [] },
  })
  // Fetch vendor documents once vendor is created (step >= 1)
  const { data: vendorDocs } = useQuery({
    queryKey: ['vendor-docs', vendorId],
    queryFn: async () => {
      const r = await apiClient.get(`/vendors/${vendorId}/documents/`)
      return r.data.results ?? r.data
    },
    enabled: !!vendorId && step >= 1,
  })
  const refreshDocs = () => queryClient.invalidateQueries({ queryKey: ['vendor-docs', vendorId] })
  const docOf = (type: string) => (vendorDocs ?? []).find((d: any) => d.doc_type === type) ?? null

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'vendor_onboarding'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/?matrix_type=vendor_onboarding&is_active=true')
      return r.data.results ?? r.data
    },
    enabled: step === 2,
  })

  const { register, handleSubmit, setValue, watch, trigger, getValues, formState: { errors } } =
    useForm<VendorForm>({
      resolver: zodResolver(schema),
      mode: 'onChange',
      reValidateMode: 'onChange',
    })

  const watchedCategory = watch('category')
  const watchedPlant    = watch('plant')
  const watchedIsMsme   = watch('is_msme')
  const watchedIsSez    = watch('is_sez')

  // ── Upload docs helper ───────────────────────────────────────────────────────
  const uploadDocs = async (vid: string) => {
    for (const doc of pendingDocs) {
      const fd = new FormData(); fd.append('file', doc.file); fd.append('doc_type', doc.doc_type)
      try { await apiClient.post(`/vendors/${vid}/documents/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }) } catch { /* non-fatal */ }
    }
    for (const row of otherDocRows.filter(r => r.file)) {
      const fd = new FormData()
      fd.append('file', row.file as File)
      fd.append('doc_type', row.doc_type)
      fd.append('title', row.title.trim() || (row.file as File).name)
      try { await apiClient.post(`/vendors/${vid}/documents/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }) } catch { /* non-fatal */ }
    }
  }

  const apiErrorMsg = (err: any): string => {
    const d = err?.response?.data
    if (!d) return 'Something went wrong.'
    if (typeof d === 'string') return d
    if (d.error) return d.error
    const msgs = Object.values(d).flat() as string[]
    return msgs.join(' ') || 'Please check all fields.'
  }

  // ── Step 0: create vendor draft (company info only) ──────────────────────────
  const step0Mutation = useMutation({
    mutationFn: async (data: VendorForm) => {
      const { data: vendor } = await apiClient.post('/vendors/', {
        company_name: data.company_name, category: data.category, plant: data.plant,
        contact_name: data.contact_name, contact_email: data.contact_email, contact_phone: data.contact_phone,
        address: data.address, city: data.city, state: data.state, pincode: data.pincode,
      })
      return vendor
    },
    onSuccess: (vendor) => { setVendorId(vendor.hash_id ?? vendor.id); queryClient.invalidateQueries({ queryKey: ['vendors'] }); setStep(1) },
    onError: (err: any) => toast({ title: 'Save failed', description: apiErrorMsg(err), variant: 'destructive' }),
  })

  // ── Step 1: patch compliance fields ─────────────────────────────────────────
  const step1Mutation = useMutation({
    mutationFn: async (data: VendorForm) => {
      await apiClient.patch(`/vendors/${vendorId}/`, {
        gst_number: data.gst_number || null,
        pan_number: data.pan_number || '',
        bank_account: data.bank_account || '', bank_ifsc: data.bank_ifsc || '', bank_name: data.bank_name || '',
        is_msme: data.is_msme ?? false, msme_number: data.msme_number ?? '',
        is_sez: data.is_sez ?? false,
      })
    },
    onSuccess: () => setStep(2),
    onError: (err: any) => toast({ title: 'Save failed', description: apiErrorMsg(err), variant: 'destructive' }),
  })

  // ── Step 2: submit ────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async ({ mode }: { mode: 'draft' | 'approval' }) => {
      if (mode === 'approval') {
        const body: Record<string, any> = {}
        if (selectedMatrix) body.matrix_id = selectedMatrix
        await apiClient.post(`/vendors/${vendorId}/submit-for-approval/`, body)
      }
      return mode
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: mode === 'approval' ? 'Vendor submitted for approval' : 'Vendor saved as draft' })
      router.push(`/vendors/${vendorId}`)
    },
    onError: (err: any) => setSubmitError(apiErrorMsg(err)),
  })

  // ── Compliance cross-validation (field ↔ doc) ───────────────────────────────
  const [complianceErrors, setComplianceErrors] = useState<Record<string, string>>({})

  const validateCompliancePairs = (): boolean => {
    const data = getValues()
    const errs: Record<string, string> = {}
    const pairs: Array<{ fieldKey: string; fieldLabel: string; docType: string; docLabel: string }> = [
      { fieldKey: 'gst_number', fieldLabel: 'GST Number', docType: 'gst_certificate', docLabel: 'GST Certificate' },
      { fieldKey: 'pan_number', fieldLabel: 'PAN Number', docType: 'pan_card', docLabel: 'PAN Card' },
    ]
    for (const { fieldKey, fieldLabel, docType, docLabel } of pairs) {
      const hasValue = !!(data as any)[fieldKey]
      const hasDoc = !!docOf(docType)
      if (hasValue && !hasDoc) errs[`doc_${docType}`] = `${docLabel} is required when ${fieldLabel} is provided`
      if (hasDoc && !hasValue) errs[`field_${fieldKey}`] = `${fieldLabel} is required when ${docLabel} is uploaded`
    }
    // Bank: any bank field filled → bank doc required, and vice versa
    const hasBankField = !!(data.bank_account || data.bank_ifsc || data.bank_name)
    const hasBankDoc = !!docOf('bank_details')
    if (hasBankField && !hasBankDoc) errs['doc_bank_details'] = 'Bank document is required when bank details are provided'
    if (hasBankDoc && !hasBankField) errs['field_bank_account'] = 'Bank details are required when bank document is uploaded'
    // MSME
    if (data.is_msme) {
      const hasMsmeNum = !!data.msme_number
      const hasMsmeDoc = !!docOf('msme_certificate')
      if (hasMsmeNum && !hasMsmeDoc) errs['doc_msme_certificate'] = 'MSME Certificate is required when MSME Number is provided'
      if (hasMsmeDoc && !hasMsmeNum) errs['field_msme_number'] = 'MSME Number is required when MSME Certificate is uploaded'
    }
    setComplianceErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleStep0Next = async () => {
    const valid = await trigger(STEP0_FIELDS)
    if (!valid) return
    handleSubmit(data => step0Mutation.mutate(data))()
  }

  const handleStep1Next = () => {
    if (!validateCompliancePairs()) return
    step1Mutation.mutate(getValues())
  }

  const handleSaveAsDraft = () => { setSubmitError(''); submitMutation.mutate({ mode: 'draft' }) }

  const handleSubmitForApproval = () => {
    setSubmitError('')
    const missing = missingComplianceFields(getValues())
    if (missing.length > 0) {
      setSubmitError(`Required before submitting: ${missing.join(', ')}.`)
      return
    }
    submitMutation.mutate({ mode: 'approval' })
  }

  const onValidationError = (errs: FieldErrors<VendorForm>) => {
    if (STEP0_FIELDS.some(f => errs[f])) setStep(0)
  }

  // ── SRF ───────────────────────────────────────────────────────────────────────
  const handleSrfFile = async (file: File) => {
    setSrfExtracting(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await apiClient.post('/vendors/extract-srf/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const rows: SrfMatchRow[] = Object.entries(data)
        .filter(([key, v]: [string, any]) => v?.value && key in SRF_FIELD_LABELS)
        .map(([key, v]: [string, any]) => ({ field: key, label: SRF_FIELD_LABELS[key], value: v.value, confidence: v.confidence ?? 0, include: true }))
      setSrfMatchRows(rows); setShowSrfMatch(true)
    } catch { toast({ title: 'SRF extraction failed', variant: 'destructive' })
    } finally { setSrfExtracting(false) }
  }

  const applySrfMatches = () => {
    const applied: Record<string, { value: string; confidence: number }> = {}
    srfMatchRows.filter(r => r.include).forEach(r => { setValue(r.field as any, r.value); applied[r.field] = { value: r.value, confidence: r.confidence } })
    setExtractedFields(applied); setShowSrfMatch(false)
    toast({ title: 'Fields applied', description: 'Review highlighted fields below.' })
  }

  const confidenceBadge = (c: number) =>
    c >= 0.8 ? <Badge variant="success" className="text-xs ml-1">High</Badge>
    : c >= 0.5 ? <Badge variant="warning" className="text-xs ml-1">Check</Badge>
    : null

  const srfConfidenceBadge = (c: number) =>
    c >= 0.8 ? <Badge variant="success" className="text-xs">High</Badge>
    : c >= 0.5 ? <Badge variant="warning" className="text-xs">Check</Badge>
    : <Badge variant="secondary" className="text-xs">Low</Badge>

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {srfExtracting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-3" />
          <p className="text-sm font-medium">Extracting with AI…</p>
          <p className="text-xs text-muted-foreground mt-1">Analysing SRF Excel file</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Register New Vendor</h1>
        <div className="flex items-center gap-2">
          {step === 0 && (
            <>
              {extractedFields && !showSrfMatch && (
                <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Fields applied</span>
              )}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={srfExtracting}
                onClick={() => srfInputRef.current?.click()}>
                {srfExtracting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
                {srfExtracting ? 'Extracting…' : 'Upload SRF for AI Fill'}
              </Button>
              <input ref={srfInputRef} type="file" className="hidden" accept=".xlsx" disabled={srfExtracting}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSrfFile(f); e.target.value = '' }} />
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => router.push('/vendors')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      {/* SRF Review panel */}
      {showSrfMatch && srfMatchRows.length > 0 && (() => {
        const selected = srfMatchRows.filter(r => r.include).length
        return (
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="text-sm font-medium">AI Extracted Fields</span>
                </div>
                <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{selected}</span> of {srfMatchRows.length} selected</span>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" className="text-purple-600 hover:underline"
                    onClick={() => setSrfMatchRows(rows => rows.map(r => ({ ...r, include: true })))}>Select all</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" className="text-slate-500 hover:underline"
                    onClick={() => setSrfMatchRows(rows => rows.map(r => ({ ...r, include: false })))}>Deselect all</button>
                </div>
              </div>
              <button type="button" onClick={() => setShowSrfMatch(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b">
                  <th className="w-10 px-4 py-3 text-left">
                    <input type="checkbox" className="accent-purple-600 w-4 h-4"
                      checked={srfMatchRows.every(r => r.include)}
                      onChange={e => setSrfMatchRows(rows => rows.map(r => ({ ...r, include: e.target.checked })))} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-52">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extracted Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {srfMatchRows.map((row, i) => (
                  <tr key={row.field} className={`transition-colors ${
                    !row.include ? 'opacity-40 bg-slate-50' :
                    row.confidence >= 0.8 ? 'bg-green-50/50' :
                    row.confidence >= 0.5 ? 'bg-amber-50/50' : 'bg-red-50/40'}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" className="accent-purple-600 w-4 h-4" checked={row.include}
                        onChange={e => setSrfMatchRows(prev => prev.map((r, j) => j === i ? { ...r, include: e.target.checked } : r))} />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{row.label}</td>
                    <td className="px-4 py-2.5">
                      <Input value={row.value} disabled={!row.include} className="h-8 text-sm"
                        onChange={e => setSrfMatchRows(prev => prev.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {srfConfidenceBadge(row.confidence)}
                        <span className="text-[11px] text-muted-foreground">{Math.round(row.confidence * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t px-5 py-3 bg-slate-50 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selected}</span> field{selected !== 1 ? 's' : ''} will be applied
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSrfMatch(false)}>Cancel</Button>
                <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 min-w-[140px]"
                  onClick={applySrfMatches} disabled={selected === 0}>
                  <CheckCircle className="w-3.5 h-3.5" /> Apply to Form
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Step indicators */}
      {!showSrfMatch && (
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
      )}

      {/* ── Step 0: Company Details ─────────────────────────────────────────────── */}
      {!showSrfMatch && step === 0 && (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <SectionTitle>General Information</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Vendor Category <span className="text-destructive">*</span></Label>
                <select
                  className={`w-full h-10 border rounded-md px-3 text-sm bg-background ${errors.category ? 'border-destructive ring-1 ring-destructive/30' : ''}`}
                  value={watchedCategory ?? ''}
                  onChange={e => setValue('category', e.target.value ? Number(e.target.value) : (undefined as any), { shouldValidate: true })}
                >
                  <option value="">Select category</option>
                  {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.series_code} — {c.name}</option>)}
                </select>
                {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Plant <span className="text-destructive">*</span></Label>
                <select
                  className={`w-full h-10 border rounded-md px-3 text-sm bg-background ${errors.plant ? 'border-destructive ring-1 ring-destructive/30' : ''}`}
                  value={watchedPlant ?? ''}
                  onChange={e => setValue('plant', e.target.value ? Number(e.target.value) : (undefined as any), { shouldValidate: true })}
                >
                  <option value="">Select plant</option>
                  {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
                {errors.plant && <p className="text-xs text-destructive mt-1">{errors.plant.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Company Name <span className="text-destructive">*</span>
                  {extractedFields?.company_name && confidenceBadge(extractedFields.company_name.confidence)}
                </Label>
                <Input placeholder="e.g. Acme Pvt Ltd" {...register('company_name')}
                  className={`${errors.company_name ? 'border-destructive ring-1 ring-destructive/30' : ''} ${extractedFields?.company_name ? 'border-purple-200 bg-purple-50' : ''}`} />
                {errors.company_name && <p className="text-xs text-destructive mt-1">{errors.company_name.message}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Address <span className="text-destructive">*</span>
                  {extractedFields?.address && confidenceBadge(extractedFields.address.confidence)}
                </Label>
                <AddressAutocomplete
                  value={watch('address') ?? ''}
                  onChange={v => setValue('address', v, { shouldValidate: true })}
                  onSelect={result => {
                    setValue('address', result.address, { shouldValidate: true })
                    if (result.city) setValue('city', result.city, { shouldValidate: true })
                    if (result.state) setValue('state', result.state, { shouldValidate: true })
                    if (result.pincode) setValue('pincode', result.pincode, { shouldValidate: true })
                  }}
                  placeholder="Start typing an address…"
                  className={`h-10 text-sm ${errors.address ? 'border-destructive ring-1 ring-destructive/30' : ''} ${extractedFields?.address ? 'border-purple-200 bg-purple-50' : ''}`}
                />
                {errors.address && <p className="text-xs text-destructive mt-1">{errors.address.message}</p>}
              </div>

              {[
                { name: 'city',    label: 'City',     placeholder: 'e.g. Mumbai' },
                { name: 'state',   label: 'State',    placeholder: 'e.g. Maharashtra' },
                { name: 'pincode', label: 'PIN Code', placeholder: 'e.g. 400001', autoComplete: 'postal-code' },
              ].map(({ name, label, placeholder, autoComplete }) => (
                <div key={name} className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    {label} <span className="text-destructive">*</span>
                    {extractedFields?.[name] && confidenceBadge(extractedFields[name].confidence)}
                  </Label>
                  <Input placeholder={placeholder} autoComplete={autoComplete} {...register(name as keyof VendorForm)}
                    className={`${errors[name as keyof VendorForm] ? 'border-destructive ring-1 ring-destructive/30' : ''} ${extractedFields?.[name] ? 'border-purple-200 bg-purple-50' : ''}`} />
                  {errors[name as keyof VendorForm] && (
                    <p className="text-xs text-destructive mt-1">{(errors[name as keyof VendorForm] as any)?.message}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'contact_name',  label: 'Contact Person', placeholder: 'e.g. John Doe' },
                { name: 'contact_email', label: 'Contact Email',  placeholder: 'e.g. john@acme.com' },
                { name: 'contact_phone', label: 'Contact Phone',  placeholder: 'e.g. 9876543210', inputMode: 'numeric', pattern: '[0-9]*' },
              ].map(({ name, label, placeholder, inputMode, pattern }) => (
                <div key={name} className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    {label} <span className="text-destructive">*</span>
                    {extractedFields?.[name] && confidenceBadge(extractedFields[name].confidence)}
                  </Label>
                  <Input placeholder={placeholder} inputMode={inputMode} pattern={pattern} {...register(name as keyof VendorForm)}
                    className={`${errors[name as keyof VendorForm] ? 'border-destructive ring-1 ring-destructive/30' : ''} ${extractedFields?.[name] ? 'border-purple-200 bg-purple-50' : ''}`} />
                  {errors[name as keyof VendorForm] && (
                    <p className="text-xs text-destructive mt-1">{(errors[name as keyof VendorForm] as any)?.message}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleStep0Next} disabled={step0Mutation.isPending} className="gap-1">
                {step0Mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Save & Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Compliance & Docs (all optional) ───────────────────────────── */}
      {!showSrfMatch && step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance & Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              All fields are optional here. GST, PAN and bank details will be required before submitting for approval.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* GST */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start ${complianceErrors['field_gst_number'] || complianceErrors['doc_gst_certificate'] ? 'border-destructive/50' : ''}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">GST Number{extractedFields?.gst_number && confidenceBadge(extractedFields.gst_number.confidence)}</Label>
                <Input placeholder="e.g. 27AAAAA0000A1Z5" {...register('gst_number')}
                  className={`${complianceErrors['field_gst_number'] ? 'border-destructive ring-1 ring-destructive/30' : ''} ${inputCls(!!errors.gst_number, !!extractedFields?.gst_number)}`} />
                {complianceErrors['field_gst_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_gst_number']}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">GST Certificate</Label>
                <DocUploadWidget vendorId={vendorId!} docType="gst_certificate"
                  doc={docOf('gst_certificate')} onRefresh={refreshDocs} />
                {complianceErrors['doc_gst_certificate'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_gst_certificate']}</p>}
              </div>
            </div>

            {/* PAN */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start ${complianceErrors['field_pan_number'] || complianceErrors['doc_pan_card'] ? 'border-destructive/50' : ''}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">PAN Number{extractedFields?.pan_number && confidenceBadge(extractedFields.pan_number.confidence)}</Label>
                <Input placeholder="e.g. AAAAA9999A" {...register('pan_number')}
                  className={`${complianceErrors['field_pan_number'] ? 'border-destructive ring-1 ring-destructive/30' : ''} ${inputCls(!!errors.pan_number, !!extractedFields?.pan_number)}`} />
                {complianceErrors['field_pan_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_pan_number']}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">PAN Card</Label>
                <DocUploadWidget vendorId={vendorId!} docType="pan_card"
                  doc={docOf('pan_card')} onRefresh={refreshDocs} />
                {complianceErrors['doc_pan_card'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_pan_card']}</p>}
              </div>
            </div>

            {/* Bank Details */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start ${complianceErrors['field_bank_account'] || complianceErrors['doc_bank_details'] ? 'border-destructive/50' : ''}`}>
              <div className="space-y-2">
                {[
                  { name: 'bank_account', label: 'Bank Account No', placeholder: 'e.g. 12345678901234' },
                  { name: 'bank_ifsc',    label: 'Bank IFSC',       placeholder: 'e.g. HDFC0001234' },
                  { name: 'bank_name',    label: 'Bank Name',       placeholder: 'e.g. HDFC Bank' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">{label}{extractedFields?.[name] && confidenceBadge(extractedFields[name].confidence)}</Label>
                    <Input placeholder={placeholder} {...register(name as keyof VendorForm)}
                      className={`${complianceErrors['field_bank_account'] ? 'border-destructive ring-1 ring-destructive/30' : ''} ${inputCls(!!errors[name as keyof VendorForm], !!extractedFields?.[name])}`} />
                    {errors[name as keyof VendorForm] && (
                      <p className="text-xs text-destructive mt-1">{(errors[name as keyof VendorForm] as any)?.message}</p>
                    )}
                  </div>
                ))}
                {complianceErrors['field_bank_account'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_bank_account']}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Bank Details / Cancelled Cheque</Label>
                <DocUploadWidget vendorId={vendorId!} docType="bank_details"
                  doc={docOf('bank_details')} onRefresh={refreshDocs} />
                {complianceErrors['doc_bank_details'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_bank_details']}</p>}
              </div>
            </div>

            {/* MSME / SEZ */}
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register('is_msme')} className="rounded" />
                <span>MSME Registered</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register('is_sez')} className="rounded" />
                <span>SEZ Unit</span>
              </label>
            </div>

            {watchedIsMsme && (
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start ${complianceErrors['field_msme_number'] || complianceErrors['doc_msme_certificate'] ? 'border-destructive/50' : ''}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">MSME Number</Label>
                  <Input placeholder="e.g. UDYAM-MH-00-0000000" {...register('msme_number')}
                    className={complianceErrors['field_msme_number'] ? 'border-destructive ring-1 ring-destructive/30' : ''} />
                  {complianceErrors['field_msme_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_msme_number']}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">MSME Certificate</Label>
                  <DocUploadWidget vendorId={vendorId!} docType="msme_certificate"
                    doc={docOf('msme_certificate')} onRefresh={refreshDocs} />
                  {complianceErrors['doc_msme_certificate'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_msme_certificate']}</p>}
                </div>
              </div>
            )}

            {watchedIsSez && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">SEZ Unit</Label>
                  <p className="text-sm text-muted-foreground">SEZ registered vendor</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">SEZ Certificate</Label>
                  <DocUploadWidget vendorId={vendorId!} docType="sez_certificate"
                    doc={docOf('sez_certificate')} onRefresh={refreshDocs} />
                </div>
              </div>
            )}

            {/* Incorporation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Incorporation Certificate</Label>
                <p className="text-sm text-muted-foreground">Company registration / MOA documents</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Upload Document</Label>
                <DocUploadWidget vendorId={vendorId!} docType="incorporation"
                  doc={docOf('incorporation')} onRefresh={refreshDocs} />
              </div>
            </div>

            {/* Other Documents */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Other Documents</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Quality certs, trade licences, NDAs, insurance, etc.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addOtherDocRow}>
                  <Plus className="w-3.5 h-3.5" /> Add Document
                </Button>
              </div>
              {otherDocRows.length === 0 && <p className="text-xs text-muted-foreground italic">No additional documents added.</p>}
              {otherDocRows.map(row => (
                <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end border rounded-md p-3 bg-slate-50/60">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Document Type</Label>
                    <select value={row.doc_type} onChange={e => updateOtherDocRow(row.id, { doc_type: e.target.value })}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-background">
                      {OTHER_DOC_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Title</Label>
                    <Input value={row.title} onChange={e => updateOtherDocRow(row.id, { title: e.target.value })}
                      placeholder="e.g. ISO 9001 — 2024" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">File</Label>
                    <DocFileInput chosen={row.file} onSelect={f => updateOtherDocRow(row.id, { file: f })}
                      onClear={() => updateOtherDocRow(row.id, { file: null })} />
                  </div>
                  <button type="button" onClick={() => removeOtherDocRow(row.id)}
                    className="h-9 w-9 flex items-center justify-center text-red-400 hover:text-red-600 border rounded-md hover:bg-red-50 transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {otherDocRows.some(r => !r.file) && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Rows without a file selected will be skipped on save.
                </p>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="button" onClick={handleStep1Next} disabled={step1Mutation.isPending} className="gap-1">
                {step1Mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Save & Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Review & Submit ─────────────────────────────────────────────── */}
      {!showSrfMatch && step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>

            <p className="text-sm text-muted-foreground mt-1">
              Save as draft to continue editing later, or select an approval matrix and submit for approval.
              <span className="font-medium text-foreground"> GST, PAN and bank details are required before submitting for approval.</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {matrices === undefined && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
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
                onSelect={(id) => { setSelectedMatrix(id); setExpandedMatrix(id) }}
                onToggleExpand={(id) => setExpandedMatrix(prev => prev === id ? null : id)}
              />
            )}

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="flex justify-between gap-3 pt-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleSaveAsDraft}
                  disabled={submitMutation.isPending} className="gap-2">
                  {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save as Draft
                </Button>
                <Button type="button" onClick={handleSubmitForApproval}
                  disabled={submitMutation.isPending || (selectedMatrix === null && !!matrices && matrices.length > 0)}
                  className="gap-2">
                  {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
