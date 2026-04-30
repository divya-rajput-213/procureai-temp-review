'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Send, Trash2, X, Pencil, Trophy, Download,
  AlertTriangle,
  Plus
} from 'lucide-react'
import {
  formatCurrency, formatDate, formatDateTime, getSLAPercentage, getSLAColor,
} from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import ComparisonTab from '../components/ComparisonTab'
import QuotationsTab from '../components/QuotationsTab'

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
  const quotations = pr.linked_quotations
  // ── Step 2: quotation picker state ────────────────────────────────────────
  const [showQuotationPicker, setShowQuotationPicker] = useState(false)
  const [selectedQuotation, setSelectedQuotation] = useState<number | null>(null)

  const { data: matrices, isLoading: loadingMatrices } = useQuery({
    queryKey: ['approval-matrices-pr'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'purchase_requisition', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
  })

  // Step 1 → open quotation picker
  const handleSubmitClick = () => {
    setShowQuotationPicker(true)
  }

  // Step 2 → final submit
  const submit = async () => {
    setSubmitting(true)
    try {
      const body: Record<string, any> = {}
      if (selectedMatrix) body.matrix_id = selectedMatrix
      if (selectedQuotation) body.quotation_id = selectedQuotation
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

  return (
    <>
      {/* ── Step 1: Matrix selector card ─────────────────────────────────── */}
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
              onSelect={(id) => { setSelectedMatrix(id); setExpandedMatrix(id) }}
              onToggleExpand={(id) => setExpandedMatrix(prev => prev === id ? null : id)}
            />
          )}
        </CardContent>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitClick} className="gap-2 min-w-[160px]">
            <Send className="w-4 h-4" />
            Submit for Approval
          </Button>
        </div>
      </Card>

      {/* ── Step 2: Quotation picker overlay modal ───────────────────────── */}
      {showQuotationPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="text-sm font-semibold">Select Quotation</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select the quotation to include with this approval request.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotationPicker(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quotation list */}
            <div className="max-h-[400px] overflow-y-auto">

              {(quotations ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground px-5 py-6">
                  No quotations linked to this PR.
                </p>
              )}

              { (quotations ?? []).length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr className="text-xs text-muted-foreground">
                      <th className="w-10 px-4 py-2.5" />
                      <th className="text-left px-3 py-2.5 font-medium">Quotation #</th>
                      <th className="text-left px-3 py-2.5 font-medium">Vendor</th>
                      <th className="text-right px-3 py-2.5 font-medium">Amount</th>
                      <th className="text-left px-3 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(quotations as any[]).map((q: any) => (
                      <tr
                        key={q.id}
                        onClick={() => setSelectedQuotation(q.id)}
                        className={`cursor-pointer transition-colors ${selectedQuotation === q.id
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/40'
                          }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            checked={selectedQuotation === q.id}
                            onChange={() => setSelectedQuotation(q.id)}
                            onClick={e => e.stopPropagation()}
                            className="accent-primary"
                          />
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {q.quotation_number ?? q.reference_number ?? `#${q.id}`}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {q.vendor_name ?? q.vendor_detail?.company_name ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {formatCurrency(q.total_amount ?? q.grand_total, q.currency_code)}
                        </td>
                        <td className="px-3 py-3">
                          {q.status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : q.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                              }`}>
                              {q.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
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

//── Main Page ─────────────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState<'details' | 'quotations' | 'approval' | 'comparison'>('details')
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

  useEffect(() => {
    if (pr && !initialTabSet.current) {
      initialTabSet.current = true
      setActiveTab('details')
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
    { key: 'quotations' as const, label: 'Quotations' },
    { key: 'approval' as const, label: 'Approval' },
    { key: 'comparison' as const, label: 'Comparison' },
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
      {/* ── Quotations Tab (per-quotation breakdown) ── */}
      {activeTab === 'quotations' && <QuotationsTab linkedQuotations={pr.linked_quotations ?? []} />}

      {/* ── Comparison Tab ── */}
      {activeTab === 'comparison' && <ComparisonTab prId={pr.id} />}
    </div>
  )
}