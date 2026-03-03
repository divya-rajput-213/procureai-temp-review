'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { ExternalLink, Trash2, Upload, FileText, Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, X, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'

// ─── Compliance rows config ───────────────────────────────────────────────────

const COMPLIANCE_ROWS: Array<{
  docType: string
  label: string
  fieldLabel: string
  fieldKey: string
  show: (v: any) => boolean
}> = [
    { docType: 'gst_certificate', label: 'GST Certificate', fieldLabel: 'GST Number', fieldKey: 'gst_number', show: () => true },
    { docType: 'pan_card', label: 'PAN Card', fieldLabel: 'PAN Number', fieldKey: 'pan_number', show: () => true },
    { docType: 'bank_details', label: 'Bank Details / Cancelled Cheque', fieldLabel: 'Bank Account', fieldKey: 'bank_account', show: () => true },
    { docType: 'incorporation', label: 'Incorporation Certificate', fieldLabel: 'Company', fieldKey: 'company_name', show: () => true },
    { docType: 'msme_certificate', label: 'MSME Certificate', fieldLabel: 'MSME No.', fieldKey: 'msme_number', show: (v: any) => !!v.is_msme },
    { docType: 'sez_certificate', label: 'SEZ Certificate', fieldLabel: 'SEZ Unit', fieldKey: '', show: (v: any) => !!v.is_sez },
  ]

// ─── Compliance doc row ────────────────────────────────────────────────────────

