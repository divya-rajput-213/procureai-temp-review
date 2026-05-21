'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import apiClient from '@/lib/api/client'
import { COMPANY_NAME_ALLOWED, ALPHA_SPACE_ONLY, ADDRESS_ALLOWED, COMPANY_NAME_ALLOWED_PARTIAL, ADDRESS_ALLOWED_PARTIAL, ALPHA_SPACE_PARTIAL } from '@/lib/utils'
import { DOC_CONFIG, PHONE_PREFIX, PHONE_ALLOWED_CHARS, DIGITS_ONLY, PINCODE_DIGITS_ONLY } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CommonConfirmModal } from '@/components/shared/CommonModal'

/* ─── Types ──────────────────────────────────────────────────────────────── */

type SrfMatchRow = { field: string; label: string; value: string; confidence: number; include: boolean }

type FieldConfig = {
  name: keyof VendorForm
  label: string
  placeholder: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  pattern?: string
  maxLength?: number
}

const SRF_FIELD_LABELS: Record<string, string> = {
  company_name: 'Company Name',
  address: 'Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  pincode: 'PIN Code',
  contact_name: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  gst_number: 'GST Number',
  pan_number: 'PAN Number',
  bank_account: 'Bank Account No',
  bank_ifsc: 'Bank IFSC',
  bank_name: 'Bank Name',
  msme_number: 'MSME Number',
}


const contactFields: FieldConfig[] = [
  { name: 'contact_name', label: 'Contact Person', placeholder: 'e.g. John Doe', maxLength: 50 },
  { name: 'contact_email', label: 'Contact Email', placeholder: 'e.g. john@acme.com' },
  { name: 'contact_phone', label: 'Contact Phone', placeholder: 'e.g. +91 9876543210', pattern: '[0-9]*', maxLength: 14 },
]

const STEP0_FIELDS: (keyof VendorForm)[] = [
  'category', 'plant', 'company_name', 'contact_name', 'contact_email',
  'contact_phone', 'address', 'city', 'state', 'country', 'pincode',
]

/* ─── Schema (unchanged from original) ──────────────────────────────────── */

const schema = z.object({
  company_name: z.string()
    .min(2, 'Company name is required')
    .regex(COMPANY_NAME_ALLOWED, 'Company name can contain only letters, numbers, spaces, &, ., ,, -, and _.')
    .max(150, 'Company name must be at most 150 characters'),
  contact_name: z.string()
    .min(2, 'Contact person is required')
    .regex(ALPHA_SPACE_ONLY, 'Contact person can contain only letters, & and spaces..'),
  contact_email: z.string().email('Valid email required'),
  contact_phone: z.string()
    .refine(v => PHONE_ALLOWED_CHARS.test(v), 'Contact phone must contain only numbers')
    .refine(v => /^\+91\d{10}$/.test(v.replace(/\s/g, '')), 'Contact phone must be +91 followed by 10 digits'),
  address: z.string({ required_error: 'Address is required', invalid_type_error: 'Address is required' })
    .min(5, 'Address is required')
    .regex(ADDRESS_ALLOWED, 'Address can contain only letters, numbers, spaces, and /, #, -, ., ,, _, (, ).')
    .max(250, 'Address must be at most 250 characters'),
  city: z.string().min(1, 'City is required').max(50).regex(ALPHA_SPACE_ONLY, 'City can contain only letters and spaces.'),
  state: z.string().min(1, 'State is required').max(50).regex(ALPHA_SPACE_ONLY, 'State can contain only letters and spaces.'),
  country: z.string().default('India').refine(v => v.trim().toLowerCase() === 'india', { message: 'Country must be India.' }),
  pincode: z.string().min(1, 'PIN Code is required').regex(DIGITS_ONLY, 'PIN Code must contain only numbers').length(6, 'PIN Code must be 6 digits'),
  category: z.number({ required_error: 'Category is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  gst_number: z.string().optional().or(z.literal('')),
  pan_number: z.string().optional().or(z.literal('')),
  bank_account: z.string().optional().or(z.literal('')),
  bank_ifsc: z.string().optional().or(z.literal('')),
  bank_name: z.string().optional().or(z.literal('')),
  is_msme: z.boolean().optional(),
  msme_number: z.string().optional(),
  is_sez: z.boolean().optional(),
})

type VendorForm = z.infer<typeof schema>

function missingComplianceFields(v: Partial<VendorForm>): string[] {
  const m: string[] = []
  if (!v.gst_number) m.push('GST Number')
  if (!v.pan_number) m.push('PAN Number')
  if (!v.bank_account || !v.bank_ifsc || !v.bank_name) m.push('Bank Details')
  return m
}

/* ─── Small helpers ──────────────────────────────────────────────────────── */

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  { bg: '#EEEDFE', tx: '#3C3489' },
  { bg: '#E6F1FB', tx: '#0C447C' },
  { bg: '#E1F5EE', tx: '#0F6E56' },
  { bg: '#FAEEDA', tx: '#854F0B' },
  { bg: '#EAF3DE', tx: '#3B6D11' },
]

function colorForName(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}
/* ─── DocUploadWidget (matches HTML upload zone + file preview) ───────────── */

function DocUploadWidget({
  vendorId, docType, doc, onRefresh, setFieldError, dropLabel, hint, isReadOnly, onValidTillChange,
}: Readonly<{
  vendorId: string
  docType: string
  doc: any | null
  onRefresh: () => void
  setFieldError?: (msg: string) => void
  dropLabel?: string
  hint?: string
  isReadOnly?: boolean
  onValidTillChange?: (val: string | null) => void
}>) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [localValidTill, setLocalValidTill] = useState<string | null>(doc?.valid_till ?? null)

  useEffect(() => {
    const vt = doc?.valid_till ?? null
    setLocalValidTill(vt)
    onValidTillChange?.(vt)
  }, [doc?.valid_till])

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Max file size is 5 MB', variant: 'destructive' }); return
    }
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Only PDF, JPG, PNG files are allowed', variant: 'destructive' }); return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      const config = DOC_CONFIG[docType]
      fd.append('file', file)
      fd.append('doc_type', config?.docType?.trim() || docType.trim())
      fd.append('title', config?.title?.trim() || file.name.trim())
      const res = await apiClient.post(`/vendors/${vendorId}/documents/`, fd)
      const data = res.data
      if (data?.ai_validation_status === 'invalid' || data?.ai_validation_status === 'failed') {
        setFieldError?.(data?.ai_validation_notes || `${docType} validation failed`)
      } else {
        setFieldError?.('')
        const vt = data?.valid_till ?? null
        setLocalValidTill(vt)
        onValidTillChange?.(vt)
      }
      onRefresh()
    } catch (err: any) {
      const errData = err?.response?.data
      const notes = errData?.ai_validation_notes || errData?.error || 'Upload failed'
      setFieldError?.(notes)
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await apiClient.delete(`/vendors/${vendorId}/documents/${doc.hash_id ?? doc.id}/`)
      setLocalValidTill(null)
      onValidTillChange?.(null)
      onRefresh()
      setFieldError?.('')
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const status = doc?.ai_validation_status
  const isFailed = status === 'failed' || status === 'invalid'
  const isVerified = status === 'passed' || status === 'valid' || status === 'warning'

  if (doc) {
    const validTill = localValidTill
    const daysLeft = validTill
      ? Math.ceil((new Date(validTill).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null
    const isExpired = daysLeft !== null && daysLeft < 0
    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
    const expiryColor = isExpired ? 'var(--red-tx)' : isExpiringSoon ? '#d97706' : '#64748b'
    const expiryLabel = validTill
      ? isExpired
        ? `Expired ${new Date(validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : isExpiringSoon
          ? `Expiring in ${daysLeft}d`
          : `Valid till ${new Date(validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : null

    return (
      <div>
        <div className="ufile" style={isFailed ? { borderColor: 'var(--red-bd)' } : isVerified ? { borderColor: 'var(--grn-bd, var(--bd))' } : {}}>
          <div className="ufile-ic" style={isFailed ? { background: 'var(--red-bg)', color: 'var(--red-tx)' } : isVerified ? { background: 'var(--grn-bg)', color: 'var(--grn-tx)' } : {}}>
            <i className={`ti ${isFailed ? 'ti-file-alert' : isVerified ? 'ti-file-check' : 'ti-file-text'}`} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ufile-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.original_filename}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="ufile-size" style={isFailed ? { color: 'var(--red-tx)' } : isVerified ? { color: 'var(--grn-tx)' } : {}}>
                {isFailed ? 'Validation failed' : isVerified ? 'Verified ✓' : 'Uploaded'}
              </div>
              {expiryLabel && (
                <span style={{ fontSize: 10, fontWeight: 600, color: expiryColor, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {(isExpired || isExpiringSoon) && <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} />}
                  {expiryLabel}
                </span>
              )}
            </div>
          </div>
          {doc.file_url && (
            <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blu-tx)', flexShrink: 0 }}>View</a>
          )}
          {!isReadOnly && (
            <button type="button" className="ufile-del" onClick={remove} disabled={deleting} title="Remove">
              {deleting ? <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> : <i className="ti ti-x" />}
            </button>
          )}
        </div>
        {isFailed && doc.ai_validation_notes && (
          <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{doc.ai_validation_notes}
          </div>
        )}
      </div>
    )
  }

  if (isReadOnly) return null

  if (uploading) {
    return (
      <div className="upz" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'default', borderColor: 'var(--blu-bd, var(--bdm))' }}>
        <div style={{ width: 32, height: 32, border: '2.5px solid var(--blu-bd, #2563eb)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--blu-tx)' }}>Uploading…</div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Validating with AI, please wait</div>
      </div>
    )
  }

  return (
    <label
      className={`upz${dragging ? ' drag' : ''}`}
      style={{ display: 'block' }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f) }}
    >
      <input
        type="file"
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
      />
      <div className="upz-ic"><i className={`ti ${dragging ? 'ti-download' : 'ti-cloud-upload'}`} /></div>
      <div className="upz-txt">{dragging ? 'Drop to upload' : (dropLabel || 'Drag & drop file here')}</div>
      <div className="upz-sub">{hint || 'PDF, JPG or PNG · max 5 MB · Data will be auto-extracted'}</div>
    </label>
  )
}

