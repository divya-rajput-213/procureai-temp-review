'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Trash2, Upload, FileText, Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, X, ChevronDown, ChevronRight, Plus, TrendingUp, TrendingDown, ShoppingCart, Star, AlertTriangle, Shield, DollarSign, BarChart3, Award, Zap, Lightbulb, Package, Download, ChevronLeft } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor, formatCurrency, DOC_CONFIG } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import {
  AreaChart, Area, LineChart, Line,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import VendorAnalysisPanel from '../components/VendorAnalysisPanel'


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
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 640 }}>
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left px-3 py-2 font-medium w-12">Level</th>
              <th className="text-left px-3 py-2 font-medium">Approver</th>
              <th className="text-left px-3 py-2 font-medium w-28">Status</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Due Date</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Acted At</th>
              <th className="text-left px-3 py-2 font-medium">Comments</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a: any) => {
              const isPending = !a.action || a.action === 'pending'
              const isCurrent = isPending && a.level_number === currentLevel
              const effectiveAction = a.action ?? 'pending'
              return (
                <tr key={a.id} className={`border-t ${isCurrent ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold ${approvalLevelBubbleClass(effectiveAction, isCurrent)}`}>
                      {a.level_number}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                    {a.approver_name ?? '—'}
                    {isCurrent && (
                      <span className="ml-1.5 text-xs font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        awaiting
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${actionStepClass(effectiveAction)}`}>
                      <ActionStepIcon action={effectiveAction} />
                      {approvalActionLabel(effectiveAction)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {a.sla_deadline ? formatDateTime(a.sla_deadline) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {a.acted_at ? formatDateTime(a.acted_at) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground italic max-w-[200px] truncate" title={a.comments || undefined}>
                    {a.comments ? `"${a.comments}"` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
function DocUploadInline({ vendorId, docType, doc, onRefresh, editable = true, setFieldError }: {
  vendorId: string | string[]
  docType: string
  doc: any | null
  onRefresh: () => void
  editable?: boolean
  setFieldError?: (msg: string) => void
}) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [localRemoved, setLocalRemoved] = useState(false)

  // Reset localRemoved whenever the doc prop changes (e.g. after refresh)
  useEffect(() => {
    setLocalRemoved(false)
  }, [doc?.id, doc?.hash_id])

  const effectiveDoc = localRemoved ? null : doc

  const upload = async (file: File) => {
    if (uploading) return // guard re-entry
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
      fd.append('file', file)
      fd.append('doc_type', docType)
      fd.append('title', DOC_CONFIG[docType]?.title || docType)
      const res = await apiClient.post(`/vendors/${vendorId}/documents/`, fd)
      const data = res.data
      if (data?.ai_validation_status === 'invalid' || data?.ai_validation_status === 'failed') {
        setFieldError?.(data?.ai_validation_notes || `${docType} validation failed`)
        toast({ title: 'Document validation failed', description: data?.ai_validation_notes || '', variant: 'destructive' })
      } else {
        setFieldError?.('')
        toast({ title: 'Document verified by AI' })
      }
      onRefresh()
    } catch (err: any) {
      const errData = err?.response?.data
      const notes = errData?.ai_validation_notes || errData?.error || 'Upload failed'
      setFieldError?.(notes)
      toast({ title: 'Document validation failed', description: notes, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    if (!effectiveDoc || deleting || localRemoved) return // triple guard
    setDeleting(true)
    setLocalRemoved(true) // optimistic: hide immediately, prevents double-click
    try {
      await apiClient.delete(`/vendors/${vendorId}/documents/${effectiveDoc.hash_id ?? effectiveDoc.id}/`)
      onRefresh()
      toast({ title: 'Document removed.' })
      setFieldError?.('')
    } catch {
      setLocalRemoved(false) // revert on failure
      toast({ title: 'Delete failed', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const extracted = effectiveDoc?.ai_extracted_data || {}
  const status = effectiveDoc?.ai_validation_status
  const isValid = status === 'passed' || status === 'valid'
  const isFailed = status === 'failed' || status === 'invalid'
  const hasExtracted = isValid && Object.values(extracted).some(v => v && String(v).trim())

  // ── State 1: Verified with extracted data ──────────────────────────────────
  if (effectiveDoc && hasExtracted) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border-b border-green-200">
          <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span className="text-xs font-medium text-green-700 flex-1">AI Verified</span>
          {effectiveDoc.file_url && (
            <a href={effectiveDoc.file_url} target="_blank" rel="noreferrer"
              className="shrink-0 text-xs text-green-600 hover:underline">View</a>
          )}
          {editable && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting || localRemoved}
              className="shrink-0 text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
            </button>
          )}
        </div>
        <div className="px-3 py-2 bg-green-50/30 space-y-1">
          {extracted.gst_number && (
            <div className="text-xs">
              <span className="text-muted-foreground w-14 inline-block">GSTIN:</span>
              <span className="font-mono font-medium">{extracted.gst_number}</span>
            </div>
          )}
          {extracted.pan_number && (
            <div className="text-xs">
              <span className="text-muted-foreground w-14 inline-block">PAN:</span>
              <span className="font-mono font-medium">{extracted.pan_number}</span>
            </div>
          )}
          {extracted.bank_account_number && (
            <div className="text-xs">
              <span className="text-muted-foreground w-14 inline-block">A/C:</span>
              <span className="font-mono font-medium">{extracted.bank_account_number}</span>
            </div>
          )}
          {extracted.ifsc_code && (
            <div className="text-xs">
              <span className="text-muted-foreground w-14 inline-block">IFSC:</span>
              <span className="font-mono font-medium">{extracted.ifsc_code}</span>
            </div>
          )}
          {extracted.bank_name && (
            <div className="text-xs">
              <span className="text-muted-foreground w-14 inline-block">Bank:</span>
              <span className="font-medium">{extracted.bank_name}</span>
            </div>
          )}
          {extracted.legal_name && (
            <div className="text-xs">
              <span className="text-muted-foreground w-14 inline-block">Name:</span>
              <span className="font-medium">{extracted.legal_name}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── State 2: Doc exists but failed / pending ───────────────────────────────
  if (effectiveDoc) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className={`flex items-center gap-2 px-3 py-2 ${isFailed ? 'bg-red-50' : 'bg-slate-50'}`}>
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{effectiveDoc.original_filename}</span>
          {isFailed && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
              Failed
            </span>
          )}
          {editable && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting || localRemoved}
              className="shrink-0 text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <X className="w-3.5 h-3.5" />
              }
            </button>
          )}
        </div>
        {effectiveDoc.ai_validation_notes && isFailed && (
          <p className="text-[10px] text-red-600 px-3 py-1.5 bg-red-50">
            {effectiveDoc.ai_validation_notes}
          </p>
        )}
        {/* Allow re-upload after failure */}
        {editable && isFailed && (
          <div className="px-3 py-2 bg-red-50/50 border-t border-red-100">
            <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-3 h-3" />
              {uploading ? 'Uploading...' : 'Replace with correct file'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploading}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) upload(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        )}
      </div>
    )
  }

  // ── State 3: No doc — show upload dropzone ────────────────────────────────
  if (!editable) {
    return (
      <div className="border rounded-md px-3 py-2 min-h-[38px]">
        <span className="text-xs text-muted-foreground italic">No document</span>
      </div>
    )
  }

  return (
    <div className="border-2 border-dashed rounded-lg px-3 py-3 text-center hover:bg-slate-50 transition-colors">
      <label
        className={`cursor-pointer block ${uploading ? 'pointer-events-none' : ''}`}
        onClick={e => { if (uploading) e.preventDefault() }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Uploading & validating...</span>
          </div>
        ) : (
          <div>
            <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">
              Drop or <span className="text-primary font-medium">browse</span> (PDF, JPG, PNG)
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Max 5 MB</p>
          </div>
        )}
        <input
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={uploading}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) upload(f)
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
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  vendor_selected: 'Vendor Selected',
  synced_to_sap: 'Synced to SAP',
  po_created: 'PO Created',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function prStatusColor(s: string) {
  if (['vendor_selected', 'synced_to_sap', 'po_created'].includes(s)) return 'bg-green-100 text-green-700'
  if (s === 'approved') return 'bg-blue-100 text-blue-700'
  if (s === 'pending_approval') return 'bg-amber-100 text-amber-700'
  if (['rejected', 'cancelled'].includes(s)) return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function bidStatusColor(s: string) {
  if (s === 'shortlisted') return 'bg-blue-100 text-blue-700'
  if (s === 'pending_approval') return 'bg-purple-100 text-purple-700'
  if (s === 'pending') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

const BID_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  pending_approval: 'In Approval',
}

// ─── KPI Card — flat, borderless, large number, sparkline right ───────────────
function KPICard({
  label, value, sub, subPositive, icon: Icon, iconColor, sparkData, sparkColor, unit,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  subPositive?: boolean
  icon: React.ElementType
  iconColor: string
  sparkData?: number[]
  sparkColor?: string
}) {
  const chartData = (sparkData ?? []).map((v, i) => ({ i, v }))

  return (
    // No Card wrapper — just a plain bordered box like the reference
    <div className="border rounded-lg bg-white px-4 py-3 flex items-start justify-between gap-2">
      {/* Left */}
      <div className="flex-1 min-w-0">
        {/* label row with icon */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
            {label}
          </p>
        </div>
        {/* value */}
        <div className="flex items-baseline gap-1">
          <p className="text-3xl font-bold leading-none tracking-tight">{value}</p>
          {unit && <span className="text-sm text-muted-foreground font-normal">{unit}</span>}
        </div>
        {/* delta */}
        {sub && (
          <p className={`text-xs mt-1.5 flex items-center gap-0.5 font-medium ${subPositive ? 'text-green-600' : 'text-red-500'}`}>
            {subPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {sub}
          </p>
        )}
      </div>

      {/* Right: sparkline */}
      {chartData.length > 0 && (
        <div className="w-[80px] h-[36px] shrink-0 self-center">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparkColor ?? '#6366f1'}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── VendorDashboard — matches reference exactly ──────────────────────────────
function VendorDashboard({ vendorId, vendor }: { vendorId: string | string[]; vendor: any }) {
  const { data: dash, isLoading } = useQuery({
    queryKey: ['vendor-dashboard', vendorId],
    queryFn: async () => (await apiClient.get(`/vendors/${vendorId}/dashboard/`)).data,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg bg-white px-4 py-3 h-24 animate-pulse bg-slate-100" />
        ))}
      </div>
    )
  }

  if (!dash) return null

  const stats = dash.stats ?? {}
  const spendTrend: { month: string; spend: number }[] = dash.spend_trend ?? []
  const transactions: any[] = dash.recent_transactions ?? []
  const perfScore = dash.performance_score != null ? Math.round(Number(dash.performance_score))
    : vendor.performance_score != null ? Math.round(Number(vendor.performance_score))
      : null
  const riskScore = dash.risk_score != null ? Math.round(Number(dash.risk_score))
    : vendor.risk_score != null ? Math.round(Number(vendor.risk_score))
      : null
  const onTimeRate = stats.on_time_delivery_rate == null ? null : Math.round(Number(stats.on_time_delivery_rate))
  const avgLeadDays = stats.avg_delivery_days ?? vendor.standard_lead_time_days ?? null

  const overviewCards = [
    {
      title: 'Vendor Score',
      value: perfScore == null ? '—' : perfScore,
      subtitle: perfScore == null ? 'No score yet' : 'Overall vendor performance',
      icon: Star,
      color: 'bg-indigo-600',
    },
    {
      title: 'On-Time Delivery',
      value: onTimeRate == null ? '—' : `${onTimeRate}%`,
      subtitle: onTimeRate == null ? 'No deliveries yet' : 'Delivery performance',
      icon: CheckCircle,
      color: 'bg-green-600',
    },
    {
      title: 'Avg Lead Time',
      value: avgLeadDays == null ? '—' : `${avgLeadDays} days`,
      subtitle: avgLeadDays == null ? 'No lead-time data' : 'Average delivery timeline',
      icon: Clock,
      color: 'bg-cyan-600',
    },
    {
      title: 'Risk Score',
      value: riskScore == null ? '—' : `${riskScore}/100`,
      subtitle: riskScore == null ? 'Risk not scored' : 'Lower is better',
      icon: AlertTriangle,
      color: 'bg-amber-500',
    },
  ] as const

  return (
    <div className="space-y-4">
      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {overviewCards.map((item) => (
          <Card key={item.title} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.title}</p>
                  <p className="text-2xl font-bold mt-1">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${item.color}`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-12 space-y-4">
          {/* ── Snapshot Card ── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Snapshot</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Vendor profile · auto-refreshed</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'CATEGORY', value: vendor.category_name || '—' },
                  { label: 'PLANT', value: vendor.plant_name || '—' },
                  { label: 'LOCATION', value: [vendor.city, vendor.state].filter(Boolean).join(', ') || '—' },
                  { label: 'COUNTRY', value: vendor.country || '—' },
                  { label: 'CURRENCY', value: vendor.currency || '—' },
                  { label: 'PAYMENT TERMS', value: vendor.payment_terms || '—' },
                  { label: 'INCOTERMS', value: vendor.incoterms || '—' },
                  { label: 'VENDOR CODE', value: vendor.vendor_code || '—' },
                  vendor.standard_lead_time_days != null
                    ? { label: 'STD LEAD TIME', value: `${vendor.standard_lead_time_days} days` }
                    : null,
                  vendor.rush_lead_time_days != null
                    ? { label: 'RUSH LEAD TIME', value: `${vendor.rush_lead_time_days} days` }
                    : null,
                  vendor.min_order_quantity != null
                    ? { label: 'MIN ORDER QTY', value: String(vendor.min_order_quantity) }
                    : null,
                  vendor.is_msme ? { label: 'MSME', value: vendor.msme_number || 'Yes' } : null,
                  vendor.is_sez ? { label: 'SEZ', value: 'Yes' } : null,
                  vendor.is_international ? { label: 'INTERNATIONAL', value: 'Yes' } : null,
                ].filter(Boolean).map(item => (
                  <div key={item!.label} className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{item!.label}</p>
                    <p className="text-sm font-medium text-slate-900">{item!.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Two chart cards ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Spend Trend */}
            <div className="bg-white border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">Spend trend</span>
                <span className="text-xs text-muted-foreground">12 months · ₹ lakhs</span>
              </div>
              {spendTrend.length === 0 || spendTrend.every(d => d.spend === 0) ? (
                <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">
                  No spend data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={spendTrend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${v / 1000}K` : String(v)} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), 'Spend']}
                      contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#spendGrad)"
                      dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Price index vs market */}
            <div className="bg-white border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">Price index vs market</span>
                <span className="text-xs text-muted-foreground">100 = market median</span>
              </div>
              {spendTrend.length === 0 ? (
                <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">
                  No data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart
                    data={spendTrend.map((d, i) => ({
                      month: d.month,
                      index: 100 - i * 0.5,
                    }))}
                    margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Area
                      type="monotone"
                      dataKey="index"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#priceGrad)"
                      dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Recent orders & deliveries ── */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <span className="text-sm font-semibold">Recent orders &amp; deliveries</span>
              <span className="text-xs text-muted-foreground">last 30 days</span>
            </div>
            {transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No transactions yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-white">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">PO</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">DATE</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">ITEMS</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">STATUS</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2">VALUE</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2">RECEIVED</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2">QC</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5 font-mono font-medium text-blue-600">{tx.pr_number}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(tx.date)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{tx.items ?? '—'} SKUs</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tx.status === 'received' ? 'bg-green-100 text-green-700' :
                          tx.status === 'partial_received' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tx.status === 'received' ? 'bg-green-500' :
                            tx.status === 'partial_received' ? 'bg-amber-500' : 'bg-slate-400'
                            }`} />
                          {tx.status === 'received' ? 'Received' :
                            tx.status === 'partial_received' ? 'Partial received' :
                              tx.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(tx.amount)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{tx.received_pct != null ? `${tx.received_pct}%` : '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        {tx.qc_status ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${tx.qc_status === 'passed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {tx.qc_status}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar Area */}
        {/* <div className="lg:col-span-4 space-y-4">
          <VendorAnalysisPanel vendor={vendor} />
        </div> */}
      </div>
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
    approved: 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0',
    draft: 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0',
    rejected: 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
    pending_approval: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    blocked: 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
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
    frow('GST Number', vendor.gst_number),
    frow('PAN Number', vendor.pan_number),
    frow('Category', vendor.category_name),
    frow('Plant', vendor.plant_name),
    frow('Country', vendor.country),
    frow('MSME', vendor.is_msme ? (vendor.msme_number ? `Yes — ${vendor.msme_number}` : 'Yes') : 'No'),
    frow('SEZ', vendor.is_sez ? 'Yes' : 'No'),
    frow('International', vendor.is_international ? 'Yes' : 'No'),
  ].join('')

  const contactRows = [
    frow('Contact Person', vendor.contact_name),
    frow('Email', vendor.contact_email),
    frow('Phone', vendor.contact_phone),
    frow('Address', addr),
  ].join('')

  const bankRows = [
    frow('Bank Name', vendor.bank_name),
    frow('Account No.', vendor.bank_account),
    frow('IFSC Code', vendor.bank_ifsc),
  ].join('')

  const commercialRows = [
    frow('Pricing Model', vendor.pricing_model),
    frow('Payment Terms', vendor.payment_terms),
    frow('Currency', vendor.currency),
    frow('Incoterms', vendor.incoterms),
    frow('Std Lead Time', vendor.standard_lead_time_days ? `${vendor.standard_lead_time_days} days` : null),
    frow('Rush Lead Time', vendor.rush_lead_time_days ? `${vendor.rush_lead_time_days} days` : null),
    frow('Min Order Qty', vendor.min_order_quantity != null ? String(vendor.min_order_quantity) : null),
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

  const perfScore = vendor.performance_score != null ? `${Number(vendor.performance_score).toFixed(1)} / 100` : null
  const riskScore = vendor.risk_score != null ? `${Number(vendor.risk_score).toFixed(1)} / 100` : null
  const createdAt = vendor.created_at ? new Date(vendor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null

  // ── HTML ───────────────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Vendor Profile — ${vendor.company_name}</title>
              <style>
                @page {size: A4 portrait; margin: 14mm 15mm 12mm; }
                * {box - sizing: border-box; }
                body {font - family: Arial, Helvetica, sans-serif; font-size: 10px; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                a {color: inherit; text-decoration: none; }
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
      pending: 'background:#fef3c7;color:#92400e',
      shortlisted: 'background:#dbeafe;color:#1e40af',
      accepted: 'background:#dcfce7;color:#166534',
      rejected: 'background:#fee2e2;color:#991b1b',
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

export default function VendorDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [activeTabKey, setActiveTabKey] = useState<'overview' | 'details' | 'documents' | 'approval'>('overview')

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

  // ── Documents tab edit state ──────────────────────────────────────────────
  const [docFields, setDocFields] = useState<Record<string, string>>({})
  const [savingDocs, setSavingDocs] = useState(false)

  const initDocFields = () => setDocFields({
    gst_number: vendor?.gst_number ?? '',
    pan_number: vendor?.pan_number ?? '',
    bank_account: vendor?.bank_account ?? '',
    bank_ifsc: vendor?.bank_ifsc ?? '',
    bank_name: vendor?.bank_name ?? '',
    msme_number: vendor?.msme_number ?? '',
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

  const canEdit = ['draft', 'pending_approval'].includes(vendor.status)
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'details', label: 'Details' },
    { key: 'documents', label: 'Documents' },
    { key: 'approval', label: 'Approval' },
  ]

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {/* <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/vendors')}
            className="h-auto p-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button> */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-700">{(vendor.company_name ?? '?')[0].toUpperCase()}</span>
            </div>
            <span className="font-semibold truncate">{vendor.company_name}</span>
            <StatusBadge status={vendor.status} />
            {/* {vendor.vendor_code && <span className="text-xs text-muted-foreground font-mono">· {vendor.vendor_code}</span>} */}
            {vendor.gstin && <span className="text-xs text-muted-foreground font-mono">· {vendor.gstin}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { void exportVendorPDF(vendor, id) }} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
          {canEdit && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => {
              if (activeTabKey !== 'details' && activeTabKey !== 'documents') setActiveTabKey('details')
              if (activeTabKey === 'documents') initDocFields()
              setIsEditing(true)
            }} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit Details
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => router.push('/vendors')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTabKey(tab.key as 'overview' | 'details' | 'documents' | 'approval'); setIsEditing(false) }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTabKey === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTabKey === 'overview' && <VendorDashboard vendorId={id} vendor={vendor} />}

      {/* Details Tab */}
      {activeTabKey === 'details' && (
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="text-sm font-semibold">Contact & Location</CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-3">
                  {[
                    { label: 'Contact Person', value: vendor.contact_name, icon: '👤' },
                    { label: 'Email', value: vendor.contact_email, icon: '📧' },
                    { label: 'Phone', value: vendor.contact_phone, icon: '📞' },
                    { label: 'Address', value: [vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ') || '—', icon: '📍' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-sm font-medium text-right text-slate-900">{value || '—'}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="text-sm font-semibold">Banking & Compliance</CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-3">
                  {[
                    { label: 'Bank Name', value: vendor.bank_name },
                    { label: 'Account Number', value: vendor.bank_account },
                    { label: 'IFSC Code', value: vendor.bank_ifsc },
                    { label: 'GST Number', value: vendor.gst_number },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-sm font-medium text-right text-slate-900 font-mono">{value || '—'}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="text-sm font-semibold">Business Information</CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-3">
                  {[
                    { label: 'PAN Number', value: vendor.pan_number },
                    { label: 'Category', value: vendor.category_name || '—' },
                    { label: 'Plant', value: vendor.plant_name || '—' },
                    { label: 'Country', value: vendor.country },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-sm font-medium text-right text-slate-900">{value || '—'}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="text-sm font-semibold">Organization Profile</CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-3">
                  {[
                    { label: 'Established', value: vendor.established },
                    { label: 'Employees', value: vendor.employees },
                    { label: 'Status', value: vendor.status && <StatusBadge status={vendor.status} /> },
                    { label: 'Vendor Code', value: vendor.vendor_code, isMono: true },
                  ].map(({ label, value, isMono }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                      </div>
                      <div className="text-sm font-medium text-right text-slate-900">
                        {typeof value === 'string' ? <span className={isMono ? 'font-mono' : ''}>{value || '—'}</span> : value}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Approval Tab */}
      {activeTabKey === 'approval' && (
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
      {activeTabKey === 'documents' && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Compliance & Documents</CardTitle>
                <p className="text-xs text-muted-foreground mt-2">
                  {isEditing ? 'Upload, replace, or remove regulatory documents.' : 'View regulatory documents and compliance information.'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">

            {(() => {
              const docOf = (type: string) => vendor.documents?.find((d: any) => d.doc_type === type) ?? null
              const refreshVendor = async () => {
                await queryClient.invalidateQueries({ queryKey: ['vendor', id] })
              }
              const blockCls = (hasErr: boolean) =>
                `border rounded-lg p-5 items-start space-y-4 ${hasErr ? 'border-destructive/50 bg-destructive/5' : 'border-slate-200 bg-slate-50/30'}`

              const VerifiedFile = ({ doc: d, onRemove }: { doc: any; onRemove: () => void }) => {
                const [clicked, setClicked] = useState(false)
                return (
                  <div className="flex items-center gap-2 border rounded-lg bg-green-50 px-3 py-2.5 min-h-[40px]">
                    <FileText className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs truncate flex-1 min-w-0 text-green-800">{d?.original_filename}</span>
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                      Verified
                    </span>
                    {d?.file_url && (
                      <a href={d.file_url} target="_blank" rel="noreferrer"
                        className="shrink-0 text-[10px] text-green-600 hover:underline">View</a>
                    )}
                    {canEdit && isEditing && (
                      <button
                        type="button"
                        disabled={clicked}
                        onClick={() => {
                          if (clicked) return
                          setClicked(true)
                          onRemove()
                        }}
                        className="shrink-0 text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {clicked
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <X className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>
                )
              }

              const removeDoc = async (d: any) => {
                if (!d) return
                try {
                  await apiClient.delete(`/vendors/${id}/documents/${d.hash_id ?? d.id}/`)
                  refreshVendor()
                } catch { /* silent */ }
              }

              const isVerified = (d: any) => d?.ai_validation_status === 'passed' || d?.ai_validation_status === 'valid'

              const gstDoc = docOf('gst_certificate')
              const panDoc = docOf('pan_card')
              const bankDoc = docOf('bank_details')

              return <>

                {/* GST */}
                <div className={blockCls(!!(complianceErrors['field_gst_number'] || complianceErrors['doc_gst_certificate']))}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> GST Certificate <span className="text-destructive">*</span>
                      </Label>
                      {isVerified(gstDoc) ? (
                        <VerifiedFile doc={gstDoc} onRemove={() => removeDoc(gstDoc)} />
                      ) : (
                        <>
                          <DocUploadInline vendorId={id} docType="gst_certificate"
                            doc={gstDoc} editable={canEdit && isEditing}
                            onRefresh={refreshVendor} setFieldError={(msg) =>
                              setComplianceErrors(prev => ({ ...prev, doc_gst_certificate: msg }))
                            } />
                          {complianceErrors['doc_gst_certificate'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_gst_certificate']}</p>}
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700">
                        GST Number <span className="text-destructive">*</span>
                        {isVerified(gstDoc) && <span className="text-[10px] text-green-600 ml-1">(AI filled)</span>}
                      </Label>
                      <ComplianceFieldInput
                        value={isEditing ? (docFields.gst_number ?? '') : (vendor.gst_number ?? '')}
                        placeholder="e.g. 27AAAAA0000A1Z5"
                        canEdit={canEdit && isEditing}
                        onChange={v => setDocField('gst_number', v)}
                        onSave={v => setDocField('gst_number', v)}
                      />
                      {complianceErrors['field_gst_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_gst_number']}</p>}
                    </div>
                  </div>
                </div>

                {/* PAN */}
                <div className={blockCls(!!(complianceErrors['field_pan_number'] || complianceErrors['doc_pan_card']))}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> PAN Card <span className="text-destructive">*</span>
                      </Label>
                      {isVerified(panDoc) ? (
                        <VerifiedFile doc={panDoc} onRemove={() => removeDoc(panDoc)} />
                      ) : (
                        <>
                          <DocUploadInline vendorId={id} docType="pan_card"
                            doc={panDoc} editable={canEdit && isEditing}
                            onRefresh={refreshVendor} setFieldError={(msg) =>
                              setComplianceErrors(prev => ({ ...prev, doc_pan_card: msg }))
                            } />
                          {complianceErrors['doc_pan_card'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_pan_card']}</p>}
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700">
                        PAN Number <span className="text-destructive">*</span>
                        {isVerified(panDoc) && <span className="text-[10px] text-green-600 ml-1">(AI filled)</span>}
                      </Label>
                      <ComplianceFieldInput
                        value={isEditing ? (docFields.pan_number ?? '') : (vendor.pan_number ?? '')}
                        placeholder="e.g. AAAAA9999A"
                        canEdit={canEdit && isEditing}
                        onChange={v => setDocField('pan_number', v)}
                        onSave={v => setDocField('pan_number', v)}
                      />
                      {complianceErrors['field_pan_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_pan_number']}</p>}
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className={blockCls(!!(complianceErrors['field_bank_account'] || complianceErrors['doc_bank_details']))}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Bank Details / Cheque <span className="text-destructive">*</span>
                      </Label>
                      {isVerified(bankDoc) ? (
                        <VerifiedFile doc={bankDoc} onRemove={() => removeDoc(bankDoc)} />
                      ) : (
                        <>
                          <DocUploadInline vendorId={id} docType="bank_details"
                            doc={bankDoc} editable={canEdit && isEditing}
                            onRefresh={refreshVendor} setFieldError={(msg) =>
                              setComplianceErrors(prev => ({ ...prev, doc_bank_details: msg }))
                            } />
                          {complianceErrors['doc_bank_details'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_bank_details']}</p>}
                        </>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. HDFC Bank' },
                        { key: 'bank_account', label: 'Account No', placeholder: 'e.g. 12345678901234' },
                        { key: 'bank_ifsc', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234' },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-700">
                            {label} <span className="text-destructive">*</span>
                            {isVerified(bankDoc) && <span className="text-[10px] text-green-600 ml-1">(AI filled)</span>}
                          </Label>
                          <ComplianceFieldInput
                            value={isEditing ? (docFields[key] ?? '') : (vendor[key] ?? '')}
                            placeholder={placeholder}
                            canEdit={canEdit && isEditing}
                            onChange={v => setDocField(key, v)}
                            onSave={v => setDocField(key, v)}
                          />
                        </div>
                      ))}
                      {complianceErrors['field_bank_account'] && <p className="text-xs text-destructive">{complianceErrors['field_bank_account']}</p>}
                    </div>
                  </div>
                </div>

                {/* MSME / SEZ toggles */}
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!vendor.is_msme}
                      disabled={!(canEdit && isEditing)}
                      onChange={async e => handleFieldUpdate('is_msme', e.target.checked)}
                      className="rounded"
                    />
                    <span>MSME Registered</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!vendor.is_sez}
                      disabled={!(canEdit && isEditing)}
                      onChange={async e => handleFieldUpdate('is_sez', e.target.checked)}
                      className="rounded"
                    />
                    <span>SEZ Unit</span>
                  </label>
                </div>

                {/* MSME (conditional) */}
                {vendor.is_msme && (
                  <div className={blockCls(!!(complianceErrors['field_msme_number'] || complianceErrors['doc_msme_certificate']))}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">MSME Number</Label>
                      <ComplianceFieldInput
                        value={isEditing ? (docFields.msme_number ?? '') : (vendor.msme_number ?? '')}
                        placeholder="e.g. UDYAM-MH-00-0000000"
                        canEdit={canEdit && isEditing}
                        onChange={v => setDocField('msme_number', v)}
                        onSave={v => setDocField('msme_number', v)}
                      />
                      {complianceErrors['field_msme_number'] && <p className="text-xs text-destructive mt-1">{complianceErrors['field_msme_number']}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">MSME Certificate</Label>
                      <DocUploadInline vendorId={id} docType="msme_certificate"
                        doc={docOf('msme_certificate')} editable={canEdit && isEditing}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                      {complianceErrors['doc_msme_certificate'] && <p className="text-xs text-destructive mt-1">{complianceErrors['doc_msme_certificate']}</p>}
                    </div>
                  </div>
                )}

                {/* SEZ (conditional) */}
                {vendor.is_sez && (
                  <div className={blockCls(false)}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">SEZ Unit</Label>
                      <p className="text-sm text-muted-foreground">SEZ registered vendor</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">SEZ Certificate</Label>
                      <DocUploadInline vendorId={id} docType="sez_certificate"
                        doc={docOf('sez_certificate')} editable={canEdit && isEditing}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                    </div>
                  </div>
                )}

                {/* Incorporation */}
                <div className={blockCls(false)}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Incorporation Certificate</Label>
                    <DocUploadInline vendorId={id} docType="incorporation"
                      doc={docOf('incorporation')} editable={canEdit && isEditing}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground mt-6">Company registration / MOA documents. Optional.</p>
                  </div>
                </div>

              </>
            })()}

            <div className="border-t pt-4 mt-2">
              <OtherDocsEditPanel
                vendorId={id}
                existingDocs={(vendor.documents ?? []).filter((d: any) => OTHER_DOC_TYPES.has(d.doc_type))}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })}
                editable={canEdit && isEditing}
              />
            </div>

            {canEdit && isEditing && (
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


    </div>
  )
}
