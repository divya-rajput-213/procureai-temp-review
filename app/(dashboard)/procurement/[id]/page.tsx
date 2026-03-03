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
  Users, TrendingUp, TrendingDown, BarChart3, PiggyBank,
} from 'lucide-react'
import {
  formatCurrency, formatDate, formatDateTime, getSLAPercentage, getSLAColor,
} from '@/lib/utils'
import apiClient from '@/lib/api/client'
import ReactMarkdown from 'react-markdown'
import { useSettingsStore } from '@/lib/stores/settings.store'

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
function ApprovalTimeline({ actions, currentLevel }: { actions: any[]; currentLevel: number }) {
  if (!actions?.length) return <p className="text-sm text-muted-foreground">No actions yet.</p>;

  return (
    <div className="px-4 py-3 bg-white border-b">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Timeline</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1.5 font-medium w-12">Level</th>
            <th className="text-left py-1.5 font-medium">Approver</th>
            <th className="text-left py-1.5 font-medium w-28">Status</th>
            <th className="text-left py-1.5 font-medium">Comments</th>
            <th className="text-right py-1.5 font-medium whitespace-nowrap">Date / Time</th>
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
                <td className="py-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold ${levelBubbleCls(effectiveAction, isCurrent)}`}>
                    {a.level_number}
                  </span>
                </td>
                <td className="py-2 font-medium text-slate-700">
                  {a.approver_name ?? '—'}
                  {a.is_delegated && <span className="ml-1.5 text-xs font-normal text-blue-500">(delegated)</span>}
                  {isCurrent && (
                    <span className="ml-1.5 text-xs font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">awaiting</span>
                  )}
                </td>
                <td className="py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${actionStepClass(effectiveAction)}`}>
                    <ActionStepIcon action={effectiveAction} />
                    {actionLabel}
                  </span>
                </td>
                <td className="py-2 text-muted-foreground italic">
                  {a.comments ? `"${a.comments}"` : '—'}
                </td>
                <td className="py-2 text-right text-muted-foreground whitespace-nowrap">
                  {a.acted_at ? formatDateTime(a.acted_at) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// ─── My Action Panel ───────────────────────────────────────────────────────────

function MyActionPanel({ pendingAction, onProcess }: {
  pendingAction: any
  onProcess: (action: string, comments: string) => void
}) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState('')
  const busy = loading !== ''

  const handle = async (act: string) => {
    setLoading(act)
    await onProcess(act, comments)
    setLoading('')
    setComments('')
  }

  return (
    <div className="pt-4 mt-4 border-t space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Your action required — Level {pendingAction?.level}
      </p>
      <textarea
        className="w-full border rounded-md p-2 text-sm resize-none h-16"
        placeholder="Comments (required for Reject / Hold)…"
        value={comments}
        onChange={e => setComments(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
          onClick={() => handle('approved')} disabled={busy || !comments}>
          {loading === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Approve
        </Button>
        <Button size="sm" variant="destructive" className="gap-1"
          onClick={() => handle('rejected')} disabled={busy || !comments}>
          {loading === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Reject
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300"
          onClick={() => handle('held')} disabled={busy || !comments}>
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
          <ApprovalTimeline actions={approvalRequest.actions ?? []} currentLevel={approvalRequest.current_level} />
          {myPendingAction && (
            <MyActionPanel pendingAction={myPendingAction} onProcess={processAction} />
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
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Submit for Approval
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review PR details and select an approval matrix.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* PR Summary */}
          <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PR Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">PR Number</p>
                <p className="font-semibold mt-0.5">{pr.pr_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="font-bold text-primary mt-0.5">{formatCurrency(pr.total_amount, pr.currency_code)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Line Items</p>
                <p className="font-medium mt-0.5">{lineCount} item{lineCount === 1 ? '' : 's'}</p>
              </div>
              {pr.plant_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Plant</p>
                  <p className="font-medium mt-0.5">{pr.plant_name}</p>
                </div>
              )}
              {pr.department_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium mt-0.5">{pr.department_name}</p>
                </div>
              )}
              {vendorNames.length > 0 && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Invited Vendors</p>
                  <p className="font-medium mt-0.5">{vendorNames.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Matrix Selection */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Approval Matrix</p>
              <p className="text-xs text-muted-foreground">
                Select a matrix or leave unselected — system auto-matches based on plant.
              </p>
            </div>

            {loadingMatrices && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
              </div>
            )}
            {!loadingMatrices && (matrices ?? []).length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No active PR approval matrices configured. The system will use the default.
              </p>
            )}
            {!loadingMatrices && (matrices ?? []).length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Matrix Name</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Plant</th>
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
                        <>
                          <tr
                            key={m.id}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'hover:bg-slate-50'}`}
                            onClick={() => setSelectedMatrix(m.id)}
                          >
                            <td className="px-3 py-2.5 text-center">
                              <input type="radio" checked={isSelected} onChange={() => setSelectedMatrix(m.id)}
                                className="accent-primary" onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="px-3 py-2.5 font-medium">{m.name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                              {m.plant_name || 'All Plants'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {levelCount} level{levelCount === 1 ? '' : 's'}
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
                            <tr key={`${m.id}-lvl`}>
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
                        </>
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
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-2 min-w-[160px]">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for Approval
          </Button>
        </div>
      </div>
    </div>
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
    queryKey: ['vendors-pr-edit', vendorSearch],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/', { params: { status: 'approved', search: vendorSearch, page_size: 20 } })
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
  const subtotal = lineItems.reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity) || 0) *
      (Number(item.unit_rate) || 0),
    0
  )
  const taxTotal = activeTaxes.reduce((s, t) => s + subtotal * t.rate / 100, 0)
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
    setLI(idx, 'item_code', item.id)
    setLI(idx, 'description', item.description)
    setItemSearch(prev => ({ ...prev, [idx]: `${item.code} - ${item.description}` }))
    setShowItemDropdown(null)
  }

  const addVendor = (v: any) => {
    if (!invitedVendors.some((x: any) => x.id === v.id)) setInvitedVendors(prev => [...prev, v])
    setShowVendorDropdown(false)
    setVendorSearch('')
  }
  const removeVendor = (id: number) => setInvitedVendors(prev => prev.filter((v: any) => v.id !== id))

  const handleSave = () => {
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
  return (
    <div className="space-y-4">
      {/* Tracking ID + Plant + Department */}
      <div className="space-y-1">
        <Label className="text-xs">Budget / Tracking ID</Label>

        <div className="relative">
          <Input
            placeholder="Search tracking ID..."
            value={showTrackingDropdown ? trackingSearch : (selectedTrackingObj?.tracking_code ?? '')}

            onChange={(e) => {
              setTrackingSearch(e.target.value)
              setShowTrackingDropdown(true)
            }}
            onFocus={() => setShowTrackingDropdown(true)}
            onBlur={() => setTimeout(() => setShowTrackingDropdown(false), 150)}
            className="h-8"
          />

          {showTrackingDropdown && trackingSearch && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 border rounded-lg bg-background shadow-lg max-h-56 overflow-y-auto divide-y">

              {trackingIds
                .filter((t: any) =>
                  !trackingSearch ||   // ← show all when search is empty
                  `${t.tracking_code} ${t.title}`
                    .toLowerCase()
                    .includes(trackingSearch.toLowerCase())
                )
                .map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      set('tracking_id', t.id)
                      setTrackingSearch('')
                      setShowTrackingDropdown(false)
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm"
                  >
                    <div className="font-medium">
                      {t.tracking_code}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {t.title}
                    </div>
                  </button>
                ))}

              {trackingIds.filter((t: any) =>
                `${t.tracking_code} ${t.title}`
                  .toLowerCase()
                  .includes(trackingSearch.toLowerCase())
              ).length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No tracking IDs found
                  </p>
                )}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
        <Input
          value={form.title}
          disabled
          readOnly
          placeholder="e.g. Enterprise Laptop Procurement"
          className="h-10 bg-muted cursor-not-allowed text-muted-foreground"
        />
      </div>
      {/* Description */}
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm resize-none h-20"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Brief description of what is being procured…"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        <div className="space-y-1">
          <Label className="text-xs">Plant</Label>
          <select
            disabled
            className="w-full h-8 border rounded-md px-3 text-sm  bg-muted cursor-not-allowed text-muted-foreground"
            value={form.plant}
            onChange={e => set('plant', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— none —</option>
            {plants.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Department</Label>
          <select
            disabled
            className="w-full h-8 border rounded-md px-3 text-sm   bg-muted cursor-not-allowed text-muted-foreground"
            value={form.department}
            onChange={e => set('department', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— none —</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>



      {/* Invited Vendors */}
      <div className="space-y-3">
        <Label className="text-xs">Invited Vendors</Label>

        {/* Search Input */}
        <div className="relative">
          <Input
            placeholder="Search approved vendors…"
            value={vendorSearch}
            onChange={e => {
              setVendorSearch(e.target.value);
              setShowVendorDropdown(true);
            }}
            onFocus={() => setShowVendorDropdown(true)}
            onBlur={() => setTimeout(() => setShowVendorDropdown(false), 150)}
            className="h-10"
          />

          {showVendorDropdown && vendorSearch && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-lg bg-background shadow-lg max-h-56 overflow-y-auto divide-y">
              {(vendorResults || [])
                .filter((v: any) => !invitedVendors.some((s: any) => s.id === v.id))
                .map((v: any) => (
                  <button
                    key={v.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addVendor(v)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.company_name}</span>
                      <span className="text-xs text-emerald-600 font-medium">
                        {v.status}
                      </span>
                    </div>

                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      {v.category_name && <span>{v.category_name}</span>}
                      {v.city && (
                        <span>
                          {v.city}
                          {v.state ? `, ${v.state}` : ""}
                        </span>
                      )}
                    </div>
                  </button>
                ))}

              {(vendorResults || []).filter(
                (v: any) => !invitedVendors.some((s: any) => s.id === v.id)
              ).length === 0 && (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    No vendors found.
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Selected Vendors Table */}
        {invitedVendors.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Vendor
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Category
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Location
                  </th>
                  <th className="w-8 px-3 py-2.5" />
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {invitedVendors.map((v: any) => (
                  <tr
                    key={v.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium">
                      {v.company_name}
                    </td>

                    <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                      {v.category_name || "—"}
                    </td>

                    <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                      {v.city
                        ? [v.city, v.state].filter(Boolean).join(", ")
                        : "—"}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeVendor(v.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
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

      {/* Line Items */}
      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="h-6 text-xs gap-1 px-2">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        <div className="space-y-2">
          {lineItems.map((li, idx) => (
            <div key={li._key} className="border border-border rounded-lg p-3 space-y-3">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {idx + 1}</span>
                <button type="button" onClick={() => removeLineItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fields grid — same as doc 4 */}
              <div className="grid grid-cols-12 gap-2 items-end">

                {/* Item Code */}
                <div className="col-span-12 sm:col-span-5 space-y-1">
                  <Label className="text-xs">Item Code <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="Search item code..."
                      value={itemSearch[idx] ?? (li.item_code ? `${li.code} - ${li.description}` : '')}
                      onChange={e => { setItemSearch(prev => ({ ...prev, [idx]: e.target.value })); setShowItemDropdown(idx) }}
                      onFocus={() => setShowItemDropdown(idx)}
                      onBlur={() => setTimeout(() => setShowItemDropdown(null), 150)}
                      className="h-10 text-sm"
                    />
                    {showItemDropdown === idx && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-md bg-background shadow-md max-h-40 overflow-y-auto divide-y">
                        {(itemResults || []).map((item: any) => (
                          <button key={item.id} type="button" onMouseDown={e => e.preventDefault()}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center gap-2"
                            onClick={() => selectItem(idx, item)}>
                            <span className="font-mono text-xs bg-slate-100 px-1 rounded">{item.code}</span>
                            <span className="truncate">{item.description}</span>
                            <span className="ml-auto text-xs text-muted-foreground shrink-0">{item.unit_of_measure}</span>
                          </button>
                        ))}
                        {(itemResults || []).length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No items found.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Qty */}
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Qty <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={li.quantity}
                    onChange={e => {
                      let value = Number(e.target.value);

                      // Clamp the value to maximum limit
                      if (value > 99999) {
                        value = 99999;
                      }

                      // Ensure value is a valid number
                      if (isNaN(value) || value <= 0) {
                        value = 0;
                      }

                      setLI(idx, 'quantity', value);
                    }}
                    className="h-10 text-sm"
                  />


                </div>

                {/* UOM */}
                <div className="col-span-3 sm:col-span-2 space-y-1">
                  <Label className="text-xs">UOM <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="EA" value={li.unit_of_measure}
                    onChange={e => setLI(idx, 'unit_of_measure', e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                {/* Unit Rate */}
                <div className="col-span-5 sm:col-span-2 space-y-1">
                  <Label className="text-xs">Unit Rate <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={li.unit_rate}
                    onChange={e => {
                      let value = parseFloat(e.target.value);

                      // Clamp the value to maximum limit
                      if (value > 9999999.99) {
                        value = 9999999.99;
                      }

                      // Ensure value is a valid number and round to 2 decimals
                      if (isNaN(value) || value <= 0) {
                        value = 0;
                      } else {
                        value = Math.round(value * 100) / 100; // Limit to 2 decimal places
                      }

                      setLI(idx, 'unit_rate', value);
                    }}
                    className="h-10 text-sm"
                  />

                </div>

                {/* Total */}
                <div className="col-span-12 sm:col-span-1 space-y-1">
                  <Label className="text-xs hidden sm:block">Total</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={(Number(li.quantity) || 0) * (Number(li.unit_rate) || 0)}  // Raw numeric value
                    disabled
                    className="h-10 text-sm"
                  />
                </div>

              </div>
            </div>
          ))}

          {lineItems.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-1">No line items. Click Add to add one.</p>
          )}
        </div>

        {/* Totals table */}
        <div className="border border-border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr className="bg-muted/30">
                <td className="px-4 py-2.5 text-muted-foreground">Subtotal</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(subtotal)}</td>
              </tr>
              {activeTaxes.map(tax => (
                <tr key={tax.id}>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {tax.name} <span className="text-xs">({tax.rate}%)</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(subtotal * tax.rate / 100)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 border-t-2 border-border">
                <td className="px-4 py-3 font-semibold">Grand Total</td>
                <td className="px-4 py-3 text-right font-bold text-base">{formatCurrency(grandTotal)}</td>
              </tr>
            </tfoot>
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
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground italic">No line items.</p>
  }
  const grandTotal = items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_rate) || 0),
    0,
  )
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
            const total = (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0)
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
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(total, currencyCode)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
              Total
            </td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(grandTotal, currencyCode)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Add Bid Form ─────────────────────────────────────────────────────────────

function AddBidForm({ prId, invitedVendors, existingBidVendorIds, onSuccess }: {
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

  const availableVendors = invitedVendors.filter(
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
          <select
            className="w-full h-9 border rounded-md px-3 text-sm bg-white"
            value={form.vendor}
            onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
          >
            <option value="">Select invited vendor…</option>
            {availableVendors.map((v: any) => (
              <option key={v.id} value={v.id}>{v.company_name}</option>
            ))}
          </select>
          {availableVendors.length === 0 && (
            <p className="text-xs text-amber-600">All invited vendors have already submitted bids.</p>
          )}
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
    pending:     { cls: 'bg-slate-100 text-slate-600',  label: 'Pending' },
    shortlisted: { cls: 'bg-blue-100 text-blue-700',    label: 'Shortlisted' },
    accepted:    { cls: 'bg-green-100 text-green-700',  label: 'Accepted' },
    rejected:    { cls: 'bg-red-100 text-red-700',      label: 'Rejected' },
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
          <p className="text-sm font-medium text-purple-700">Run AI Analysis</p>
          <p className="text-xs text-muted-foreground">Get recommendations across 6 dimensions</p>
        </div>
      )}
    </div>
  )
}

// ─── AI Recommendation Banner ─────────────────────────────────────────────────

function AIRecommendationBanner({ aiRec }: { aiRec: any }) {
  if (!aiRec?.recommendation?.recommended_vendor_name) return null
  const rec = aiRec.recommendation
  return (
    <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl px-4 py-3">
      <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-semibold text-purple-800">AI Recommendation</p>
        <p className="text-sm text-slate-700 leading-relaxed">{rec.reasoning}</p>
      </div>
      {rec.confidence && (
        <span className="shrink-0 text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
          {Math.round(rec.confidence * 100)}% confidence
        </span>
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

// ─── Bid Row ──────────────────────────────────────────────────────────────────

function BidRow({ bid, pr, rank, aiRankedVendors, canAct, onApprove, onReject }: {
  bid: any
  pr: any
  rank: number
  aiRankedVendors: any[]
  canAct: boolean
  onApprove: (bid: any) => void
  onReject: (bid: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const aiRank = aiRankedVendors.find(rv => rv.vendor_id === bid.vendor)
  const isAccepted = bid.status === 'accepted'
  const isRejected = bid.status === 'rejected'
  const isRecommended = pr.ai_recommendation?.recommendation?.recommended_vendor_id === bid.vendor

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isAccepted ? 'border-green-300' :
      isRejected ? 'border-red-200 opacity-75' :
      isRecommended ? 'border-purple-300' : 'border-border'
    }`}>
      {/* Main row */}
      <div className={`flex items-center gap-3 px-4 py-3 ${
        isAccepted ? 'bg-green-50/60' :
        isRejected ? 'bg-red-50/20' :
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
                <Sparkles className="w-3 h-3" /> AI Pick
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

        {/* Quote */}
        <div className="text-right shrink-0">
          <p className="text-base font-bold">{formatCurrency(bid.bid_amount, pr.currency_code)}</p>
          <p className="text-xs text-muted-foreground">
            {bid.delivery_days}d · {bid.validity_days}d validity
          </p>
        </div>

        {/* AI Score pill */}
        {bid.ai_score != null && (
          <div className={`shrink-0 hidden sm:flex flex-col items-center justify-center w-14 h-12 rounded-lg border ${
            bid.ai_score >= 75 ? 'border-green-200 bg-green-50' :
            bid.ai_score >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
          }`}>
            <span className={`text-base font-bold leading-none ${
              bid.ai_score >= 75 ? 'text-green-700' :
              bid.ai_score >= 50 ? 'text-amber-700' : 'text-red-700'
            }`}>{bid.ai_score}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">AI Score</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canAct && !isAccepted && !isRejected && (
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

      {/* Rejection reason */}
      {isRejected && bid.rejection_reason && (
        <div className="px-4 pb-3 bg-red-50/30 border-t border-red-100">
          <p className="text-xs text-red-600 mt-2">Reason: {bid.rejection_reason}</p>
        </div>
      )}
    </div>
  )
}

// ─── Bids Tab ─────────────────────────────────────────────────────────────────

function BidsTab({ pr, onPRChange }: { pr: any; onPRChange: () => void }) {
  const { id } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [analysingBids, setAnalysingBids] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState<any>(null)
  const [confirmReject, setConfirmReject] = useState<any>(null)

  const canCollectBids = ['approved', 'vendor_selected', 'synced_to_sap', 'po_created'].includes(pr.status)
  const canAct = ['approved', 'vendor_selected'].includes(pr.status)

  const { data: bids, refetch: refetchBids } = useQuery({
    queryKey: ['pr-bids', id],
    queryFn: async () => {
      const res = await apiClient.get(`/procurement/${id}/bids/`)
      return res.data.results ?? res.data
    },
  })

  const existingBidVendorIds = (bids ?? []).map((b: any) => b.vendor)
  const aiRec = pr.ai_recommendation ?? {}
  const aiRankedVendors: any[] = aiRec.ranked_vendors ?? []

  // Called after a bid is saved — refetch then auto-run AI analysis if ≥2 bids
  const handleBidAdded = async () => {
    const res = await refetchBids()
    const updatedBids: any[] = res.data ?? []
    if (updatedBids.length >= 2) {
      await analyseBids()
    }
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

  const analyseBids = async () => {
    setAnalysingBids(true)
    try {
      await apiClient.post(`/procurement/${id}/analyse-bids/`)
      await refetchBids()
      onPRChange()
      toast({ title: 'AI analysis complete.' })
    } catch (err: any) {
      toast({ title: 'AI analysis failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setAnalysingBids(false)
    }
  }

  const handleApprove = async (reason?: string) => {
    if (!confirmApprove) return
    try {
      await apiClient.post(`/procurement/${id}/approve-bid/`, { bid_id: confirmApprove.id, reason })
      toast({ title: `Bid approved — ${confirmApprove.vendor_name} selected as vendor.` })
      setConfirmApprove(null)
      refetchBids()
      onPRChange()
      queryClient.invalidateQueries({ queryKey: ['pr', id] })
    } catch (err: any) {
      toast({ title: 'Approval failed', description: err?.response?.data?.error, variant: 'destructive' })
    }
  }

  const handleReject = async (reason?: string) => {
    if (!confirmReject) return
    try {
      await apiClient.post(`/procurement/${id}/reject-bid/`, { bid_id: confirmReject.id, reason })
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

      {/* Vendor-selected banner */}
      {pr.status === 'vendor_selected' && acceptedBid && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Vendor selected: {acceptedBid.vendor_name}</p>
            <p className="text-xs text-green-700">
              Bid of {formatCurrency(acceptedBid.bid_amount, pr.currency_code)} · {acceptedBid.delivery_days}d delivery
            </p>
          </div>
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
        {hasBids && pendingBids.length >= 2 && (
          <Button variant="outline" onClick={analyseBids} disabled={analysingBids} className="gap-2">
            {analysingBids
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing…</>
              : <><Sparkles className="w-4 h-4 text-purple-500" />
                  {aiRec.recommendation ? 'Re-analyse Bids' : 'Analyse Bids with AI'}</>
            }
          </Button>
        )}
        {hasBids && pendingBids.length < 2 && !aiRec.recommendation && (
          <p className="text-xs text-muted-foreground">At least 2 pending bids needed to run AI analysis.</p>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Bids ({(bids ?? []).length})
              </p>
              {aiRec.comparison_table && (
                <details className="relative">
                  <summary className="text-xs text-purple-600 cursor-pointer hover:text-purple-800 font-medium list-none">
                    View comparison table ↓
                  </summary>
                  <div className="absolute right-0 z-10 mt-2 w-[640px] max-w-[90vw] bg-white border rounded-xl shadow-xl p-4 overflow-x-auto text-xs">
                    <ReactMarkdown>{aiRec.comparison_table}</ReactMarkdown>
                  </div>
                </details>
              )}
            </div>
            {sortedBids.map((bid: any, idx: number) => (
              <BidRow
                key={bid.id}
                bid={bid}
                pr={pr}
                rank={idx + 1}
                aiRankedVendors={aiRankedVendors}
                canAct={canAct}
                onApprove={b => setConfirmApprove(b)}
                onReject={b => setConfirmReject(b)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border rounded-xl p-8 text-center space-y-1">
          <p className="text-sm text-muted-foreground">No bids recorded yet.</p>
          <p className="text-xs text-muted-foreground">Use "Record Bid" above to enter vendor bids.</p>
        </div>
      )}

      {/* Confirm approve */}
      {confirmApprove && (
        <ConfirmDialog
          title="Approve Bid"
          message={`Approve the bid from ${confirmApprove.vendor_name} for ${formatCurrency(confirmApprove.bid_amount, pr.currency_code)}? All other pending bids will be rejected and this vendor will be selected.`}
          confirmLabel="Approve & Select Vendor"
          confirmClass="bg-green-600 hover:bg-green-700 text-white"
          onConfirm={handleApprove}
          onCancel={() => setConfirmApprove(null)}
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

export default function PRDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'details' | 'approval' | 'bids'>('approval')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const initialTabSet = useRef(false)

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/`)).data,
  })

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
      toast({ title: 'Save failed', description: err?.response?.data?.error ?? 'Update failed.', variant: 'destructive' })
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

  const canCollectBids = ['approved', 'vendor_selected', 'synced_to_sap', 'po_created'].includes(pr.status)

  const TABS = [
    ...(canCollectBids ? [{ key: 'bids' as const, label: 'Bids' }] : []),
    { key: 'details' as const, label: 'Details' },
    { key: 'approval' as const, label: 'Approval' },
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
        <div className="flex items-center gap-3 shrink-0">
          {pr.status === 'draft' && !isEditing && activeTab === "details" && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
          <div className="text-right">
            <p className="text-xl font-bold">{formatCurrency(pr.total_amount, pr.currency_code)}</p>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </div>
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
          {/* Key Info */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Requisition Info</CardTitle></CardHeader>
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
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-0.5"><StatusBadge status={pr.status} /></dd>
                </div>
                {pr.selected_vendor_name && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Selected Vendor</dt>
                    <dd className="font-medium mt-0.5">{pr.selected_vendor_name}</dd>
                  </div>
                )}
                {pr.approved_at && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Approved At</dt>
                    <dd className="font-medium mt-0.5">{formatDate(pr.approved_at)}</dd>
                  </div>
                )}
                {pr.sap_pr_number && (
                  <div>
                    <dt className="text-xs text-muted-foreground">SAP PR#</dt>
                    <dd className="font-mono font-medium mt-0.5">{pr.sap_pr_number}</dd>
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
                  <p className="text-sm">{pr.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invited Vendors */}
          {pr.invited_vendors_detail?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Invited Vendors</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(pr.invited_vendors_detail as any[]).map((v: any) => (
                    <div key={v.id} className="border rounded-md px-3 py-2 text-sm">
                      <p className="font-medium">{v.company_name}</p>
                      {v.category_name && (
                        <p className="text-xs text-muted-foreground">{v.category_name}</p>
                      )}
                    </div>
                  ))}
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
            <div className="border rounded-xl p-8 text-center space-y-4 bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Ready to submit?</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  This PR is saved as a draft. Submit it for approval to start the review workflow.
                </p>
              </div>
              <Button onClick={() => setShowSubmitModal(true)} className="gap-2">
                <Send className="w-4 h-4" /> Submit for Approval
              </Button>
            </div>
          ) : (
            <ApprovalProgressPanel prId={id!} onStatusChange={invalidatePR} />
          )}
        </div>
      )}

      {/* ── Submit for Approval Modal ── */}
      {showSubmitModal && (
        <SubmitForApprovalModal
          pr={pr}
          prId={id!}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={invalidatePR}
        />
      )}

      {/* ── Bids Tab ── */}
      {activeTab === 'bids' && <BidsTab pr={pr} onPRChange={invalidatePR} />}
    </div>
  )
}
