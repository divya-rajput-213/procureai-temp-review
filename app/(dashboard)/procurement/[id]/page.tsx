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

function BidRow({ bid, pr, rank, aiRankedVendors, canAct, hasBidPendingApproval, onApprove, onReject }: {
  bid: any
  pr: any
  rank: number
  aiRankedVendors: any[]
  canAct: boolean
  hasBidPendingApproval: boolean
  onApprove: (bid: any) => void
  onReject: (bid: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const aiRank = aiRankedVendors.find(rv => rv.vendor_id === bid.vendor)
  const isAccepted = bid.status === 'accepted'
  const isRejected = bid.status === 'rejected'
  const isPendingApproval = bid.status === 'pending_approval'
  const isRecommended = pr.ai_recommendation?.recommendation?.recommended_vendor_id === bid.vendor

  const isLocked = hasBidPendingApproval && !isPendingApproval && !isAccepted && !isRejected

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

        {/* Quote */}
        <div className="text-right shrink-0">
          <p className="text-base font-bold">{formatCurrency(bid.bid_amount, pr.currency_code)}</p>
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

      {/* Pending approval progress */}
      <BidApprovalProgress bid={bid} />

      {/* Rejection reason */}
      {isRejected && bid.rejection_reason && (
        <div className="px-4 pb-3 bg-red-50/30 border-t border-red-100">
          <p className="text-xs text-red-600 mt-2">Reason: {bid.rejection_reason}</p>
        </div>
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
      await apiClient.post(`/procurement/${pr.id}/submit-bid-for-approval/`, {
        bid_id: bid.id,
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
    queryKey: ['bid-approval', bid.id],
    queryFn: async () => {
      const res = await apiClient.get('/approvals/requests/', {
        params: { entity_type: 'vendorbid', object_id: bid.id },
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

      {!isLoading && actions.length > 0 && (
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-amber-100/60 text-amber-900">
              <th className="text-left px-3 py-1.5 font-medium w-12">Level</th>
              <th className="text-left px-3 py-1.5 font-medium">Approver</th>
              <th className="text-left px-3 py-1.5 font-medium w-28">Status</th>
              <th className="text-left px-3 py-1.5 font-medium">Comments</th>
              <th className="text-right px-3 py-1.5 font-medium whitespace-nowrap">Date</th>
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
  const canAct = ['approved', 'vendor_selected'].includes(pr.status)

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

function exportPRPDF(pr: any) {
  const lineItems: any[] = pr.line_items ?? []
  const subtotal = lineItems.reduce(
    (s, item) => s + Number(item.quantity || 0) * Number(item.unit_rate || 0),
    0,
  )
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const currency = pr.currency_code ?? ''

  const lineRows = lineItems.map((item, idx) => {
    const total = Number(item.quantity || 0) * Number(item.unit_rate || 0)
    return `<tr>
      <td style="padding:5px 8px;text-align:center">${idx + 1}</td>
      <td style="padding:5px 8px;font-family:monospace">${item.item_code || '—'}</td>
      <td style="padding:5px 8px">${item.description || '—'}</td>
      <td style="padding:5px 8px;text-align:right">${Number(item.quantity).toLocaleString()}</td>
      <td style="padding:5px 8px;text-align:center">${item.unit_of_measure || 'EA'}</td>
      <td style="padding:5px 8px;text-align:right">${fmt(Number(item.unit_rate))}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:600">${fmt(total)}</td>
    </tr>`
  }).join('')

  const invitedVendors: string = (pr.invited_vendors_detail ?? [])
    .map((v: any) => v.company_name)
    .join(', ') || '—'

  const selectedVendor: string = pr.selected_vendor_name || '—'

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      approved: '#dcfce7;color:#166534',
      draft: '#f1f5f9;color:#475569',
      rejected: '#fee2e2;color:#991b1b',
      pending_approval: '#fef3c7;color:#92400e',
      vendor_selected: '#dbeafe;color:#1e40af',
    }
    const style = colors[s] ?? '#f1f5f9;color:#475569'
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:700;background:${style}">${s.replace(/_/g, ' ')}</span>`
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Purchase Requisition — ${pr.pr_number}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #1e293b; }
    h1 { font-size: 18px; margin: 0 0 3px; color: #1e3a5f; }
    .meta { font-size: 10px; color: #64748b; margin-bottom: 14px; }
    .section-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 14px 0 8px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .kpi-label { font-size: 9px; color: #64748b; }
    .kpi-value { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f1f5f9; padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; border: 1px solid #e2e8f0; }
    td { border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totals { margin-top: 8px; text-align: right; }
    .totals table { width: auto; margin-left: auto; min-width: 280px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; }
    .info-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    .info-label { color: #64748b; width: 130px; shrink: 0; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <h1>${pr.pr_number} ${statusBadge(pr.status)}</h1>
  <div class="meta">
    ${pr.tracking_code ? `Tracking ID: <strong>${pr.tracking_code}</strong> &nbsp;·&nbsp;` : ''}
    Created: <strong>${pr.created_at ? new Date(pr.created_at).toLocaleDateString() : '—'}</strong>
    ${pr.created_by_name ? `&nbsp;·&nbsp; By: <strong>${pr.created_by_name}</strong>` : ''}
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Total Value</div>
      <div class="kpi-value">${currency} ${Number(pr.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Line Items</div>
      <div class="kpi-value">${lineItems.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Type</div>
      <div class="kpi-value">${pr.purchase_type || 'General'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Plant</div>
      <div class="kpi-value">${pr.plant_name || '—'}</div>
    </div>
  </div>

  <div class="info-grid">
    <div>
      <div class="section-title">Requisition Details</div>
      <div class="info-row"><span class="info-label">Title</span><span>${pr.title || '—'}</span></div>
      <div class="info-row"><span class="info-label">Description</span><span>${pr.description || '—'}</span></div>
      <div class="info-row"><span class="info-label">Department</span><span>${pr.department_name || '—'}</span></div>
      <div class="info-row"><span class="info-label">Currency</span><span>${pr.currency_code || '—'}</span></div>
    </div>
    <div>
      <div class="section-title">Vendor Information</div>
      <div class="info-row"><span class="info-label">Invited Vendors</span><span>${invitedVendors}</span></div>
      <div class="info-row"><span class="info-label">Selected Vendor</span><span>${selectedVendor}</span></div>
    </div>
  </div>

  <div class="section-title">Line Items</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th style="width:90px">Item Code</th>
        <th>Description</th>
        <th style="width:60px;text-align:right">Qty</th>
        <th style="width:45px;text-align:center">UOM</th>
        <th style="width:90px;text-align:right">Unit Rate</th>
        <th style="width:100px;text-align:right">Total (${currency})</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || '<tr><td colspan="7" style="padding:8px;text-align:center;color:#94a3b8">No line items</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td style="padding:5px 12px;color:#64748b">Subtotal</td>
        <td style="padding:5px 12px;text-align:right;font-weight:600">${currency} ${fmt(subtotal)}</td>
      </tr>
      <tr style="background:#f1f5f9">
        <td style="padding:6px 12px;font-weight:700">Grand Total</td>
        <td style="padding:6px 12px;text-align:right;font-weight:700;font-size:13px;color:#1e3a5f">${currency} ${fmt(Number(pr.total_amount || subtotal))}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <span>Lumax Procurement — Purchase Requisition</span>
    <span>Generated: ${new Date().toLocaleString()}</span>
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) { URL.revokeObjectURL(url); return }
  win.addEventListener('load', () => { win.focus(); win.print() })
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
          <Button variant="outline" size="sm" onClick={() => exportPRPDF(pr)} className="gap-1.5">
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

          {/* Invited Vendors */}
          {pr.invited_vendors_detail?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Invited Vendors</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(pr.invited_vendors_detail as any[]).map((v: any) => (
                    <div key={v.id} className="border rounded-lg px-3 py-2 text-sm bg-slate-50">
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
