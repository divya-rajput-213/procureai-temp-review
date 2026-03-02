'use client'

import { useEffect, useState } from 'react'
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

function ApprovalTimeline({ actions }: { actions: any[] }) {
  if (!actions?.length) return <p className="text-sm text-muted-foreground">No actions yet.</p>
  return (
    <div>
      {actions.map((a: any, idx: number) => {
        const s = stepStyle(a.action)
        const isLast = idx === actions.length - 1
        const label = a.action === 'approved' ? 'Approved'
          : a.action === 'rejected' ? 'Rejected'
            : a.action === 'held' ? 'On Hold'
              : 'Pending'
        return (
          <div key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s.dot}`}>
                {a.action === 'approved'
                  ? <CheckCircle className="w-4 h-4 text-white" />
                  : a.action === 'rejected'
                    ? <XCircle className="w-4 h-4 text-white" />
                    : <Clock className="w-4 h-4 text-white" />}
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200 my-1 min-h-[16px]" />}
            </div>
            <div className={`flex-1 ${isLast ? 'pb-1' : 'pb-4'}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-sm font-semibold">{a.approver_name ?? 'Unknown'}</span>
                  {a.role_name && (
                    <span className="text-xs text-muted-foreground ml-1.5">({a.role_name})</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">· Level {a.level_number}</span>
                  {a.is_delegated && <span className="text-xs text-blue-500 ml-1">(delegated)</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{label}</span>
              </div>
              {a.acted_at && <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(a.acted_at)}</p>}
              {a.action === 'pending' && a.sla_deadline && (
                <p className="text-xs text-amber-600 mt-0.5">Due: {formatDateTime(a.sla_deadline)}</p>
              )}
              {a.comments && <p className="text-xs text-slate-500 mt-1 italic">"{a.comments}"</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
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
        Your action required — Level {pendingAction.level}
      </p>
      <textarea
        className="w-full border rounded-md p-2 text-sm resize-none h-16"
        placeholder="Comments (required for Reject / Hold)…"
        value={comments}
        onChange={e => setComments(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
          onClick={() => handle('approved')} disabled={busy}>
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
        <div className="px-4 py-4">
          <ApprovalTimeline actions={approvalRequest.actions ?? []} />
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
  type LineItem = { _key: string; item_code: number | ''; description: string; quantity: string; unit_of_measure: string; unit_rate: string }
  const [lineItems, setLineItems] = useState<LineItem[]>(
    (pr.line_items ?? []).map((li: any) => ({
      _key: String(li.id),
      item_code: li.item_code,
      description: li.description,
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
    { _key: crypto.randomUUID(), item_code: '', description: '', quantity: '1', unit_of_measure: 'Nos', unit_rate: '0' },
  ])
  const removeLineItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx))
  const setLI = (idx: number, k: keyof LineItem, v: any) =>
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [k]: v } : li))

  const selectItem = (idx: number, item: any) => {
    setLI(idx, 'item_code', item.id)
    setLI(idx, 'description', item.description)
    setItemSearch(prev => ({ ...prev, [idx]: item.code }))
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
                      value={itemSearch[idx] ?? (li.item_code ? String(li.item_code) : '')}
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
                    type="number" placeholder="1" value={li.quantity}
                    onChange={e => setLI(idx, 'quantity', e.target.value)}
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
                    type="number" placeholder="0.00" value={li.unit_rate}
                    onChange={e => setLI(idx, 'unit_rate', e.target.value)}
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

function AddBidForm({ prId, onSuccess }: { prId: string | string[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    vendor: '',
    bid_amount: '',
    delivery_days: '30',
    validity_days: '30',
    notes: '',
  })

  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved'],
    queryFn: async () => (await apiClient.get('/vendors/?status=approved')).data.results || [],
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData()
      payload.append('vendor', form.vendor)
      payload.append('bid_amount', form.bid_amount)
      payload.append('delivery_days', form.delivery_days)
      payload.append('validity_days', form.validity_days)
      if (form.notes) payload.append('notes', form.notes)
      await apiClient.post(`/procurement/${prId}/bids/`, payload)
    },
    onSuccess: () => {
      toast({ title: 'Bid added.' })
      setForm({ vendor: '', bid_amount: '', delivery_days: '30', validity_days: '30', notes: '' })
      onSuccess()
    },
    onError: (err: any) => {
      toast({ title: 'Failed to add bid', description: err?.response?.data?.error, variant: 'destructive' })
    },
  })

  const valid = !!form.vendor && !!form.bid_amount

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
      <p className="text-xs font-medium text-muted-foreground">Add Vendor Bid</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Vendor <span className="text-destructive">*</span></Label>
          <select
            className="w-full h-9 border rounded-md px-3 text-sm bg-white"
            value={form.vendor}
            onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
          >
            <option value="">Select vendor…</option>
            {(vendors || []).map((v: any) => (
              <option key={v.id} value={v.id}>{v.company_name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bid Amount (₹) <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.bid_amount}
            onChange={e => setForm(f => ({ ...f, bid_amount: e.target.value }))}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Delivery Days</Label>
          <Input
            type="number"
            placeholder="30"
            value={form.delivery_days}
            onChange={e => setForm(f => ({ ...f, delivery_days: e.target.value }))}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Validity Days</Label>
          <Input
            type="number"
            placeholder="30"
            value={form.validity_days}
            onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Input
            placeholder="Optional notes…"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="h-9"
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={!valid || mutation.isPending}
        className="gap-1.5"
      >
        {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Add Bid
      </Button>
    </div>
  )
}

// ─── Bids Tab ─────────────────────────────────────────────────────────────────

function BidsTab({ pr }: { pr: any }) {
  const { id } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [analysingBids, setAnalysingBids] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  const isApproved = pr.status === 'approved' || pr.status === 'synced_to_sap' || pr.status === 'po_created'

  const { data: bids, refetch } = useQuery({
    queryKey: ['pr-bids', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/bids/`)).data.results ??
      (await apiClient.get(`/procurement/${id}/bids/`)).data,
  })

  const selectVendorMutation = useMutation({
    mutationFn: async (vendorId: number) => {
      await apiClient.patch(`/procurement/${id}/`, { selected_vendor: vendorId })
    },
    onSuccess: () => {
      toast({ title: 'Vendor selected.' })
      queryClient.invalidateQueries({ queryKey: ['pr', id] })
    },
    onError: () => toast({ title: 'Failed to select vendor', variant: 'destructive' }),
  })

  const analyseBids = async () => {
    setAnalysingBids(true)
    try {
      const { data } = await apiClient.post(`/procurement/${id}/analyse-bids/`)
      setAiResult(data)
    } catch (err: any) {
      toast({ title: 'AI analysis failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setAnalysingBids(false)
    }
  }

  if (!isApproved) {
    return (
      <div className="border rounded-lg p-8 text-center space-y-2">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Bids are collected after approval</p>
        <p className="text-xs text-muted-foreground">
          Once this PR is approved, you can invite vendors to submit bids here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AddBidForm prId={id!} onSuccess={refetch} />

      {/* Bid list */}
      {bids && bids.length > 0 ? (
        <div className="space-y-3">
          {(bids as any[]).map((bid: any) => (
            <div key={bid.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-sm">{bid.vendor_name}</p>
                  {bid.notes && <p className="text-xs text-muted-foreground">{bid.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(bid.bid_amount, pr.currency_code)}</p>
                  <p className="text-xs text-muted-foreground">
                    {bid.delivery_days}d delivery · {bid.validity_days}d validity
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t">
                {pr.selected_vendor === bid.vendor ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" /> Selected Vendor
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => selectVendorMutation.mutate(bid.vendor)}
                    disabled={selectVendorMutation.isPending}
                  >
                    Select This Vendor
                  </Button>
                )}
                {bid.submitted_at && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(bid.submitted_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">No bids yet.</p>
      )}

      {/* AI Analysis */}
      {bids && bids.length >= 2 && (
        <div className="space-y-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={analyseBids}
            disabled={analysingBids}
            className="gap-2"
          >
            {analysingBids
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing…</>
              : <><Sparkles className="w-4 h-4 text-purple-500" />Analyse Bids with AI</>}
          </Button>
          {aiResult && (
            <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-purple-500" /> AI Bid Analysis
              </h3>
              {aiResult.recommendation && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm font-medium text-green-800">
                    Recommended: {aiResult.recommendation.recommended_vendor_name}
                  </p>
                  <p className="text-xs text-green-700 mt-1">{aiResult.recommendation.reasoning}</p>
                </div>
              )}
              {aiResult.comparison_table && (
                <div className="overflow-x-auto text-xs">
                  <ReactMarkdown>{aiResult.comparison_table}</ReactMarkdown>
                </div>
              )}
              {aiResult.anomalies?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-1">Anomalies Detected:</p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {aiResult.anomalies.map((a: string) => <li key={a}>• {a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
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

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/`)).data,
  })

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
    { key: 'details', label: 'Details' },
    { key: 'approval', label: 'Approval' },
    { key: 'bids', label: 'Bids' },
  ] as const

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
      {activeTab === 'bids' && <BidsTab pr={pr} />}
    </div>
  )
}
