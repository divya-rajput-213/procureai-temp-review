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
  Plus,
  Check
} from 'lucide-react'
import {
  formatCurrency, formatDate, formatDateTime, getSLAPercentage, getSLAColor,
  cn,
} from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import CompareStep from '../components/CompareStep'

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
function SubmitForApprovalModal({ pr, prId, onClose, onSuccess, selectedVendor }: {
  pr: any
  prId: string | string[]
  onClose: () => void
  onSuccess: () => void
  selectedVendor: any
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
    if (!prId) {
      toast({ title: 'Submission failed', description: 'PR ID is missing.', variant: 'destructive' })
      setSubmitting(false)
      return
    }
    if (!selectedVendor) {
      toast({ title: 'Submission failed', description: 'No quotation selected.', variant: 'destructive' })
      setSubmitting(false)
      return
    }
    try {
      const body = selectedMatrix ? { matrix_id: selectedMatrix, selected_quotation_id: selectedVendor } : { selected_quotation: selectedVendor }
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
        <div>
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
        </div>

        {/* Footer — same as first design */}
        <div className="flex items-center justify-end ">
          {/* <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button> */}

          <Button
            onClick={submit}
            disabled={submitting || !selectedMatrix}
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
    </>

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
  const [activeTab, setActiveTab] = useState<'approval' | 'comparison' | 'details'>('comparison')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))
  const initialTabSet = useRef(false)
  const [selectedVendor, setSelectedVendor] = useState<any>("")
  const [isExporting, setIsExporting] = useState(false)

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/`)).data,
  })
  const subtotal = (pr?.line_items ?? []).reduce(
    (sum: any, item: any) => sum + (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0),
    0,
  )
  const quotationIds = pr?.linked_quotations.map((quotation: any) => quotation?.id) ?? []
  {/* KPI ROW */ }
  const selectedQuotation = pr?.linked_quotations?.find((q: any) => q.id === pr?.selected_quotation
  ) ?? null
  const [expandedQuotationId, setExpandedQuotationId] = useState<number | null>(null)

  const handleExport = async (prId: any) => {
    if (!prId) return
    setIsExporting(true)
    try {
      const res = await apiClient.get(
        `/procurement/${prId}/export-pcs/`,
        { responseType: 'blob' }
      )

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = match ? match[1].replace(/['"]/g, '') : `PCS-${prId}.xlsx`

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      let message = 'Could not download the PCS sheet. Please try again.'

      const blob: Blob = err?.response?.data
      if (blob instanceof Blob) {
        try {
          const text = await blob.text()
          const json = JSON.parse(text)
          message = json.error || json.detail || message
        } catch {
          // not JSON, keep default message
        }
      }

      console.error('Export failed', err)
      toast({ title: 'Export failed', description: message, variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }
  // Auto-expand the selected quotation on load
  useEffect(() => {
    if (selectedQuotation) setExpandedQuotationId(selectedQuotation.id)
  }, [selectedQuotation?.id])
  useEffect(() => {
    if (pr?.status === 'draft') {
      setActiveTab('comparison')
    } else if (pr && !initialTabSet.current) {
      initialTabSet.current = true
      setActiveTab('details')
    }
  }, [pr])

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
    { key: 'comparison' as const, label: 'Comparison' },
    { key: 'approval' as const, label: 'Approval' },
  ]
  return (
    <>
      <style>{`
        .prd-lbl{font-size:10px;font-weight:600;color:var(--tx3,#9a9a96);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
        .prd-val{font-size:13px;font-weight:500;color:#1a1a18}
        .prd-cell{padding:0 14px}
        .prd-cell:first-child{padding-left:0}
        .prd-cell:last-child{padding-right:0}
      `}</style>
      <div className="space-y-3 w-full min-w-0 overflow-x-hidden">

        {/* ── Hero card ── */}
        <div style={{ background: 'var(--bg,#fff)', border: '0.5px solid var(--bd,rgba(0,0,0,0.08))', borderRadius: 'var(--rl,12px)', padding: 22, marginBottom: 4 }}>

          {/* Row 1 — icon + PR number + status + action buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dbeafe', color: '#1e40af', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-clipboard-list" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.4px' }}>{pr.pr_number}</span>
                <StatusBadge status={pr.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--tx2,#6b6b69)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                <span>Created {formatDate(pr.created_at)}{pr.created_by_name ? ` · ${pr.created_by_name}` : ''}</span>
                {pr.tracking_code && <span style={{ fontFamily: 'monospace', fontSize: 12 }}>· {pr.tracking_code}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Button size="sm" variant="outline" className="text-[12px] h-8 gap-1.5" onClick={() => exportPRPDF(pr, activeTaxes)}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
              {pr.status === 'draft' && (
                <Button size="sm" variant="outline" className="text-[12px] h-8 gap-1.5" onClick={() => router.push(`/procurement/edit/${pr.id}`)}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </div>
          </div>

          {/* Row 2 — metadata strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderTop: '0.5px solid var(--bd,rgba(0,0,0,0.08))', paddingTop: 14 }}>
            {[
              { label: 'Tracking ID', value: pr.budget_info
?.                tracking_code, mono: true },
              { label: 'Plant', value: pr.plant_name },
              { label: 'Department', value: pr.department_name },
              { label: 'Selected Vendor', value: pr.selected_vendor_name },
              // { label: 'Total Amount', value: formatCurrency(pr.total_amount, pr.currency_code) },
            ].map(({ label, value, mono }, i) => (
              <div key={label} className="prd-cell" style={i > 0 ? { borderLeft: '0.5px solid var(--bd,rgba(0,0,0,0.08))' } : {}}>
                <div className="prd-lbl">{label}</div>
                <div className="prd-val" style={mono ? { fontFamily: 'monospace' } : {}}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center w-full border border-[rgba(0,0,0,0.08)] rounded-t-xl overflow-hidden bg-white mb-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center justify-center gap-1.5
                px-5 py-[11px]
                text-[13px] font-medium
                transition-colors
                border-b-[2.5px]
                whitespace-nowrap
                ${activeTab === tab.key
                  ? 'text-[#042348] border-[#042348] bg-white'
                  : 'text-[#9a9a96] border-transparent hover:bg-[#f8f8f6] hover:text-[#042348]'
                }
              `}
            >
              {tab.key === 'details' && <i className="ti ti-layout-list" style={{ fontSize: 14 }} />}
              {tab.key === 'comparison' && <i className="ti ti-table-column" style={{ fontSize: 14 }} />}
              {tab.key === 'approval' && <i className="ti ti-shield-check" style={{ fontSize: 14 }} />}
              {tab.label}
            </button>
          ))}
        </div>
      {activeTab === 'details' && (
        <div >
          {/* LEFT */}
          <div className="space-y-4 min-w-0">
            {/* KPI ROW */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                  Awarded Value
                </div>
                <div className="flex items-end gap-1.5 mt-2">
                  <div className="text-[30px] leading-none font-semibold tracking-tight">
                    {selectedQuotation ? formatCurrency(selectedQuotation.total_amount, pr.currency_code) : formatCurrency(pr.total_amount, pr.currency_code)}
                  </div>
                  <span className="text-xs text-muted-foreground mb-1">excl. GST</span>
                </div>
                {selectedQuotation && (
                  <div className="mt-1.5 text-xs text-muted-foreground truncate">{selectedQuotation.vendor_name}</div>
                )}
              </div>

              <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                  Budget Util.
                </div>
                <div className="text-[30px] leading-none font-semibold tracking-tight mt-2">
                  {pr.budget_info?.approved_amount
                    ? `${Math.round((Number(pr.total_amount) / Number(pr.budget_info.approved_amount)) * 100)}%`
                    : '—'}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {pr.budget_info ? `${formatCurrency(pr.budget_info.consumed_amount)} of ${formatCurrency(pr.budget_info.approved_amount)}` : '—'}
                </div>
              </div>

              <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                  Remaining Budget
                </div>
                <div className={`text-[30px] leading-none font-semibold tracking-tight mt-2 ${Number(pr.budget_info?.remaining_amount) > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {pr.budget_info?.remaining_amount ? formatCurrency(pr.budget_info.remaining_amount) : '—'}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  Tracking: {pr.budget_info?.tracking_code ?? '—'}
                </div>
              </div>

              <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                  Quotations
                </div>
                <div className="text-[30px] leading-none font-semibold tracking-tight mt-2">
                  {pr.linked_quotations?.length ?? 0}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {selectedQuotation ? `1 selected · ${pr.linked_quotations.length - 1} others` : 'None selected'}
                </div>
              </div>
            </div>

            {/* PROCUREMENT DETAILS */}
            {/* <Card className="overflow-hidden rounded-xl shadow-sm">
              <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
                <div className="flex h-full items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Procurement details
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">
                  {[
                    {
                      label: 'PR ID',
                      value: pr.id || '—',
                      mono: true,
                    },
                    {
                      label: 'Title',
                      value: pr.title || '—',
                    },
                    {
                      label: 'Department',
                      value: pr.department_name || '—',
                    },
                    {
                      label: 'Requestor',
                      value: pr.requestor_name || '—',
                    },
                    {
                      label: 'Created',
                      value: formatDate(pr.created_at),
                    },
                    {
                      label: 'Expected Delivery',
                      value: pr.expected_delivery_date
                        ? formatDate(pr.expected_delivery_date)
                        : '—',
                    },
                    {
                      label: 'Awarded Vendor',
                      value: pr.selected_vendor_name || '—',
                    },
                    {
                      label: 'Quotations',
                      value: `${pr.invited_vendors_detail?.length || 0} evaluated`,
                    },
                    {
                      label: 'Budget',
                      value: pr.budget_info?.approved_amount
                        ? formatCurrency(pr.budget_info.approved_amount)
                        : '—',
                    },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold leading-none">
                        {item.label}
                      </p>

                      <p
                        className={cn(
                          'text-sm font-medium text-foreground leading-snug',
                          item.mono && 'text-[13px]'
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card> */}

            {/* QUOTATIONS */}
            <Card className="overflow-hidden rounded-xl shadow-sm">
              <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
                <div className="flex h-full items-center">
                  <CardTitle className="text-sm font-semibold">Quotations</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        {['Ref No', 'Vendor', 'Items', 'Total', 'Status', 'Selected'].map((head, i) => (
                          <th
                            key={head}
                            className={cn(
                              'py-3 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold whitespace-nowrap',
                              i === 3 ? 'px-4 text-right' : 'px-4 text-left'
                            )}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(pr.linked_quotations || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground italic">
                            No quotations linked yet.
                          </td>
                        </tr>
                      ) : (
                        (pr.linked_quotations || []).map((q: any) => {
                          const isSelected = q.is_selected
                          return (
                            <tr
                              key={q.id}
                              className={cn(
                                'border-b last:border-0 transition-colors',
                                isSelected ? 'bg-emerald-50 hover:bg-emerald-100/70' : 'hover:bg-muted/20'
                              )}
                              style={{ borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent' }}
                            >
                              <td className="px-4 py-3 text-xs whitespace-nowrap font-mono">{q.ref_no || q.quotation_no}</td>
                              <td className="px-4 py-3 font-medium whitespace-nowrap">{q.vendor_name}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{q.items_count} item{q.items_count !== 1 ? 's' : ''}</td>
                              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                                {formatCurrency(q.total_amount, pr.currency_code)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={cn(
                                  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                                  q.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : q.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-600'
                                )}>
                                  {q.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    <Check className="w-3 h-3" /> Selected
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Selected quotation line items (always shown if a quotation is selected) ── */}
                {selectedQuotation?.items?.length > 0 && (
                  <div className="border-t bg-muted/10">
                    <div className="px-6 py-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Line items · {selectedQuotation.vendor_name}
                      </p>
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-muted/40 border-y">
                            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">#</th>
                            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Item Code</th>
                            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</th>
                            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Qty</th>
                            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">UOM</th>
                            <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unit Price</th>
                            <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedQuotation.items.map((item: any, idx: number) => (
                            <tr key={item.id} className={cn('border-b last:border-0', idx % 2 === 1 && 'bg-muted/20')}>
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{item.item_code}</td>
                              <td className="px-3 py-2 font-medium">{item.item_name}</td>
                              <td className="px-3 py-2 text-center">{item.quantity}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{item.unit_of_measure}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(item.item_price, pr.currency_code)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.line_total, pr.currency_code)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-muted/30">
                            <td colSpan={6} className="px-3 py-2 text-right font-semibold text-muted-foreground">Total</td>
                            <td className="px-3 py-2 text-right font-bold">{formatCurrency(selectedQuotation.total_amount, pr.currency_code)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT SIDEBAR */}
          {/* <div className="space-y-4"> */}


          {/* APPROVAL CHAIN */}
          {/* <Card className="overflow-hidden rounded-xl shadow-sm">
              <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
                <div className="flex h-full items-center">
                  <CardTitle className="text-sm font-semibold">
                    Approval chain
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <div className="space-y-3">
                  {(pr.approval_logs || []).length > 0 ? (
                    pr.approval_logs.map(
                      (a: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 border-b border-dashed pb-3 last:border-none last:pb-0"
                        >
                          <div className="flex h-5 w-5 items-center justify-center rounded-full">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">
                              {a.approver_name || 'Approver'}
                            </p>
                          </div>

                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            approved{' '}
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No approvals yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card> */}

          {/* </div> */}
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
              selectedVendor={selectedVendor}
            />
          ) : (
            <ApprovalProgressPanel prId={id!} onStatusChange={invalidatePR} />
          )}
        </div>
      )}

      {/* ── Comparison Tab ── */}
      {activeTab === 'comparison' && (
        <CompareStep
          selectedQuotationIds={quotationIds}
          selectedVendorId={selectedVendor}
          setSelectedVendorId={setSelectedVendor}
          isDisabled={true}
          prId={pr.id}
          onSelectVendor={pr.status === 'draft' ? () => router.push(`/procurement/edit/${id}?step=2`) : undefined}
        />
      )}
      </div>
    </>
  )
}