function ComplianceDocRow({ docType, label, fieldLabel, fieldValue, fieldKey, doc, vendorId, canEdit, onRefresh, onFieldUpdate }: {
  docType: string
  label: string
  fieldLabel: string
  fieldValue: string
  fieldKey: string
  doc: any | null
  vendorId: string | string[]
  canEdit: boolean
  onRefresh: () => void
  onFieldUpdate?: (key: string, value: string) => Promise<void>
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEditingField, setIsEditingField] = useState(false)
  const [fieldEditValue, setFieldEditValue] = useState(fieldValue)
  const [savingField, setSavingField] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      await apiClient.post(`/vendors/${vendorId}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onRefresh()
      toast({ title: 'Document uploaded. AI validation running...' })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await apiClient.delete(`/vendors/${vendorId}/documents/${doc.id}/`)
      onRefresh()
      toast({ title: 'Document removed.' })
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const saveField = async () => {
    if (!onFieldUpdate || !fieldKey) return
    setSavingField(true)
    try {
      await onFieldUpdate(fieldKey, fieldEditValue)
      setIsEditingField(false)
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' })
    } finally {
      setSavingField(false)
    }
  }

  const openFieldEdit = () => {
    setFieldEditValue(fieldValue)
    setIsEditingField(true)
  }

  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b last:border-0">
      {/* Field value — editable inline for draft vendors */}
      <div className="w-44 shrink-0">
        <p className="text-xs text-muted-foreground">{fieldLabel}</p>
        {isEditingField ? (
          <div className="flex items-center gap-1 mt-0.5">
            <input
              type="text"
              value={fieldEditValue}
              onChange={e => setFieldEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { saveField() } else if (e.key === 'Escape') { setIsEditingField(false) } }}
              className="border rounded px-1.5 py-0.5 text-xs font-mono w-full focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={saveField}
              disabled={savingField}
              className="shrink-0 text-green-600 hover:text-green-800 disabled:opacity-50"
              title="Save"
            >
              {savingField ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsEditingField(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <p className="text-sm font-mono font-medium truncate">{fieldValue || '—'}</p>
            {canEdit && fieldKey && onFieldUpdate && (
              <button
                onClick={openFieldEdit}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                title={`Edit ${fieldLabel}`}
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {/* Doc type label */}
      <p className="text-xs text-muted-foreground w-52 shrink-0">{label}</p>
      {/* Document or upload action */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {doc && (
          <>
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate max-w-[180px]">{doc.original_filename}</p>
              <div className="mt-0.5"><AIValidationBadge status={doc.ai_validation_status} /></div>
            </div>
            {doc.file_url && (
              <a href={doc.file_url} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
            {canEdit && (
              <Button
                variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={remove}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            )}
          </>
        )}
        {!doc && canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) upload(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Upload
            </Button>
          </>
        )}
        {!doc && !canEdit && (
          <span className="text-xs text-muted-foreground italic">No document</span>
        )}
      </div>
    </div>
  )
}

const DOC_TYPE_LABELS: Record<string, string> = {
  gst_certificate: 'GST Certificate',
  pan_card: 'PAN Card',
  bank_details: 'Bank Details',
  msme_certificate: 'MSME Certificate',
  sez_certificate: 'SEZ Certificate',
  incorporation: 'Incorporation Certificate',
  quality_certificate: 'Quality Certificate',
  iso_certificate: 'ISO Certificate',
  trade_license: 'Trade License',
  insurance: 'Insurance Document',
  nda: 'NDA / Agreement',
  warranty: 'Warranty Document',
  other: 'Other',
}

// Doc types available in the "Other Documents" upload panel
const OTHER_DOC_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'quality_certificate', label: 'Quality Certificate' },
  { value: 'iso_certificate', label: 'ISO Certificate' },
  { value: 'trade_license', label: 'Trade License' },
  { value: 'insurance', label: 'Insurance Document' },
  { value: 'nda', label: 'NDA / Agreement' },
  { value: 'warranty', label: 'Warranty Document' },
  { value: 'other', label: 'Other' },
]

// Doc types that belong to the "other" bucket (not in COMPLIANCE_ROWS)
const OTHER_DOC_TYPES = new Set(OTHER_DOC_TYPE_OPTIONS.map(o => o.value))

function AIValidationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    passed: { label: 'AI Passed', cls: 'bg-green-100 text-green-700' },
    warning: { label: 'AI Warning', cls: 'bg-amber-100 text-amber-700' },
    failed: { label: 'AI Failed', cls: 'bg-red-100 text-red-700' },
    pending: { label: 'AI Pending', cls: 'bg-slate-100 text-slate-500' },
    skipped: { label: 'AI Skipped', cls: 'bg-slate-100 text-slate-500' },
  }
  const { label, cls } = map[status] || map.pending
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function actionStepClass(action: string) {
  if (action === 'approved') return 'bg-green-50 border-green-200 text-green-700'
  if (action === 'rejected') return 'bg-red-50 border-red-200 text-red-700'
  if (action === 'held') return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-slate-50 border-slate-200 text-slate-500'
}

function ActionStepIcon({ action }: { action: string }) {
  if (action === 'approved') return <CheckCircle className="w-3 h-3" />
  if (action === 'rejected') return <XCircle className="w-3 h-3" />
  return <Clock className="w-3 h-3" />
}

function ActionBtnIcon({ loading, name, icon }: { loading: string; name: string; icon: React.ReactNode }) {
  return loading === name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>{icon}</>
}

function approvalLevelBubbleClass(action: string, isCurrent: boolean): string {
  if (action === 'approved') return 'bg-green-100 text-green-700'
  if (action === 'rejected') return 'bg-red-100 text-red-700'
  if (action === 'held') return 'bg-amber-100 text-amber-700'
  if (isCurrent) return 'bg-amber-200 text-amber-800'
  return 'bg-slate-100 text-slate-500'
}

function approvalActionLabel(action: string): string {
  if (action === 'approved') return 'Approved'
  if (action === 'rejected') return 'Rejected'
  if (action === 'held') return 'On Hold'
  return 'Pending'
}

function ApprovalSteps({ actions, currentLevel }: { actions: any[]; currentLevel?: number }) {
  if (!actions?.length) return null
  return (
    <div className="px-4 py-3 bg-white border-b">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Timeline</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1.5 font-medium w-12">Level</th>
            <th className="text-left py-1.5 font-medium">Approver</th>
            <th className="text-left py-1.5 font-medium">Status</th>
            <th className="text-right py-1.5 font-medium">Date / Time</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a: any) => {
            const isPending = !a.action || a.action === 'pending'
            const isCurrent = isPending && a.level_number === currentLevel
            const effectiveAction = a.action ?? 'pending'
            return (
              <tr key={a.id} className={`border-t ${isCurrent ? 'bg-amber-50' : ''}`}>
                <td className="py-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold ${approvalLevelBubbleClass(effectiveAction, isCurrent)}`}>
                    {a.level_number}
                  </span>
                </td>
                <td className="py-2 font-medium text-slate-700">
                  {a.approver_name ?? '—'}
                  {isCurrent && (
                    <span className="ml-1.5 text-xs font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                      awaiting
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${actionStepClass(effectiveAction)}`}>
                    <ActionStepIcon action={effectiveAction} />
                    {approvalActionLabel(effectiveAction)}
                  </span>
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {a.acted_at ? formatDateTime(a.acted_at) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MyActionPanel({ pendingAction, onProcess }: {
  pendingAction: any; onProcess: (action: string, comments: string) => void
}) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState('')

  const handle = async (action: string) => {
    setLoading(action)
    await onProcess(action, comments)
    setLoading('')
    setComments('')
  }

  return (
    <div className="px-4 py-3 bg-white space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Your action required (Level {pendingAction.level})</p>
      <textarea
        className="w-full border rounded-md p-2 text-sm resize-none h-16"
        placeholder="Comments (required for Reject / Hold)…"
        value={comments}
        onChange={e => setComments(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => handle('approved')} disabled={!!loading}>
          <ActionBtnIcon loading={loading} name="approved" icon={<CheckCircle className="w-3.5 h-3.5" />} /> Approve
        </Button>
        <Button size="sm" variant="destructive" className="gap-1" onClick={() => handle('rejected')} disabled={!!loading || !comments}>
          <ActionBtnIcon loading={loading} name="rejected" icon={<XCircle className="w-3.5 h-3.5" />} /> Reject
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300" onClick={() => handle('held')} disabled={!!loading || !comments}>
          <ActionBtnIcon loading={loading} name="held" icon={<Clock className="w-3.5 h-3.5" />} /> Hold
        </Button>
      </div>
    </div>
  )
}

// ─── Submit for Approval panel (draft status) ─────────────────────────────────
function SubmitForApprovalPanel({ vendorId, onSuccess }: { vendorId: string | string[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'vendor_onboarding'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/?matrix_type=vendor_onboarding&is_active=true')
      return r.data.results ?? r.data
    },
  })

  const submit = async () => {
    setSubmitting(true)
    try {
      const body: Record<string, any> = {}
      if (selectedMatrix) body.matrix_id = selectedMatrix
      await apiClient.post(`/vendors/${vendorId}/submit-for-approval/`, body)
      toast({ title: 'Submitted for approval. Approvers have been notified.' })
      onSuccess()
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const matrixCount = matrices?.length ?? 0

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Approval Matrix</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Select an approval matrix, then confirm your submission.</p>
        </CardHeader>
        <CardContent className="pt-5">
          {matrices === undefined && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
            </div>
          )}
          {matrices && matrixCount === 0 && (
            <p className="text-xs text-amber-600 font-medium">No active PR approval matrices configured. The system will use the default matrix.</p>
          )}
          {matrices && matrixCount > 0 && (
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
        </CardContent>
      </Card>
      <div className="flex justify-end mt-4">
        <Button
          onClick={submit}
          disabled={submitting || (matrixCount > 0 && selectedMatrix === null)}
          className="gap-1.5"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          Submit for Approval
        </Button>
      </div>
    </>
  )
}

// ─── Approval Status Panel (pending_approval) ─────────────────────────────────
function ApprovalProgressPanel({ vendorId, onStatusChange }: {
  vendorId: string | string[]; onStatusChange: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: approvalRequest, isLoading: loadingRequest } = useQuery({
    queryKey: ['vendor-approval', vendorId],
    queryFn: async () => {
      const res = await apiClient.get('/approvals/requests/', { params: { entity_type: 'vendor', object_id: vendorId } })
      const list = res.data.results ?? res.data
      return list.find((r: any) => ['pending', 'in_progress'].includes(r.status)) ?? (list[0] ?? null)
    },
  })

  const { data: myPendingAction } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    select: (data: any[]) => data.find((a: any) => a.entity_type === 'vendor' && String(a.object_id) === String(vendorId)),
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
    queryClient.invalidateQueries({ queryKey: ['vendor-approval', vendorId] })
    queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    onStatusChange()
  }

  const processAction = async (action: string, comments: string) => {
    if (!myPendingAction) return
    const labels: Record<string, string> = { approved: 'Approved', rejected: 'Rejected', held: 'Held' }
    try {
      await apiClient.patch(`/approvals/actions/${myPendingAction.action_id}/`, { action, comments })
      toast({ title: `${labels[action] ?? action} successfully.` })
      invalidateAll()
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.response?.data?.error, variant: 'destructive' })
    }
  }

  const pct = myPendingAction ? getSLAPercentage(myPendingAction.sla_deadline) : 100
  const slaLabel = pct <= 0 ? 'SLA Breached' : `SLA: ${Math.round(pct)}% remaining`
  const reqStatus = approvalRequest?.status

  let levelLabel = 'Pending Approval'
  if (loadingRequest) levelLabel = 'Loading approval status…'
  else if (reqStatus === 'approved') levelLabel = 'Approved'
  else if (reqStatus === 'rejected') levelLabel = 'Rejected'
  else if (approvalRequest) levelLabel = `Pending Approval — Level ${approvalRequest.current_level} of ${approvalRequest.actions?.length ?? '?'}`

  let headerBg = 'bg-amber-50'
  let headerTextCls = 'text-amber-800'
  let headerSubCls = 'text-amber-600'
  let StatusIcon = <Clock className="w-4 h-4 text-amber-600" />
  if (reqStatus === 'approved') {
    headerBg = 'bg-green-50'
    headerTextCls = 'text-green-800'
    headerSubCls = 'text-green-600'
    StatusIcon = <CheckCircle className="w-4 h-4 text-green-600" />
  } else if (reqStatus === 'rejected') {
    headerBg = 'bg-red-50'
    headerTextCls = 'text-red-800'
    headerSubCls = 'text-red-600'
    StatusIcon = <XCircle className="w-4 h-4 text-red-600" />
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${headerBg}`}>
        <div className="flex items-center gap-2">
          {StatusIcon}
          <span className={`text-sm font-medium ${headerTextCls}`}>{levelLabel}</span>
          {approvalRequest && <span className={`text-xs ${headerSubCls}`}>via {approvalRequest.matrix_name}</span>}
        </div>
        {myPendingAction && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSLAColor(pct)}`}>{slaLabel}</span>
        )}
      </div>
      <ApprovalSteps actions={approvalRequest?.actions ?? []} currentLevel={approvalRequest?.current_level} />
      {myPendingAction && <MyActionPanel pendingAction={myPendingAction} onProcess={processAction} />}
    </div>
  )
}

// ─── Compliance field input — editable (draft) or read-only ─────────────────
function ComplianceFieldInput({ value, placeholder, canEdit, onSave }: {
  value: string
  placeholder?: string
  canEdit: boolean
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    if (draft !== value) onSave(draft)
    setEditing(false)
  }

  if (!canEdit) {
    return <p className="text-sm font-medium h-10 flex items-center font-mono">{value || '—'}</p>
  }

  return editing ? (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { commit() } else if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className="h-10 text-sm flex-1 font-mono"
      />
      <button
        type="button"
        onClick={commit}
        title="Save"
        className="shrink-0 text-green-600 hover:text-green-800 transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(false) }}
        title="Cancel"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => { setDraft(value); setEditing(true) }}
      className="w-full h-10 flex items-center border rounded-md px-3 text-sm text-left hover:border-primary/60 transition-colors font-mono"
    >
      <span className={value ? 'text-foreground' : 'text-muted-foreground/60'}>{value || placeholder || 'Click to edit…'}</span>
    </button>
  )
}

// ─── Inline doc upload widget ─────────────────────────────────────────────────
function DocUploadInline({ vendorId, docType, doc, onRefresh }: {
  vendorId: string | string[]
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
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      await apiClient.post(`/vendors/${vendorId}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onRefresh()
      toast({ title: 'Document uploaded. AI validation running...' })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await apiClient.delete(`/vendors/${vendorId}/documents/${doc.id}/`)
      onRefresh()
      toast({ title: 'Document removed.' })
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (doc) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[38px]">
        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs truncate flex-1 min-w-0">{doc.original_filename}</span>
        <AIValidationBadge status={doc.ai_validation_status} />
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noreferrer" className="shrink-0">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </a>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="shrink-0 text-red-400 hover:text-red-600 disabled:opacity-50"
          title="Remove"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[38px]">
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">No file chosen</span>
      <label className="cursor-pointer shrink-0">
        <span className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-slate-50 transition-colors">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Choose
        </span>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) upload(file)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

// ─── Edit form — company details only (compliance is in Documents tab) ───────
function EditDetailsForm({ vendor, categories, plants, onSave, onCancel, saving }: {
  vendor: any
  categories: any[]
  plants: any[]
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  saving: boolean
}) {
  // ── Field state ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    company_name: vendor.company_name ?? '',
    address: vendor.address ?? '',
    city: vendor.city ?? '',
    state: vendor.state ?? '',
    pincode: vendor.pincode ?? '',
    contact_name: vendor.contact_name ?? '',
    contact_email: vendor.contact_email ?? '',
    contact_phone: vendor.contact_phone ?? '',
    category: vendor.category ?? '',
    plant: vendor.plant ?? '',
  })

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const tf = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs">{label}</Label>
      <Input
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="h-10 text-sm"
      />
    </div>
  )

  return (
    <>
      {/* ── Card 1: Company Details (same as Add form Step 0) ── */}
      <Card>
        <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
        <CardContent className="space-y-5">

          {/* General Information — category + plant (same label as Add form) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-1">General Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Vendor Category *</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={form.category}
                  onChange={e => set('category', e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.series_code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plant *</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={form.plant}
                  onChange={e => set('plant', e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select plant</option>
                  {plants.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Company fields — no section label, same as Add form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tf('company_name', 'Company Name *', 'Acme Pvt Ltd')}
            {tf('address', 'Address *', '123, Industrial Area')}
            {tf('city', 'City *', 'Mumbai')}
            {tf('state', 'State *', 'Maharashtra')}
            {tf('pincode', 'PIN Code *', '400001')}
          </div>

          {/* Contact fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tf('contact_name', 'Contact Person *', 'John Doe')}
            {tf('contact_email', 'Contact Email *', 'john@acme.com')}
            {tf('contact_phone', 'Contact Phone *', '+91 98765 43210')}
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            Compliance fields (GST, PAN, bank details, documents) are managed from the <strong>Documents</strong> tab.
          </p>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={() => onSave(form)} disabled={saving} className="gap-1">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ─── Other Documents edit panel (shown in Details tab when editing) ──────────
function OtherDocsEditPanel({ vendorId, existingDocs, onRefresh }: {
  vendorId: string | string[]
  existingDocs: any[]
  onRefresh: () => void
}) {
  const { toast } = useToast()

  // ── Inline title editing for existing docs ────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  const startEdit = (doc: any) => {
    setEditingId(doc.id)
    setEditTitle(doc.title || doc.original_filename)
  }

  const saveTitle = async (docId: number) => {
    setSavingTitle(true)
    try {
      await apiClient.patch(`/vendors/${vendorId}/documents/${docId}/`, { title: editTitle })
      onRefresh()
      setEditingId(null)
      toast({ title: 'Title updated.' })
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' })
    } finally {
      setSavingTitle(false)
    }
  }

  // ── Add new rows ──────────────────────────────────────────────────────────
  const [rows, setRows] = useState<{ id: number; doc_type: string; title: string; file: File | null; uploading: boolean }[]>([])

  const addRow = () =>
    setRows(prev => [...prev, { id: Date.now(), doc_type: 'other', title: '', file: null, uploading: false }])

  const updateRow = (id: number, patch: Partial<{ doc_type: string; title: string; file: File | null }>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const removeRow = (id: number) =>
    setRows(prev => prev.filter(r => r.id !== id))

  const uploadRow = async (row: typeof rows[0]) => {
    if (!row.file) return
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploading: true } : r))
    try {
      const fd = new FormData()
      fd.append('file', row.file)
      fd.append('doc_type', row.doc_type)
      fd.append('title', row.title.trim() || row.file.name)
      await apiClient.post(`/vendors/${vendorId}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onRefresh()
      removeRow(row.id)
      toast({ title: 'Document uploaded. AI validation running...' })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploading: false } : r))
    }
  }

  // ── Delete existing ───────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const deleteDoc = async (docId: number) => {
    setDeletingId(docId)
    try {
      await apiClient.delete(`/vendors/${vendorId}/documents/${docId}/`)
      onRefresh()
      toast({ title: 'Document removed.' })
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium">Other Documents</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quality certs, trade licences, NDAs, insurance, etc.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addRow}>
          <Plus className="w-3.5 h-3.5" /> Add Document
        </Button>
      </div>
      <div className="space-y-2">
        {/* Existing docs with inline title edit */}
        {existingDocs.map(doc => (
          <div key={doc.id} className="flex items-start gap-3 border rounded-lg px-3 py-2.5">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              {/* Title row — editable */}
              {editingId === doc.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTitle(doc.id)
                      else if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    onClick={() => saveTitle(doc.id)}
                    disabled={savingTitle}
                    className="text-green-600 hover:text-green-800 disabled:opacity-50 shrink-0"
                    title="Save"
                  >
                    {savingTitle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground shrink-0" title="Cancel">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium group inline-flex items-center gap-1">
                  {doc.title || doc.original_filename}
                  <button
                    onClick={() => startEdit(doc)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="Edit title"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </span>
              )}
              {/* Meta row — type chip + AI badge + date */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                </span>
                <AIValidationBadge status={doc.ai_validation_status} />
                <span className="text-xs text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
              </div>
              {doc.ai_validation_notes && (
                <p className="text-xs text-muted-foreground">{doc.ai_validation_notes}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
              <Button
                variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={() => deleteDoc(doc.id)}
                disabled={deletingId === doc.id}
              >
                {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}

        {existingDocs.length === 0 && rows.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-1">No other documents. Click "Add Document" to attach one.</p>
        )}

        {/* Add new rows */}
        {rows.map(row => (
          <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end border rounded-lg p-3 bg-slate-50/60">
            <div className="space-y-1">
              <Label className="text-xs">Document Type</Label>
              <select
                value={row.doc_type}
                onChange={e => updateRow(row.id, { doc_type: e.target.value })}
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
                onChange={e => updateRow(row.id, { title: e.target.value })}
                placeholder="e.g. ISO 9001 — 2024"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">File</Label>
              <div className="flex items-center gap-1 border rounded-md px-2 py-1.5 bg-background min-h-[36px]">
                <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                  {row.file?.name ?? 'No file chosen'}
                </span>
                <label className="cursor-pointer shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-slate-50">
                    <Upload className="w-3 h-3" /> Choose
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) updateRow(row.id, { file: f })
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                type="button" size="sm"
                className="h-9 gap-1 text-xs px-2.5"
                disabled={!row.file || row.uploading}
                onClick={() => uploadRow(row)}
              >
                {row.uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {row.uploading ? '' : 'Upload'}
              </Button>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={row.uploading}
                className="h-9 w-9 flex items-center justify-center text-red-400 hover:text-red-600 border rounded-md hover:bg-red-50 transition-colors"
                title="Remove row"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VendorDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [docSubTab, setDocSubTab] = useState<'compliance' | 'other'>('compliance')
  const [isEditing, setIsEditing] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/`)).data,
  })

  const { data: categories } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/categories/')
      return r.data.results ?? r.data
    },
    enabled: isEditing,
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      const r = await apiClient.get('/users/plants/')
      return r.data.results ?? r.data
    },
    enabled: isEditing,
  })

  const editMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      // Strip empty strings for FK fields (send null instead)
      const payload = { ...data }
      if (!payload.category) payload.category = null
      if (!payload.plant) payload.plant = null
      return (await apiClient.patch(`/vendors/${id}/`, payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', id] })
      toast({ title: 'Vendor details updated.' })
      setIsEditing(false)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.gst_number?.[0] || err?.response?.data?.error || 'Update failed.'
      toast({ title: 'Save failed', description: detail, variant: 'destructive' })
    },
  })

  const handleFieldUpdate = async (key: string, value: string | boolean) => {
    await apiClient.patch(`/vendors/${id}/`, { [key]: value })
    queryClient.invalidateQueries({ queryKey: ['vendor', id] })
    toast({ title: 'Field updated.' })
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!vendor) return <div className="p-8 text-center text-muted-foreground">Vendor not found.</div>

  const isDraft = vendor.status === 'draft'
  const tabs = ['details', 'documents', 'approval']

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{vendor.company_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{vendor.vendor_code || 'No code assigned'}</span>
            <StatusBadge status={vendor.status} />
            {vendor.is_msme && <Badge variant="info" className="text-xs">MSME</Badge>}
            {vendor.is_sez && <Badge variant="secondary" className="text-xs">SEZ</Badge>}
          </div>
        </div>
        {isDraft && !isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit Details
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setIsEditing(false) }}
            className={`px-4 py-2 text-sm capitalize font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {isEditing ? (
            <EditDetailsForm
              vendor={vendor}
              categories={categories ?? []}
              plants={plants ?? []}
              onSave={data => editMutation.mutate(data)}
              onCancel={() => setIsEditing(false)}
              saving={editMutation.isPending}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Business Information</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ['GST Number', vendor.gst_number],
                    ['PAN Number', vendor.pan_number],
                    ['Category', vendor.category_name || '—'],
                    ['Plant', vendor.plant_name || '—'],
                    ['Country', vendor.country],
                    ['SAP Vendor Code', vendor.sap_vendor_code || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Contact & Bank Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ['Contact', vendor.contact_name],
                    ['Email', vendor.contact_email],
                    ['Phone', vendor.contact_phone],
                    ['Address', `${vendor.city}, ${vendor.state} - ${vendor.pincode}`],
                    ['Bank', vendor.bank_name],
                    ['Account', vendor.bank_account],
                    ['IFSC', vendor.bank_ifsc],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Approval Tab */}
      {activeTab === 'approval' && (
        <div>
          {vendor.status !== 'draft' && (
            <ApprovalProgressPanel
              vendorId={id}
              onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })}
            />
          )}
          {vendor.status === 'draft' && (
            <SubmitForApprovalPanel
              vendorId={id}
              onSuccess={() => {
                setShowSubmitModal(false)
                queryClient.invalidateQueries({ queryKey: ['vendor', id] })
              }}
            />
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance &amp; Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Enter regulatory numbers and upload supporting documents alongside each field.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Sub-tabs */}
            <div className="flex gap-1 border-b">
              {(['compliance', 'other'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDocSubTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${docSubTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {tab === 'compliance' ? 'Compliance' : 'Other Documents'}
                </button>
              ))}
            </div>

            {docSubTab === 'compliance' && (() => {
              const docOf = (type: string) => vendor.documents?.find((d: any) => d.doc_type === type) ?? null
              const blockCls = (hasField: boolean, hasDoc: boolean) =>
                `grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start${isDraft && (!hasField || !hasDoc) ? ' border-amber-300' : ''}`
              return <>

                {/* GST */}
                <div className={blockCls(!!vendor.gst_number, !!docOf('gst_certificate'))}>
                  <div className="space-y-1">
                    <Label className="text-xs">GST Number <span className="text-destructive">*</span></Label>
                    <ComplianceFieldInput
                      value={vendor.gst_number ?? ''}
                      placeholder="27AAAAA0000A1Z5"
                      canEdit={isDraft}
                      onSave={v => handleFieldUpdate('gst_number', v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">GST Certificate <span className="text-destructive">*</span></Label>
                    <DocUploadInline vendorId={id} docType="gst_certificate"
                      doc={docOf('gst_certificate')}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                  </div>
                </div>

                {/* PAN */}
                <div className={blockCls(!!vendor.pan_number, !!docOf('pan_card'))}>
                  <div className="space-y-1">
                    <Label className="text-xs">PAN Number <span className="text-destructive">*</span></Label>
                    <ComplianceFieldInput
                      value={vendor.pan_number ?? ''}
                      placeholder="AAAAA9999A"
                      canEdit={isDraft}
                      onSave={v => handleFieldUpdate('pan_number', v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PAN Card <span className="text-destructive">*</span></Label>
                    <DocUploadInline vendorId={id} docType="pan_card"
                      doc={docOf('pan_card')}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                  </div>
                </div>

                {/* Bank Details */}
                <div className={blockCls(!!(vendor.bank_account || vendor.bank_ifsc || vendor.bank_name), !!docOf('bank_details'))}>
                  <div className="space-y-2">
                    {[
                      { key: 'bank_account', label: 'Bank Account No', placeholder: '12345678901234' },
                      { key: 'bank_ifsc', label: 'Bank IFSC', placeholder: 'HDFC0001234' },
                      { key: 'bank_name', label: 'Bank Name', placeholder: 'HDFC Bank' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label} <span className="text-destructive">*</span></Label>
                        <ComplianceFieldInput
                          value={vendor[key] ?? ''}
                          placeholder={placeholder}
                          canEdit={isDraft}
                          onSave={v => handleFieldUpdate(key, v)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bank Details / Cancelled Cheque <span className="text-destructive">*</span></Label>
                    <DocUploadInline vendorId={id} docType="bank_details"
                      doc={docOf('bank_details')}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                  </div>
                </div>

                {/* MSME / SEZ toggles */}
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!vendor.is_msme}
                      disabled={!isDraft}
                      onChange={async e => handleFieldUpdate('is_msme', e.target.checked)}
                      className="rounded"
                    />
                    <span>MSME Registered</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!vendor.is_sez}
                      disabled={!isDraft}
                      onChange={async e => handleFieldUpdate('is_sez', e.target.checked)}
                      className="rounded"
                    />
                    <span>SEZ Unit</span>
                  </label>
                </div>

                {/* MSME (conditional) */}
                {vendor.is_msme && (
                  <div className={blockCls(!!vendor.msme_number, !!docOf('msme_certificate'))}>
                    <div className="space-y-1">
                      <Label className="text-xs">MSME Number <span className="text-destructive">*</span></Label>
                      <ComplianceFieldInput
                        value={vendor.msme_number ?? ''}
                        placeholder="UDYAM-MH-00-0000000"
                        canEdit={isDraft}
                        onSave={v => handleFieldUpdate('msme_number', v)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">MSME Certificate <span className="text-destructive">*</span></Label>
                      <DocUploadInline vendorId={id} docType="msme_certificate"
                        doc={docOf('msme_certificate')}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    </div>
                  </div>
                )}

                {/* SEZ (conditional) */}
                {vendor.is_sez && (
                  <div className={blockCls(true, !!docOf('sez_certificate'))}>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">SEZ Unit</Label>
                      <p className="text-sm text-muted-foreground">SEZ registered vendor</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">SEZ Certificate <span className="text-destructive">*</span></Label>
                      <DocUploadInline vendorId={id} docType="sez_certificate"
                        doc={docOf('sez_certificate')}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    </div>
                  </div>
                )}

                {/* Incorporation */}
                <div className={blockCls(true, !!docOf('incorporation'))}>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Incorporation Certificate</p>
                    <p className="text-sm">Company registration / MOA documents</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Incorporation Certificate <span className="text-destructive">*</span></Label>
                    <DocUploadInline vendorId={id} docType="incorporation"
                      doc={docOf('incorporation')}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                  </div>
                </div>

              </>
            })()}

            {docSubTab === 'other' && (
              <OtherDocsEditPanel
                vendorId={id}
                existingDocs={(vendor.documents ?? []).filter((d: any) => OTHER_DOC_TYPES.has(d.doc_type))}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })}
              />
            )}

          </CardContent>
        </Card>
      )}

    </div>
  )
}
