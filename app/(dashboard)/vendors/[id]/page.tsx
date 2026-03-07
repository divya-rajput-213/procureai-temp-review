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
import { ExternalLink, Trash2, Upload, FileText, Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, X, ChevronDown, ChevronRight, Plus, TrendingUp, TrendingDown, ShoppingCart, Star, AlertTriangle, Shield, DollarSign, BarChart3, Award, Zap, Lightbulb, Package, Download } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor, formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'

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
      await apiClient.delete(`/vendors/${vendorId}/documents/${doc.hash_id}/`)
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
              <div className="mt-0.5"><span className="text-xs text-muted-foreground">{doc.original_filename}</span></div>
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
    skipped: { label: 'AI Pending', cls: 'bg-slate-100 text-slate-500' },
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

function ApprovalSteps({ actions, currentLevel, requestedAt }: { actions: any[]; currentLevel?: number; requestedAt?: string }) {
  if (!actions?.length) return null
  return (
    <div className="px-4 py-3 bg-white border-b">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Timeline</p>
      {requestedAt && (
        <p className="text-[11px] text-muted-foreground mb-2">Requested for approval: <span className="font-medium text-slate-700">{formatDateTime(requestedAt)}</span></p>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1.5 font-medium w-12">Level</th>
            <th className="text-left py-1.5 font-medium">Approver</th>
            <th className="text-left py-1.5 font-medium">Status</th>
            <th className="text-left py-1.5 font-medium whitespace-nowrap">Due Date</th>
            <th className="text-right py-1.5 font-medium whitespace-nowrap">Acted At</th>
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
                <td className="py-2 text-muted-foreground whitespace-nowrap">
                  {a.sla_deadline ? formatDateTime(a.sla_deadline) : '—'}
                </td>
                <td className="py-2 text-right text-muted-foreground whitespace-nowrap">
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

function MyActionPanel({ pendingAction, onProcess, onReleaseHold }: {
  pendingAction: any; onProcess: (action: string, comments: string) => void; onReleaseHold: () => void
}) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState('')
  const isHeld = pendingAction?.action_status === 'held'

  const handle = async (action: string) => {
    setLoading(action)
    await onProcess(action, comments)
    setLoading('')
    setComments('')
  }

  if (isHeld) {
    return (
      <div className="px-4 py-3 bg-white space-y-2">
        <p className="text-xs font-medium text-amber-700">This item is on hold (Level {pendingAction.level})</p>
        <Button size="sm" variant="outline" className="gap-1" onClick={onReleaseHold} disabled={!!loading}>
          <Clock className="w-3.5 h-3.5" /> Release Hold
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 bg-white space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Your action required (Level {pendingAction.level})</p>
      <div>
        <label className="text-xs font-medium">Comments <span className="text-red-500">*</span></label>
        <textarea
          className="mt-1 w-full border rounded-md p-2 text-sm resize-none h-16"
          placeholder="Add your comments…"
          value={comments}
          onChange={e => setComments(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => handle('approved')} disabled={!!loading || !comments.trim()}>
          <ActionBtnIcon loading={loading} name="approved" icon={<CheckCircle className="w-3.5 h-3.5" />} /> Approve
        </Button>
        <Button size="sm" variant="destructive" className="gap-1" onClick={() => handle('rejected')} disabled={!!loading || !comments.trim()}>
          <ActionBtnIcon loading={loading} name="rejected" icon={<XCircle className="w-3.5 h-3.5" />} /> Reject
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300" onClick={() => handle('held')} disabled={!!loading || !comments.trim()}>
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
          <p className="text-xs text-muted-foreground mt-1">Choose the approval workflow for this budget request.</p>
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
        </CardContent>
      
      </Card>
  
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

  const releaseHold = async () => {
    if (!myPendingAction) return
    try {
      await apiClient.post(`/approvals/actions/${myPendingAction.action_id}/release-hold/`)
      toast({ title: 'Hold released. You can now approve or reject.' })
      invalidateAll()
    } catch (err: any) {
      toast({ title: 'Failed to release hold', description: err?.response?.data?.error, variant: 'destructive' })
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
      <ApprovalSteps actions={approvalRequest?.actions ?? []} currentLevel={approvalRequest?.current_level} requestedAt={approvalRequest?.created_at} />
      {myPendingAction && <MyActionPanel pendingAction={myPendingAction} onProcess={processAction} onReleaseHold={releaseHold} />}
    </div>
  )
}

// ─── Compliance field input — editable (draft) or read-only ─────────────────
function ComplianceFieldInput({ value, placeholder, canEdit, onSave, onChange }: {
  value: string
  placeholder?: string
  canEdit: boolean
  onSave: (v: string) => void
  onChange?: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)

  if (!canEdit) {
    return <p className="text-sm font-medium h-10 flex items-center font-mono">{value || '—'}</p>
  }

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={e => { setDraft(e.target.value); onChange?.(e.target.value) }}
      onBlur={() => { if (draft !== value) onSave(draft) }}
      onKeyDown={e => { if (e.key === 'Enter') { if (draft !== value) onSave(draft) } }}
      className="h-10 text-sm font-mono"
    />
  )
}

// ─── Inline doc upload widget ─────────────────────────────────────────────────
function DocUploadInline({ vendorId, docType, doc, onRefresh, editable = true }: {
  vendorId: string | string[]
  docType: string
  doc: any | null
  onRefresh: () => void
  editable?: boolean
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
      await apiClient.delete(`/vendors/${vendorId}/documents/${doc.hash_id}/`)
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
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noreferrer" className="shrink-0">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </a>
        )}
        {editable && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="shrink-0 text-red-400 hover:text-red-600 disabled:opacity-50"
            title="Remove"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    )
  }

  if (!editable) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background min-h-[38px]">
        <span className="text-xs text-muted-foreground italic">No document</span>
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
    <div className="space-y-1.5" key={key}>
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder ? `e.g. ${placeholder}` : undefined}
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Vendor Category <span className="text-destructive">*</span></Label>
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Plant <span className="text-destructive">*</span></Label>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Address <span className="text-destructive">*</span></Label>
              <AddressAutocomplete
                value={form.address}
                onChange={v => set('address', v)}
                onSelect={result => {
                  set('address', result.address)
                  if (result.city) set('city', result.city)
                  if (result.state) set('state', result.state)
                  if (result.pincode) set('pincode', result.pincode)
                }}
                placeholder="Start typing an address…"
                className="h-10 text-sm"
              />
            </div>
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
function OtherDocsEditPanel({ vendorId, existingDocs, onRefresh, editable = true }: {
  vendorId: string | string[]
  existingDocs: any[]
  onRefresh: () => void
  editable?: boolean
}) {
  const { toast } = useToast()

  // ── Inline title editing for existing docs ────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  const startEdit = (doc: any) => {
    setEditingId(doc.hash_id)
    setEditTitle(doc.title || doc.original_filename)
  }

  const saveTitle = async (docId: string) => {
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteDoc = async (docId: string) => {
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
        {editable && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" /> Add Document
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {/* Existing docs with inline title edit */}
        {existingDocs.map(doc => (
          <div key={doc.id} className="flex items-start gap-3 border rounded-lg px-3 py-2.5">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              {/* Title row — editable */}
              {editable && editingId === doc.hash_id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTitle(doc.hash_id)
                      else if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    onClick={() => saveTitle(doc.hash_id)}
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
                  {editable && (
                    <button
                      onClick={() => startEdit(doc)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title="Edit title"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )}
              {/* Meta row — type chip + date */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
              {editable && (
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                  onClick={() => deleteDoc(doc.hash_id)}
                  disabled={deletingId === doc.hash_id}
                >
                  {deletingId === doc.hash_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              )}
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

// ─── Vendor Dashboard ─────────────────────────────────────────────────────────

const PR_STATUS_LABELS: Record<string, string> = {
  draft:            'Draft',
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  vendor_selected:  'Vendor Selected',
  synced_to_sap:    'Synced to SAP',
  po_created:       'PO Created',
  rejected:         'Rejected',
  cancelled:        'Cancelled',
}

function prStatusColor(s: string) {
  if (['vendor_selected', 'synced_to_sap', 'po_created'].includes(s)) return 'bg-green-100 text-green-700'
  if (s === 'approved') return 'bg-blue-100 text-blue-700'
  if (s === 'pending_approval') return 'bg-amber-100 text-amber-700'
  if (['rejected', 'cancelled'].includes(s)) return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function bidStatusColor(s: string) {
  if (s === 'shortlisted')      return 'bg-blue-100 text-blue-700'
  if (s === 'pending_approval') return 'bg-purple-100 text-purple-700'
  if (s === 'pending')          return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

const BID_STATUS_LABELS: Record<string, string> = {
  pending:          'Pending',
  shortlisted:      'Shortlisted',
  pending_approval: 'In Approval',
}

const COMPLIANCE_DOC_LABELS: Record<string, string> = {
  gst_certificate: 'GST Certificate',
  pan_card:        'PAN Card',
  bank_details:    'Bank Details',
  incorporation:   'Incorporation',
  msme_certificate:'MSME Certificate',
  sez_certificate: 'SEZ Certificate',
}

function KPICard({ label, value, sub, subPositive, icon: Icon, iconColor }: {
  label: string; value: string; sub?: string; subPositive?: boolean
  icon: React.ElementType; iconColor: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && (
              <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${subPositive ? 'text-green-600' : 'text-red-500'}`}>
                {subPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {sub}
              </p>
            )}
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VendorDashboard({ vendorId, vendor }: { vendorId: string | string[]; vendor: any }) {
  const { data: dash, isLoading } = useQuery({
    queryKey: ['vendor-dashboard', vendorId],
    queryFn: async () => (await apiClient.get(`/vendors/${vendorId}/dashboard/`)).data,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-5 pb-4"><div className="h-16 bg-slate-100 animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    )
  }

  if (!dash) return null

  const stats = dash.stats ?? {}
  const spendTrend: { month: string; spend: number }[] = dash.spend_trend ?? []
  const transactions: any[] = dash.recent_transactions ?? []
  const activeBids: any[] = dash.active_bids ?? []

  // Performance + risk — freshly computed by backend on every dashboard fetch
  const perfScore  = Math.round(dash.performance_score ?? 0)
  const riskScore  = Math.round(dash.risk_score ?? 0)
  const riskLabel  = riskScore < 30 ? 'Low Risk' : riskScore < 60 ? 'Medium Risk' : 'High Risk'
  const riskColor  = riskScore < 30
    ? 'text-green-700 bg-green-50 border-green-200'
    : riskScore < 60
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200'
  const riskBarColor = riskScore < 30 ? 'bg-green-500' : riskScore < 60 ? 'bg-amber-500' : 'bg-red-500'

  // Dynamic risk factors
  const riskFactors: { color: string; Icon: React.ElementType; title: string; desc: string }[] = []
  if (stats.win_rate >= 40) riskFactors.push({ color: 'green', Icon: Award, title: `Strong Win Rate — ${stats.win_rate}%`, desc: `Won ${stats.accepted_bids} of ${stats.total_bids} bids submitted` })
  if (riskScore < 30) riskFactors.push({ color: 'blue', Icon: Shield, title: 'Low Risk Vendor', desc: 'Risk score indicates a stable and reliable supplier' })
  if (riskScore >= 60) riskFactors.push({ color: 'amber', Icon: AlertTriangle, title: 'Elevated Risk Score', desc: `Risk score of ${riskScore}/100 — monitor closely and consider alternatives` })
  if (stats.open_prs > 2) riskFactors.push({ color: 'amber', Icon: AlertTriangle, title: 'Multiple Open PRs', desc: `${stats.open_prs} open purchase requisitions awaiting this vendor` })
  if (stats.accepted_bids === 1) riskFactors.push({ color: 'amber', Icon: AlertTriangle, title: 'Single Awarded Contract', desc: 'Consider diversifying across multiple vendors to reduce dependency' })
  if (riskFactors.length === 0) riskFactors.push({ color: 'green', Icon: CheckCircle, title: 'No Risk Factors', desc: 'Vendor is performing well with no identified concerns' })

  // Compliance docs from vendor
  const complianceDocs = Object.keys(COMPLIANCE_DOC_LABELS)
    .map(type => ({ label: COMPLIANCE_DOC_LABELS[type], doc: vendor.documents?.find((d: any) => d.doc_type === type) }))
    .filter(c => c.doc)

  // Spend formatting helper
  const fmtSpend = (v: number) => {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return String(Math.round(v))
  }

  const colorMap: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  }
  const iconColorMap: Record<string, string> = {
    green: 'text-green-600', blue: 'text-blue-600', amber: 'text-amber-600',
  }

  return (
    <div className="space-y-5">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Spend (YTD)"  value={stats.total_spend_ytd > 0 ? `${vendor.currency ?? ''} ${fmtSpend(stats.total_spend_ytd)}` : '—'} icon={DollarSign}    iconColor="bg-blue-50 text-blue-600" />
        <KPICard label="Bids Won"            value={String(stats.accepted_bids)}                                                                       icon={FileText}     iconColor="bg-purple-50 text-purple-600" />
        <KPICard label="Open PRs"            value={String(stats.open_prs)}                                                                            icon={ShoppingCart}  iconColor="bg-amber-50 text-amber-600" />
        <KPICard label="Win Rate"            value={stats.total_bids > 0 ? `${stats.win_rate}%` : '—'}                                               icon={CheckCircle}  iconColor="bg-green-50 text-green-600" />
        <KPICard label="Avg Lead Time"       value={stats.avg_delivery_days > 0 ? `${stats.avg_delivery_days}d` : vendor.standard_lead_time_days ? `${vendor.standard_lead_time_days}d` : '—'} icon={Clock} iconColor="bg-cyan-50 text-cyan-600" />
        <KPICard label="Performance Score"   value={perfScore > 0 ? `${perfScore}/100` : '—'}                                                          icon={Star}         iconColor="bg-rose-50 text-rose-500" />
      </div>

      {/* ── Spend Trend + Transactions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Spend trend chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" /> Spend Trend (12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spendTrend.every(d => d.spend === 0) ? (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">No spend data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={spendTrend} barSize={18} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${v / 1000}K` : String(v)} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Spend']} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="spend" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No transactions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/60">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">PR Number</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Amount</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium font-mono">{tx.pr_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-medium">{formatCurrency(tx.amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prStatusColor(tx.status)}`}>
                          {PR_STATUS_LABELS[tx.status] ?? tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Performance + Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" /> Vendor Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Performance Score */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Performance Score</p>
                <div className="flex items-end gap-1 mt-0.5">
                  <span className="text-3xl font-bold">{perfScore > 0 ? perfScore : '—'}</span>
                  {perfScore > 0 && <span className="text-sm text-muted-foreground mb-0.5">/100</span>}
                </div>
                {perfScore > 0 && (
                  <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${perfScore >= 70 ? 'text-green-600' : perfScore >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                    {perfScore >= 70 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {perfScore >= 70 ? 'Good performance' : perfScore >= 40 ? 'Average performance' : 'Needs improvement'}
                  </p>
                )}
              </div>
              <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center ${perfScore >= 70 ? 'border-indigo-500 bg-indigo-50' : perfScore >= 40 ? 'border-amber-400 bg-amber-50' : 'border-red-400 bg-red-50'}`}>
                <span className={`text-sm font-bold ${perfScore >= 70 ? 'text-indigo-600' : perfScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {perfScore > 0 ? `${perfScore}%` : '—'}
                </span>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">Risk Assessment</p>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-full ${riskColor}`}>
                  <Shield className="w-3 h-3" /> {riskLabel}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{riskScore > 0 ? `${riskScore}/100` : '—'}</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${riskBarColor}`} style={{ width: `${riskScore}%` }} />
              </div>
            </div>

            {/* Vendor Profile */}
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">Vendor Profile</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Payment Terms',   value: vendor.payment_terms?.replace('_', ' ').toUpperCase() ?? '—' },
                  { label: 'Lead Time',        value: vendor.standard_lead_time_days ? `${vendor.standard_lead_time_days} days` : '—' },
                  { label: 'Pricing Model',    value: vendor.pricing_model ?? '—' },
                  { label: 'Total Bids',       value: String(stats.total_bids ?? 0) },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                    <span className="text-xs font-semibold capitalize">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Factors + Compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Factors & Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskFactors.slice(0, 3).map((rf, i) => (
              <div key={i} className={`border rounded-lg p-3 ${colorMap[rf.color]}`}>
                <div className="flex items-start gap-2">
                  <rf.Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColorMap[rf.color]}`} />
                  <div>
                    <p className="text-xs font-semibold">{rf.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">{rf.desc}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Compliance Documents */}
            {complianceDocs.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground font-medium mb-2">Compliance Documents</p>
                <div className="space-y-1.5">
                  {complianceDocs.map(c => {
                    const aiStatus = c.doc?.ai_validation_status
                    const isGood = aiStatus === 'passed'
                    const isWarn = aiStatus === 'warning'
                    return (
                      <div key={c.label} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{c.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${isGood ? 'bg-green-50 text-green-700' : isWarn ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isGood ? 'Verified' : isWarn ? 'Warning' : 'Uploaded'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bid Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bid Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Bids',     value: String(stats.total_bids ?? 0),         positive: true },
                { label: 'Bids Won',       value: String(stats.accepted_bids ?? 0),       positive: true },
                { label: 'Win Rate',       value: stats.total_bids > 0 ? `${stats.win_rate}%` : '—', positive: (stats.win_rate ?? 0) >= 40 },
                { label: 'Avg Lead Time',  value: stats.avg_delivery_days > 0 ? `${stats.avg_delivery_days}d` : '—', positive: true },
              ].map(m => (
                <div key={m.label} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${m.positive ? 'text-foreground' : 'text-red-500'}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Win rate bar */}
            {stats.total_bids > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Win rate</span><span>{stats.win_rate}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${(stats.win_rate ?? 0) >= 60 ? 'bg-green-500' : (stats.win_rate ?? 0) >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${stats.win_rate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Category + Location */}
            <div className="border-t pt-3 space-y-1.5">
              {[
                { label: 'Category',  value: vendor.category_name ?? '—' },
                { label: 'Location',  value: vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : '—' },
                { label: 'Currency',  value: vendor.currency ?? '—' },
                { label: 'Incoterms', value: vendor.incoterms ?? '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="text-xs font-semibold">{r.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Active Bids ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" /> Active Bids
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeBids.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active bids for this vendor.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeBids.map((bid: any, i: number) => (
                <div key={i} className="border rounded-xl p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-muted-foreground">{bid.pr_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bidStatusColor(bid.status)}`}>
                      {BID_STATUS_LABELS[bid.status] ?? bid.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{bid.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(bid.submitted_at)}
                    </p>
                    {bid.bid_amount && (
                      <p className="text-sm font-bold">{formatCurrency(bid.bid_amount)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
// ─── Vendor PDF Export ────────────────────────────────────────────────────────

async function exportVendorPDF(vendor: any, vendorId: string | string[]) {
  const addr = [vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ')

  // Fetch bids from dashboard endpoint
  let activeBids: any[] = []
  try {
    const dash = await apiClient.get(`/vendors/${vendorId}/dashboard/`)
    activeBids = dash.data.active_bids ?? []
  } catch { /* silently skip if unavailable */ }

  const statusColors: Record<string, string> = {
    approved:         'background:#dcfce7;color:#166534;border:1px solid #bbf7d0',
    draft:            'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0',
    rejected:         'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
    pending_approval: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    blocked:          'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
  }
  const statusStyle = statusColors[vendor.status] ?? statusColors.draft

  // ── Helpers ────────────────────────────────────────────────────────────────

  const badge = (label: string, bg: string, fg: string, border: string) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:700;background:${bg};color:${fg};border:1px solid ${border};letter-spacing:0.03em">${label}</span>`

  // Field row for a key-value table (label left, value right)
  const frow = (label: string, value: string | undefined | null) =>
    `<tr>
      <td style="padding:5px 10px;color:#64748b;font-size:9.5px;width:42%;border-bottom:1px solid #f1f5f9;white-space:nowrap">${label}</td>
      <td style="padding:5px 10px;font-size:9.5px;font-weight:500;border-bottom:1px solid #f1f5f9">${value || '—'}</td>
    </tr>`

  // Section block — title + table rows, used inside a <td> of the 2-col outer table
  const section = (title: string, rows: string) =>
    `<div style="margin-bottom:14px">
      <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">${title}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">${rows}</table>
    </div>`

  // ── Data rows ──────────────────────────────────────────────────────────────

  const identityRows = [
    frow('GST Number',     vendor.gst_number),
    frow('PAN Number',     vendor.pan_number),
    frow('Category',       vendor.category_name),
    frow('Plant',          vendor.plant_name),
    frow('SAP Code',       vendor.sap_vendor_code),
    frow('Country',        vendor.country),
    frow('MSME',           vendor.is_msme ? (vendor.msme_number ? `Yes — ${vendor.msme_number}` : 'Yes') : 'No'),
    frow('SEZ',            vendor.is_sez ? 'Yes' : 'No'),
    frow('International',  vendor.is_international ? 'Yes' : 'No'),
  ].join('')

  const contactRows = [
    frow('Contact Person', vendor.contact_name),
    frow('Email',          vendor.contact_email),
    frow('Phone',          vendor.contact_phone),
    frow('Address',        addr),
  ].join('')

  const bankRows = [
    frow('Bank Name',      vendor.bank_name),
    frow('Account No.',    vendor.bank_account),
    frow('IFSC Code',      vendor.bank_ifsc),
  ].join('')

  const commercialRows = [
    frow('Pricing Model',  vendor.pricing_model),
    frow('Payment Terms',  vendor.payment_terms),
    frow('Currency',       vendor.currency),
    frow('Incoterms',      vendor.incoterms),
    frow('Std Lead Time',  vendor.standard_lead_time_days ? `${vendor.standard_lead_time_days} days` : null),
    frow('Rush Lead Time', vendor.rush_lead_time_days ? `${vendor.rush_lead_time_days} days` : null),
    frow('Min Order Qty',  vendor.min_order_quantity != null ? String(vendor.min_order_quantity) : null),
  ].join('')

  // ── Compliance documents status ──────────────────────────────────────────
  const complianceDocTypes = [
    { type: 'gst_certificate', label: 'GST Certificate' },
    { type: 'pan_card', label: 'PAN Card' },
    { type: 'bank_details', label: 'Bank Details / Cancelled Cheque' },
    { type: 'incorporation', label: 'Incorporation Certificate' },
    ...(vendor.is_msme ? [{ type: 'msme_certificate', label: 'MSME Certificate' }] : []),
    ...(vendor.is_sez ? [{ type: 'sez_certificate', label: 'SEZ Certificate' }] : []),
  ]
  const docs: any[] = vendor.documents ?? []
  const complianceRows = complianceDocTypes.map(({ type, label }) => {
    const doc = docs.find((d: any) => d.doc_type === type)
    const statusLabel = doc ? (doc.ai_validation_status === 'passed' ? 'Verified' : doc.ai_validation_status === 'failed' ? 'Failed' : 'Uploaded') : 'Missing'
    const statusClr = doc ? (doc.ai_validation_status === 'passed' ? 'color:#166534' : doc.ai_validation_status === 'failed' ? 'color:#991b1b' : 'color:#92400e') : 'color:#991b1b'
    const fileName = doc?.original_filename ?? '—'
    return `<tr>
      <td style="padding:5px 10px;font-size:9.5px;border-bottom:1px solid #f1f5f9">${label}</td>
      <td style="padding:5px 10px;font-size:9.5px;border-bottom:1px solid #f1f5f9;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fileName}</td>
      <td style="padding:5px 10px;font-size:9.5px;font-weight:600;border-bottom:1px solid #f1f5f9;${statusClr}">${statusLabel}</td>
    </tr>`
  }).join('')

  const otherDocs = docs.filter((d: any) => !complianceDocTypes.some(c => c.type === d.doc_type))
  const otherDocsRows = otherDocs.length > 0
    ? otherDocs.map((d: any) => `<tr>
        <td style="padding:5px 10px;font-size:9.5px;border-bottom:1px solid #f1f5f9">${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</td>
        <td style="padding:5px 10px;font-size:9.5px;border-bottom:1px solid #f1f5f9">${d.title || d.original_filename}</td>
        <td style="padding:5px 10px;font-size:9.5px;border-bottom:1px solid #f1f5f9;color:#64748b">${d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
      </tr>`).join('')
    : ''

  const perfScore  = vendor.performance_score != null ? `${Number(vendor.performance_score).toFixed(1)} / 100` : null
  const riskScore  = vendor.risk_score != null ? `${Number(vendor.risk_score).toFixed(1)} / 100` : null
  const createdAt  = vendor.created_at ? new Date(vendor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null

  // ── HTML ───────────────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Vendor Profile — ${vendor.company_name}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 15mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body>

  <!-- ═══ HEADER ═══ -->
  <table style="width:100%;border-collapse:collapse;border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:20px;font-weight:700;color:#1e3a5f;line-height:1.1">${vendor.company_name}</div>
        <div style="margin-top:5px">
          <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:9px;font-weight:700;${statusStyle}">${(vendor.status ?? '').replace(/_/g, ' ').toUpperCase()}</span>
          ${vendor.is_msme ? '&nbsp;' + badge('MSME', '#dbeafe', '#1e40af', '#bfdbfe') : ''}
          ${vendor.is_sez ? '&nbsp;' + badge('SEZ', '#f3e8ff', '#7e22ce', '#e9d5ff') : ''}
          ${vendor.is_international ? '&nbsp;' + badge('International', '#fce7f3', '#9d174d', '#fbcfe8') : ''}
        </div>
      </td>
      <td style="text-align:right;vertical-align:top;white-space:nowrap">
        <div style="font-size:9px;color:#64748b;line-height:1.8">
          <div><strong style="color:#1e293b">Vendor Code:</strong> ${vendor.vendor_code || '—'}</div>
          <div><strong style="color:#1e293b">SAP Code:</strong> ${vendor.sap_vendor_code || '—'}</div>
          <div><strong style="color:#1e293b">Generated:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- ═══ ROW 1: Business Identity | Contact ═══ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
    <tr>
      <td style="width:50%;padding-right:8px;vertical-align:top">${section('Business Identity', identityRows)}</td>
      <td style="width:50%;padding-left:8px;vertical-align:top">${section('Contact Information', contactRows)}</td>
    </tr>
  </table>

  <!-- ═══ ROW 2: Bank | Commercial Terms ═══ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
    <tr>
      <td style="width:50%;padding-right:8px;vertical-align:top">${section('Bank Details', bankRows)}</td>
      <td style="width:50%;padding-left:8px;vertical-align:top">${section('Commercial Terms', commercialRows)}</td>
    </tr>
  </table>

  <!-- ═══ ROW 3: Performance ═══ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">Performance &amp; Audit</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
          <tr>
            <td style="padding:6px 10px;width:25%;border-bottom:1px solid #f1f5f9">
              <div style="font-size:8.5px;color:#64748b">Performance Score</div>
              <div style="font-size:14px;font-weight:700;color:#1e3a5f;margin-top:2px">${perfScore ?? '—'}</div>
            </td>
            <td style="padding:6px 10px;width:25%;border-bottom:1px solid #f1f5f9">
              <div style="font-size:8.5px;color:#64748b">Risk Score</div>
              <div style="font-size:14px;font-weight:700;color:#1e3a5f;margin-top:2px">${riskScore ?? '—'}</div>
            </td>
            <td style="padding:6px 10px;width:25%;border-bottom:1px solid #f1f5f9">
              <div style="font-size:8.5px;color:#64748b">Created By</div>
              <div style="font-size:11px;font-weight:600;color:#1e293b;margin-top:2px">${vendor.created_by_name || '—'}</div>
            </td>
            <td style="padding:6px 10px;width:25%;border-bottom:1px solid #f1f5f9">
              <div style="font-size:8.5px;color:#64748b">Created On</div>
              <div style="font-size:11px;font-weight:600;color:#1e293b;margin-top:2px">${createdAt ?? '—'}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ═══ COMPLIANCE DOCUMENTS ═══ -->
  <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">Compliance Documents</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;margin-bottom:14px">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#64748b;border-bottom:1px solid #e2e8f0">Document</th>
        <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#64748b;border-bottom:1px solid #e2e8f0">File</th>
        <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#64748b;border-bottom:1px solid #e2e8f0;width:80px">Status</th>
      </tr>
    </thead>
    <tbody>${complianceRows}</tbody>
  </table>

  ${otherDocsRows ? `
  <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">Other Documents</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;margin-bottom:14px">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#64748b;border-bottom:1px solid #e2e8f0">Type</th>
        <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#64748b;border-bottom:1px solid #e2e8f0">Title / File</th>
        <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#64748b;border-bottom:1px solid #e2e8f0;width:80px">Uploaded</th>
      </tr>
    </thead>
    <tbody>${otherDocsRows}</tbody>
  </table>` : ''}

  ${activeBids.length > 0 ? `
  <!-- ═══ ACTIVE BIDS ═══ -->
  <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">Active &amp; Recent Bids</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:5px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:90px">PR Number</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b">Title / Description</th>
        <th style="padding:5px 8px;text-align:center;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:80px">Status</th>
        <th style="padding:5px 8px;text-align:right;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:100px">Bid Amount</th>
        <th style="padding:5px 8px;text-align:center;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:80px">Submitted</th>
      </tr>
    </thead>
    <tbody>
      ${activeBids.map((bid: any, idx: number) => {
        const bg = idx % 2 === 1 ? 'background:#f8fafc' : ''
        const statusClr: Record<string, string> = {
          pending:      'background:#fef3c7;color:#92400e',
          shortlisted:  'background:#dbeafe;color:#1e40af',
          accepted:     'background:#dcfce7;color:#166534',
          rejected:     'background:#fee2e2;color:#991b1b',
        }
        const sStyle = statusClr[bid.status] ?? 'background:#f1f5f9;color:#475569'
        const amtStr = bid.bid_amount != null
          ? Number(bid.bid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
          : '—'
        return `<tr style="${bg}">
          <td style="padding:5px 8px;font-family:Courier New,monospace;font-size:9px;border:1px solid #e2e8f0">${bid.pr_number}</td>
          <td style="padding:5px 8px;font-size:9.5px;border:1px solid #e2e8f0">${bid.title || '—'}</td>
          <td style="padding:5px 8px;text-align:center;border:1px solid #e2e8f0">
            <span style="display:inline-block;padding:1px 6px;border-radius:9999px;font-size:8px;font-weight:700;${sStyle}">${(bid.status ?? '').replace(/_/g, ' ')}</span>
          </td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;border:1px solid #e2e8f0;font-size:9.5px">${amtStr}</td>
          <td style="padding:5px 8px;text-align:center;color:#64748b;border:1px solid #e2e8f0;font-size:9px">${bid.submitted_at || '—'}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>` : ''}

  <!-- ═══ FOOTER ═══ -->
  <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px">
    <tr>
      <td style="font-size:8.5px;color:#94a3b8">Lumax Procurement — Vendor Profile Report</td>
      <td style="font-size:8.5px;color:#94a3b8;text-align:right">This is a system-generated document. Please verify before use.</td>
    </tr>
  </table>

</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none'
  document.body.appendChild(iframe)
  iframe.src = url
  iframe.addEventListener('load', () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url) }, 60_000)
  })
}

// ─── Change Request Tab ─────────────────────────────────────────────────────

function ChangeRequestTab({ vendorId, vendor, categories, plants }: {
  vendorId: string | string[]
  vendor: any
  categories: any[]
  plants: any[]
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedCR, setExpandedCR] = useState<string | null>(null)
  const [submittingCR, setSubmittingCR] = useState<string | null>(null)
  const [selectingMatrixCR, setSelectingMatrixCR] = useState<string | null>(null)
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'vendor_onboarding'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/?matrix_type=vendor_onboarding&is_active=true')
      return r.data.results ?? r.data
    },
    enabled: selectingMatrixCR !== null,
  })

  const { data: changeRequests, refetch } = useQuery({
    queryKey: ['vendor-change-requests', vendorId],
    queryFn: async () => (await apiClient.get(`/vendors/${vendorId}/change-requests/`)).data,
  })

  const { data: crDetail } = useQuery({
    queryKey: ['vendor-cr-detail', vendorId, expandedCR],
    queryFn: async () => (await apiClient.get(`/vendors/${vendorId}/change-requests/${expandedCR}/`)).data,
    enabled: !!expandedCR,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { reason: string; changes: Record<string, any> }) =>
      (await apiClient.post(`/vendors/${vendorId}/change-requests/`, data)).data,
    onSuccess: (cr) => {
      toast({ title: 'Change request created.' })
      setShowForm(false)
      refetch()
      setExpandedCR(cr.hash_id)
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err?.response?.data?.error || 'Could not create change request.', variant: 'destructive' })
    },
  })

  const handleSubmitForApproval = async (crId: string, matrixId?: number) => {
    setSubmittingCR(crId)
    try {
      const payload: any = {}
      if (matrixId) payload.matrix_id = matrixId
      await apiClient.post(`/vendors/${vendorId}/change-requests/${crId}/submit/`, payload)
      toast({ title: 'Change request submitted for approval.' })
      setSelectingMatrixCR(null)
      setSelectedMatrix(null)
      refetch()
      queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
    } catch (err: any) {
      toast({ title: 'Submit failed', description: err?.response?.data?.error || 'Failed to submit.', variant: 'destructive' })
    } finally {
      setSubmittingCR(null)
    }
  }

  const FIELD_LABELS: Record<string, string> = {
    company_name: 'Company Name', category: 'Category', plant: 'Plant',
    gst_number: 'GST Number', pan_number: 'PAN Number',
    bank_account: 'Bank Account', bank_ifsc: 'Bank IFSC', bank_name: 'Bank Name',
    contact_name: 'Contact Person', contact_email: 'Contact Email', contact_phone: 'Contact Phone',
    address: 'Address', city: 'City', state: 'State', pincode: 'PIN Code', country: 'Country',
    is_msme: 'MSME', msme_number: 'MSME Number', is_sez: 'SEZ',
    standard_lead_time_days: 'Lead Time (days)', rush_lead_time_days: 'Rush Lead Time (days)',
    min_order_quantity: 'Min Order Qty', pricing_model: 'Pricing Model',
    payment_terms: 'Payment Terms', currency: 'Currency', incoterms: 'Incoterms',
  }

  const crStatusCls = (s: string) => {
    if (s === 'approved') return 'bg-green-100 text-green-700'
    if (s === 'rejected') return 'bg-red-100 text-red-700'
    if (s === 'pending_approval') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Change Requests</h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Request Change
          </Button>
        )}
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <ChangeRequestForm
          vendor={vendor}
          categories={categories}
          plants={plants}
          saving={createMutation.isPending}
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── List ── */}
      {(changeRequests ?? []).length === 0 && !showForm && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No change requests yet. Click "Request Change" to propose changes to this vendor.
          </CardContent>
        </Card>
      )}

      {(changeRequests ?? []).map((cr: any) => (
        <Card key={cr.hash_id} className="overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => setExpandedCR(expandedCR === cr.hash_id ? null : cr.hash_id)}
          >
            <div className="flex items-center gap-3 min-w-0">
              {expandedCR === cr.hash_id ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">CR-{cr.hash_id}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${crStatusCls(cr.status)}`}>
                    {cr.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-md">{cr.reason}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">{formatDateTime(cr.created_at)}</span>
              {cr.status === 'pending' && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectingMatrixCR(selectingMatrixCR === cr.hash_id ? null : cr.hash_id)
                    setSelectedMatrix(null)
                    setExpandedMatrix(null)
                  }}
                  disabled={submittingCR === cr.hash_id}
                >
                  {submittingCR === cr.hash_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SendHorizonal className="w-3 h-3" />}
                  {selectingMatrixCR === cr.hash_id ? 'Cancel' : 'Submit'}
                </Button>
              )}
            </div>
          </div>

          {/* ── Expanded Detail ── */}
          {expandedCR === cr.hash_id && crDetail && (
            <div className="border-t px-4 py-3 bg-slate-50/50 space-y-3">
              <div className="text-xs text-muted-foreground">
                Requested by <span className="font-medium text-slate-700">{crDetail.created_by_name}</span> on {formatDateTime(crDetail.created_at)}
                {crDetail.applied_at && <> · Applied {formatDateTime(crDetail.applied_at)}</>}
              </div>
              <p className="text-sm"><span className="font-medium">Reason:</span> {crDetail.reason}</p>

              {/* Changes diff table */}
              <table className="w-full text-xs border rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Field</th>
                    <th className="text-left px-3 py-2 font-medium">Before</th>
                    <th className="text-left px-3 py-2 font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {(crDetail.changed_fields ?? []).map((f: string) => (
                    <tr key={f} className="border-t">
                      <td className="px-3 py-2 font-medium text-slate-700">{FIELD_LABELS[f] || f}</td>
                      <td className="px-3 py-2 text-red-600 line-through">{String(crDetail.before_snapshot?.[f] ?? '—')}</td>
                      <td className="px-3 py-2 text-green-700 font-medium">{String(crDetail.after_snapshot?.[f] ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Matrix Selector for Submit ── */}
          {selectingMatrixCR === cr.hash_id && (
            <div className="border-t px-4 py-4 bg-blue-50/40 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Approval Matrix</p>
              {matrices === undefined && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
                </div>
              )}
              {matrices && matrices.length === 0 && (
                <p className="text-xs text-amber-600 font-medium">No active vendor onboarding matrices configured.</p>
              )}
              {matrices && matrices.length > 0 && (
                <MatrixSelectorTable
                  matrices={matrices}
                  selectedMatrix={selectedMatrix}
                  expandedMatrix={expandedMatrix}
                  onSelect={(id) => { setSelectedMatrix(id); setExpandedMatrix(id) }}
                  onToggleExpand={(id) => setExpandedMatrix(prev => (prev === id ? null : id))}
                />
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSubmitForApproval(cr.hash_id, selectedMatrix ?? undefined)
                  }}
                  disabled={submittingCR === cr.hash_id || (matrices && matrices.length > 0 && !selectedMatrix)}
                >
                  {submittingCR === cr.hash_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SendHorizonal className="w-3 h-3" />}
                  Submit for Approval
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function ChangeRequestForm({ vendor, categories, plants, saving, onSubmit, onCancel }: {
  vendor: any
  categories: any[]
  plants: any[]
  saving: boolean
  onSubmit: (data: { reason: string; changes: Record<string, any> }) => void
  onCancel: () => void
}) {
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
  const [reason, setReason] = useState('')

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const tf = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-1.5" key={key}>
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder ? `e.g. ${placeholder}` : undefined}
        className="h-10 text-sm"
      />
    </div>
  )

  // Build changes dict (only fields that differ from current vendor)
  const buildChanges = (): Record<string, any> => {
    const changes: Record<string, any> = {}
    for (const [key, value] of Object.entries(form)) {
      const current = vendor[key]
      const currentStr = current == null ? '' : String(current)
      const newStr = value == null ? '' : String(value)
      if (currentStr !== newStr) {
        changes[key] = value || null
      }
    }
    return changes
  }

  const handleSubmit = () => {
    const changes = buildChanges()
    if (Object.keys(changes).length === 0) return
    onSubmit({ reason, changes })
  }

  const changeCount = Object.keys(buildChanges()).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Propose Changes</CardTitle>
        <p className="text-xs text-muted-foreground">Edit the fields you want to change. Only modified fields will be included in the request.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Reason */}
        <div className="space-y-1">
          <Label className="text-xs">Reason for Change *</Label>
          <textarea
            className="w-full border rounded-md p-2 text-sm resize-none h-16"
            placeholder="Explain why this change is needed…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {/* General fields */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">General Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Vendor Category</Label>
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
              <Label className="text-xs">Plant</Label>
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

        {/* Company fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tf('company_name', 'Company Name', 'Acme Pvt Ltd')}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Address</Label>
            <AddressAutocomplete
              value={form.address}
              onChange={v => set('address', v)}
              onSelect={result => {
                set('address', result.address)
                if (result.city) set('city', result.city)
                if (result.state) set('state', result.state)
                if (result.pincode) set('pincode', result.pincode)
              }}
              placeholder="Start typing an address…"
              className="h-10 text-sm"
            />
          </div>
          {tf('city', 'City', 'Mumbai')}
          {tf('state', 'State', 'Maharashtra')}
          {tf('pincode', 'PIN Code', '400001')}
        </div>

        {/* Contact fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tf('contact_name', 'Contact Person', 'John Doe')}
          {tf('contact_email', 'Contact Email', 'john@acme.com')}
          {tf('contact_phone', 'Contact Phone', '+91 98765 43210')}
        </div>

        {/* Summary + actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {changeCount > 0 ? `${changeCount} field${changeCount > 1 ? 's' : ''} changed` : 'No changes detected'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || !reason.trim() || changeCount === 0} className="gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
              Create Change Request
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function VendorDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('dashboard')
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
    enabled: isEditing || activeTab === 'change requests',
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      const r = await apiClient.get('/users/plants/')
      return r.data.results ?? r.data
    },
    enabled: isEditing || activeTab === 'change requests',
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

  // ── Documents tab edit state ──────────────────────────────────────────────
  const [docFields, setDocFields] = useState<Record<string, string>>({})
  const [savingDocs, setSavingDocs] = useState(false)

  const initDocFields = () => setDocFields({
    gst_number:   vendor?.gst_number   ?? '',
    pan_number:   vendor?.pan_number   ?? '',
    bank_account: vendor?.bank_account ?? '',
    bank_ifsc:    vendor?.bank_ifsc    ?? '',
    bank_name:    vendor?.bank_name    ?? '',
    msme_number:  vendor?.msme_number  ?? '',
  })

  const setDocField = (key: string, val: string) =>
    setDocFields(prev => ({ ...prev, [key]: val }))

  const [complianceErrors, setComplianceErrors] = useState<Record<string, string>>({})

  const validateCompliancePairs = (): boolean => {
    const docOf = (type: string) => vendor?.documents?.find((d: any) => d.doc_type === type) ?? null
    const errs: Record<string, string> = {}
    const pairs: Array<{ fieldKey: string; fieldLabel: string; docType: string; docLabel: string }> = [
      { fieldKey: 'gst_number', fieldLabel: 'GST Number', docType: 'gst_certificate', docLabel: 'GST Certificate' },
      { fieldKey: 'pan_number', fieldLabel: 'PAN Number', docType: 'pan_card', docLabel: 'PAN Card' },
    ]
    for (const { fieldKey, fieldLabel, docType, docLabel } of pairs) {
      const hasValue = !!docFields[fieldKey]
      const hasDoc = !!docOf(docType)
      if (hasValue && !hasDoc) errs[`doc_${docType}`] = `${docLabel} is required when ${fieldLabel} is provided`
      if (hasDoc && !hasValue) errs[`field_${fieldKey}`] = `${fieldLabel} is required when ${docLabel} is uploaded`
    }
    const hasBankField = !!(docFields.bank_account || docFields.bank_ifsc || docFields.bank_name)
    const hasBankDoc = !!docOf('bank_details')
    if (hasBankField && !hasBankDoc) errs['doc_bank_details'] = 'Bank document is required when bank details are provided'
    if (hasBankDoc && !hasBankField) errs['field_bank_account'] = 'Bank details are required when bank document is uploaded'
    if (vendor?.is_msme) {
      const hasMsmeNum = !!docFields.msme_number
      const hasMsmeDoc = !!docOf('msme_certificate')
      if (hasMsmeNum && !hasMsmeDoc) errs['doc_msme_certificate'] = 'MSME Certificate is required when MSME Number is provided'
      if (hasMsmeDoc && !hasMsmeNum) errs['field_msme_number'] = 'MSME Number is required when MSME Certificate is uploaded'
    }
    setComplianceErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveDocChanges = async () => {
    if (!validateCompliancePairs()) return
    setSavingDocs(true)
    try {
      await apiClient.patch(`/vendors/${id}/`, docFields)
      queryClient.invalidateQueries({ queryKey: ['vendor', id] })
      toast({ title: 'Documents saved.' })
      setIsEditing(false)
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.response?.data?.error ?? 'Please try again.', variant: 'destructive' })
    } finally {
      setSavingDocs(false)
    }
  }


  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!vendor) return <div className="p-8 text-center text-muted-foreground">Vendor not found.</div>

  const isDraft = vendor.status === 'draft'
  const showChangeRequests = ['pending_approval', 'approved', 'blocked'].includes(vendor.status)
  const tabs = ['dashboard', 'details', 'documents', 'approval', ...(showChangeRequests ? ['change requests'] : [])]

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { void exportVendorPDF(vendor, id) }} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
          {isDraft && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => {
              if (activeTab !== 'details' && activeTab !== 'documents') setActiveTab('details')
              if (activeTab === 'documents') initDocFields()
              setIsEditing(true)
            }} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit Details
            </Button>
          )}
        </div>
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

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && <VendorDashboard vendorId={id} vendor={vendor} />}

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
              {isEditing ? 'You can upload, replace, or remove documents.' : 'View regulatory documents and compliance information. Click "Edit Details" to make changes.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {(() => {
              const docOf = (type: string) => vendor.documents?.find((d: any) => d.doc_type === type) ?? null
              const blockCls = () =>
                'grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4 items-start'
              return <>

                {/* GST */}
                <div className={`${blockCls()} ${complianceErrors['field_gst_number'] || complianceErrors['doc_gst_certificate'] ? 'border-destructive/50' : ''}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">GST Number</Label>
                    <ComplianceFieldInput
                      value={isEditing ? (docFields.gst_number ?? '') : (vendor.gst_number ?? '')}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      canEdit={isDraft && isEditing}
                      onChange={v => setDocField('gst_number', v)}
                      onSave={v => setDocField('gst_number', v)}
                    />
                    {complianceErrors['field_gst_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_gst_number']}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">GST Certificate</Label>
                    <DocUploadInline vendorId={id} docType="gst_certificate"
                      doc={docOf('gst_certificate')} editable={isDraft && isEditing}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    {complianceErrors['doc_gst_certificate'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_gst_certificate']}</p>}
                  </div>
                </div>

                {/* PAN */}
                <div className={`${blockCls()} ${complianceErrors['field_pan_number'] || complianceErrors['doc_pan_card'] ? 'border-destructive/50' : ''}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">PAN Number</Label>
                    <ComplianceFieldInput
                      value={isEditing ? (docFields.pan_number ?? '') : (vendor.pan_number ?? '')}
                      placeholder="e.g. AAAAA9999A"
                      canEdit={isDraft && isEditing}
                      onChange={v => setDocField('pan_number', v)}
                      onSave={v => setDocField('pan_number', v)}
                    />
                    {complianceErrors['field_pan_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_pan_number']}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">PAN Card</Label>
                    <DocUploadInline vendorId={id} docType="pan_card"
                      doc={docOf('pan_card')} editable={isDraft && isEditing}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    {complianceErrors['doc_pan_card'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_pan_card']}</p>}
                  </div>
                </div>

                {/* Bank Details */}
                <div className={`${blockCls()} ${complianceErrors['field_bank_account'] || complianceErrors['doc_bank_details'] ? 'border-destructive/50' : ''}`}>
                  <div className="space-y-2">
                    {[
                      { key: 'bank_account', label: 'Bank Account No', placeholder: 'e.g. 12345678901234' },
                      { key: 'bank_ifsc', label: 'Bank IFSC', placeholder: 'e.g. HDFC0001234' },
                      { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. HDFC Bank' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
                        <ComplianceFieldInput
                          value={isEditing ? (docFields[key] ?? '') : (vendor[key] ?? '')}
                          placeholder={placeholder}
                          canEdit={isDraft && isEditing}
                          onChange={v => setDocField(key, v)}
                          onSave={v => setDocField(key, v)}
                        />
                      </div>
                    ))}
                    {complianceErrors['field_bank_account'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_bank_account']}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Bank Details / Cancelled Cheque</Label>
                    <DocUploadInline vendorId={id} docType="bank_details"
                      doc={docOf('bank_details')} editable={isDraft && isEditing}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    {complianceErrors['doc_bank_details'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_bank_details']}</p>}
                  </div>
                </div>

                {/* MSME / SEZ toggles */}
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!vendor.is_msme}
                      disabled={!(isDraft && isEditing)}
                      onChange={async e => handleFieldUpdate('is_msme', e.target.checked)}
                      className="rounded"
                    />
                    <span>MSME Registered</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!vendor.is_sez}
                      disabled={!(isDraft && isEditing)}
                      onChange={async e => handleFieldUpdate('is_sez', e.target.checked)}
                      className="rounded"
                    />
                    <span>SEZ Unit</span>
                  </label>
                </div>

                {/* MSME (conditional) */}
                {vendor.is_msme && (
                  <div className={`${blockCls()} ${complianceErrors['field_msme_number'] || complianceErrors['doc_msme_certificate'] ? 'border-destructive/50' : ''}`}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">MSME Number</Label>
                      <ComplianceFieldInput
                        value={isEditing ? (docFields.msme_number ?? '') : (vendor.msme_number ?? '')}
                        placeholder="e.g. UDYAM-MH-00-0000000"
                        canEdit={isDraft && isEditing}
                        onChange={v => setDocField('msme_number', v)}
                        onSave={v => setDocField('msme_number', v)}
                      />
                      {complianceErrors['field_msme_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_msme_number']}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">MSME Certificate</Label>
                      <DocUploadInline vendorId={id} docType="msme_certificate"
                        doc={docOf('msme_certificate')} editable={isDraft && isEditing}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                      {complianceErrors['doc_msme_certificate'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_msme_certificate']}</p>}
                    </div>
                  </div>
                )}

                {/* SEZ (conditional) */}
                {vendor.is_sez && (
                  <div className={blockCls()}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">SEZ Unit</Label>
                      <p className="text-sm text-muted-foreground">SEZ registered vendor</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">SEZ Certificate</Label>
                      <DocUploadInline vendorId={id} docType="sez_certificate"
                        doc={docOf('sez_certificate')} editable={isDraft && isEditing}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    </div>
                  </div>
                )}

                {/* Incorporation */}
                <div className={blockCls()}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Incorporation Certificate</Label>
                    <p className="text-sm text-muted-foreground">Company registration / MOA documents</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Upload Document</Label>
                    <DocUploadInline vendorId={id} docType="incorporation"
                      doc={docOf('incorporation')} editable={isDraft && isEditing}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                  </div>
                </div>

              </>
            })()}

            <div className="border-t pt-4 mt-2">
              <OtherDocsEditPanel
                vendorId={id}
                existingDocs={(vendor.documents ?? []).filter((d: any) => OTHER_DOC_TYPES.has(d.doc_type))}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })}
                editable={isDraft && isEditing}
              />
            </div>

            {isDraft && isEditing && (
              <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditing(false)}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" className="gap-1.5" onClick={saveDocChanges} disabled={savingDocs}>
                  {savingDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Save Changes
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Change Requests Tab */}
      {activeTab === 'change requests' && showChangeRequests && (
        <ChangeRequestTab
          vendorId={id}
          vendor={vendor}
          categories={categories ?? []}
          plants={plants ?? []}
        />
      )}

    </div>
  )
}