/* ─── Checklist sidebar ──────────────────────────────────────────────────── */

function FormChecklist({ values, isMsme }: { values: Partial<VendorForm>; isMsme: boolean }) {
  const items = [
    { group: 'Step 1 — Company & Contact' },
    { label: 'Company name', done: !!values.company_name, req: true },
    { label: 'Vendor category', done: !!values.category, req: true },
    { label: 'Plant', done: !!values.plant, req: true },
    { label: 'Address & PIN code', done: !!(values.address && values.pincode), req: true },
    { label: 'City & state', done: !!(values.city && values.state), req: true },
    { label: 'Contact person', done: !!values.contact_name, req: true },
    { label: 'Contact email', done: !!values.contact_email, req: true },
    { label: 'Contact phone', done: !!values.contact_phone, req: true },
    { group: 'Step 2 — Documents' },
    { label: 'GST Certificate', done: !!values.gst_number, req: true },
    { label: 'PAN Card', done: !!values.pan_number, req: true },
    { label: 'Bank Verification', done: !!(values.bank_account && values.bank_ifsc && values.bank_name), req: true },
    ...(isMsme ? [{ label: 'MSME Certificate', done: !!values.msme_number, req: true }] : []),
  ]

  const reqItems = items.filter((x): x is { label: string; done: boolean; req: boolean } => 'req' in x && x.req === true)
  const doneReq = reqItems.filter(x => x.done).length
  const totalReq = reqItems.length
  const pct = totalReq ? Math.round((doneReq / totalReq) * 100) : 0

  return (
    <div>
      <div className="cl-progress">
        <div className="cl-prog-bar">
          <div className="cl-prog-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="cl-prog-txt">{doneReq}/{totalReq} required</span>
      </div>
      {items.map((item, i) => {
        if ('group' in item) {
          return <div key={i} className="cl-group">{item.group}</div>
        }
        const { label, done, req } = item
        let cls = done ? 'ci-done' : req ? 'ci-pending' : 'ci-opt'
        let icon = done ? 'ti-circle-check' : req ? 'ti-alert-circle' : 'ti-circle-dashed'
        return (
          <div key={i} className={`checklist-item ${cls}`}>
            <i className={`ti ${icon}`} />
            <span>{label}</span>
            {!req && <span className="cl-opt-tag">optional</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main VendorForm component ──────────────────────────────────────────── */

interface VendorFormProps {
  /** If provided, form is in edit mode and will PATCH this vendor */
  vendorId?: string
  /** Pre-populated values for edit mode */
  initialValues?: Partial<VendorForm>
  /** Called after successful save/submit (e.g. to navigate away) */
  onSuccess?: (vendorId: string) => void
  setIsEditing?: React.Dispatch<React.SetStateAction<boolean>>
  vendorStatus?: string
}

export default function VendorForm({ vendorId: existingVendorId, initialValues, onSuccess, setIsEditing, vendorStatus }: VendorFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = !!existingVendorId
  const isReadOnly = isEdit && vendorStatus !== 'draft'

  const [step, setStep] = useState(isEdit ? 1 : 0)
  const [vendorId, setVendorId] = useState<string | null>(existingVendorId ?? null)
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<() => void>(() => { })

  /* SRF */
  const [srfExtracting, setSrfExtracting] = useState(false)
  const [extractedFields, setExtractedFields] = useState<Record<string, { value: string; confidence: number }> | null>(null)
  const [srfMatchRows, setSrfMatchRows] = useState<SrfMatchRow[]>([])
  const [showSrfMatch, setShowSrfMatch] = useState(false)
  const srfInputRef = useRef<HTMLInputElement>(null)


  /* Queries */
  const { data: categories = [] } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => { const r = await apiClient.get('/vendors/categories/'); return Array.isArray(r.data) ? r.data : r.data.results ?? [] },
  })

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return Array.isArray(r.data) ? r.data : r.data.results ?? [] },
  })

  const { data: vendorDocs } = useQuery({
    queryKey: ['vendor-docs', vendorId],
    queryFn: async () => { const r = await apiClient.get(`/vendors/${vendorId}/documents/`); return r.data.results ?? r.data },
    enabled: !!vendorId && step >= 1,
  })

  const refreshDocs = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vendor-docs', vendorId] })
    if (vendorId) {
      try {
        const { data: v } = await apiClient.get(`/vendors/${vendorId}/`)
        if (v.gst_number) setValue('gst_number', v.gst_number)
        if (v.pan_number) setValue('pan_number', v.pan_number)
        if (v.bank_account) setValue('bank_account', v.bank_account)
        if (v.bank_ifsc) setValue('bank_ifsc', v.bank_ifsc)
        if (v.bank_name) setValue('bank_name', v.bank_name)
        if (v.msme_number) setValue('msme_number', v.msme_number)
      } catch { /* silent */ }
    }
  }

  const docOf = (type: string) => (vendorDocs ?? []).find((d: any) => d.doc_type === type) ?? null

  const [validTillMap, setValidTillMap] = useState<Record<string, string | null>>({})
  const setDocValidTill = (docType: string) => (val: string | null) =>
    setValidTillMap(prev => ({ ...prev, [docType]: val }))

  const ValidTillChip = ({ docType: dt }: { docType: string }) => {
    const vt = validTillMap[dt] ?? docOf(dt)?.valid_till ?? null
    if (!vt) return null
    const days = Math.ceil((new Date(vt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const isExpired = days < 0
    const isSoon = days >= 0 && days <= 30
    const color = isExpired ? 'var(--red-tx)' : isSoon ? '#d97706' : 'var(--tx2)'
    const bg = isExpired ? 'var(--red-bg)' : isSoon ? '#fef3c7' : 'var(--bg-s)'
    const label = isExpired
      ? `Expired ${new Date(vt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : isSoon
        ? `Expiring in ${days}d — ${new Date(vt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : `Valid till ${new Date(vt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 10px', borderRadius: 6, background: bg, border: `1px solid ${isExpired ? 'var(--red-bd)' : isSoon ? '#fde68a' : 'var(--bd)'}`, width: 'fit-content' }}>
        <i className={`ti ${isExpired || isSoon ? 'ti-alert-triangle' : 'ti-calendar-check'}`} style={{ fontSize: 12, color }} />
        <span style={{ fontSize: 11, fontWeight: 600, color }}>Valid Till: {label}</span>
      </div>
    )
  }

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'vendor_onboarding'],
    queryFn: async () => { const r = await apiClient.get('/approvals/matrices/?matrix_type=vendor_onboarding&is_active=true'); return r.data.results ?? r.data },
    enabled: step === 2,
  })

  /* Form */
  const { register, handleSubmit, setValue, watch, trigger, getValues, setError, clearErrors, formState: { errors } } =
    useForm<VendorForm>({
      resolver: zodResolver(schema),
      mode: 'onChange',
      reValidateMode: 'onChange',
      defaultValues: {
        contact_phone: PHONE_PREFIX,
        country: 'India',
        ...initialValues,
      },
    })

  const watchedCategory = watch('category')
  const watchedPlant = watch('plant')
  const watchedIsMsme = watch('is_msme')
  const allValues = watch()

  /* Compliance cross-validation */
  const [complianceErrors, setComplianceErrors] = useState<Record<string, string>>({})
  const [docUploadErrors, setDocUploadErrors] = useState<Record<string, string>>({})
  const setDocError = (docType: string) => (msg: string) =>
    setDocUploadErrors(prev => ({ ...prev, [docType]: msg }))
  const [validationTriggered, setValidationTriggered] = useState(false)
  const [expandedComplianceDocs, setExpandedComplianceDocs] = useState<Record<string, boolean>>({
    gst_certificate: !!initialValues?.gst_number,
    pan_card: !!initialValues?.pan_number,
    bank_details: !!(initialValues?.bank_account || initialValues?.bank_ifsc || initialValues?.bank_name),
    iso_certificate: false,
    msme_certificate: !!initialValues?.is_msme,
    sez_certificate: !!initialValues?.is_sez,
    other_documents: false,
  })
  type IsoRow = { standard: string; custom: string }
  const [isoRows, setIsoRows] = useState<IsoRow[]>([{ standard: '', custom: '' }])
  const isoDocType = (idx: number) => idx === 0 ? 'iso_certificate' : `iso_certificate_${idx}`
  const addIsoRow = () => setIsoRows(prev => [...prev, { standard: '', custom: '' }])
  const removeIsoRow = (idx: number) => setIsoRows(prev => prev.filter((_, i) => i !== idx))
  const updateIsoRow = (idx: number, field: keyof IsoRow, value: string) =>
    setIsoRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))

  const validateCompliancePairs = (): boolean => {
    const data = getValues()
    const errs: Record<string, string> = {}
    if (!data.gst_number?.trim()) errs['field_gst_number'] = 'GST Number is required'
    if (!data.pan_number?.trim()) errs['field_pan_number'] = 'PAN Number is required'
    if (!data.bank_account?.trim() || !data.bank_ifsc?.trim() || !data.bank_name?.trim()) errs['field_bank_account'] = 'Bank Account, IFSC and Bank Name are required'
    if (data.is_msme && !data.msme_number?.trim()) errs['field_msme_number'] = 'MSME Number is required'
    isoRows.forEach((row, idx) => {
      if (row.standard.trim() && !docOf(isoDocType(idx))) errs[`field_iso_${idx}`] = 'Document upload is required'
    })
    setComplianceErrors(errs)
    return Object.keys(errs).length === 0
  }

  useEffect(() => {
    if (!validationTriggered || Object.keys(complianceErrors).length === 0) return
    validateCompliancePairs()
  }, [vendorDocs, allValues.gst_number, allValues.pan_number, allValues.bank_account, allValues.bank_ifsc, allValues.bank_name, watchedIsMsme, allValues.msme_number, isoRows, validationTriggered])

  useEffect(() => {
    if (!validationTriggered) return
    if (complianceErrors['field_gst_number']) setExpandedComplianceDocs(prev => ({ ...prev, gst_certificate: true }))
    if (complianceErrors['field_pan_number']) setExpandedComplianceDocs(prev => ({ ...prev, pan_card: true }))
    if (Object.keys(complianceErrors).some(k => k.startsWith('field_iso_'))) setExpandedComplianceDocs(prev => ({ ...prev, iso_certificate: true }))
  }, [validationTriggered, complianceErrors])

  useEffect(() => { if (step !== 1) setValidationTriggered(false) }, [step])

  const apiErrorMsg = (err: any): string => {
    const d = err?.response?.data
    if (!d) return 'Something went wrong.'
    if (typeof d === 'string') return d
    if (d.error) return d.error
    return (Object.values(d).flat() as string[]).join(' ') || 'Please check all fields.'
  }

  const applyServerFieldErrors = (err: any): boolean => {
    const d = err?.response?.data
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false

    const fieldSet = new Set(Object.keys(getValues()))
    let applied = false

    for (const [key, raw] of Object.entries(d as Record<string, any>)) {
      if (!fieldSet.has(key)) continue

      const msg =
        Array.isArray(raw) ? String(raw[0] ?? '') :
          typeof raw === 'string' ? raw :
            raw?.message ? String(raw.message) :
              ''

      if (!msg) continue
      setError(key as keyof VendorForm, { type: 'server', message: msg })
      applied = true
    }

    return applied
  }

  /* ── Mutations (unchanged) ── */

  const step0Mutation = useMutation({
    mutationFn: async (data: VendorForm) => {
      if (vendorId) {
        const { data: v } = await apiClient.patch(`/vendors/${vendorId}/`, {
          company_name: data.company_name, category: data.category, plant: data.plant,
          contact_name: data.contact_name, contact_email: data.contact_email, contact_phone: data.contact_phone,
          address: data.address, city: data.city, state: data.state, country: data.country, pincode: data.pincode,
        })
        return v
      }
      const { data: vendor } = await apiClient.post('/vendors/', {
        company_name: data.company_name, category: data.category, plant: data.plant,
        contact_name: data.contact_name, contact_email: data.contact_email, contact_phone: data.contact_phone,
        address: data.address, city: data.city, state: data.state, country: data.country, pincode: data.pincode,
      })
      return vendor
    },
    onSuccess: (vendor) => {
      setVendorId(vendor.hash_id ?? vendor.id)
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      setStep(1)
    },
    onError: (err: any) => {
      if (applyServerFieldErrors(err)) return
      toast({ title: 'Save failed', description: apiErrorMsg(err), variant: 'destructive' })
    },
  })

  const step1Mutation = useMutation({
    mutationFn: async (data: VendorForm) => {
      await apiClient.patch(`/vendors/${vendorId}/`, {
        category: data.category,
        plant: data.plant,
        gst_number: data.gst_number || null,
        pan_number: data.pan_number || '',
        bank_account: data.bank_account || "", bank_ifsc: data.bank_ifsc || '', bank_name: data.bank_name || '',
        is_msme: !!docOf('msme_certificate'),
        msme_number: data.msme_number ?? '',
        is_sez: !!docOf('sez_certificate'),
        is_final: true,
      })
    },
    onSuccess: () => setStep(2),
    onError: (err: any) => {
      if (applyServerFieldErrors(err)) return
      toast({ title: 'Save failed', description: apiErrorMsg(err), variant: 'destructive' })
    },
  })

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
      setShowConfirmModal(false)
      router.push('/vendors')
    },
    onError: (err: any) => { setShowConfirmModal(false); setSubmitError(apiErrorMsg(err)) },
  })

  /* ── Handlers (unchanged) ── */

  const handleStep0Next = async () => {
    const valid = await trigger(STEP0_FIELDS)
    if (!valid) return
    handleSubmit(data => step0Mutation.mutate(data))()
  }

  const handleStep1Next = async () => {
    setValidationTriggered(true)
    if (!validateCompliancePairs()) {
      toast({ title: 'Validation failed', description: 'Complete required fields before proceeding.', variant: 'destructive' })
      return
    }
    step1Mutation.mutate(getValues())
  }

  const handleSaveAsDraft = () => { setSubmitError(''); submitMutation.mutate({ mode: 'draft' }) }

  const handleSubmitForApproval = () => {
    setSubmitError('')
    setValidationTriggered(true)
    if (!validateCompliancePairs()) {
      setSubmitError('Please complete all mandatory compliance details (GST, PAN, Bank documents) before submitting for approval.')
      return
    }
    const missing = missingComplianceFields(getValues())
    if (missing.length > 0) {
      setSubmitError(`Required before submitting: ${missing.join(', ')}.`)
      return
    }
    setConfirmAction(() => () => submitMutation.mutate({ mode: 'approval' }))
    setShowConfirmModal(true)
  }

  /* ── SRF ── */

  const handleSrfFile = async (file: File) => {
    setSrfExtracting(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await apiClient.post('/vendors/extract-srf/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const rows: SrfMatchRow[] = Object.entries(data)
        .filter(([key, v]: [string, any]) => v?.value && key in SRF_FIELD_LABELS)
        .map(([key, v]: [string, any]) => ({ field: key, label: SRF_FIELD_LABELS[key], value: v.value, confidence: v.confidence ?? 0, include: true }))
      setSrfMatchRows(rows); setShowSrfMatch(true)
    } catch { toast({ title: 'SRF extraction failed', variant: 'destructive' }) }
    finally { setSrfExtracting(false) }
  }

  const applySrfMatches = () => {
    const applied: Record<string, { value: string; confidence: number }> = {}
    srfMatchRows.filter(r => r.include).forEach(r => { setValue(r.field as any, r.value); applied[r.field] = { value: r.value, confidence: r.confidence } })
    setExtractedFields(applied); setShowSrfMatch(false)
    toast({ title: 'Fields applied', description: 'Review highlighted fields below.' })
  }

  /* ── Step marker rendering ── */

  const stepClass = (i: number) => {
    if (i === step) return 'step active'
    if (i < step) return 'step done'
    return 'step'
  }

  const stepNum = (i: number) => {
    if (i < step) return <i className="ti ti-check" style={{ fontSize: 12 }} />
    return <>{i + 1}</>
  }

  const steps = ['Company & Contact', 'Documents & Finance', 'Submit for Approval']
  const stepSubs = ['Basic info, address, contact person', 'Compliance docs, bank details', 'Review approval chain & confirm']

  /* ── Render ── */

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .vf-root{font-family:'DM Sans',sans-serif;color:var(--tx,#1a1a18)}
        :root{
          --bg:#fff;--bg-s:#f8f8f6;--bg-t:#f2f1ee;
          --tx:#1a1a18;--tx2:#5a5a57;--tx3:#9a9a96;
          --bd:rgba(0,0,0,0.08);--bdm:rgba(0,0,0,0.14);
          --r:8px;--rl:12px;
          --blu-bg:#E6F1FB;--blu-tx:#0C447C;--blu-bd:#185FA5;
          --amb-bg:#FAEEDA;--amb-tx:#854F0B;--amb-bd:#BA7517;
          --red-bg:#FCEBEB;--red-tx:#A32D2D;--red-bd:#E24B4A;
          --grn-bg:#EAF3DE;--grn-tx:#3B6D11;--grn-bd:#639922;
          --tel-bg:#E1F5EE;--tel-tx:#0F6E56;--tel-bd:#1D9E75;
          --gry-bg:#F1EFE8;--gry-tx:#5F5E5A;--gry-bd:#888780;
          --pur-bg:#EEEDFE;--pur-tx:#3C3489;--pur-bd:#7F77DD;
          --mono:'DM Mono',monospace;
        }
        .vf-root .btn{padding:7px 14px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:var(--tx);transition:background 0.15s;text-decoration:none}
        .vf-root .btn:hover{background:var(--bg-t)}
        .vf-root .btn-primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-color:hsl(var(--primary))}
        .vf-root .btn-primary:hover{background:hsl(var(--primary)/0.9)}
        .vf-root .btn-sm{padding:5px 10px;font-size:12px}
        .vf-root .btn-sm i{font-size:12px}
        .vf-root .btn i{font-size:14px}
        .vf-root .step-bar{display:flex;gap:0;margin-bottom:20px;background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden}
        .vf-root .step{flex:1;padding:14px 16px;display:flex;align-items:center;gap:10px;border-right:0.5px solid var(--bd);cursor:pointer;transition:background 0.15s;user-select:none;background:transparent;border-top:none;border-left:none;border-bottom:none;font-family:'DM Sans',sans-serif;text-align:left}
        .vf-root .step:hover{background:var(--bg-t)}
        .vf-root .step:last-child{border-right:none}
        .vf-root .step.done{background:var(--bg-s)}
        .vf-root .step.active{background:var(--bg)}
        .vf-root .step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:var(--bg-t);color:var(--tx3)}
        .vf-root .step.active .step-num{background:#1a1a18;color:#fff}
        .vf-root .step.done .step-num{background:var(--grn-bg);color:var(--grn-tx)}
        .vf-root .step-label{font-size:12px;font-weight:500;color:var(--tx3)}
        .vf-root .step.active .step-label{color:var(--tx);font-weight:600}
        .vf-root .step.done .step-label{color:var(--tx2)}
        .vf-root .step-sub{font-size:11px;color:var(--tx3)}
        .vf-root .form-layout{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}
        @media(max-width:900px){.vf-root .form-layout{grid-template-columns:1fr}}
        .vf-root .form-section{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:16px}
        .vf-root .form-section-head{padding:14px 20px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;gap:10px}
        .vf-root .fsh-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .vf-root .fsh-title{font-size:14px;font-weight:600}
        .vf-root .fsh-sub{font-size:12px;color:var(--tx3);margin-top:1px}
        .vf-root .form-body{padding:20px}
        .vf-root .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        @media(max-width:600px){.vf-root .form-grid{grid-template-columns:1fr}}
        .vf-root .form-group{display:flex;flex-direction:column;gap:5px}
        .vf-root .form-group.full{grid-column:1/-1}
        .vf-root .form-label{font-size:12px;font-weight:600;color:var(--tx2)}
        .vf-root .form-label .req{color:var(--red-bd);margin-left:2px}
        .vf-root .form-input{padding:8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);outline:none;transition:border-color 0.15s;width:100%}
        .vf-root .form-input:focus{border-color:hsl(var(--primary))}
        .vf-root .form-input.ai-fill{border-color:var(--tel-bd)!important;background:var(--tel-bg)!important}
        .vf-root .form-input.border-red{border-color:var(--red-bd)!important}
        .vf-root .form-select{padding:8px 32px 8px 12px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tx);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9a96'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;width:100%;transition:border-color 0.15s}
        .vf-root .form-select:focus{border-color:hsl(var(--primary))}
        .vf-root .form-divider{border:none;border-top:0.5px solid var(--bd);margin:4px 0 8px}
        .vf-root .field-err{font-size:11px;color:var(--red-tx);margin-top:2px}
        .vf-root .form-sidebar .card{background:var(--bg);border:0.5px solid var(--bd);border-radius:var(--rl);overflow:hidden;margin-bottom:14px}
        .vf-root .card-head{padding:13px 16px;border-bottom:0.5px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
        .vf-root .card-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;color:var(--tx)}
        .vf-root .card-title i{font-size:14px;color:var(--tx3)}
        .vf-root .preview-box{padding:16px}
        .vf-root .prev-av{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;margin-bottom:12px}
        .vf-root .prev-name{font-size:15px;font-weight:600;margin-bottom:3px}
        .vf-root .prev-sub{font-size:12px;color:var(--tx3);margin-bottom:10px}
        .vf-root .prev-chips{display:flex;flex-wrap:wrap;gap:5px}
        .vf-root .tag{font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;display:inline-block}
        .vf-root .t-cap{background:var(--pur-bg);color:var(--pur-tx)}
        .vf-root .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;border:0.5px solid transparent}
        .vf-root .c-draft{background:var(--gry-bg);color:var(--gry-tx);border-color:rgba(136,135,128,0.3)}
        .vf-root .checklist-item{display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:0.5px solid var(--bd);font-size:12px}
        .vf-root .checklist-item:last-child{border-bottom:none}
        .vf-root .checklist-item i{font-size:13px;flex-shrink:0}
        .vf-root .ci-done{color:var(--grn-tx)}
        .vf-root .ci-pending{color:var(--red-tx)}
        .vf-root .ci-opt{color:var(--tx3)}
        .vf-root .cl-group{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;padding:8px 14px 4px;background:var(--bg-s)}
        .vf-root .cl-opt-tag{font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;background:var(--gry-bg);color:var(--gry-tx);margin-left:auto;flex-shrink:0}
        .vf-root .cl-progress{padding:10px 14px;display:flex;align-items:center;gap:9px;border-bottom:0.5px solid var(--bd)}
        .vf-root .cl-prog-bar{height:5px;background:var(--bg-t);border-radius:10px;flex:1;overflow:hidden}
        .vf-root .cl-prog-fill{height:100%;background:var(--grn-bd,#639922);border-radius:10px;transition:width .3s}
        .vf-root .cl-prog-txt{font-size:11px;font-weight:600;color:var(--tx3);white-space:nowrap}
	        .vf-root .form-actions{background:var(--bg);border-top:0.5px solid var(--bd);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;bottom:0;z-index:40;margin-top:16px;border-radius:0 0 var(--rl) var(--rl)}
        .vf-root .tog-card{border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:10px}
        .vf-root .tog-card-head{padding:12px 14px;display:flex;align-items:center;justify-content:space-between;background:var(--bg-s)}
        .vf-root .tog-card-body{padding:16px;border-top:0.5px solid var(--bd);background:var(--bg)}
        .vf-root .tog-switch{position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0}
        .vf-root .tog-switch input{opacity:0;width:0;height:0;position:absolute}
        .vf-root .tog-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#d0cfcc;border-radius:22px;transition:.2s}
        .vf-root .tog-slider:before{position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .vf-root .tog-switch input:checked+.tog-slider{background:#1a1a18}
        .vf-root .tog-switch input:checked+.tog-slider:before{transform:translateX(16px)}
        .vf-root .upz{border:1.5px dashed var(--bdm);border-radius:var(--r);padding:20px 16px;text-align:center;cursor:pointer;transition:all .15s;background:var(--bg-s);position:relative;display:block}
        .vf-root .upz:hover{border-color:#1a1a18;background:var(--bg-t)}
        .vf-root .upz-ic{font-size:24px;color:var(--tx3);margin-bottom:6px}
        .vf-root .upz-txt{font-size:13px;font-weight:500;color:var(--tx2)}
        .vf-root .upz-sub{font-size:11px;color:var(--tx3);margin-top:3px}
        .vf-root .ufile{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg-s);border:0.5px solid var(--bd);border-radius:var(--r);margin-bottom:8px}
        .vf-root .ufile-ic{width:30px;height:30px;border-radius:7px;background:var(--blu-bg);color:var(--blu-tx);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
        .vf-root .ufile-name{font-size:12px;font-weight:600;color:var(--tx);flex:1}
        .vf-root .ufile-size{font-size:11px;color:var(--tx3)}
        .vf-root .ufile-del{width:22px;height:22px;border-radius:5px;border:0.5px solid var(--bd);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:12px;flex-shrink:0}
        .vf-root .ufile-del:hover{background:var(--red-bg);color:var(--red-tx);border-color:rgba(226,75,74,.3)}
        .vf-root .parse-strip{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--blu-bg);border-radius:var(--r);font-size:12px;color:var(--blu-tx);margin-top:8px}
        .vf-root .parse-dot{width:6px;height:6px;border-radius:50%;background:var(--blu-tx);animation:pdot 1s infinite alternate;flex-shrink:0}
        @keyframes pdot{from{opacity:.3}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .vf-root .manual-lnk{font-size:12px;color:var(--blu-tx);cursor:pointer;text-decoration:underline;display:inline-flex;align-items:center;gap:4px;background:none;border:none;padding:0;font-family:'DM Sans',sans-serif}
        .vf-root .manual-lnk:hover{color:var(--blu-bd)}
        .vf-root .appr-matrix-table{border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden;margin:0 0 8px}
        .vf-root .appr-matrix-head{display:grid;grid-template-columns:1fr 140px 100px;padding:7px 16px;font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;border-bottom:0.5px solid var(--bd);background:var(--bg-s)}
        .vf-root .appr-lvl-head{display:grid;grid-template-columns:56px 1fr 1fr 72px;padding:7px 16px 7px 42px;font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;border-top:0.5px solid var(--bd);background:var(--bg-s);border-bottom:0.5px solid var(--bd)}
        .vf-root .appr-lvl-row{display:grid;grid-template-columns:56px 1fr 1fr 72px;padding:9px 16px 9px 42px;border-bottom:0.5px solid var(--bd);align-items:center;font-size:12px;background:var(--bg)}
        .vf-root .appr-lvl-row:last-child{border-bottom:none}
        .vf-root .appr-lvl-num{width:22px;height:22px;border-radius:50%;background:#1a1a18;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .vf-root .appr-matrix-row{display:grid;grid-template-columns:1fr 140px 100px;padding:11px 16px;align-items:center;background:var(--bg)}
        .vf-root .appr-radio{width:16px;height:16px;border-radius:50%;border:2px solid var(--blu-bd);background:var(--blu-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px}
        .vf-root .appr-radio::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--blu-bd)}
        .vf-root .other-doc-row{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-s);border:0.5px solid var(--bd);border-radius:var(--r);margin-bottom:8px}
        .vf-root .abt{background:none;border:none;padding:4px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .vf-root .abt.del{color:var(--red-tx);font-size:14px}
        .vf-root .abt.del:hover{background:var(--red-bg)}
        .vf-root .srf-table{width:100%;border-collapse:collapse;font-size:13px}
        .vf-root .srf-table thead tr{background:var(--bg-s);border-bottom:0.5px solid var(--bd)}
        .vf-root .srf-table th{padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px}
        .vf-root .srf-table tbody tr{border-bottom:0.5px solid var(--bd);transition:background .1s}
        .vf-root .srf-table tbody tr:last-child{border-bottom:none}
        .vf-root .srf-high{background:#f0fdf4}
        .vf-root .srf-med{background:#fffbeb}
        .vf-root .srf-low{background:#fff1f2}
        .vf-root .srf-off{background:var(--bg-s);opacity:.4}
        .vf-root .step3-summary{padding:12px 16px;background:var(--bg-s);border-radius:var(--r);margin-bottom:18px;display:flex;align-items:center;gap:12px;border:0.5px solid var(--bd)}
        .vf-root .confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:500;display:flex;align-items:center;justify-content:center}
	        .vf-root .confirm-modal{background:var(--bg);border-radius:var(--rl);padding:24px;width:100%;max-width:384px;box-shadow:0 20px 25px -5px rgba(0,0,0,.15),0 8px 10px -6px rgba(0,0,0,.12);border:1px solid rgba(0,0,0,0.08)}
	        .vf-root .confirm-modal h2{font-size:16px;font-weight:600;margin-bottom:6px}
	        .vf-root .confirm-modal p{font-size:14px;color:var(--tx3);margin-bottom:20px;line-height:1.5}
        .vf-root .confirm-actions{display:flex;gap:8px;justify-content:flex-end}
        .vf-root .srf-overlay{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,.8)}
      `}</style>

      {srfExtracting && (
        <div className="vf-root srf-overlay">
          <div className="parse-dot" style={{ width: 20, height: 20, marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>Extracting with AI…</p>
          <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>Analysing SRF Excel file</p>
        </div>
      )}

      <div className="vf-root">
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>
              {isEdit ? 'Edit Vendor' : 'Add New Vendor'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 2 }}>
              {isEdit ? 'Update vendor details and documents' : 'Fill in the details to register a new vendor'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step === 0 && (
              <>
                {extractedFields && !showSrfMatch && (
                  <span style={{ fontSize: 12, color: 'var(--grn-tx)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="ti ti-circle-check" style={{ fontSize: 13 }} /> Fields applied
                  </span>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => srfInputRef.current?.click()} disabled={srfExtracting}>
                  <i className="ti ti-sparkles" style={{ color: 'var(--pur-tx)' }} />
                  {srfExtracting ? 'Extracting…' : 'Upload SRF for AI Fill'}
                </Button>
                <input ref={srfInputRef} type="file" style={{ display: 'none' }} accept=".xlsx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSrfFile(f); e.target.value = '' }} />
              </>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => isEdit ? setIsEditing?.(false) : router.push('/vendors')}>
              <i className="ti ti-arrow-left" /> Back
            </Button>
          </div>
        </div>

        {/* SRF review panel */}
        {showSrfMatch && srfMatchRows.length > 0 && (
          <div style={{ border: '0.5px solid var(--bd)', borderRadius: 'var(--rl)', overflow: 'hidden', background: 'var(--bg)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'var(--bg-s)', borderBottom: '0.5px solid var(--bd)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="ti ti-sparkles" style={{ color: 'var(--pur-tx)', fontSize: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>AI Extracted Fields</span>
                <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
                  <strong style={{ color: 'var(--tx)' }}>{srfMatchRows.filter(r => r.include).length}</strong> of {srfMatchRows.length} selected
                </span>
                <button className="manual-lnk" style={{ fontSize: 11 }} onClick={() => setSrfMatchRows(r => r.map(x => ({ ...x, include: true })))}>Select all</button>
                <span style={{ color: 'var(--bd)', fontSize: 11 }}>|</span>
                <button className="manual-lnk" style={{ fontSize: 11, color: 'var(--tx3)' }} onClick={() => setSrfMatchRows(r => r.map(x => ({ ...x, include: false })))}>Deselect all</button>
              </div>
              <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--tx2)' }} onClick={() => setShowSrfMatch(false)}>
                <i className="ti ti-x" style={{ fontSize: 15 }} />
              </button>
            </div>
            <table className="srf-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" style={{ accentColor: 'var(--pur-bd)' }}
                      checked={srfMatchRows.every(r => r.include)}
                      onChange={e => setSrfMatchRows(rows => rows.map(r => ({ ...r, include: e.target.checked })))} />
                  </th>
                  <th>Field</th>
                  <th>Extracted Value</th>
                  <th style={{ textAlign: 'right' }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {srfMatchRows.map((row, i) => (
                  <tr key={row.field} className={!row.include ? 'srf-off' : row.confidence >= 0.8 ? 'srf-high' : row.confidence >= 0.5 ? 'srf-med' : 'srf-low'}>
                    <td style={{ padding: '8px 14px' }}>
                      <input type="checkbox" style={{ accentColor: 'var(--pur-bd)' }} checked={row.include}
                        onChange={e => setSrfMatchRows(prev => prev.map((r, j) => j === i ? { ...r, include: e.target.checked } : r))} />
                    </td>
                    <td style={{ padding: '8px 14px', fontWeight: 500 }}>{row.label}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <input className="form-input" value={row.value} disabled={!row.include}
                        style={{ fontSize: 12, height: 32 }}
                        onChange={e => setSrfMatchRows(prev => prev.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: row.confidence >= 0.8 ? 'var(--grn-tx)' : row.confidence >= 0.5 ? 'var(--amb-tx)' : 'var(--red-tx)' }}>
                        {Math.round(row.confidence * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'var(--bg-s)', borderTop: '0.5px solid var(--bd)' }}>
              <span style={{ fontSize: 13, color: 'var(--tx2)' }}>
                <strong style={{ color: 'var(--tx)' }}>{srfMatchRows.filter(r => r.include).length}</strong> field{srfMatchRows.filter(r => r.include).length !== 1 ? 's' : ''} will be applied
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setShowSrfMatch(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={applySrfMatches} disabled={srfMatchRows.filter(r => r.include).length === 0}>
                  <i className="ti ti-circle-check" /> Apply to Form
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step bar */}
        <div className="step-bar">
          {steps.map((s, i) => isReadOnly && i === 2 ? null : (
            <button key={s} type="button" className={stepClass(i)} onClick={() => i < step && setStep(i)}>
              <div className="step-num">{stepNum(i)}</div>
              <div>
                <div className="step-label">{s}</div>
                <div className="step-sub">{stepSubs[i]}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="form-layout">
          {/* ── Main form area ── */}
          <div>

            {/* ══ STEP 0: Company & Contact ══ */}
            {step === 0 && (
              <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
                {/* Company Information */}
                <div className="form-section">
                  <div className="form-body">
                    <div className="form-grid" style={{ marginBottom: 16 }}>
                      <div className="form-group full">
                        <label className="form-label">Company Name <span className="req">*</span></label>
                        <input
                          className={`form-input${extractedFields?.company_name ? ' ai-fill' : ''}`}
                          style={
                            errors.company_name
                              ? { borderColor: 'var(--red-bd)' }
                              : {}
                          }
                          placeholder="e.g. Acme Pvt Ltd"
                          {...register('company_name', {
                            onChange: (e) => {
                              const raw = String(e.target.value ?? '')
                              if (!COMPANY_NAME_ALLOWED_PARTIAL.test(raw)) {
                                setError('company_name', { type: 'manual', message: 'Company name can contain only letters, numbers, spaces, &, ., ,, -, and _.' })
                                return
                              }
                              if (errors.company_name?.type === 'manual') clearErrors('company_name')
                              setValue('company_name', raw, { shouldValidate: true })
                            },
                          })}
                        />
                        {errors.company_name && <span className="field-err">{errors.company_name.message}</span>}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Vendor Category <span className="req">*</span></label>
                        <select
                          className="form-select"
                          value={watchedCategory ?? ''}
                          onChange={e => setValue('category', e.target.value ? Number(e.target.value) : (undefined as any), { shouldValidate: true })}
                          style={errors.category ? { borderColor: 'var(--red-bd)' } : {}}
                        >
                          <option value="">Select category</option>
                          {(categories as any[]).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.series_code} — {c.name}</option>
                          ))}
                        </select>
                        {errors.category && <span className="field-err">{errors.category.message}</span>}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Plant <span className="req">*</span></label>
                        <select
                          className="form-select"
                          value={watchedPlant ?? ''}
                          onChange={e => setValue('plant', e.target.value ? Number(e.target.value) : (undefined as any), { shouldValidate: true })}
                          style={errors.plant ? { borderColor: 'var(--red-bd)' } : {}}
                        >
                          <option value="">Select plant</option>
                          {(plants as any[]).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
                        </select>
                        {errors.plant && <span className="field-err">{errors.plant.message}</span>}
                      </div>
                    </div>

                    <hr className="form-divider" />

                    <div className="form-grid">
                      <div className="form-group full">
                        <label className="form-label">Address <span className="req">*</span></label>
                        <AddressAutocomplete
                          value={watch('address') ?? ''}
                          onChange={v => {
                            if (v && !ADDRESS_ALLOWED_PARTIAL.test(v)) {
                              setError('address', { type: 'manual', message: 'Address can contain only letters, numbers, spaces, and /, #, -, ., ,, _, (, ).' })
                            } else if (errors.address?.type === 'manual') {
                              clearErrors('address')
                            }
                            setValue('address', v, { shouldValidate: true })
                          }}
                          onSelect={result => {
                            if (errors.address?.type === 'manual') clearErrors('address')
                            setValue('address', result.address, { shouldValidate: true })
                            if (result.city) setValue('city', result.city, { shouldValidate: true })
                            if (result.state) setValue('state', result.state, { shouldValidate: true })
                            setValue('country', 'India', { shouldValidate: true })
                            if (result.pincode) setValue('pincode', result.pincode, { shouldValidate: true })
                          }}
                          placeholder="Start typing an address…"
                          className={`form-input${errors.address ? ' border-red' : ''}${extractedFields?.address ? ' ai-fill' : ''}`}
                        />
                        {errors.address && <span className="field-err">{errors.address.message}</span>}
                      </div>

                      {[
                        { name: 'city', label: 'City', placeholder: 'e.g. Mumbai', maxLength: 50 },
                        { name: 'state', label: 'State', placeholder: 'e.g. Maharashtra', maxLength: 50 },
                        { name: 'country', label: 'Country', placeholder: 'e.g. India', disabled: true },
                        { name: 'pincode', label: 'PIN Code', placeholder: 'e.g. 400001', maxLength: 6, mono: true },
                      ].map(({ name, label, placeholder, maxLength, disabled, mono }) => (
                        <div key={name} className="form-group">
                          <label className="form-label">{label} <span className="req">*</span></label>
                          <input
                            className={`form-input${extractedFields?.[name] ? ' ai-fill' : ''}`}
                            placeholder={placeholder}
                            maxLength={maxLength}
                            disabled={disabled}
                            inputMode={name === 'pincode' ? 'numeric' : undefined}
                            style={{ ...(mono ? { fontFamily: 'var(--mono)', fontSize: 12 } : {}), ...(errors[name as keyof VendorForm] ? { borderColor: 'var(--red-bd)' } : {}) }}
                            {...register(name as keyof VendorForm,
                              name === 'pincode' ? {
                                onChange: (e) => {
                                  const raw = String(e.target.value ?? '')
                                  if (!PINCODE_DIGITS_ONLY.test(raw)) { setError('pincode', { type: 'manual', message: 'PIN Code must contain only numbers' }); return }
                                  if (raw.length > 6) return
                                  if (errors.pincode?.type === 'manual') clearErrors('pincode')
                                  setValue('pincode', raw, { shouldValidate: true })
                                },
                              }
                                : (name === 'city' || name === 'state') ? {
                                  onChange: (e) => {
                                    const raw = String(e.target.value ?? '')
                                    if (!ALPHA_SPACE_PARTIAL.test(raw)) {
                                      setError(name as 'city' | 'state', { type: 'manual', message: `${label} can contain only letters and spaces.` })
                                      return
                                    }
                                    if ((errors[name as 'city' | 'state'] as any)?.type === 'manual') clearErrors(name as 'city' | 'state')
                                    setValue(name as 'city' | 'state', raw, { shouldValidate: true })
                                  },
                                }
                                  : undefined
                            )}
                          />
                          {errors[name as keyof VendorForm] && (
                            <span className="field-err">{(errors[name as keyof VendorForm] as any)?.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Contact */}
                <div className="form-section">
                  <div className="form-body">
                    <div className="form-grid">
                      {contactFields.map(({ name, label, placeholder, pattern, maxLength }) => (
                        <div key={name} className="form-group">
                          <label className="form-label">{label} <span className="req">*</span></label>
                          <input
                            className={`form-input${extractedFields?.[name] ? ' ai-fill' : ''}`}
                            placeholder={placeholder}
                            pattern={pattern}
                            maxLength={maxLength}
                            inputMode={name === 'contact_phone' ? 'tel' : undefined}
                            style={errors[name as keyof VendorForm] ? { borderColor: 'var(--red-bd)' } : {}}
                            {...register(name as keyof VendorForm,
                              name === 'contact_phone' ? {
                                onChange: (e) => {
                                  const raw = String(e.target.value ?? '')
                                  if (!PHONE_ALLOWED_CHARS.test(raw)) { setError('contact_phone', { type: 'manual', message: 'Contact phone must contain only numbers' }); return }
                                  let digits = raw
                                  if (digits.startsWith(PHONE_PREFIX)) digits = digits.slice(PHONE_PREFIX.length)
                                  else digits = digits.replace(/^\+?91\s*/g, '')
                                  digits = digits.replace(/\D/g, '').slice(0, 10)
                                  const next = `${PHONE_PREFIX}${digits}`
                                  if (errors.contact_phone?.type === 'manual') clearErrors('contact_phone')
                                  setValue('contact_phone', next, { shouldValidate: true })
                                },
                              }
                                : name === 'contact_name' ? {
                                  onChange: (e) => {
                                    const raw = String(e.target.value ?? '')
                                    if (!ALPHA_SPACE_PARTIAL.test(raw)) {
                                      setError('contact_name', { type: 'manual', message: 'Contact person can contain only letters, & and spaces.' })
                                      return
                                    }
                                    if (errors.contact_name?.type === 'manual') clearErrors('contact_name')
                                    setValue('contact_name', raw, { shouldValidate: true })
                                  },
                                }
                                  : undefined
                            )}
                          />
                          {errors[name as keyof VendorForm] && (
                            <span className="field-err">{(errors[name as keyof VendorForm] as any)?.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {/* ══ STEP 1: Documents & Finance ══ */}
            {step === 1 && !!vendorId && (
              <div className="form-section">
                <div className="form-body">

                  {/* Compliance Documents section */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Compliance Documents</div>

                  {/* GST */}
                  <div style={{ border: `0.5px solid ${complianceErrors['field_gst_number'] ? 'var(--red-bd)' : 'var(--bd)'}`, borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 10, background: 'var(--bg)' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-s)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--blu-bg)', color: 'var(--blu-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          <i className="ti ti-file-certificate" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            GST Certificate <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 6 }}>Required</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>PDF, JPG or PNG</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => setExpandedComplianceDocs(prev => ({ ...prev, gst_certificate: !prev.gst_certificate }))} title="Toggle">
                        <i className={`ti ti-chevron-${expandedComplianceDocs.gst_certificate ? 'up' : 'down'}`} />
                      </button>
                    </div>
                    {expandedComplianceDocs.gst_certificate && (
                      <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                        <DocUploadWidget vendorId={vendorId} docType="gst_certificate" doc={docOf('gst_certificate')} onRefresh={refreshDocs} dropLabel="Drag &amp; drop GST Certificate here" isReadOnly={isReadOnly} setFieldError={setDocError('gst_certificate')} onValidTillChange={setDocValidTill('gst_certificate')} />
                        <ValidTillChip docType="gst_certificate" />
                        {docUploadErrors['gst_certificate'] && (
                          <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{docUploadErrors['gst_certificate']}
                          </div>
                        )}
                        <div className="form-grid" style={{ marginTop: 12 }}>
                          <div className="form-group">
                            <label className="form-label">GST Number <span className="req">*</span></label>
                            <input
                              className="form-input"
                              placeholder="e.g. 27AAAAA0000A1Z5"
                              disabled={isReadOnly}
                              style={(complianceErrors['field_gst_number'] || errors.gst_number) ? { borderColor: 'var(--red-bd)' } : {}}
                              {...register('gst_number')}
                            />
                            {complianceErrors['field_gst_number'] && <span className="field-err">{complianceErrors['field_gst_number']}</span>}
                            {errors.gst_number && <span className="field-err">{errors.gst_number.message}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PAN */}
                  <div style={{ border: `0.5px solid ${complianceErrors['field_pan_number'] ? 'var(--red-bd)' : 'var(--bd)'}`, borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 10, background: 'var(--bg)' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-s)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--grn-bg)', color: 'var(--grn-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          <i className="ti ti-id" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            PAN Card Copy <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 6 }}>Required</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>PDF, JPG or PNG</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => setExpandedComplianceDocs(prev => ({ ...prev, pan_card: !prev.pan_card }))} title="Toggle">
                        <i className={`ti ti-chevron-${expandedComplianceDocs.pan_card ? 'up' : 'down'}`} />
                      </button>
                    </div>
                    {expandedComplianceDocs.pan_card && (
                      <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                        <DocUploadWidget vendorId={vendorId} docType="pan_card" doc={docOf('pan_card')} onRefresh={refreshDocs} dropLabel="Drag &amp; drop PAN Card here" isReadOnly={isReadOnly} setFieldError={setDocError('pan_card')} onValidTillChange={setDocValidTill('pan_card')} />
                        <ValidTillChip docType="pan_card" />
                        {docUploadErrors['pan_card'] && (
                          <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{docUploadErrors['pan_card']}
                          </div>
                        )}
                        <div className="form-grid" style={{ marginTop: 12 }}>
                          <div className="form-group">
                            <label className="form-label">PAN Number <span className="req">*</span></label>
                            <input
                              className="form-input"
                              placeholder="e.g. AAAAA9999A"
                              disabled={isReadOnly}
                              style={(complianceErrors['field_pan_number'] || errors.pan_number) ? { borderColor: 'var(--red-bd)' } : {}}
                              {...register('pan_number')}
                            />
                            {complianceErrors['field_pan_number'] && <span className="field-err">{complianceErrors['field_pan_number']}</span>}
                            {errors.pan_number && <span className="field-err">{errors.pan_number.message}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bank */}
                  <div style={{ border: `0.5px solid ${complianceErrors['field_bank_account'] ? 'var(--red-bd)' : 'var(--bd)'}`, borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 10, background: 'var(--bg)' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-s)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--pur-bg)', color: 'var(--pur-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          <i className="ti ti-building-bank" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>Bank Verification Letter <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-tx)', marginLeft: 6 }}>Required</span></div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>PDF, JPG or PNG</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => setExpandedComplianceDocs(prev => ({ ...prev, bank_details: !prev.bank_details }))} title="Toggle">
                        <i className={`ti ti-chevron-${expandedComplianceDocs.bank_details ? 'up' : 'down'}`} />
                      </button>
                    </div>
                    {expandedComplianceDocs.bank_details && (
                      <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                        <DocUploadWidget vendorId={vendorId} docType="bank_details" doc={docOf('bank_details')} onRefresh={refreshDocs} dropLabel="Drag &amp; drop Bank Letter / Cancelled Cheque here" isReadOnly={isReadOnly} setFieldError={setDocError('bank_details')} onValidTillChange={setDocValidTill('bank_details')} />
                        <ValidTillChip docType="bank_details" />
                        {docUploadErrors['bank_details'] && (
                          <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{docUploadErrors['bank_details']}
                          </div>
                        )}
                        <div className="form-grid" style={{ marginTop: 12 }}>
                          <div className="form-group">
                            <label className="form-label">Account Number <span className="req">*</span></label>
                            <input
                              className="form-input"
                              placeholder="e.g. 50100123456789"
                              disabled={isReadOnly}
                              style={(complianceErrors['field_bank_account'] || errors.bank_account) ? { borderColor: 'var(--red-bd)' } : {}}
                              {...register('bank_account')}
                            />
                            {errors.bank_account && <span className="field-err">{errors.bank_account.message}</span>}
                          </div>
                          <div className="form-group">
                            <label className="form-label">IFSC <span className="req">*</span></label>
                            <input
                              className="form-input"
                              placeholder="e.g. HDFC0001234"
                              disabled={isReadOnly}
                              style={(complianceErrors['field_bank_account'] || errors.bank_ifsc) ? { borderColor: 'var(--red-bd)' } : {}}
                              {...register('bank_ifsc')}
                            />
                            {errors.bank_ifsc && <span className="field-err">{errors.bank_ifsc.message}</span>}
                          </div>
                          <div className="form-group full">
                            <label className="form-label">Bank Name <span className="req">*</span></label>
                            <input
                              className="form-input"
                              placeholder="e.g. HDFC Bank Ltd"
                              disabled={isReadOnly}
                              style={(complianceErrors['field_bank_account'] || errors.bank_name) ? { borderColor: 'var(--red-bd)' } : {}}
                              {...register('bank_name')}
                            />
                            {complianceErrors['field_bank_account'] && <span className="field-err">{complianceErrors['field_bank_account']}</span>}
                            {errors.bank_name && <span className="field-err">{errors.bank_name.message}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Certifications section */}
                  <hr className="form-divider" style={{ marginTop: 14 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0' }}>Certifications</div>

                  {/* MSME */}
                  <input type="hidden" {...register('is_msme')} />
                  <div style={{ border: `0.5px solid ${errors.is_msme ? 'var(--red-bd)' : 'var(--bd)'}`, borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: errors.is_msme ? 4 : 10, background: 'var(--bg)' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-s)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--grn-bg)', color: 'var(--grn-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          <i className="ti ti-certificate-2" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>MSME Registered</div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Micro, Small &amp; Medium Enterprise (Udyam) certificate</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" title="Toggle" disabled={isReadOnly} onClick={() => {
                        const next = !expandedComplianceDocs.msme_certificate
                        setExpandedComplianceDocs(prev => ({ ...prev, msme_certificate: next }))
                        setValue('is_msme', next)
                      }}>
                        <i className={`ti ti-chevron-${expandedComplianceDocs.msme_certificate ? 'up' : 'down'}`} />
                      </button>
                    </div>
                    {expandedComplianceDocs.msme_certificate && (
                      <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                        <DocUploadWidget vendorId={vendorId} docType="msme_certificate" doc={docOf('msme_certificate')} onRefresh={refreshDocs} dropLabel="Drag &amp; drop Udyam Certificate here" isReadOnly={isReadOnly} setFieldError={setDocError('msme_certificate')} onValidTillChange={setDocValidTill('msme_certificate')} />
                        <ValidTillChip docType="msme_certificate" />
                        {docUploadErrors['msme_certificate'] && (
                          <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{docUploadErrors['msme_certificate']}
                          </div>
                        )}
                        <div className="form-grid" style={{ marginTop: 12 }}>
                          <div className="form-group">
                            <label className="form-label">Udyam Registration No. <span className="req">*</span></label>
                            <input className="form-input" placeholder="e.g. UDYAM-MH-00-0000000" style={{ fontFamily: 'var(--mono)', fontSize: 12, ...(complianceErrors['field_msme_number'] ? { borderColor: 'var(--red-bd)' } : {}) }} {...register('msme_number')} />
                            {complianceErrors['field_msme_number'] && <span className="field-err">{complianceErrors['field_msme_number']}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.is_msme && (
                    <div style={{ fontSize: 11, color: 'var(--red-tx)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, marginTop: -6 }}>
                      <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{errors.is_msme.message}
                    </div>
                  )}

                  {/* SEZ */}
                  <input type="hidden" {...register('is_sez')} />
                  <div style={{ border: `0.5px solid ${errors.is_sez ? 'var(--red-bd)' : 'var(--bd)'}`, borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: errors.is_sez ? 4 : 10, background: 'var(--bg)' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-s)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--pur-bg)', color: 'var(--pur-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          <i className="ti ti-building-estate" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>SEZ Unit</div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Special Economic Zone registered unit</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" title="Toggle" disabled={isReadOnly} onClick={() => {
                        const next = !expandedComplianceDocs.sez_certificate
                        setExpandedComplianceDocs(prev => ({ ...prev, sez_certificate: next }))
                        setValue('is_sez', next)
                      }}>
                        <i className={`ti ti-chevron-${expandedComplianceDocs.sez_certificate ? 'up' : 'down'}`} />
                      </button>
                    </div>
                    {expandedComplianceDocs.sez_certificate && (
                      <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                        <DocUploadWidget vendorId={vendorId} docType="sez_certificate" doc={docOf('sez_certificate')} onRefresh={refreshDocs} dropLabel="Drag &amp; drop SEZ Approval Letter here" isReadOnly={isReadOnly} setFieldError={setDocError('sez_certificate')} onValidTillChange={setDocValidTill('sez_certificate')} />
                        <ValidTillChip docType="sez_certificate" />
                        {docUploadErrors['sez_certificate'] && (
                          <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{docUploadErrors['sez_certificate']}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.is_sez && (
                    <div style={{ fontSize: 11, color: 'var(--red-tx)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, marginTop: -4 }}>
                      <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{errors.is_sez.message}
                    </div>
                  )}

                  {/* ISO / Quality Certificate — multi-row at end */}
                  <hr className="form-divider" style={{ marginTop: 14 }} />
                  <div style={{ border: `0.5px solid ${Object.keys(complianceErrors).some(k => k.startsWith('field_iso_')) ? 'var(--red-bd)' : 'var(--bd)'}`, borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 10, background: 'var(--bg)' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-s)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--amb-bg)', color: 'var(--amb-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          <i className="ti ti-award" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>ISO / Quality Certificate</div>
                          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>PDF, JPG or PNG · {isoRows.length} document{isoRows.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => setExpandedComplianceDocs(prev => ({ ...prev, iso_certificate: !prev.iso_certificate }))} title="Toggle">
                        <i className={`ti ti-chevron-${expandedComplianceDocs.iso_certificate ? 'up' : 'down'}`} />
                      </button>
                    </div>
                    {expandedComplianceDocs.iso_certificate && (
                      <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                        {isoRows.map((row, idx) => (
                          <div key={idx}>
                            {idx > 0 && <hr style={{ margin: '14px 0', borderColor: 'var(--bd)', borderTopWidth: '0.5px' }} />}
                            {isoRows.length > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                <button type="button" className="abt del" onClick={() => removeIsoRow(idx)} title="Remove">
                                  <i className="ti ti-x" />
                                </button>
                              </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 12 }}>
                              <label className="form-label">Document Type</label>
                              <select className="form-select" value={row.standard} onChange={(e) => { updateIsoRow(idx, 'standard', e.target.value); if (e.target.value !== 'other') updateIsoRow(idx, 'custom', '') }}>
                                <option value="" disabled>Select type</option>
                                <option value="ISO 9001:2015">ISO 9001:2015 – Quality Management</option>
                                <option value="ISO 14001:2015">ISO 14001:2015 – Environmental Management</option>
                                <option value="ISO 45001:2018">ISO 45001:2018 – Occupational Health &amp; Safety</option>
                                <option value="ISO 27001">ISO 27001 – Information Security</option>
                                <option value="ISO 22000">ISO 22000 – Food Safety Management</option>
                                <option value="ISO 50001">ISO 50001 – Energy Management</option>
                                <option value="ISO 13485">ISO 13485 – Medical Devices</option>
                                <option value="other">Other (specify)</option>
                              </select>
                            </div>
                            {row.standard === 'other' && (
                              <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Specify Document Type</label>
                                <input className="form-input" disabled={isReadOnly} value={row.custom} onChange={e => updateIsoRow(idx, 'custom', e.target.value)} placeholder="e.g. Trade Licence, NDA, Warranty…" />
                              </div>
                            )}
                            <DocUploadWidget vendorId={vendorId} docType={isoDocType(idx)} doc={docOf(isoDocType(idx))} onRefresh={refreshDocs} dropLabel="Drag &amp; drop document here" hint="PDF, JPG or PNG · max 5 MB" isReadOnly={isReadOnly} setFieldError={setDocError(isoDocType(idx))} onValidTillChange={setDocValidTill(isoDocType(idx))} />
                            <ValidTillChip docType={isoDocType(idx)} />
                            {complianceErrors[`field_iso_${idx}`] && (
                              <div className="field-err" style={{ marginTop: 6 }}>{complianceErrors[`field_iso_${idx}`]}</div>
                            )}
                            {docUploadErrors[isoDocType(idx)] && (
                              <div style={{ fontSize: 11, color: 'var(--red-tx)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />{docUploadErrors[isoDocType(idx)]}
                              </div>
                            )}
                          </div>
                        ))}
                        <button type="button" className="btn btn-sm" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }} onClick={addIsoRow}>
                          <i className="ti ti-plus" />
                          Add More
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ STEP 2: Submit for Approval ══ */}
            {step === 2 && !isReadOnly && (
              <div className="form-section" style={{ border: 'none', background: 'transparent' }}>
                <div style={{ padding: '16px 0' }}>
                  {/* Matrix selector */}
                  {matrices === undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx3)', padding: '8px 0' }}>
                      <span className="parse-dot" /> Loading matrices…
                    </div>
                  )}
                  {matrices && matrices.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--amb-tx)', background: 'var(--amb-bg)', border: '0.5px solid rgba(186,117,23,.25)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
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
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--red-tx)', background: 'var(--red-bg)', border: '0.5px solid rgba(226,75,74,.25)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
                      {submitError}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── Sidebar ── */}
          <div className="form-sidebar">
            <div className="card">
              <div className="card-head">
                <div className="card-title"><i className="ti ti-checklist" /> Form Checklist</div>
              </div>
              <FormChecklist values={allValues} isMsme={!!watch('is_msme')} />
            </div>
          </div>
        </div>

        {/* ── Sticky form actions ── */}
        <div className="form-actions">
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStep(s => s - 1)}>
                <i className="ti ti-arrow-left" /> Previous
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Step {step + 1} of 3</span>

            {step < 2 && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => step === 0 ? handleStep0Next() : handleStep1Next()}
                disabled={step0Mutation.isPending || step1Mutation.isPending}
              >
                {(step0Mutation.isPending || step1Mutation.isPending) ? 'Saving…' : <>{step === 0 ? "Next & Save Draft" : "Next"} <i className="ti ti-arrow-right" /></>}
              </Button>
            )}
            {step === 2 && (
              <>
                <Button
                  className="gap-1.5"
                  size="sm"
                  onClick={handleSubmitForApproval}
                  disabled={submitMutation.isPending || (selectedMatrix === null && !!matrices && matrices.length > 0)}
                >
                  {submitMutation.isPending ? 'Submitting…' : <><i className="ti ti-send" /> Submit for Approval</>}
                </Button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── Confirm modal — outside vf-root so Tailwind styles are not overridden ── */}
      <CommonConfirmModal
        isOpen={showConfirmModal}
        title="Confirm Action"
        description={<>Are you sure you want to submit this vendor for approval?<br />Approvers will be notified immediately.</>}
        confirmLabel="Yes, Submit"
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmAction}
        isPending={submitMutation.isPending}
      />
    </>
  )
}
