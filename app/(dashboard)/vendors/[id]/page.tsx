'use client'

import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { ExternalLink, Trash2, Upload, FileText, Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, X, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// ─── Compliance rows config ───────────────────────────────────────────────────

const COMPLIANCE_ROWS: Array<{
  docType: string
  label: string
  fieldLabel: string
  fieldKey: string
  show: (v: any) => boolean
}> = [
  { docType: 'gst_certificate',  label: 'GST Certificate',               fieldLabel: 'GST Number',     fieldKey: 'gst_number',    show: () => true },
  { docType: 'pan_card',         label: 'PAN Card',                      fieldLabel: 'PAN Number',     fieldKey: 'pan_number',    show: () => true },
  { docType: 'bank_details',     label: 'Bank Details / Cancelled Cheque', fieldLabel: 'Bank Account', fieldKey: 'bank_account',  show: () => true },
  { docType: 'incorporation',    label: 'Incorporation Certificate',      fieldLabel: 'Company',        fieldKey: 'company_name',  show: () => true },
  { docType: 'msme_certificate', label: 'MSME Certificate',              fieldLabel: 'MSME No.',       fieldKey: 'msme_number',   show: (v: any) => !!v.is_msme },
  { docType: 'sez_certificate',  label: 'SEZ Certificate',               fieldLabel: 'SEZ Unit',       fieldKey: '',              show: (v: any) => !!v.is_sez },
]

// ─── Compliance doc row ────────────────────────────────────────────────────────

function ComplianceDocRow({ docType, label, fieldLabel, fieldValue, doc, vendorId, canEdit, onRefresh }: {
  docType: string
  label: string
  fieldLabel: string
  fieldValue: string
  doc: any | null
  vendorId: string | string[]
  canEdit: boolean
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
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

  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b last:border-0">
      {/* Field value */}
      <div className="w-44 shrink-0">
        <p className="text-xs text-muted-foreground">{fieldLabel}</p>
        <p className="text-sm font-mono font-medium truncate">{fieldValue || '—'}</p>
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
  other: 'Other',
}

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
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Select an approval matrix, then confirm your submission.</p>
      {matrices === undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices...
        </div>
      )}
      {matrices && matrixCount === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          No active vendor onboarding matrices configured.
        </p>
      )}
        {matrices && matrixCount > 0 && (
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
                  <label
                    htmlFor={`submit-matrix-${m.id}`}
                    className={`grid grid-cols-[auto_1fr_auto_auto] items-center px-3 py-3 gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors ${isSelected ? 'hover:bg-primary/5' : ''}`}
                  >
                    <input
                      type="radio"
                      id={`submit-matrix-${m.id}`}
                      name="submit-matrix"
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
                  {isExpanded && (
                    <div className="border-t bg-slate-50/60 px-4 py-2">
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
        <Button
          onClick={submit}
          disabled={submitting || (matrixCount > 0 && selectedMatrix === null)}
          className="gap-1.5 w-full"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          Submit for Approval
      </Button>
    </div>
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

// ─── Inline Edit Form ─────────────────────────────────────────────────────────
function EditDetailsForm({ vendor, categories, plants, onSave, onCancel, saving }: {
  vendor: any
  categories: any[]
  plants: any[]
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    company_name:  vendor.company_name  ?? '',
    gst_number:    vendor.gst_number    ?? '',
    pan_number:    vendor.pan_number    ?? '',
    address:       vendor.address       ?? '',
    city:          vendor.city          ?? '',
    state:         vendor.state         ?? '',
    pincode:       vendor.pincode       ?? '',
    contact_name:  vendor.contact_name  ?? '',
    contact_email: vendor.contact_email ?? '',
    contact_phone: vendor.contact_phone ?? '',
    bank_account:  vendor.bank_account  ?? '',
    bank_ifsc:     vendor.bank_ifsc     ?? '',
    bank_name:     vendor.bank_name     ?? '',
    category:      vendor.category      ?? '',
    plant:         vendor.plant         ?? '',
    is_msme:       vendor.is_msme       ?? false,
    is_sez:        vendor.is_sez        ?? false,
  })

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const textField = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs">{label}</Label>
      <Input
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Classification */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Classification</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Vendor Category</Label>
            <select
              className="w-full h-8 border rounded-md px-3 text-sm bg-background"
              value={form.category}
              onChange={e => set('category', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— none —</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.series_code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plant</Label>
            <select
              className="w-full h-8 border rounded-md px-3 text-sm bg-background"
              value={form.plant}
              onChange={e => set('plant', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— none —</option>
              {plants.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Basic Profile */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Basic Profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {textField('company_name', 'Company Name')}
          {textField('gst_number', 'GST Number')}
          {textField('pan_number', 'PAN Number')}
          {textField('address', 'Address')}
          {textField('city', 'City')}
          {textField('state', 'State')}
          {textField('pincode', 'PIN Code')}
          <div className="flex items-center gap-4 pt-1 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_msme} onChange={e => set('is_msme', e.target.checked)} className="rounded" />
              <span>MSME Registered</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_sez} onChange={e => set('is_sez', e.target.checked)} className="rounded" />
              <span>SEZ Unit</span>
            </label>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Primary Contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {textField('contact_name', 'Contact Person')}
          {textField('contact_email', 'Contact Email')}
          {textField('contact_phone', 'Contact Phone')}
        </div>
      </div>

      {/* Bank */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {textField('bank_account', 'Bank Account No')}
          {textField('bank_ifsc', 'Bank IFSC')}
          {textField('bank_name', 'Bank Name')}
        </div>
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
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VendorDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [uploading, setUploading] = useState(false)
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

  const onDocDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', 'other')
      await apiClient.post(`/vendors/${id}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      queryClient.invalidateQueries({ queryKey: ['vendor', id] })
      toast({ title: 'Document uploaded. AI validation running...' })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }, [id, queryClient, toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDocDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png'],
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiClient.delete(`/vendors/${id}/documents/${docId}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', id] })
      toast({ title: 'Document deleted.' })
    },
  })

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
            <Button size="sm" onClick={() => setShowSubmitModal(true)} className="gap-1.5">
              <SendHorizonal className="w-3.5 h-3.5" /> Submit for Approval
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
        <div>
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Edit Company Details</CardTitle>
              </CardHeader>
              <CardContent>
                <EditDetailsForm
                  vendor={vendor}
                  categories={categories ?? []}
                  plants={plants ?? []}
                  onSave={data => editMutation.mutate(data)}
                  onCancel={() => setIsEditing(false)}
                  saving={editMutation.isPending}
                />
              </CardContent>
            </Card>
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
            <div className="border rounded-lg p-8 text-center text-muted-foreground space-y-1">
              <Clock className="w-5 h-5 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-medium">No approval in progress</p>
              <p className="text-xs">Use the Submit for Approval button to start the process.</p>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Compliance Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compliance Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload supporting documents for each regulatory field. One document per type.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {COMPLIANCE_ROWS.filter(r => r.show(vendor)).map(row => (
                <ComplianceDocRow
                  key={row.docType}
                  docType={row.docType}
                  label={row.label}
                  fieldLabel={row.fieldLabel}
                  fieldValue={row.fieldKey ? (vendor[row.fieldKey] ?? '') : ''}
                  doc={vendor.documents?.find((d: any) => d.doc_type === row.docType) ?? null}
                  vendorId={id}
                  canEdit={isDraft}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: ['vendor', id] })}
                />
              ))}
            </CardContent>
          </Card>

          {/* Other Documents */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Other Documents</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isDraft && (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <input {...getInputProps()} />
                  {uploading && (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Uploading & running AI validation...</span>
                    </div>
                  )}
                  {!uploading && (
                    <div>
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm">Drop PDF or image here, or click to select</p>
                    </div>
                  )}
                </div>
              )}
              {vendor.documents?.filter((d: any) => d.doc_type === 'other').length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No other documents uploaded.</p>
              )}
              {vendor.documents?.filter((d: any) => d.doc_type === 'other').length > 0 && (
                <div className="space-y-2">
                  {vendor.documents.filter((d: any) => d.doc_type === 'other').map((doc: any) => (
                    <Card key={doc.id}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.original_filename}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-xs">{DOC_TYPE_LABELS[doc.doc_type]}</Badge>
                              <AIValidationBadge status={doc.ai_validation_status} />
                              <span className="text-xs text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
                            </div>
                            {doc.ai_validation_notes && (
                              <p className="text-xs text-muted-foreground mt-1">{doc.ai_validation_notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                          {isDraft && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => deleteDocMutation.mutate(doc.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submit for Approval Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setShowSubmitModal(false)}
          />
          <Card className="relative z-10 w-full max-w-lg">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Submit for Approval</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSubmitModal(false)} className="h-7 w-7 p-0">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <SubmitForApprovalPanel
                vendorId={id}
                onSuccess={() => {
                  setShowSubmitModal(false)
                  queryClient.invalidateQueries({ queryKey: ['vendor', id] })
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
