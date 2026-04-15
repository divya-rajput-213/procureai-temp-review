'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Send,
  ChevronDown, ChevronRight, Plus, Sparkles, X, User, Pencil,
  MapPin, Star, AlertTriangle, ThumbsUp, ThumbsDown, Trophy,
  Users, TrendingUp, TrendingDown, BarChart3, PiggyBank, Download,
  History, FileText, Search, Trash2,
  MoreVertical,
} from 'lucide-react'
import {
  formatCurrency, formatDate, formatDateTime, getSLAPercentage, getSLAColor,
} from '@/lib/utils'
import apiClient from '@/lib/api/client'
import ReactMarkdown from 'react-markdown'
import { useSettingsStore } from '@/lib/stores/settings.store'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'

// ─── Approval Timeline ─────────────────────────────────────────────────────────

function stepStyle(action: string) {
  if (action === 'approved') return { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' }
  if (action === 'rejected') return { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' }
  if (action === 'held') return { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' }
  return { dot: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600' }
}

function actionStepClass(action: string) {
  if (action === 'approved') return 'bg-green-50 border-green-200 text-green-700'
  if (action === 'rejected') return 'bg-red-50 border-red-200 text-red-700'
  if (action === 'held') return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-slate-50 border-slate-200 text-slate-500'
}
function levelBubbleCls(action: string, isCurrent: boolean): string {
  if (action === 'approved') return 'bg-green-100 text-green-700'
  if (action === 'rejected') return 'bg-red-100 text-red-700'
  if (action === 'held') return 'bg-amber-100 text-amber-700'
  if (isCurrent) return 'bg-amber-200 text-amber-800'
  return 'bg-slate-100 text-slate-500'
}
function ActionStepIcon({ action }: { action: string }) {
  if (action === 'approved') return <CheckCircle className="w-3 h-3" />
  if (action === 'rejected') return <XCircle className="w-3 h-3" />
  return <Clock className="w-3 h-3" />
}
function ApprovalTimeline({ actions, currentLevel, requestedAt }: { actions: any[]; currentLevel: number; requestedAt?: string }) {
  if (!actions?.length) return <p className="text-sm text-muted-foreground">No actions yet.</p>;

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
            {actions.map((a: any, idx: number) => {
              const s = stepStyle(a.action);
              const isPending = !a.action || a.action === 'pending';
              const isCurrent = isPending && a.level_number === currentLevel;
              const effectiveAction = a.action ?? 'pending';
              let actionLabel = 'Pending';
              if (effectiveAction === 'approved') actionLabel = 'Approved';
              else if (effectiveAction === 'rejected') actionLabel = 'Rejected';
              else if (effectiveAction === 'held') actionLabel = 'On Hold';

              return (
                <tr key={a.id} className={`border-t ${isCurrent ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold ${levelBubbleCls(effectiveAction, isCurrent)}`}>
                      {a.level_number}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                    {a.approver_name ?? '—'}
                    {a.is_delegated && <span className="ml-1.5 text-xs font-normal text-blue-500">(delegated)</span>}
                    {isCurrent && (
                      <span className="ml-1.5 text-xs font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">awaiting</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${actionStepClass(effectiveAction)}`}>
                      <ActionStepIcon action={effectiveAction} />
                      {actionLabel}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── My Action Panel ───────────────────────────────────────────────────────────

function MyActionPanel({ pendingAction, onProcess, onReleaseHold }: {
  pendingAction: any
  onProcess: (action: string, comments: string) => void
  onReleaseHold: () => void
}) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState('')
  const busy = loading !== ''
  const isHeld = pendingAction?.action_status === 'held'

  const handle = async (act: string) => {
    setLoading(act)
    await onProcess(act, comments)
    setLoading('')
    setComments('')
  }

  if (isHeld) {
    return (
      <div className="px-4 py-3 border-t space-y-2">
        <p className="text-xs font-medium text-amber-700">This item is on hold — Level {pendingAction?.level}</p>
        <Button size="sm" variant="outline" className="gap-1" onClick={onReleaseHold} disabled={busy}>
          <Clock className="w-3.5 h-3.5" /> Release Hold
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-t space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Your action required — Level {pendingAction?.level}
      </p>
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
        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
          onClick={() => handle('approved')} disabled={busy || !comments.trim()}>
          {loading === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Approve
        </Button>
        <Button size="sm" variant="destructive" className="gap-1"
          onClick={() => handle('rejected')} disabled={busy || !comments.trim()}>
          {loading === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Reject
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300"
          onClick={() => handle('held')} disabled={busy || !comments.trim()}>
          {loading === 'held' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
          Hold
        </Button>
      </div>
    </div>
  )
}

// ─── Approval Progress Panel ───────────────────────────────────────────────────

function ApprovalProgressPanel({ prId, onStatusChange }: {
  prId: string | string[]
  onStatusChange: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: approvalRequest, isLoading } = useQuery({
    queryKey: ['pr-approval', prId],
    queryFn: async () => {
      const res = await apiClient.get('/approvals/requests/', {
        params: { entity_type: 'purchaserequisition', object_id: prId },
      })
      const list: any[] = res.data.results ?? res.data
      return list.find(r => ['pending', 'in_progress'].includes(r.status)) ?? list[0] ?? null
    },
  })

  const { data: myPendingAction } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    select: (data: any[]) =>
      data.find(a => a.entity_type === 'purchaserequisition' && String(a.object_id) === String(prId)),
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pr', prId] })
    queryClient.invalidateQueries({ queryKey: ['pr-approval', prId] })
    queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    onStatusChange()
  }

  const processAction = async (action: string, comments: string) => {
    if (!myPendingAction) return
    try {
      await apiClient.patch(`/approvals/actions/${myPendingAction.action_id}/`, { action, comments })
      toast({ title: action === 'approved' ? 'Approved.' : action === 'rejected' ? 'Rejected.' : 'Held.' })
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

  const levelLabel = isLoading ? 'Loading…'
    : reqStatus === 'approved' ? 'Fully Approved'
      : reqStatus === 'rejected' ? 'Rejected'
        : approvalRequest ? `In Progress — Level ${approvalRequest.current_level}`
          : 'No Approval Request'

  const headerBg = reqStatus === 'approved' ? 'bg-green-50'
    : reqStatus === 'rejected' ? 'bg-red-50'
      : 'bg-amber-50'
  const headerText = reqStatus === 'approved' ? 'text-green-800'
    : reqStatus === 'rejected' ? 'text-red-800'
      : 'text-amber-800'
  const headerSub = reqStatus === 'approved' ? 'text-green-600'
    : reqStatus === 'rejected' ? 'text-red-600'
      : 'text-amber-600'
  const StatusIcon = reqStatus === 'approved'
    ? <CheckCircle className="w-4 h-4 text-green-600" />
    : reqStatus === 'rejected'
      ? <XCircle className="w-4 h-4 text-red-600" />
      : <Clock className="w-4 h-4 text-amber-600" />

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${headerBg}`}>
        <div className="flex items-center gap-2">
          {StatusIcon}
          <span className={`text-sm font-medium ${headerText}`}>{levelLabel}</span>
          {approvalRequest && (
            <span className={`text-xs ${headerSub}`}>via {approvalRequest.matrix_name}</span>
          )}
        </div>
        {myPendingAction && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSLAColor(pct)}`}>
            {slaLabel}
          </span>
        )}
      </div>
      {isLoading && (
        <div className="px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading approval details…
        </div>
      )}
      {!isLoading && approvalRequest && (
        <div className="">
          <ApprovalTimeline actions={approvalRequest.actions ?? []} currentLevel={approvalRequest.current_level} requestedAt={approvalRequest.created_at} />
          {myPendingAction && (
            <MyActionPanel pendingAction={myPendingAction} onProcess={processAction} onReleaseHold={releaseHold} />
          )}
        </div>
      )}
      {!isLoading && !approvalRequest && (
        <div className="px-4 py-4 text-sm text-muted-foreground">
          No approval request found for this PR.
        </div>
      )}
    </div>
  )
}

// ─── Submit for Approval Modal ─────────────────────────────────────────────────

function SubmitForApprovalModal({ pr, prId, onClose, onSuccess }: {
  pr: any
  prId: string | string[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: matrices, isLoading: loadingMatrices } = useQuery({
    queryKey: ['approval-matrices-pr'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'purchase_requisition', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
  })

  const submit = async () => {
    setSubmitting(true)
    try {
      const body = selectedMatrix ? { matrix_id: selectedMatrix } : {}
      await apiClient.post(`/procurement/${prId}/submit/`, body)
      toast({ title: 'PR submitted for approval.' })
      onSuccess()
      onClose()
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const lineCount = pr.line_items?.length ?? 0
  const vendorNames = (pr.invited_vendors_detail as any[] ?? []).map((v: any) => v.company_name)

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Select Approval Matrix
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the approval workflow for this budget request.
          </p>
        </CardHeader>

        <CardContent className="pt-5">
          {matrices === undefined && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
            </div>
          )}

          {!loadingMatrices && (matrices ?? []).length === 0 && (
            <p className="text-xs text-amber-600 font-medium">
              No active PR approval matrices configured. The system will use the default matrix.
            </p>
          )}

          {!loadingMatrices && (matrices ?? []).length > 0 && (
            <MatrixSelectorTable
              matrices={matrices}
              selectedMatrix={selectedMatrix}
              expandedMatrix={expandedMatrix}
              onSelect={(id) => {
                setSelectedMatrix(id)
                setExpandedMatrix(id)
              }}
              onToggleExpand={(id) => {
                setExpandedMatrix((prev) => (prev === id ? null : id))
              }}
            />
          )}
        </CardContent>

        {/* Footer — same as first design */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button
            onClick={submit}
            disabled={submitting}
            className="gap-2 min-w-[160px]"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit for Approval
          </Button>
        </div>
      </Card>
    </>

  )
}

// ─── Edit PR Form ─────────────────────────────────────────────────────────────

function EditPRForm({ pr, plants, departments, trackingIds, onSave, onCancel, saving }: {
  pr: any
  plants: any[]
  departments: any[]
  trackingIds: any[]
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  saving: boolean
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    plant: pr.plant ?? '',
    department: pr.department ?? '',
    tracking_id: pr.tracking_id ?? '',
    description: pr.description ?? '',
    title: pr.title ?? ""
  })
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))
  // Invited vendors
  const [invitedVendors, setInvitedVendors] = useState<any[]>(pr.invited_vendors_detail ?? [])
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [trackingSearch, setTrackingSearch] = useState('')
  const [showTrackingDropdown, setShowTrackingDropdown] = useState(false)
  const selectedTrackingObj = trackingIds.find((t: any) => t.id === Number(form.tracking_id))

  const { data: vendorResults } = useQuery({
    queryKey: ['vendors-pr-edit', vendorSearch, form.plant],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/', {
        params: {
          status: 'approved',
          search: vendorSearch,
          page_size: 20,
          ...(form.plant ? { plant: form.plant } : {}),
        },
      })

      return r.data.results ?? r.data
    },
    enabled: showVendorDropdown,
  })


  // Line items
  type LineItem = { _key: string; code: string; item_code: number | ''; description: string; quantity: string; unit_of_measure: string; unit_rate: string }
  const [lineItems, setLineItems] = useState<LineItem[]>(
    (pr.line_items ?? []).map((li: any) => ({
      _key: String(li.id),
      code: li.item_code_detail?.code,
      item_code: li.item_code,
      description: li.item_code_detail?.description,
      quantity: String(li.quantity),
      unit_of_measure: li.unit_of_measure,
      unit_rate: String(li.unit_rate),
    }))
  )
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({})
  const [showItemDropdown, setShowItemDropdown] = useState<number | null>(null)
  const activeItemSearch = showItemDropdown === null ? '' : (itemSearch[showItemDropdown] ?? '')

  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))
  const combinedTaxRate = activeTaxes.reduce((s, t) => s + t.rate, 0)
  const subtotal = lineItems.reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity) || 0) *
      (Number(item.unit_rate) || 0),
    0
  )
  const taxTotal = subtotal * (combinedTaxRate / 100)
  const grandTotal = subtotal + taxTotal



  const { data: itemResults } = useQuery({
    queryKey: ['items-edit', activeItemSearch],
    queryFn: async () => {
      const r = await apiClient.get('/procurement/items/', { params: { search: activeItemSearch, page_size: 20 } })
      return r.data.results ?? r.data
    },
    enabled: showItemDropdown !== null,
  })

  const addLineItem = () => setLineItems(prev => [
    ...prev,
    { _key: crypto.randomUUID(), code: "", item_code: '', description: '', quantity: '1', unit_of_measure: 'Nos', unit_rate: '0' },
  ])
  const removeLineItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx))
  const setLI = (idx: number, k: keyof LineItem, v: any) =>
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [k]: v } : li))

  const selectItem = (idx: number, item: any) => {
    const duplicateIdx = lineItems.findIndex((li, i) => i !== idx && li.item_code === item.id)
    if (duplicateIdx !== -1) {
      toast({ title: 'Duplicate item', description: `"${item.code} — ${item.description}" is already added in row ${duplicateIdx + 1}.`, variant: 'destructive' })
      setShowItemDropdown(null)
      return
    }
    setLI(idx, 'item_code', item.id)
    setLI(idx, 'code', item.code)
    setLI(idx, 'description', item.description)
    setLI(idx, 'unit_of_measure', item.unit_of_measure ?? 'EA')
    if (item.unit_rate) setLI(idx, 'unit_rate', String(Number(item.unit_rate)))
    setItemSearch(prev => ({ ...prev, [idx]: `${item.code} — ${item.description}` }))
    setShowItemDropdown(null)
  }

  const addVendor = (v: any) => {
    if (!invitedVendors.some((x: any) => x.id === v.id)) setInvitedVendors(prev => [...prev, v])
    setShowVendorDropdown(false)
    setVendorSearch('')
  }
  const removeVendor = (id: number) => setInvitedVendors(prev => prev.filter((v: any) => v.id !== id))

  const handleSave = () => {
    if (budgetExceeded) {
      toast({ title: 'Budget exceeded', description: `PR total (${formatCurrency(grandTotal)}) exceeds remaining budget (${formatCurrency(budgetRemaining)}).`, variant: 'destructive' })
      return
    }
    onSave({
      ...form,
      plant: form.plant || null,
      department: form.department || null,
      tracking_id: form.tracking_id || null,
      invited_vendor_ids: invitedVendors.map((v: any) => v.id),
      line_items: lineItems.map(li => ({
        item_code: Number(li.item_code),
        description: li.description,
        quantity: Number(li.quantity),
        unit_of_measure: li.unit_of_measure,
        unit_rate: Number(li.unit_rate),
      })),
    })
  }
  useEffect(() => {
    if (!form.tracking_id) return;

    const selectedTracking = trackingIds.find(
      (t: any) => t.id === Number(form.tracking_id)
    );
    if (selectedTracking) {
      setForm(prev => ({
        ...prev,
        plant: selectedTracking.plant ?? '',
        department: selectedTracking.department ?? '',
        description: selectedTracking?.description ?? "",
        title: selectedTracking?.title ?? ""
      }));
    }
  }, [form.tracking_id, trackingIds]);
  const budgetApproved = selectedTrackingObj
    ? Number(selectedTrackingObj.approved_amount ?? selectedTrackingObj.requested_amount)
    : null
  const budgetRemaining = selectedTrackingObj
    ? Number(selectedTrackingObj.remaining_amount ?? (budgetApproved! - Number(selectedTrackingObj.consumed_amount)))
    : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  return (
    <div className="space-y-4">
      {/* Tracking ID (read-only) */}
      <div className="space-y-1">
        <Label className="text-xs">Budget / Tracking ID</Label>
        <Input value={pr.tracking_code ?? selectedTrackingObj?.tracking_code ?? '—'} disabled readOnly className="h-8 bg-muted cursor-not-allowed text-muted-foreground font-mono" />
      </div>

      {/* Budget Details — compact inline */}
      {selectedTrackingObj && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
          <span className="font-medium text-blue-700">Budget</span>
          <span className="text-muted-foreground">Approved: <span className="font-semibold text-foreground">{formatCurrency(budgetApproved ?? 0)}</span></span>
          <span className="text-muted-foreground">Consumed: <span className="font-semibold text-foreground">{formatCurrency(selectedTrackingObj.consumed_amount)}</span></span>
          <span className="text-muted-foreground">Remaining: <span className={`font-semibold ${budgetRemaining !== null && budgetRemaining > 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(budgetRemaining ?? 0)}</span></span>
          {grandTotal > 0 && budgetExceeded && (
            <span className="flex items-center gap-1 text-red-600 font-medium ml-auto">
              <AlertTriangle className="w-3 h-3" />
              Exceeds by {formatCurrency(grandTotal - (budgetRemaining ?? 0))}
            </span>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Title</Label>
        <Input value={form.title} disabled readOnly className="h-8 bg-muted cursor-not-allowed text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none h-16" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Plant</Label>
          <Input value={pr.plant_name ?? '—'} disabled readOnly className="h-8 bg-muted cursor-not-allowed text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Department</Label>
          <Input value={pr.department_name ?? '—'} disabled readOnly className="h-8 bg-muted cursor-not-allowed text-muted-foreground" />
        </div>
      </div>

      {/* Invited Vendors */}
      <div className="space-y-2">
        <Label className="text-xs">Invited Vendors</Label>
        <div className="relative">
          <Input placeholder="Search approved vendors…" value={vendorSearch}
            onChange={e => { setVendorSearch(e.target.value); setShowVendorDropdown(true) }}
            onFocus={() => setShowVendorDropdown(true)}
            onBlur={() => setTimeout(() => setShowVendorDropdown(false), 200)}
            className="h-8" />
          {showVendorDropdown && vendorSearch && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-md bg-background shadow-lg max-h-56 overflow-y-auto divide-y">
              {(vendorResults || []).filter((v: any) => !invitedVendors.some((s: any) => s.id === v.id)).map((v: any) => (
                <button key={v.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => addVendor(v)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.company_name}</span>
                    <span className="text-xs text-emerald-600 font-medium">{v.status}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    {v.category_name && <span>{v.category_name}</span>}
                    {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                  </div>
                </button>
              ))}
              {(vendorResults || []).filter((v: any) => !invitedVendors.some((s: any) => s.id === v.id)).length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No vendors found.</p>
              )}
            </div>
          )}
        </div>
        {invitedVendors.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Location</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invitedVendors.map((v: any) => (
                  <tr key={v.id} className="group hover:bg-muted/30">
                    <td className="px-2 py-1.5 font-medium">{v.company_name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">{v.category_name || '—'}</td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">{v.city ? [v.city, v.state].filter(Boolean).join(', ') : '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeVendor(v.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Line Items — compact table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="h-6 text-xs gap-1 px-2">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
        <div className="border border-border rounded-lg overflow-visible">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[40%]">Item</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">Qty</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">UOM</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[15%]">Rate</th>
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide w-[15%]">Amount</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineItems.map((li, idx) => (
                <tr key={li._key} className="group">
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Input
                        placeholder="Search item…"
                        value={itemSearch[idx] ?? (li.item_code ? `${li.code} — ${li.description}` : '')}
                        onChange={e => { setItemSearch(prev => ({ ...prev, [idx]: e.target.value })); setShowItemDropdown(idx) }}
                        onFocus={() => { setShowItemDropdown(idx) }}
                        onBlur={() => setTimeout(() => setShowItemDropdown(null), 200)}
                        className="h-8 text-xs"
                      />
                      {showItemDropdown === idx && (
                        <div className="absolute z-50 bottom-full mb-1 left-0 right-0 border rounded-md bg-background shadow-lg max-h-48 overflow-y-auto divide-y">
                          {(itemResults || []).map((item: any) => (
                            <button key={item.id} type="button" onMouseDown={e => e.preventDefault()}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs flex items-center gap-2"
                              onClick={() => selectItem(idx, item)}>
                              <span className="font-mono bg-slate-100 px-1 rounded">{item.code}</span>
                              <span className="truncate">{item.description}</span>
                              <span className="ml-auto text-muted-foreground shrink-0">{item.unit_of_measure}</span>
                            </button>
                          ))}
                          {(itemResults || []).length === 0 && (
                            <p className="px-3 py-1.5 text-xs text-muted-foreground">No items found.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" placeholder="1" value={li.quantity}
                      onChange={e => { let v = Number(e.target.value); if (v > 99999) v = 99999; setLI(idx, 'quantity', v || 0) }}
                      className="h-8 text-xs" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input placeholder="EA" value={li.unit_of_measure} onChange={e => setLI(idx, 'unit_of_measure', e.target.value)} className="h-8 text-xs" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" placeholder="0.00" value={li.unit_rate}
                      disabled
                      onChange={e => { let v = parseFloat(e.target.value); if (v > 9999999.99) v = 9999999.99; setLI(idx, 'unit_rate', isNaN(v) ? 0 : Math.round(v * 100) / 100) }}
                      className="h-8 text-xs" />
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm font-medium text-muted-foreground">
                    {formatCurrency((Number(li.quantity) || 0) * (Number(li.unit_rate) || 0))}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button type="button" onClick={() => removeLineItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lineItems.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-1">No line items. Click Add to add one.</p>
        )}

        {/* Totals */}
        <div className="border border-border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr className="bg-slate-50">
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(subtotal)}</td>
              </tr>
              <tr className="bg-slate-50">
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Tax ({combinedTaxRate}%)</td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(taxTotal)}</td>
              </tr>
              <tr className="bg-slate-100 border-t-2">
                <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold">Total</td>
                <td className="px-3 py-2.5 text-right font-bold text-base">{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ─── Line Items Table (read-only) ─────────────────────────────────────────────

function LineItemsTable({ items, currencyCode }: { items: any[]; currencyCode?: string }) {
  const { taxComponents } = useSettingsStore()
  const combinedTaxRate = taxComponents
    .filter(t => t.is_active)
    .reduce((s, t) => s + t.rate, 0)

  if (!items?.length) {
    return <p className="text-sm text-muted-foreground italic">No line items.</p>
  }

  const subtotal = items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_rate) || 0),
    0,
  )
  const totalTax = subtotal * (combinedTaxRate / 100)
  const grandTotal = subtotal + totalTax

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr className="text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium w-8">#</th>
            <th className="text-left px-3 py-2 font-medium">Item / Description</th>
            <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
            <th className="text-left px-3 py-2 font-medium w-20">UOM</th>
            <th className="text-right px-3 py-2 font-medium w-32">Unit Rate</th>
            <th className="text-right px-3 py-2 font-medium w-32">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, idx) => {
            const amount = (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0)
            return (
              <tr key={item.id ?? idx} className="hover:bg-slate-50/50">
                <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium">
                    {item.item_code_detail?.code ?? item.item_code_detail?.description ?? '—'}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.unit_of_measure}</td>
                <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_rate, currencyCode)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(amount, currencyCode)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(subtotal, currencyCode)}</td>
          </tr>
          <tr className="bg-slate-50">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Tax ({combinedTaxRate}%)</td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(totalTax, currencyCode)}</td>
          </tr>
          <tr className="bg-slate-100 border-t-2">
            <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold">Total</td>
            <td className="px-3 py-2.5 text-right font-bold text-base">{formatCurrency(grandTotal, currencyCode)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Add Bid Form ─────────────────────────────────────────────────────────────

function AddBidForm({ prId, invitedVendors: _invitedVendors, existingBidVendorIds, onSuccess }: {
  prId: string | string[]
  invitedVendors: any[]
  existingBidVendorIds: number[]
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    vendor: '',
    bid_amount: '',
    delivery_days: '30',
    notes: '',
  })
  const [bidFile, setBidFile] = useState<File | null>(null)

  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)

  const { data: vendorResults } = useQuery({
    queryKey: ['vendors-pr-bid', vendorSearch],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/', { params: { status: 'approved', search: vendorSearch, page_size: 20 } })
      return r.data.results ?? r.data
    },
    enabled: showVendorDropdown,
  })

  const filteredVendorResults = (vendorResults || []).filter(
    (v: any) => !existingBidVendorIds.includes(v.id)
  )

  const mutation = useMutation({
    mutationFn: async () => {
      if (bidFile) {
        const fd = new FormData()
        fd.append('vendor', String(Number(form.vendor)))
        fd.append('bid_amount', form.bid_amount)
        fd.append('delivery_days', String(Number(form.delivery_days)))
        fd.append('notes', form.notes)
        fd.append('bid_document', bidFile)
        await apiClient.post(`/procurement/${prId}/bids/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await apiClient.post(`/procurement/${prId}/bids/`, {
          vendor: Number(form.vendor),
          bid_amount: form.bid_amount,
          delivery_days: Number(form.delivery_days),
          notes: form.notes,
        })
      }
    },
    onSuccess: () => {
      toast({ title: 'Bid recorded.' })
      setForm({ vendor: '', bid_amount: '', delivery_days: '30', notes: '' })
      setBidFile(null)
      setVendorSearch('')
      setShowVendorDropdown(false)
      setOpen(false)
      onSuccess()
    },
    onError: (err: any) => {
      const msg = err?.response?.data
      const detail = typeof msg === 'object' ? Object.values(msg).flat().join(' ') : String(msg)
      toast({ title: 'Failed to add bid', description: detail, variant: 'destructive' })
    },
  })

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Record Bid
      </Button>
    )
  }

  return (
    <div className="w-full border rounded-xl p-5 space-y-4 bg-slate-50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Record Vendor Bid</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Vendor — full width */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium">Vendor <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              placeholder="Search approved vendors…"
              value={vendorSearch}
              onChange={e => {
                setVendorSearch(e.target.value)
                setShowVendorDropdown(true)
                setForm(f => ({ ...f, vendor: '' }))
              }}
              onFocus={() => setShowVendorDropdown(true)}
              onBlur={() => setTimeout(() => setShowVendorDropdown(false), 200)}
              className="h-9"
            />
            {showVendorDropdown && vendorSearch && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-md bg-background shadow-lg max-h-56 overflow-y-auto divide-y">
                {filteredVendorResults.map((v: any) => (
                  <button
                    key={v.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setForm(f => ({ ...f, vendor: String(v.id) }))
                      setVendorSearch(v.company_name ?? '')
                      setShowVendorDropdown(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.company_name}</span>
                      <span className="text-xs text-emerald-600 font-medium">{v.status}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      {v.category_name && <span>{v.category_name}</span>}
                      {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                    </div>
                  </button>
                ))}
                {filteredVendorResults.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No vendors found.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bid Amount */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Bid Amount <span className="text-destructive">*</span></Label>
          <Input
            type="number" step="0.01" placeholder="0.00"
            value={form.bid_amount}
            onChange={e => setForm(f => ({ ...f, bid_amount: e.target.value }))}
            className="h-9"
          />
        </div>

        {/* Delivery Days */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Delivery Days</Label>
          <Input
            type="number" placeholder="30"
            value={form.delivery_days}
            onChange={e => setForm(f => ({ ...f, delivery_days: e.target.value }))}
            className="h-9"
          />
        </div>

        {/* Bid Document — full width */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium">Bid Document</Label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 bg-white hover:bg-slate-50 text-sm transition-colors">
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              {bidFile ? bidFile.name : 'Attach file (PDF, Excel, Word)…'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={e => setBidFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {bidFile && (
              <button type="button" onClick={() => setBidFile(null)}
                className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notes — full width textarea */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium">Notes</Label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm resize-none h-20 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Additional notes, terms, conditions…"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t">
        <Button
          onClick={() => mutation.mutate()}
          disabled={!form.vendor || !form.bid_amount || mutation.isPending}
          className="gap-1.5"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Save Bid
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Bid Status Badge ─────────────────────────────────────────────────────────

function BidStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-slate-100 text-slate-600', label: 'Pending' },
    shortlisted: { cls: 'bg-blue-100 text-blue-700', label: 'Shortlisted' },
    pending_approval: { cls: 'bg-amber-100 text-amber-700', label: 'Pending Approval' },
    accepted: { cls: 'bg-green-100 text-green-700', label: 'Accepted' },
    rejected: { cls: 'bg-red-100 text-red-700', label: 'Rejected' },
  }
  const s = map[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, children }: {
  title: string
  message: string
  confirmLabel: string
  confirmClass?: string
  onConfirm: (reason?: string) => void
  onCancel: () => void
  children?: React.ReactNode
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        {children}
        <div className="space-y-2">
          <textarea
            className="w-full border rounded-md p-2 text-sm resize-none h-16"
            placeholder="Reason / comments (optional)…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className={confirmClass} onClick={() => onConfirm(reason)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Markdown Table Parser ────────────────────────────────────────────────────

// ─── Bid Summary Cards ─────────────────────────────────────────────────────────

function BidSummaryCards({ bids, pr }: { bids: any[]; pr: any }) {
  if (!bids.length) return null

  const amounts = bids.map(b => Number(b.bid_amount))
  const minAmount = Math.min(...amounts)
  const maxAmount = Math.max(...amounts)
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
  const budget = Number(pr.total_amount)
  const potentialSavings = budget - minAmount
  const savingsPct = budget > 0 ? (potentialSavings / budget * 100) : 0
  const totalInvitations = pr.invited_vendors_detail?.length ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Total Invitations</p>
          <Users className="w-4 h-4 text-blue-500" />
        </div>
        <p className="text-2xl font-bold text-blue-700">{totalInvitations}</p>
        <p className="text-xs text-muted-foreground">{bids.length} bid{bids.length !== 1 ? 's' : ''} received</p>
      </div>

      <div className="border border-violet-100 bg-violet-50/50 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Quote Range</p>
          <TrendingUp className="w-4 h-4 text-violet-500" />
        </div>
        <p className="text-sm font-bold text-violet-700 leading-tight">
          {formatCurrency(minAmount, pr.currency_code)}
          <span className="text-muted-foreground font-normal"> – </span>
          {formatCurrency(maxAmount, pr.currency_code)}
        </p>
        <p className="text-xs text-muted-foreground">
          Spread: {formatCurrency(maxAmount - minAmount, pr.currency_code)}
        </p>
      </div>

      <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Avg. Quote</p>
          <BarChart3 className="w-4 h-4 text-amber-500" />
        </div>
        <p className="text-xl font-bold text-amber-700">{formatCurrency(avgAmount, pr.currency_code)}</p>
        <p className="text-xs text-muted-foreground">Budget: {formatCurrency(budget, pr.currency_code)}</p>
      </div>

      <div className={`border rounded-xl p-4 space-y-2 ${potentialSavings >= 0 ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Potential Savings</p>
          <PiggyBank className={`w-4 h-4 ${potentialSavings >= 0 ? 'text-green-500' : 'text-red-500'}`} />
        </div>
        <p className={`text-xl font-bold ${potentialSavings >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {potentialSavings >= 0 ? '' : '-'}{formatCurrency(Math.abs(potentialSavings), pr.currency_code)}
        </p>
        <p className="text-xs text-muted-foreground">{Math.abs(savingsPct).toFixed(1)}% vs budget</p>
      </div>
    </div>
  )
}

// ─── Bid Highlight Cards ───────────────────────────────────────────────────────

function BidHighlightCards({ bids, pr, aiRec }: { bids: any[]; pr: any; aiRec: any }) {
  if (!bids.length) return null

  const amounts = bids.map(b => Number(b.bid_amount))
  const lowestBid = bids.find(b => Number(b.bid_amount) === Math.min(...amounts))
  const rec = aiRec?.recommendation
  const rankedVendors: any[] = aiRec?.ranked_vendors ?? []
  const recommendedBid = rec ? bids.find(b => b.vendor === rec.recommended_vendor_id) : null
  const recommendedRank = rankedVendors.find(rv => rv.vendor_id === rec?.recommended_vendor_id)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Lowest Price */}
      {lowestBid && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lowest Price</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">{lowestBid.vendor_name}</p>
            <p className="text-2xl font-bold mt-0.5">{formatCurrency(lowestBid.bid_amount, pr.currency_code)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {lowestBid.delivery_days}d delivery
            {lowestBid.vendor_performance_score != null && ` · Perf ${lowestBid.vendor_performance_score}/100`}
            {lowestBid.vendor_risk_score != null && ` · Risk ${lowestBid.vendor_risk_score}/100`}
          </p>
        </div>
      )}

      {/* Best Value / Recommended */}
      {recommendedBid && recommendedRank ? (
        <div className="border border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Best Value (Recommended)</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">{recommendedBid.vendor_name}</p>
            <p className="text-2xl font-bold mt-0.5">{formatCurrency(recommendedBid.bid_amount, pr.currency_code)}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {recommendedBid.delivery_days && <span>{recommendedBid.delivery_days}d lead time</span>}
            {recommendedRank.ai_score != null && (
              <span className="font-semibold text-purple-700">AI Score: {recommendedRank.ai_score}/100</span>
            )}
            {recommendedBid.vendor_risk_score != null && (
              <span>Low risk profile ({recommendedBid.vendor_risk_score}/100)</span>
            )}
          </div>
        </div>
      ) : !rec && (
        <div className="border border-dashed border-purple-200 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 bg-purple-50/20">
          <Sparkles className="w-6 h-6 text-purple-400" />
          <p className="text-sm font-medium text-purple-700">AI Analysis</p>
          <p className="text-xs text-muted-foreground">AI recommendations will appear here after bids are recorded</p>
        </div>
      )}
    </div>
  )
}

// ─── AI Recommendation Banner ─────────────────────────────────────────────────

function AIRecommendationBanner({ aiRec }: { aiRec: any }) {
  if (!aiRec?.recommendation?.recommended_vendor_name) return null
  const rec = aiRec.recommendation

  // Split reasoning into bullet points: first try newlines, then sentences
  const rawPoints: string[] = rec.reasoning
    ? rec.reasoning.split('\n').map((s: string) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
    : []
  const points = rawPoints.length > 1
    ? rawPoints
    : (rec.reasoning ?? '').split(/\.\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 3).map((s: string) => s.endsWith('.') ? s : s + '.')

  return (
    <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl px-4 py-3">
      <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-semibold text-purple-800">AI Recommendation</p>
          <span className="text-xs font-semibold text-purple-700">— {rec.recommended_vendor_name}</span>
          {rec.confidence && (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
              {Math.round(rec.confidence * 100)}% confidence
            </span>
          )}
        </div>
        <ul className="space-y-1">
          {points.map((pt: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
              {pt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── AI Vendor Comparison Table ──────────────────────────────────────────────

function AIVendorComparisonTable({
  aiRec,
  bids,
  pr,
  canAct,
  onApprove,
  onReject,
  onBidEdited,
}: {
  aiRec: any
  bids: any[]
  pr: any
  canAct: boolean
  onApprove: (bid: any) => void
  onReject: (bid: any) => void
  onBidEdited: () => void
}) {
  const ranked: any[] = aiRec?.ranked_vendors ?? []

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<any>(null)
  const [showEditTrail, setShowEditTrail] = useState(false)

  if (ranked.length < 2) return null

  const DIMS = [
    { key: 'price_score', label: 'Price', weight: '30%' },
    { key: 'delivery_score', label: 'Delivery', weight: '20%' },
    { key: 'past_record_score', label: 'Past Record', weight: '20%' },
    { key: 'quality_score', label: 'Quality', weight: '15%' },
    { key: 'distance_score', label: 'Distance', weight: '10%' },
    { key: 'communication_score', label: 'Comms', weight: '5%' },
  ]

  const scoreColor = (s: number) => {
    if (s >= 80) return 'text-green-700 bg-green-50'
    if (s >= 60) return 'text-amber-700 bg-amber-50'
    return 'text-red-700 bg-red-50'
  }

  return (
    <div className="border rounded-xl overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-violet-50 border-b">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
          AI Vendor Comparison
        </p>
        <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full ml-auto">
          {ranked.length} vendors analysed
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 680 }}>
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="text-left px-4 py-2.5">Rank</th>
              <th className="text-left px-4 py-2.5">Vendor</th>
              <th className="text-right px-4 py-2.5">Bid Amount</th>
              <th className="text-center px-4 py-2.5">AI Score</th>

              {DIMS.map(d => (
                <th key={d.key} className="text-center px-3 py-2.5 whitespace-nowrap">
                  {d.label}
                  <span className="block text-[10px]">{d.weight}</span>
                </th>
              ))}

              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>

          <tbody className="divide-y">

            {ranked.map((rv: any) => {
              const bid = bids.find((b: any) => b.vendor === rv.vendor_id)
              const breakdown = rv.score_breakdown ?? {}
              const isOpen = expandedMap[rv.vendor_id]

              const isAccepted = bid?.status === 'accepted'
              const isRejected = bid?.status === 'rejected'
              const isPendingApproval = bid?.status === 'pending_approval'

              const isLocked =
                aiRec?.lock_active && !isAccepted && !isRejected && !isPendingApproval

              const hideMenu = isAccepted || isRejected || isPendingApproval

              const isRecommended =
                aiRec?.recommendation?.recommended_vendor_id === rv.vendor_id

              const editCount = (bid?.edit_logs ?? []).length

              const colSpan = DIMS.length + 5


              return (
                <>
                  <tr
                    key={rv.vendor_id}
                    className={`transition-all ${isAccepted
                      ? 'bg-green-50/60 border-green-300'
                      : isRejected
                        ? 'bg-red-50/20 border-red-200 opacity-60'
                        : isPendingApproval
                          ? 'bg-amber-50/40 border-amber-300'
                          : isLocked
                            ? 'border-slate-200 opacity-50'
                            : isRecommended
                              ? 'bg-purple-50/30 border-purple-300'
                              : 'bg-white'
                      }`}
                  >


                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span className="w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold bg-slate-100">
                        {rv.rank}
                      </span>
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rv.vendor_name}</span>
                        <BidStatusBadge status={bid.status} />

                        {isRecommended && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            TOP PICK
                          </span>
                        )}

                        {isAccepted && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            SELECTED
                          </span>
                        )}
                      </div>
                      {rv.notes && <p className="text-muted-foreground mt-0.5 max-w-[200px] truncate" title={rv.notes}>{rv.notes}</p>}

                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right font-semibold">
                      {bid ? formatCurrency(bid.bid_amount, pr.currency_code) : '—'}
                    </td>

                    {/* AI SCORE */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded font-bold ${scoreColor(rv.ai_score)}`}>
                        {rv.ai_score}
                      </span>
                    </td>

                    {/* DIMENSIONS */}
                    {DIMS.map(d => {
                      const val = breakdown[d.key]
                      return (
                        <td key={d.key} className="px-3 py-3 text-center">
                          {val != null ? (
                            <span className={`px-1.5 py-0.5 rounded text-xs ${scoreColor(val)}`}>
                              {val}
                            </span>
                          ) : '—'}
                        </td>
                      )
                    })}

                    {/* ACTIONS */}
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">

                        {/* DO NOT SHOW MENU IF ACCEPTED / REJECTED / PENDING_APPROVAL */}
                        {!hideMenu && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpen(menuOpen === rv.vendor_id ? null : rv.vendor_id)
                              }
                              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuOpen === rv.vendor_id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border rounded shadow z-20">

                                <button
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                  onClick={() => {
                                    setEditing(bid)
                                    setMenuOpen(null)
                                  }}
                                >
                                  Edit
                                </button>

                                {canAct && (
                                  <button
                                    className="w-full text-left px-3 py-2 text-xs text-green-600 hover:bg-green-50"
                                    onClick={() => {
                                      onApprove(bid)
                                      setMenuOpen(null)
                                    }}
                                  >
                                    Approve
                                  </button>
                                )}

                                {canAct && (
                                  <button
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                      onReject(bid)
                                      setMenuOpen(null)
                                    }}
                                  >
                                    Reject
                                  </button>
                                )}
                                {editCount > 0 && (
                                  <button type="button"
                                    onClick={() => setShowEditTrail(x => !x)}
                                    className="h-7 flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded border border-transparent hover:border-border transition-colors"
                                    title="View edit history">
                                    <History className="w-3.5 h-3.5" />
                                    <span>{editCount}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* EXPAND BUTTON STILL ALLOWED */}
                        {rv.score_breakdown && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMap(prev => ({
                                ...prev,
                                [rv.vendor_id]: !prev[rv.vendor_id],
                              }))
                            }
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            {expandedMap[rv.vendor_id] ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                  {/* Pending approval progress */}

                  {/* EXPANDED */}
                  {isOpen && (
                    <tr>
                      <td colSpan={colSpan} className="p-0">
                        <div className="px-4 pb-4 bg-slate-50 border-t">
                          <ScoreDimensionGrid scoreBreakdown={rv.score_breakdown} />
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={colSpan} className="p-0">
                      <BidApprovalProgress bid={bid} />
                    </td>
                  </tr>
                  {/* Edit trail */}
                  {showEditTrail && bid?.edit_logs?.length > 0 && (
                    <tr>
                      <td colSpan={colSpan} className="p-0">
                        <BidEditTrail
                          logs={bid.edit_logs}
                          currencyCode={pr.currency_code}
                        />
                      </td>
                    </tr>
                  )}



                  {/* Rejection reason */}
                  {isRejected && bid?.rejection_reason && (
                    <tr>
                      <td colSpan={colSpan} className="p-0">
                        <div className="px-4 pb-3 bg-red-50/30 border-t border-red-100">
                          <p className="text-xs text-red-600 mt-2">
                            Reason: {bid.rejection_reason}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                </>

              )
            })}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <EditBidModal
          bid={editing}
          prId={pr.id}
          onClose={() => setEditing(null)}
          onSuccess={onBidEdited}
        />
      )}

      {/* SUMMARY */}
      {aiRec.summary && (
        <div className="px-4 py-3 border-t bg-slate-50 text-xs text-muted-foreground">
          <span className="font-semibold">Summary: </span>
          {aiRec.summary}
        </div>
      )}
    </div>
  )
}


// ─── Score Dimension Grid ─────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  price_score: 'Price',
  past_record_score: 'Past Record',
  delivery_score: 'Delivery',
  distance_score: 'Distance',
  quality_score: 'Quality',
  communication_score: 'Communication',
}

function ScoreDimensionGrid({ scoreBreakdown }: { scoreBreakdown: Record<string, number> }) {
  const keys = ['price_score', 'past_record_score', 'delivery_score', 'distance_score', 'quality_score', 'communication_score']
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 pt-3 border-t border-dashed">
      {keys.map(k => {
        const score = scoreBreakdown[k]
        if (score === undefined) return null
        return <ScoreBar key={k} label={DIMENSION_LABELS[k] ?? k} score={score} />
      })}
    </div>
  )
}

// ─── Bid Edit Modal ──────────────────────────────────────────────────────────

function EditBidModal({ bid, prId, onClose, onSuccess }: {
  bid: any
  prId: string | string[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    bid_amount: String(bid.bid_amount),
    delivery_days: String(bid.delivery_days),
    notes: bid.notes ?? '',
    change_reason: '',
  })
  const [bidFile, setBidFile] = useState<File | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('bid_amount', form.bid_amount)
      fd.append('delivery_days', String(Number(form.delivery_days)))
      fd.append('notes', form.notes)
      fd.append('change_reason', form.change_reason)
      if (bidFile) fd.append('bid_document', bidFile)
      await apiClient.patch(`/procurement/${prId}/bids/${bid.hash_id}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast({ title: 'Bid updated.' })
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      const d = err?.response?.data
      const msg = typeof d === 'string' ? d : d?.detail ?? (d && typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Update failed.')
      toast({ title: 'Update failed', description: msg, variant: 'destructive' })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit Bid — {bid.vendor_name}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Bid Amount *</Label>
            <Input type="number" step="0.01" value={form.bid_amount}
              onChange={e => setForm(f => ({ ...f, bid_amount: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Delivery Days *</Label>
            <Input type="number" value={form.delivery_days}
              onChange={e => setForm(f => ({ ...f, delivery_days: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comments / Notes</Label>
            <textarea className="w-full border rounded-md p-2 text-sm resize-none h-16"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Replace Document</Label>
            <div className="flex items-center gap-2 text-xs">
              <label className="cursor-pointer border rounded px-2 py-1 hover:bg-slate-50">
                Choose file
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setBidFile(f); e.target.value = '' }} />
              </label>
              <span className="text-muted-foreground truncate">{bidFile?.name ?? 'No new file'}</span>
              {bidFile && <button type="button" onClick={() => setBidFile(null)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reason for Change *</Label>
            <textarea className={`w-full border rounded-md p-2 text-sm resize-none h-12 ${!form.change_reason.trim() ? 'border-amber-300' : ''}`}
              placeholder="Why is this bid being revised? (required)"
              value={form.change_reason}
              onChange={e => setForm(f => ({ ...f, change_reason: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 justify-end px-6 py-4 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.bid_amount || !form.delivery_days || !form.change_reason.trim()}
            className="gap-1">
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bid Edit Trail ──────────────────────────────────────────────────────────

function BidEditTrail({ logs, currencyCode }: { logs: any[]; currencyCode: string }) {
  if (!logs || logs.length === 0) return null
  return (
    <div className="px-4 pb-3 bg-slate-50/60 border-t">
      <div className="flex items-center gap-1.5 pt-2 pb-1.5">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Edit History ({logs.length})
        </span>
      </div>
      <div className="space-y-2">
        {logs.map((log: any) => {
          const priceChanged = String(log.old_bid_amount) !== String(log.new_bid_amount)
          const deliveryChanged = log.old_delivery_days !== log.new_delivery_days
          const notesChanged = log.old_notes !== log.new_notes
          const docChanged = log.old_bid_document !== log.new_bid_document
          return (
            <div key={log.id} className="border rounded-md bg-white px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-foreground">{log.edited_by_name}</span>
                <span className="text-muted-foreground">{formatDateTime(log.edited_at)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {priceChanged && (
                  <span>
                    Price: <span className="line-through text-red-500">{formatCurrency(log.old_bid_amount, currencyCode)}</span>
                    {' → '}<span className="font-medium text-foreground">{formatCurrency(log.new_bid_amount, currencyCode)}</span>
                  </span>
                )}
                {deliveryChanged && (
                  <span>
                    Delivery: <span className="line-through text-red-500">{log.old_delivery_days}d</span>
                    {' → '}<span className="font-medium text-foreground">{log.new_delivery_days}d</span>
                  </span>
                )}
                {notesChanged && <span>Notes updated</span>}
                {docChanged && <span className="flex items-center gap-0.5"><FileText className="w-3 h-3" /> Document replaced</span>}
              </div>
              {log.change_reason && (
                <p className="mt-1 text-muted-foreground italic">Reason: {log.change_reason}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Bid Row ──────────────────────────────────────────────────────────────────

function BidRow({ bid, pr, rank, aiRankedVendors, canAct, hasBidPendingApproval, onApprove, onReject, onBidEdited }: {
  bid: any
  pr: any
  rank: number
  aiRankedVendors: any[]
  canAct: boolean
  hasBidPendingApproval: boolean
  onApprove: (bid: any) => void
  onReject: (bid: any) => void
  onBidEdited: () => void
}) {
  const { id: prId } = useParams()
  const [expanded, setExpanded] = useState(false)
  const [showEditTrail, setShowEditTrail] = useState(false)
  const [editing, setEditing] = useState(false)
  const aiRank = aiRankedVendors.find(rv => rv.vendor_id === bid.vendor)
  const isAccepted = bid.status === 'accepted'
  const isRejected = bid.status === 'rejected'
  const isPendingApproval = bid.status === 'pending_approval'
  const isRecommended = pr.ai_recommendation?.recommendation?.recommended_vendor_id === bid.vendor

  const isLocked = hasBidPendingApproval && !isPendingApproval && !isAccepted && !isRejected
  const canEdit = canAct && !isAccepted && !isRejected && !isPendingApproval
  const editCount = (bid.edit_logs ?? []).length

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isAccepted ? 'border-green-300' :
      isRejected ? 'border-red-200 opacity-60' :
        isPendingApproval ? 'border-amber-300' :
          isLocked ? 'border-slate-200 opacity-50' :
            isRecommended ? 'border-purple-300' : 'border-border'
      }`}>
      {/* Lock banner */}
      {isLocked && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 border-b text-xs text-slate-500">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Locked — another bid is under approval
        </div>
      )}

      {/* Main row */}
      <div className={`flex items-center gap-3 px-4 py-3 ${isAccepted ? 'bg-green-50/60' :
        isRejected ? 'bg-red-50/20' :
          isPendingApproval ? 'bg-amber-50/40' :
            isRecommended ? 'bg-purple-50/30' : 'bg-white'
        }`}>
        {/* Rank */}
        <span className="text-xs font-bold text-muted-foreground w-6 shrink-0 text-center">#{rank}</span>

        {/* Vendor info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{bid.vendor_name}</p>
            <BidStatusBadge status={bid.status} />
            {isRecommended && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                <Sparkles className="w-3 h-3" /> Recommended
              </span>
            )}
            {isAccepted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                <Trophy className="w-3 h-3" /> Selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {(bid.vendor_city || bid.vendor_state) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {[bid.vendor_city, bid.vendor_state].filter(Boolean).join(', ')}
              </span>
            )}
            {bid.vendor_performance_score != null && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400" />
                Perf {bid.vendor_performance_score}/100
              </span>
            )}
            {bid.notes && <span className="italic">"{bid.notes}"</span>}
          </div>
        </div>

        {/* Quote (latest price) */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5 justify-end">
            <p className="text-base font-bold">{formatCurrency(bid.bid_amount, pr.currency_code)}</p>
            {editCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Revised</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {bid.delivery_days}d · {bid.validity_days}d validity
          </p>
        </div>

        {/* AI Score pill */}
        {bid.ai_score != null && (
          <div className={`shrink-0 hidden sm:flex flex-col items-center justify-center w-14 h-12 rounded-lg border ${bid.ai_score >= 75 ? 'border-green-200 bg-green-50' :
            bid.ai_score >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
            }`}>
            <span className={`text-base font-bold leading-none ${bid.ai_score >= 75 ? 'text-green-700' :
              bid.ai_score >= 50 ? 'text-amber-700' : 'text-red-700'
              }`}>{bid.ai_score}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">AI Score</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => setEditing(true)}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
          )}
          {canAct && !isAccepted && !isRejected && !isPendingApproval && !hasBidPendingApproval && (
            <>
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1"
                onClick={() => onApprove(bid)}>
                <ThumbsUp className="w-3 h-3" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                onClick={() => onReject(bid)}>
                <ThumbsDown className="w-3 h-3" /> Reject
              </Button>
            </>
          )}
          {editCount > 0 && (
            <button type="button"
              onClick={() => setShowEditTrail(x => !x)}
              className="h-7 flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded border border-transparent hover:border-border transition-colors"
              title="View edit history">
              <History className="w-3.5 h-3.5" />
              <span>{editCount}</span>
            </button>
          )}
          {aiRank?.score_breakdown && (
            <button type="button"
              onClick={() => setExpanded(x => !x)}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded border border-transparent hover:border-border transition-colors ml-1">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded: 6-dimension score grid */}
      {expanded && aiRank?.score_breakdown && (
        <div className="px-4 pb-4 bg-slate-50 border-t">
          <ScoreDimensionGrid scoreBreakdown={aiRank.score_breakdown} />
        </div>
      )}

      {/* Edit trail */}
      {showEditTrail && <BidEditTrail logs={bid.edit_logs} currencyCode={pr.currency_code} />}

      {/* Pending approval progress */}
      <BidApprovalProgress bid={bid} />

      {/* Rejection reason */}
      {isRejected && bid.rejection_reason && (
        <div className="px-4 pb-3 bg-red-50/30 border-t border-red-100">
          <p className="text-xs text-red-600 mt-2">Reason: {bid.rejection_reason}</p>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditBidModal bid={bid} prId={prId!} onClose={() => setEditing(false)} onSuccess={onBidEdited} />
      )}
    </div>
  )
}

// ─── Bid Approval Modal ────────────────────────────────────────────────────────

function BidApprovalModal({ bid, pr, onClose, onSuccess }: {
  bid: any
  pr: any
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: matrices, isLoading: loadingMatrices } = useQuery({
    queryKey: ['approval-matrices-bid'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'vendor_bid', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
  })

  const submit = async () => {
    if (!selectedMatrix) {
      toast({ title: 'Please select an approval matrix.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post(`/procurement/${pr.hash_id}/submit-bid-for-approval/`, {
        bid_id: bid.hash_id,
        matrix_id: selectedMatrix,
      })
      toast({ title: `Bid from ${bid.vendor_name} submitted for approval.` })
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.response?.data?.detail ?? 'Submission failed.'
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-green-600" />
              Submit Bid for Approval
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select an approval matrix. All matrix approvers must approve before the bid is accepted.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Bid Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selected Bid</p>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-sm">{bid.vendor_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {(bid.vendor_city || bid.vendor_state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[bid.vendor_city, bid.vendor_state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {bid.vendor_performance_score != null && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400" />
                      Perf {bid.vendor_performance_score}/100
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{formatCurrency(bid.bid_amount, pr.currency_code)}</p>
                <p className="text-xs text-muted-foreground">{bid.delivery_days}d delivery</p>
              </div>
            </div>
            {bid.ai_score != null && (
              <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs text-purple-700 font-medium">AI Score: {bid.ai_score}/100</span>
              </div>
            )}
          </div>

          {/* Matrix Selection */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Approval Matrix <span className="text-destructive">*</span></p>
              <p className="text-xs text-muted-foreground">
                Select which approval chain must sign off on this bid selection.
              </p>
            </div>

            {loadingMatrices && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
              </div>
            )}
            {!loadingMatrices && (matrices ?? []).length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No active <strong>Vendor Bid Approval</strong> matrices found. Create one in Settings → Approval Matrices with type "Vendor Bid Approval".
              </p>
            )}
            {!loadingMatrices && (matrices ?? []).length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Matrix Name</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Levels</th>
                      <th className="w-8 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(matrices as any[]).map((m: any) => {
                      const levelCount = m.levels?.length ?? 0
                      const isSelected = selectedMatrix === m.id
                      const isExpanded = expandedMatrix === m.id
                      return (
                        <React.Fragment key={m.id}>
                          <tr
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'hover:bg-slate-50'}`}
                            onClick={() => setSelectedMatrix(m.id)}
                          >
                            <td className="px-3 py-2.5 text-center">
                              <input type="radio" checked={isSelected} onChange={() => setSelectedMatrix(m.id)}
                                className="accent-primary" onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="px-3 py-2.5 font-medium">{m.name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell capitalize">
                              {(m.matrix_type ?? '').replace('_', ' ')}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {levelCount} level{levelCount !== 1 ? 's' : ''}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setExpandedMatrix(prev => prev === m.id ? null : m.id) }}
                                className="text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && levelCount > 0 && (
                            <tr>
                              <td colSpan={5} className="p-0">
                                <div className="bg-slate-50 border-t px-6 py-3">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground border-b border-slate-200">
                                        <th className="text-left pb-2 pr-4 font-medium">Level</th>
                                        <th className="text-left pb-2 pr-4 font-medium">Approver</th>
                                        <th className="text-left pb-2 pr-4 font-medium">Role</th>
                                        <th className="text-left pb-2 font-medium">SLA</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {m.levels.map((lv: any) => (
                                        <tr key={lv.id}>
                                          <td className="py-2 pr-4 font-medium text-muted-foreground">L{lv.level_number}</td>
                                          <td className="py-2 pr-4">
                                            <div className="flex items-center gap-1.5">
                                              <User className="w-3 h-3 text-muted-foreground shrink-0" />
                                              <span className="font-medium">{lv.user_name ?? '—'}</span>
                                            </div>
                                          </td>
                                          <td className="py-2 pr-4 text-muted-foreground">{lv.role_name ?? '—'}</td>
                                          <td className="py-2 text-muted-foreground">{lv.sla_hours ? `${lv.sla_hours}h` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting || !selectedMatrix}
            className="gap-2 min-w-[200px] bg-green-600 hover:bg-green-700"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
            Submit for Approval
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bid Approval Progress ─────────────────────────────────────────────────────

function bidActionStyle(action: string, isCurrent: boolean) {
  if (action === 'approved') return { badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', label: 'Approved' }
  if (action === 'rejected') return { badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Rejected' }
  if (action === 'held') return { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'On Hold' }
  if (isCurrent) return { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'Awaiting' }
  return { badge: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-300', label: 'Pending' }
}

function BidApprovalProgress({ bid }: { bid: any }) {
  const { data: approvalRequest, isLoading } = useQuery({
    queryKey: ['bid-approval', bid.hash_id],
    queryFn: async () => {
      const res = await apiClient.get('/approvals/requests/', {
        params: { entity_type: 'vendorbid', object_id: bid.hash_id },
      })
      const list: any[] = res.data.results ?? res.data
      return list.find(r => ['pending', 'in_progress'].includes(r.status)) ?? list[0] ?? null
    },
    enabled: bid.status === 'pending_approval',
    refetchInterval: 15000,
  })

  if (bid.status !== 'pending_approval') return null

  const actions: any[] = approvalRequest?.actions ?? []
  const currentLevel: number = approvalRequest?.current_level ?? 0

  return (
    <div className="px-4 py-3 bg-amber-50/50 border-t border-amber-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Approval in Progress
        </p>
        {approvalRequest && (
          <span className="text-xs text-muted-foreground">
            {approvalRequest.matrix_name} · Level {approvalRequest.current_level}/{approvalRequest.total_levels}
          </span>
        )}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground py-1">Loading approval status…</p>}

      {!isLoading && approvalRequest?.created_at && (
        <p className="text-[11px] text-muted-foreground mb-2">Requested for approval: <span className="font-medium text-slate-700">{formatDateTime(approvalRequest.created_at)}</span></p>
      )}

      {!isLoading && actions.length > 0 && (
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-amber-100/60 text-amber-900">
              <th className="text-left px-3 py-1.5 font-medium w-12">Level</th>
              <th className="text-left px-3 py-1.5 font-medium">Approver</th>
              <th className="text-left px-3 py-1.5 font-medium w-28">Status</th>
              <th className="text-left px-3 py-1.5 font-medium">Comments</th>
              <th className="text-left px-3 py-1.5 font-medium whitespace-nowrap">Due Date</th>
              <th className="text-right px-3 py-1.5 font-medium whitespace-nowrap">Acted At</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-amber-50">
            {actions.map((a: any) => {
              const isPending = !a.action || a.action === 'pending'
              const isCurrent = isPending && a.level_number === currentLevel
              const effectiveAction = a.action ?? (isCurrent ? 'current' : 'pending')
              const s = bidActionStyle(effectiveAction, isCurrent)
              return (
                <tr key={a.id} className={isCurrent ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold">
                      {a.level_number}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700">
                    {a.approver_name ?? '—'}
                    {isCurrent && (
                      <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">awaiting</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground italic">
                    {a.comments || '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {a.sla_deadline ? formatDateTime(a.sla_deadline) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {a.acted_at ? formatDateTime(a.acted_at) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {!isLoading && !approvalRequest && (
        <p className="text-xs text-muted-foreground italic">No approval record found.</p>
      )}
    </div>
  )
}

// ─── Bids Tab ─────────────────────────────────────────────────────────────────

function BidsTab({ pr, onPRChange }: { pr: any; onPRChange: () => void }) {
  const { id } = useParams()
  const { toast } = useToast()
  const [bidToApprove, setBidToApprove] = useState<any>(null)
  const [confirmReject, setConfirmReject] = useState<any>(null)

  const canCollectBids = ['approved', 'vendor_selected', 'synced_to_sap', 'po_created'].includes(pr.status)
  const canAct = pr.status === 'approved'

  const { data: bids, refetch: refetchBids } = useQuery({
    queryKey: ['pr-bids', id],
    queryFn: async () => {
      const res = await apiClient.get(`/procurement/${id}/bids/`)
      return res.data.results ?? res.data
    },
  })

  const existingBidVendorIds = (bids ?? []).map((b: any) => b.vendor)
  const hasBidPendingApproval = (bids ?? []).some((b: any) => b.status === 'pending_approval')
  const aiRec = pr.ai_recommendation ?? {}
  const aiRankedVendors: any[] = aiRec.ranked_vendors ?? []

  // Called after a bid is saved — refetch bids and PR (AI analysis runs on backend)
  const handleBidAdded = async () => {
    await refetchBids()
    onPRChange()
  }

  // Sort: accepted → ranked by AI → by amount → rejected
  const sortedBids = [...(bids ?? [])].sort((a: any, b: any) => {
    if (a.status === 'accepted') return -1
    if (b.status === 'accepted') return 1
    if (a.status === 'rejected' && b.status !== 'rejected') return 1
    if (b.status === 'rejected' && a.status !== 'rejected') return -1
    const ar = aiRankedVendors.find(rv => rv.vendor_id === a.vendor)
    const br = aiRankedVendors.find(rv => rv.vendor_id === b.vendor)
    if (ar && br) return ar.rank - br.rank
    return Number(a.bid_amount) - Number(b.bid_amount)
  })

  const handleReject = async (reason?: string) => {
    if (!confirmReject) return
    try {
      await apiClient.post(`/procurement/${id}/reject-bid/`, { bid_id: confirmReject.hash_id, reason })
      toast({ title: `Bid from ${confirmReject.vendor_name} rejected.` })
      setConfirmReject(null)
      refetchBids()
    } catch (err: any) {
      toast({ title: 'Rejection failed', description: err?.response?.data?.error, variant: 'destructive' })
    }
  }

  if (!canCollectBids) {
    return (
      <div className="border rounded-xl p-8 text-center space-y-2">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Bids are collected after PR approval</p>
        <p className="text-xs text-muted-foreground">Once this PR is approved, invited vendors can submit bids here.</p>
      </div>
    )
  }

  const pendingBids = (bids ?? []).filter((b: any) => b.status === 'pending')
  const acceptedBid = (bids ?? []).find((b: any) => b.status === 'accepted')
  const hasBids = (bids ?? []).length > 0

  return (
    <div className="space-y-5">

      {/* Vendor-selected banner + Create PO */}
      {pr.status === 'vendor_selected' && acceptedBid && (
        <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Vendor selected: {acceptedBid.vendor_name}</p>
              <p className="text-xs text-green-700">
                Bid of {formatCurrency(acceptedBid.bid_amount, pr.currency_code)} · {acceptedBid.delivery_days}d delivery
              </p>
            </div>
          </div>
          <CreatePOButton prId={pr.id} prNumber={pr.pr_number} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {canAct && (
          <AddBidForm
            prId={id!}
            invitedVendors={pr.invited_vendors_detail ?? []}
            existingBidVendorIds={existingBidVendorIds}
            onSuccess={handleBidAdded}
          />
        )}
      </div>

      {hasBids ? (
        <>
          {/* ── KPI Cards ── */}
          <BidSummaryCards bids={bids ?? []} pr={pr} />

          {/* ── Highlight Cards (Lowest Price + Best Value) ── */}
          <BidHighlightCards bids={bids ?? []} pr={pr} aiRec={aiRec} />

          {/* ── AI Recommendation Banner ── */}
          <AIRecommendationBanner aiRec={aiRec} />

          {/* ── AI Vendor Comparison Table ── */}
          <AIVendorComparisonTable
            aiRec={aiRec}
            bids={bids ?? []}
            pr={pr}
            canAct={canAct}
            onApprove={b => setBidToApprove(b)}
            onReject={b => setConfirmReject(b)}
            onBidEdited={() => { refetchBids(); onPRChange() }}
          />


          {/* ── Anomalies ── */}
          {(aiRec.anomalies ?? []).length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Anomalies / Red Flags</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {(aiRec.anomalies as string[]).map((a: string, i: number) => <li key={i}>• {a}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* ── Bids list ── */}
         { aiRec.length<=0 &&<div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Bids ({(bids ?? []).length})
              </p>
            </div>
            {sortedBids.map((bid: any, idx: number) => (
              <BidRow
                key={bid.id}
                bid={bid}
                pr={pr}
                rank={idx + 1}
                aiRankedVendors={aiRankedVendors}
                canAct={canAct}
                hasBidPendingApproval={hasBidPendingApproval}
                onApprove={b => setBidToApprove(b)}
                onReject={b => setConfirmReject(b)}
                onBidEdited={() => { refetchBids(); onPRChange() }}
              />
            ))}
          </div>}
        </>
      ) : (
        <div className="border rounded-xl p-8 text-center space-y-1">
          <p className="text-sm text-muted-foreground">No bids recorded yet.</p>
          <p className="text-xs text-muted-foreground">Use "Record Bid" above to enter vendor bids.</p>
        </div>
      )}

      {/* Bid approval modal — matrix-based workflow */}
      {bidToApprove && (
        <BidApprovalModal
          bid={bidToApprove}
          pr={pr}
          onClose={() => setBidToApprove(null)}
          onSuccess={() => { refetchBids(); onPRChange() }}
        />
      )}

      {/* Confirm reject */}
      {confirmReject && (
        <ConfirmDialog
          title="Reject Bid"
          message={`Reject the bid from ${confirmReject.vendor_name}?`}
          confirmLabel="Reject Bid"
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleReject}
          onCancel={() => setConfirmReject(null)}
        />
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

// ─── PR PDF Export ────────────────────────────────────────────────────────────

function exportPRPDF(pr: any, activeTaxes: Array<{ name: string; rate: number }> = []) {
  const lineItems: any[] = pr.line_items ?? []
  const subtotal = lineItems.reduce(
    (s, item) => s + Number(item.quantity || 0) * Number(item.unit_rate || 0),
    0,
  )
  const taxTotal = activeTaxes.reduce((s, t) => s + subtotal * t.rate / 100, 0)
  const grandTotal = subtotal + taxTotal
  const currency = pr.currency_code ?? 'INR'
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const dateStr = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const dateTimeStr = (d: string) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  // ── Status badge ─────────────────────────────────────────────────────────────

  const statusStyles: Record<string, string> = {
    draft: 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0',
    pending_approval: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    approved: 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0',
    rejected: 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
    vendor_selected: 'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe',
    synced_to_sap: 'background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe',
    po_created: 'background:#ede9fe;color:#5b21b6;border:1px solid #ddd6fe',
    cancelled: 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0',
  }
  const sstyle = statusStyles[pr.status] ?? statusStyles.draft
  const statusLabel = (pr.status ?? '').replaceAll('_', ' ').toUpperCase()

  // ── Line item rows ────────────────────────────────────────────────────────────

  const lineRows = lineItems.length === 0
    ? `<tr><td colspan="7" style="padding:10px;text-align:center;color:#94a3b8;font-style:italic">No line items</td></tr>`
    : lineItems.map((item, idx) => {
      const detail = item.item_code_detail ?? {}
      const code = detail.code ?? item.item_code ?? '—'
      const desc = detail.description ?? item.description ?? '—'
      const total = Number(item.quantity || 0) * Number(item.unit_rate || 0)
      const bg = idx % 2 === 1 ? 'background:#f8fafc' : ''
      return `<tr style="${bg}">
          <td style="padding:5px 8px;text-align:center;border:1px solid #e2e8f0;color:#64748b">${idx + 1}</td>
          <td style="padding:5px 8px;font-family:Courier New,monospace;font-size:9px;border:1px solid #e2e8f0">${code}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${desc}</td>
          <td style="padding:5px 8px;text-align:right;border:1px solid #e2e8f0">${Number(item.quantity).toLocaleString()}</td>
          <td style="padding:5px 8px;text-align:center;border:1px solid #e2e8f0;color:#64748b">${item.unit_of_measure || 'EA'}</td>
          <td style="padding:5px 8px;text-align:right;border:1px solid #e2e8f0">${fmt(Number(item.unit_rate))}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;border:1px solid #e2e8f0">${fmt(total)}</td>
        </tr>`
    }).join('')

  // ── Info field row ────────────────────────────────────────────────────────────

  const frow = (label: string, value: string | undefined | null) =>
    `<tr>
      <td style="padding:5px 10px;color:#64748b;font-size:9.5px;width:38%;border-bottom:1px solid #f1f5f9;white-space:nowrap">${label}</td>
      <td style="padding:5px 10px;font-size:9.5px;font-weight:500;border-bottom:1px solid #f1f5f9">${value || '—'}</td>
    </tr>`

  const section = (title: string, rows: string) =>
    `<div style="margin-bottom:12px">
      <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f">${title}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">${rows}</table>
    </div>`

  const invitedVendors = (pr.invited_vendors_detail ?? []).map((v: any) => {
    const loc = [v.city, v.state].filter(Boolean).join(', ')
    return v.company_name + (loc ? ` (${loc})` : '')
  }).join(', ') || '—'
  const selectedVendor = pr.selected_vendor_name || '—'
  const createdAt = dateStr(pr.created_at)
  const approvedAt = dateStr(pr.approved_at)

  // Budget info
  const budget = pr.budget_info
  const trackingCode = budget?.tracking_code ?? pr.tracking_code ?? '—'

  const detailRows = [
    frow('PR Number', pr.pr_number),
    frow('Title', pr.title),
    frow('Description', pr.description),
    frow('Department', pr.department_name),
    frow('Plant', pr.plant_name),
    frow('Purchase Type', pr.purchase_type),
    frow('Currency', currency),
    frow('Created By', pr.created_by_name),
    frow('Created On', createdAt),
    frow('Approved On', pr.approved_at ? approvedAt : null),
  ].join('')

  const vendorRows = [
    frow('Invited Vendors', invitedVendors),
    frow('Selected Vendor', selectedVendor),
    frow('SAP PR Number', pr.sap_pr_number || null),
    frow('SAP PO Number', pr.sap_po_number || null),
  ].join('')

  // Budget section
  const budgetRows = budget ? [
    frow('Tracking ID', trackingCode),
    frow('Approved Budget', `${currency} ${fmt(Number(budget.approved_amount))}`),
    frow('Consumed', `${currency} ${fmt(Number(budget.consumed_amount))}`),
    frow('Remaining', `${currency} ${fmt(Number(budget.remaining_amount))}`),
  ].join('') : null

  // Invited vendors table
  const vendorDetailRows = (pr.invited_vendors_detail ?? []).length > 0
    ? (pr.invited_vendors_detail as any[]).map((v: any, idx: number) => {
      const bg = idx % 2 === 1 ? 'background:#f8fafc' : ''
      const loc = [v.city, v.state].filter(Boolean).join(', ') || '—'
      return `<tr style="${bg}">
          <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;color:#64748b">${idx + 1}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:500">${v.company_name}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${v.category_name || '—'}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${loc}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${v.contact_email || '—'}</td>
        </tr>`
    }).join('')
    : null

  // ── HTML ───────────────────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>PR — ${pr.pr_number}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 15mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div style="max-width:800px;margin:0 auto;padding:20px">

  <!-- ═══ HEADER ═══ -->
  <table style="width:100%;border-collapse:collapse;border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">Purchase Requisition</div>
        <div style="font-size:22px;font-weight:700;color:#1e3a5f;line-height:1.1">${pr.pr_number}</div>
        <div style="margin-top:5px">
          <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:9px;font-weight:700;${sstyle}">${statusLabel}</span>
        </div>
      </td>
      <td style="text-align:right;vertical-align:top;white-space:nowrap">
        <div style="font-size:9px;color:#64748b;line-height:1.9">
          <div><strong style="color:#1e293b">Tracking ID:</strong> ${trackingCode}</div>
          <div><strong style="color:#1e293b">Created:</strong> ${createdAt}</div>
          ${pr.created_by_name ? `<div><strong style="color:#1e293b">By:</strong> ${pr.created_by_name}</div>` : ''}
          ${pr.approved_at ? `<div><strong style="color:#1e293b">Approved:</strong> ${approvedAt}</div>` : ''}
          <div style="margin-top:4px;font-size:18px;font-weight:700;color:#1e3a5f">${currency} ${fmt(grandTotal)}</div>
          <div style="font-size:8.5px;color:#94a3b8">Grand Total (incl. taxes)</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- ═══ KPI BOXES ═══ -->
  <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:4px">
    <tr>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:8.5px;color:#64748b;margin-bottom:3px">Subtotal</div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${currency} ${fmt(subtotal)}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:8.5px;color:#64748b;margin-bottom:3px">Tax</div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${currency} ${fmt(taxTotal)}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:8.5px;color:#64748b;margin-bottom:3px">Grand Total</div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${currency} ${fmt(grandTotal)}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:8.5px;color:#64748b;margin-bottom:3px">Line Items</div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${lineItems.length}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:8.5px;color:#64748b;margin-bottom:3px">Purchase Type</div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${pr.purchase_type || 'General'}</div>
      </td>
    </tr>
  </table>

  <!-- ═══ DETAILS + VENDORS (2 col) ═══ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
    <tr>
      <td style="width:55%;padding-right:8px;vertical-align:top">${section('Requisition Details', detailRows)}</td>
      <td style="width:45%;padding-left:8px;vertical-align:top">
        ${section('Vendor & SAP Info', vendorRows)}
        ${budgetRows ? section('Budget Information', budgetRows) : ''}
      </td>
    </tr>
  </table>

  <!-- ═══ INVITED VENDORS TABLE ═══ -->
  ${vendorDetailRows ? `
  <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">Invited Vendors</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:6px 8px;text-align:center;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:28px">#</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b">Vendor Name</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b">Category</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b">Location</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b">Email</th>
      </tr>
    </thead>
    <tbody>${vendorDetailRows}</tbody>
  </table>
  ` : ''}

  <!-- ═══ LINE ITEMS ═══ -->
  <div style="font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.1em;padding:5px 10px 4px;background:#f1f5f9;border-left:3px solid #1e3a5f;margin-bottom:0">Line Items</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:6px 8px;text-align:center;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:28px">#</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:90px">Item Code</th>
        <th style="padding:6px 8px;text-align:left;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b">Description</th>
        <th style="padding:6px 8px;text-align:right;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:55px">Qty</th>
        <th style="padding:6px 8px;text-align:center;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:42px">UOM</th>
        <th style="padding:6px 8px;text-align:right;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:85px">Unit Rate</th>
        <th style="padding:6px 8px;text-align:right;border:1px solid #e2e8f0;font-size:8.5px;color:#64748b;width:90px">Total (${currency})</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <!-- ═══ TOTALS ═══ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
    <tr>
      <td style="width:55%"></td>
      <td style="width:45%">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:5px 12px;color:#64748b;border:1px solid #e2e8f0">Subtotal</td>
            <td style="padding:5px 12px;text-align:right;font-weight:600;border:1px solid #e2e8f0">${currency} ${fmt(subtotal)}</td>
          </tr>
          ${activeTaxes.map(t => {
    const amt = subtotal * t.rate / 100
    return `<tr>
              <td style="padding:5px 12px;color:#64748b;border:1px solid #e2e8f0">${t.name} (${t.rate}%)</td>
              <td style="padding:5px 12px;text-align:right;border:1px solid #e2e8f0">${currency} ${fmt(amt)}</td>
            </tr>`
  }).join('')}
          ${activeTaxes.length > 0 ? `<tr style="background:#f8fafc">
            <td style="padding:5px 12px;color:#475569;font-weight:600;border:1px solid #e2e8f0">Total Tax</td>
            <td style="padding:5px 12px;text-align:right;font-weight:600;border:1px solid #e2e8f0">${currency} ${fmt(taxTotal)}</td>
          </tr>` : ''}
          <tr style="background:#1e3a5f">
            <td style="padding:7px 12px;color:#ffffff;font-weight:700;border:1px solid #1e3a5f">Grand Total</td>
            <td style="padding:7px 12px;text-align:right;font-weight:700;font-size:13px;color:#ffffff;border:1px solid #1e3a5f">${currency} ${fmt(grandTotal)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ═══ FOOTER ═══ -->
  <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px">
    <tr>
      <td style="font-size:8.5px;color:#94a3b8">Lumax Procurement — Purchase Requisition Document</td>
      <td style="font-size:8.5px;color:#94a3b8;text-align:right">Generated: ${new Date().toLocaleString('en-IN')}</td>
    </tr>
  </table>

  </div>
</body>
</html>`

  // Open print dialog in the same page via hidden iframe
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
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

export default function PRDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'details' | 'approval' | 'bids'>('details')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))
  const initialTabSet = useRef(false)

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/`)).data,
  })
  const subtotal = (pr?.line_items ?? []).reduce(
    (sum: any, item: any) => sum + (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0),
    0,
  )
  const taxTotal = activeTaxes.reduce((s, t) => s + subtotal * t.rate / 100, 0)
  const grandTotal = subtotal + taxTotal
  // Auto-select Bids tab when PR is in a bids-eligible state
  useEffect(() => {
    if (pr && !initialTabSet.current) {
      initialTabSet.current = true
      const bidStatuses = ['approved', 'vendor_selected', 'synced_to_sap', 'po_created']
      setActiveTab(bidStatuses.includes(pr.status) ? 'bids' : 'details')
    }
  }, [pr])

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
    enabled: isEditing,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
    enabled: isEditing,
  })

  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-edit'],
    queryFn: async () => { const r = await apiClient.get('/budget/tracking-ids/'); return r.data.results ?? r.data },
    enabled: isEditing,
  })

  const editMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const payload = { ...data }
      if (!payload.plant) payload.plant = null
      if (!payload.department) payload.department = null
      return (await apiClient.patch(`/procurement/${id}/`, payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr', id] })
      toast({ title: 'PR updated.' })
      setIsEditing(false)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      let msg = ''
      if (typeof detail === 'object' && detail !== null) {
        if (detail.error) msg = detail.error
        else {
          for (const val of Object.values(detail)) {
            if (Array.isArray(val)) msg = (val as string[])[0]
            else if (typeof val === 'string') msg = val
            if (msg) break
          }
        }
        if (!msg) msg = JSON.stringify(detail)
      } else {
        msg = String(detail ?? 'Update failed.')
      }
      toast({ title: 'Save failed', description: msg, variant: 'destructive' })
    },
  })

  const invalidatePR = () => queryClient.invalidateQueries({ queryKey: ['pr', id] })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    )
  }

  if (!pr) {
    return (
      <div className="p-8 text-center text-muted-foreground">PR not found.</div>
    )
  }

  const TABS = [
    { key: 'details' as const, label: 'Details' },
    { key: 'approval' as const, label: 'Approval' },
    { key: 'bids' as const, label: 'Bids' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold truncate">{pr.pr_number}</h1>
            <StatusBadge status={pr.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Created {formatDate(pr.created_at)}
            {pr.created_by_name && ` by ${pr.created_by_name}`}
            {pr.tracking_code && ` · Tracking: ${pr.tracking_code}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pr.status === 'draft' && !isEditing && activeTab === "details" && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportPRPDF(pr, activeTaxes)} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push('/procurement')} className="gap-1 shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && isEditing && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Edit Purchase Requisition</CardTitle></CardHeader>
          <CardContent>
            <EditPRForm
              pr={pr}
              plants={plants ?? []}
              departments={departments ?? []}
              trackingIds={trackingIds ?? []}
              onSave={data => editMutation.mutate(data)}
              onCancel={() => setIsEditing(false)}
              saving={editMutation.isPending}
            />
          </CardContent>
        </Card>
      )}
      {activeTab === 'details' && !isEditing && (
        <div className="space-y-4">

          {/* ── PR Dashboard ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Value */}
            <div className="col-span-2 lg:col-span-1 border rounded-xl p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(pr.total_amount, pr.currency_code)}</p>
              <p className="text-xs text-muted-foreground">{pr.currency_code} · {pr.purchase_type || 'General'}</p>
            </div>
            {/* Line Items */}
            <div className="border rounded-xl p-4 bg-blue-50/50 border-blue-100 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Line Items</p>
              <p className="text-2xl font-bold text-blue-700">{pr.line_items?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">items in requisition</p>
            </div>
            {/* Invited Vendors */}
            <div className="border rounded-xl p-4 bg-violet-50/50 border-violet-100 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Invited Vendors</p>
              <p className="text-2xl font-bold text-violet-700">{pr.invited_vendors_detail?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">vendors invited to bid</p>
            </div>
            {/* Status */}
            <div className="border rounded-xl p-4 bg-slate-50 border-slate-200 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <StatusBadge status={pr.status} />
              {pr.approved_at && (
                <p className="text-xs text-muted-foreground">Approved {formatDate(pr.approved_at)}</p>
              )}
            </div>
          </div>

          {/* Selected Vendor / SAP banner */}
          {(pr.selected_vendor_name || pr.sap_pr_number) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pr.selected_vendor_name && (
                <div className="flex items-center gap-3 border border-green-200 bg-green-50/60 rounded-xl px-4 py-3">
                  <Trophy className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs text-green-700 font-medium">Selected Vendor</p>
                    <p className="text-sm font-semibold text-green-900">{pr.selected_vendor_name}</p>
                  </div>
                </div>
              )}
              {pr.sap_pr_number && (
                <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3">
                  <CheckCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">SAP PR Number</p>
                    <p className="text-sm font-mono font-semibold">{pr.sap_pr_number}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Key Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Requisition Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Plant</dt>
                  <dd className="font-medium mt-0.5">{pr.plant_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Department</dt>
                  <dd className="font-medium mt-0.5">{pr.department_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created On</dt>
                  <dd className="font-medium mt-0.5">{formatDate(pr.created_at)}</dd>
                </div>
                {pr.tracking_code && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Budget Tracking</dt>
                    <dd className="font-mono font-medium mt-0.5">{pr.tracking_code}</dd>
                  </div>
                )}
                {pr.sap_po_number && (
                  <div>
                    <dt className="text-xs text-muted-foreground">SAP PO#</dt>
                    <dd className="font-mono font-medium mt-0.5">{pr.sap_po_number}</dd>
                  </div>
                )}
              </dl>
              {pr.description && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{pr.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Info */}
          {pr.budget_info && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
              <span className="font-medium text-blue-700">Budget</span>
              <span className="font-mono text-muted-foreground">{pr.budget_info.tracking_code}</span>
              <span className="text-muted-foreground">Approved: <span className="font-semibold text-foreground">{formatCurrency(pr.budget_info.approved_amount)}</span></span>
              <span className="text-muted-foreground">Consumed: <span className="font-semibold text-foreground">{formatCurrency(pr.budget_info.consumed_amount)}</span></span>
              <span className="text-muted-foreground">Remaining: <span className={`font-semibold ${Number(pr.budget_info.remaining_amount) > 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(pr.budget_info.remaining_amount)}</span></span>
            </div>
          )}

          {/* Invited Vendors */}
          {pr.invited_vendors_detail?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Invited Vendors</CardTitle></CardHeader>
              <CardContent>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Location</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Email</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(pr.invited_vendors_detail as any[]).map((v: any) => (
                        <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-foreground">{v.company_name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{v.category_name || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                            {v.city ? [v.city, v.state].filter(Boolean).join(', ') : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{v.contact_email || '—'}</td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            {v.status && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {v.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Line Items */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
            <CardContent>
              <LineItemsTable items={pr.line_items ?? []} currencyCode={pr.currency_code} />
            </CardContent>
          </Card>

        </div>
      )}

      {/* ── Approval Tab ── */}
      {activeTab === 'approval' && (
        <div className="space-y-4">
          {pr.status === 'draft' ? (
            <SubmitForApprovalModal
              pr={pr}
              prId={id!}
              onClose={() => setShowSubmitModal(false)}
              onSuccess={invalidatePR}
            />
          ) : (
            <ApprovalProgressPanel prId={id!} onStatusChange={invalidatePR} />
          )}
        </div>
      )}

      {/* ── Bids Tab ── */}
      {activeTab === 'bids' && <BidsTab pr={pr} onPRChange={invalidatePR} />}
    </div>
  )
}

// ── Create PO from PR ───────────────────────────────────────────────────────

function CreatePOButton({ prId, prNumber }: { prId: number; prNumber: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.post('/purchase-orders/create-from-pr/', { pr_id: prId })
      toast({ title: `PO ${data.po_number} created from ${prNumber}` })
      router.push(`/purchase-orders/${data.hash_id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to create PO'
      toast({ title: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" className="gap-1.5 shrink-0" onClick={handleCreate} disabled={loading}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      Create PO
    </Button>
  )
}
