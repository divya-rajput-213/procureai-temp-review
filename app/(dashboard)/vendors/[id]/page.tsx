'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, ShoppingCart, Award, MapPin, LayoutDashboard, ShieldCheck, CheckCircle2, FileBadge, CreditCard, Landmark, Building2, BadgeCheck, User, ChartNoAxesColumnIncreasing, FileText, TrendingUp, Trophy, Truck, Receipt, AlertTriangle } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor, formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

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
      <p className="text-[13px] font-semibold tracking-wide mb-2">Approval Timeline</p>
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
    onProcess(action, comments)
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
    <div>
      {matrices === undefined && (
        <div className="flex items-center justify-center gap-2 w-full py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading matrices…</span>
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
            setExpandedMatrix(id)
          }}
          onToggleExpand={(id) => {
            setExpandedMatrix(prev => (prev === id ? null : id))
          }}
        />
      )}
      <div className="flex justify-end mt-4">
        <Button
          size="sm"
          onClick={submit}
          disabled={submitting || (matrixCount > 0 && selectedMatrix === null)}
          className="gap-1.5"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          Submit for Approval
        </Button>
      </div>
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

// ─── VendorDashboard ──────────────────────────────────────────────────────────
function VendorDashboard({ vendor, dash, isLoading }: { vendor: any, dash: any, isLoading: boolean }) {
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!dash) return null

  const stats = dash?.stats ?? {}
  const recentPOs: any[] = dash?.recent_pos ?? []
  const recentQuotations: any[] = dash?.recent_quotations ?? []
  const recentInvoices: any[] = dash?.recent_invoices ?? []
  const scorecard = dash?.scorecard ?? null
  const viewQuotationHref = '/quotation'
  const openInNewTab = (href: string) => window.open(href, '_blank', 'noopener,noreferrer')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[70%_1fr] gap-4 min-w-0">
      {/* LEFT */}
      <div className="space-y-4 min-w-0 overflow-x-hidden">
        {/* Purchase Orders */}
        <Card>
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><ShoppingCart className="h-3.5 w-3.5" /></span>
              Recent Purchase Orders
            </CardTitle>
            <Link href="/purchase-orders" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-[12px] h-7">View</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">PO Number</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Type</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Plant</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-right">Amount</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPOs.length ? (
                  recentPOs.slice(0, 5).map((po: any) => (
                    <tr
                      key={po.id}
                      onClick={() => { if (!po?.id) return; openInNewTab(`/purchase-orders/${po.id}`) }}
                      className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px]">{po.po_number || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{po.po_type_display || po.po_type || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{po.plant_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{po.total_amount != null ? formatCurrency(po.total_amount) : '—'}</td>
                      <td className="px-4 py-2.5 text-center"><StatusBadge status={po.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[12px] text-muted-foreground">No purchase orders yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Recent Quotations */}
        <Card className="rounded-xl border shadow-none overflow-hidden">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Recent Quotations
            </CardTitle>
            <Link href={viewQuotationHref} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-[12px] h-7">View</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Ref No</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Quotation No</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Valid Until</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-right">Amount</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotations.length ? (
                  recentQuotations.slice(0, 5).map((q: any) => (
                    <tr
                      key={q.id ?? q.bid_id}
                      onClick={() => {
                        const quotationId = q?.hash_id ?? q?.id ?? q?.bid_id
                        if (!quotationId) return
                        openInNewTab(`/quotation/detail/${quotationId}`)
                      }}
                      className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{q.ref_no || q.pr_number || '—'}</td>
                      <td className="px-4 py-2.5 max-w-[160px] truncate">{q.quotation_no || q.title || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{q.valid_until ? formatDate(q.valid_until) : '—'}</td>
                      <td className="px-4 py-2.5 text-right">{(q.total_amount ?? q.bid_amount) != null ? formatCurrency(q.total_amount ?? q.bid_amount) : '—'}</td>
                      <td className="px-4 py-2.5 text-center"><StatusBadge status={q.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[12px] text-muted-foreground">No quotations yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="rounded-xl border shadow-none overflow-hidden">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5" />
              Recent Invoices
            </CardTitle>
            <Link href="/invoices" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-[12px] h-7">View</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Invoice #</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Type</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">PO Ref</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-right">Amount</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-left">Due Date</th>
                  <th className="px-4 py-2 text-[11px] uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length ? (
                  recentInvoices.slice(0, 5).map((inv: any) => (
                    <tr
                      key={inv.id}
                      onClick={() => { if (!inv?.id) return; openInNewTab(`/invoices/${inv.id}`) }}
                      className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px]">{inv.invoice_number || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize">{inv.invoice_type?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{inv.po_number || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{inv.total_amount != null ? formatCurrency(inv.total_amount) : '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                      <td className="px-4 py-2.5 text-center"><StatusBadge status={inv.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[12px] text-muted-foreground">No invoices yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Monthly Spend Trend */}
        <Card className="rounded-xl border shadow-none">
          <CardHeader className="py-3 px-4 border-b flex-row items-center justify-between">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Monthly Spend Trend
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">Last 12 months</span>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={dash.spend_trend ?? []} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), 'Spend']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Area type="monotone" dataKey="spend" stroke="#2563eb" strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bid Win Rate + Delivery Performance */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-xl border shadow-none">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5" />
                Bid Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col items-center gap-2">
              {stats.total_bids === 0 ? (
                <div className="h-[120px] flex items-center justify-center text-[12px] text-muted-foreground">No bids yet</div>
              ) : (
                <>
                  <div className="relative">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Won', value: stats.accepted_bids ?? 0 },
                            { name: 'Rejected', value: stats.rejected_bids ?? 0 },
                            { name: 'Pending', value: stats.pending_bids ?? 0 },
                          ]}
                          cx={55} cy={55} innerRadius={36} outerRadius={52}
                          startAngle={90} endAngle={-270}
                          dataKey="value" strokeWidth={0}
                        >
                          <Cell fill="#2563eb" />
                          <Cell fill="#ef4444" />
                          <Cell fill="#e2e8f0" />
                        </Pie>
                        <Tooltip formatter={(v: any, name: any) => [v, name]} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[18px] font-bold text-slate-800">{stats.win_rate}%</span>
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-[11px] text-muted-foreground">{stats.accepted_bids} of {stats.total_bids} bids won</div>
                    <div className="flex items-center justify-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563eb] inline-block" />Won</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />Rejected</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#e2e8f0] inline-block" />Pending</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-none">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                Delivery Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={dash.delivery_trend ?? []} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any, name: any) => [`${v} days`, name === 'actual' ? 'Actual' : 'Target']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="target" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {stats.otd_pct != null && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">{stats.otd_pct}% on-time delivery</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="space-y-4 min-w-0">
        {/* Compliance */}
        <Card className="rounded-xl border shadow-none overflow-hidden">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(() => {
              const docs: any[] = vendor.documents ?? []
              const docOf = (type: string) => docs.find((d: any) => d.doc_type === type || d.doc_type?.startsWith(type)) ?? null
              const isVerified = (d: any) => d && (d.ai_validation_status === 'passed' || d.ai_validation_status === 'warning')
              const today = new Date()
              const daysUntil = (dateStr: string) => {
                const diff = new Date(dateStr).getTime() - today.getTime()
                return Math.ceil(diff / (1000 * 60 * 60 * 24))
              }

              const allItems = [
                { label: 'GST',           docType: 'gst_certificate',  value: vendor.gst_number,  icon: FileBadge,  bg: 'bg-blue-100',   color: 'text-blue-700',   empty: 'Missing',      mono: true,  show: true },
                { label: 'PAN',           docType: 'pan_card',         value: vendor.pan_number,  icon: CreditCard, bg: 'bg-green-100',  color: 'text-green-700',  empty: 'Missing',      mono: true,  show: true },
                { label: 'Bank',          docType: 'bank_details',     value: vendor.bank_account ? `••${vendor.bank_account.slice(-4)}` : null, icon: Landmark, bg: 'bg-purple-100', color: 'text-purple-700', empty: 'Not provided', mono: true, show: true },
                { label: 'MSME',          docType: 'msme_certificate', value: vendor.msme_number, icon: BadgeCheck, bg: 'bg-green-100',  color: 'text-green-700',  empty: '—',            mono: false, show: !!vendor.is_msme },
                { label: 'SEZ',           docType: 'sez_certificate',  value: vendor.is_sez ? 'Registered' : null, icon: Building2, bg: 'bg-purple-100', color: 'text-purple-700', empty: '—', mono: false, show: !!vendor.is_sez },
                { label: 'ISO / Quality', docType: 'iso_certificate',  value: docOf('iso_certificate') ? 'Uploaded' : null, icon: Award, bg: 'bg-amber-100', color: 'text-amber-700', empty: '—', mono: false, show: !!docOf('iso_certificate') },
              ]

              return allItems.filter(item => item.show).map(item => {
                const doc = docOf(item.docType)
                const verified = isVerified(doc)
                const hasDoc = !!doc
                const hasValue = !!item.value
                const Icon = item.icon
                const expiry = doc?.valid_till ?? null
                const days = expiry ? daysUntil(expiry) : null
                const expiringSoon = days !== null && days >= 0 && days <= 30
                const expired = days !== null && days < 0

                return (
                  <div key={item.label} className={`px-3 py-2.5 border-b last:border-0 ${expired ? 'bg-red-50/40' : expiringSoon ? 'bg-amber-50/40' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${item.bg}`}>
                        <Icon className={`h-3 w-3 ${item.color}`} />
                      </div>
                      <span className="text-[11px] font-medium w-[68px] shrink-0">{item.label}</span>
                      <span className={`text-[11px] text-slate-500 flex-1 truncate ${item.mono ? 'font-mono' : ''}`}>
                        {hasValue ? item.value : <span className="text-slate-300">{item.empty}</span>}
                      </span>
                      {hasValue && verified && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-semibold shrink-0">
                          <CheckCircle2 className="h-2.5 w-2.5" />Verified
                        </span>
                      )}
                      {hasValue && !verified && hasDoc && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-semibold shrink-0">
                          <AlertTriangle className="h-2.5 w-2.5" />Not Verified
                        </span>
                      )}
                      {hasValue && !hasDoc && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-semibold shrink-0">
                          <Clock className="h-2.5 w-2.5" />No Doc
                        </span>
                      )}
                      {!hasValue && <XCircle className="h-3 w-3 text-slate-300 shrink-0" />}
                    </div>
                    {expiry && (
                      <div className="pl-8 mt-0.5">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-slate-400'}`}>
                          {(expired || expiringSoon) && <AlertTriangle className="h-2.5 w-2.5" />}
                          {expired
                            ? `Expired ${new Date(expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                            : expiringSoon
                              ? `Expiring in ${days}d`
                              : `Valid till ${new Date(expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="text-[13px] font-medium">{vendor.contact_name}</div>
                <div className="text-[11px] text-muted-foreground">Owner</div>
              </div>
              <div>
                <div className="text-[12px]">{vendor.contact_email}</div>
                <div className="text-[11px] text-muted-foreground">{vendor.contact_phone}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Scorecard */}
        {scorecard && (
          <Card className="rounded-xl border overflow-hidden">
            <CardHeader className="py-2.5 px-4 flex-row justify-between items-center border-b">
              <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                <ChartNoAxesColumnIncreasing className="h-3.5 w-3.5" />
                Vendor Scorecard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {(() => {
                const c = scorecard.compliance
                const score: number = c?.score ?? 0
                const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
                const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
                const docs = c?.docs ?? {}
                const docItems = [
                  { key: 'gst', label: 'GST' },
                  { key: 'pan', label: 'PAN' },
                  { key: 'bank', label: 'Bank' },
                  { key: 'msme', label: 'MSME' },
                  { key: 'iso', label: 'ISO' },
                ]
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Compliance</span>
                      <span className={`text-[13px] font-bold ${color}`}>{score}<span className="text-[10px] font-normal text-muted-foreground">/100</span></span>
                    </div>
                    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
                      <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '50%' }} />
                      <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '80%' }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {docItems.map(({ key, label }) => {
                        const d = docs[key]
                        if (d === null || d === undefined) return null
                        const st: string = d?.status ?? 'missing'
                        const chip = st === 'verified' ? 'bg-green-50 text-green-700 border-green-200'
                          : st === 'uploaded' ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : st === 'expired'  ? 'bg-red-50 text-red-600 border-red-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                        const icon = st === 'verified' ? '✓' : st === 'expired' ? '!' : st === 'uploaded' ? '↑' : '–'
                        return (
                          <span key={key} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${chip}`}>
                            {icon} {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {scorecard.win_rate != null && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Bid Win Rate</span>
                    <span className={`text-[13px] font-bold ${scorecard.win_rate >= 60 ? 'text-green-600' : scorecard.win_rate >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                      {scorecard.win_rate}<span className="text-[10px] font-normal text-muted-foreground">%</span>
                    </span>
                  </div>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full transition-all ${scorecard.win_rate >= 60 ? 'bg-green-500' : scorecard.win_rate >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${scorecard.win_rate}%` }} />
                    <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '30%' }} />
                    <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '60%' }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{stats.accepted_bids} of {stats.total_bids} bids won</p>
                </div>
              )}

              {scorecard.otd != null && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">On-Time Delivery</span>
                    <span className={`text-[13px] font-bold ${scorecard.otd >= 85 ? 'text-green-600' : scorecard.otd >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {scorecard.otd}<span className="text-[10px] font-normal text-muted-foreground">%</span>
                    </span>
                  </div>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full transition-all ${scorecard.otd >= 85 ? 'bg-green-500' : scorecard.otd >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${scorecard.otd}%` }} />
                    <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '60%' }} />
                    <div className="absolute top-0 h-full w-px bg-white/70" style={{ left: '85%' }} />
                  </div>
                </div>
              )}

              {scorecard.win_rate == null && scorecard.otd == null && (
                <p className="text-[11px] text-muted-foreground border-t pt-3">
                  Win rate & delivery scores appear once bid activity is recorded.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function VendorDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const router = useRouter()

  const queryClient = useQueryClient()
  const [activeTabKey, setActiveTabKey] = useState<'overview' | 'documents' | 'approval'>('overview')

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/`)).data,
  })

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['vendor-dashboard', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/dashboard/`)).data,
  })

  const { data: vendorDocs = [] } = useQuery({
    queryKey: ['vendor-docs', id],
    queryFn: async () => { const r = await apiClient.get(`/vendors/${id}/documents/`); return r.data.results ?? r.data },
    enabled: activeTabKey === 'documents',
  })

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!vendor) return <div className="p-8 text-center text-muted-foreground">Vendor not found.</div>

  const canFullEdit = vendor.status === 'draft'
  const canUploadDoc = ['draft', 'pending_approval'].includes(vendor.status)
  const isLocked = ['rejected', 'blocked'].includes(vendor.status)

  const tabs = [
    { key: 'overview',   label: 'Overview'   },
    { key: 'documents',  label: 'Documents'  },
    { key: 'approval',   label: 'Approval'   },
  ]

  return (
    <>
      <div className="space-y-3 w-full min-w-0 overflow-x-hidden">

        {/* ── Page-level action bar: action buttons right only ── */}
        <div className="flex items-center justify-end gap-2">
          {canFullEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-[13px]"
              onClick={() => router.push(`/vendors/${id}/edit`)}
            >
              <Pencil className="w-[14px] h-[14px] mr-1" />
              Edit
            </Button>
          )}
          {canUploadDoc && !canFullEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-[13px]"
              onClick={() => router.push(`/vendors/${id}/edit`)}
            >
              <FileText className="w-[14px] h-[14px] mr-1" />
              Upload Documents
            </Button>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] font-medium">
              <XCircle className="w-3.5 h-3.5" />
              {vendor.status === 'blocked' ? 'Vendor blocked' : 'Vendor rejected'} — read only
            </span>
          )}
        </div>

        {/* ── Header card ── */}
        <div className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white p-[22px]">

          {/* Row 1 — Avatar + company name + status badge + location/date */}
          <div className="flex items-start gap-[14px] mb-5">
            <div className="w-[48px] h-[48px] rounded-[12px] bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <span className="text-[17px] font-bold">
                {(vendor.company_name ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[19px] font-semibold tracking-[-0.4px]">{vendor.company_name}</h1>
                <StatusBadge status={vendor.status} />
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{vendor.city}, {vendor.state}</span>
                {vendor.created_at && (
                  <span className="ml-1">· Created {formatDate(vendor.created_at)}</span>
                )}
              </p>
            </div>
          </div>

          {/* Row 2 — 3-column contextual info strip */}
          <div className="grid grid-cols-3 border rounded-lg overflow-hidden mb-5">
            {/* Vendor */}
            <div className="px-4 py-3 border-r">
              <p className="text-[10px] uppercase font-semibold tracking-[0.5px] text-muted-foreground mb-1">Vendor</p>
              <p className="font-medium text-[13px] text-[#1a1a18]">{vendor.company_name}</p>
              {(vendor.city || vendor.state) && (
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="px-4 py-3 border-r">
              <p className="text-[10px] uppercase font-semibold tracking-[0.5px] text-muted-foreground mb-1">Vendor Contact</p>
              <p className="font-medium text-[13px] text-[#1a1a18]">{vendor.contact_name || '—'}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {[vendor.contact_email, vendor.contact_phone].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>

            {/* Plant / Category */}
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase font-semibold tracking-[0.5px] text-muted-foreground mb-1">Plant / Department / Category</p>
              <p className="font-medium text-[13px] text-[#1a1a18]">
                {[vendor.plant_name, vendor.category_name].filter(Boolean).join(' / ') || '—'}
              </p>
            </div>
          </div>

          {/* Row 3 — key metadata strip */}
          <div className="grid grid-cols-5 divide-x divide-[rgba(0,0,0,0.07)]">
            {[
              { label: 'Vendor ID',        value: vendor.vendor_code,   mono: false },
              { label: 'GSTIN',            value: vendor.gst_number,    mono: true  },
              { label: 'PAN',              value: vendor.pan_number,    mono: true  },
              { label: 'MSME',             value: vendor.is_msme ? (vendor.msme_number || 'Registered') : '—', mono: false },
              {
                label: 'Compliance Score',
                value: dash?.scorecard?.compliance?.score != null
                  ? `${dash.scorecard.compliance.score}/100`
                  : '—',
                mono: false,
              },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 first:pl-0 last:pr-0">
                <p className="text-[10px] uppercase font-semibold tracking-[0.4px] text-muted-foreground mb-1">{label}</p>
                <p className="text-[13px] font-medium text-[#1a1a18]">{value || '—'}</p>
              </div>
            ))}
          </div>

        </div>

        {/* ── Tabs ── */}
        <div className="flex w-full border border-[rgba(0,0,0,0.08)] rounded-t-xl overflow-hidden bg-white mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTabKey(tab.key as 'overview' | 'documents' | 'approval')}
              className={`
                flex items-center justify-center gap-1.5
                px-5 py-[11px]
                text-[13px] font-medium
                transition-colors
                border-b-[2.5px]
                whitespace-nowrap
                ${activeTabKey === tab.key
                  ? 'text-[#042348] border-[#042348] bg-white'
                  : 'text-[#9a9a96] border-transparent hover:bg-[#f8f8f6] hover:text-[#042348]'
                }
              `}
            >
              {tab.key === 'overview'  && <LayoutDashboard className="w-[14px] h-[14px]" />}
              {tab.key === 'documents' && <FileText        className="w-[14px] h-[14px]" />}
              {tab.key === 'approval'  && <ShieldCheck     className="w-[14px] h-[14px]" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTabKey === 'overview' && (
          <VendorDashboard vendor={vendor} dash={dash} isLoading={dashLoading} />
        )}

        {/* ── Documents Tab ── */}
        {activeTabKey === 'documents' && (
          <div className="space-y-4">
            {canUploadDoc && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="text-[13px]" onClick={() => router.push(`/vendors/${id}/edit`)}>
                  <FileText className="w-[14px] h-[14px] mr-1" />
                  Upload Documents
                </Button>
              </div>
            )}

            {isLocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-[13px] text-red-700">
                <XCircle className="h-4 w-4 shrink-0" />
                This vendor is <strong>{vendor.status}</strong>. Document uploads are disabled.
              </div>
            )}

            {vendorDocs.length === 0 ? (
              <div className="rounded-xl border bg-white p-10 text-center text-[13px] text-muted-foreground">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-left text-muted-foreground">Document</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-left text-muted-foreground">Type</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-left text-muted-foreground">Uploaded</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-center text-muted-foreground">Verification</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-left text-muted-foreground">Valid Till</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-center text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorDocs.map((doc: any) => {
                      const isVerified = doc.ai_validation_status === 'passed' || doc.ai_validation_status === 'warning'
                      const isFailed = doc.ai_validation_status === 'failed'
                      const isPending = !doc.ai_validation_status || doc.ai_validation_status === 'pending'
                      const docLabel = (doc.doc_type ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      const today = new Date()
                      const days = doc.valid_till
                        ? Math.ceil((new Date(doc.valid_till).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        : null
                      const isExpired = days !== null && days < 0
                      const isExpiringSoon = days !== null && days >= 0 && days <= 30
                      return (
                        <tr key={doc.id ?? doc.hash_id} className={`border-t hover:bg-slate-50 transition-colors ${isExpired ? 'bg-red-50/40' : isExpiringSoon ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                                <FileText className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <span className="font-medium text-[13px] max-w-[180px] truncate">{doc.original_filename || doc.title || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-[12px]">{docLabel}</td>
                          <td className="px-4 py-3 text-muted-foreground text-[12px]">
                            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                isVerified ? 'bg-green-100 text-green-700' :
                                isFailed   ? 'bg-red-100 text-red-700' :
                                             'bg-slate-100 text-slate-500'
                              }`}>
                                {isVerified
                                  ? <><CheckCircle2 className="h-3 w-3" /> Verified</>
                                  : isFailed
                                    ? <><XCircle className="h-3 w-3" /> Failed</>
                                    : <><Clock className="h-3 w-3" /> {isPending ? 'Pending' : 'Not Verified'}</>
                                }
                              </span>
                              {doc.ai_validation_notes && (
                                <span className="text-[9px] text-muted-foreground max-w-[120px] truncate" title={doc.ai_validation_notes}>
                                  {doc.ai_validation_notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {doc.valid_till ? (
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-[12px] font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-700'}`}>
                                  {new Date(doc.valid_till).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                {isExpired && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Expired {Math.abs(days!)}d ago
                                  </span>
                                )}
                                {isExpiringSoon && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Expiring in {days}d
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[12px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-[13px]">
                            {doc.file_url ? (
                              <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[12px] text-blue-600 hover:underline font-medium">View</a>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Approval Tab ── */}
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
                  queryClient.invalidateQueries({ queryKey: ['vendor', id] })
                  router.push(`/vendors`)
                }}
              />
            )}
          </div>
        )}

      </div>
    </>
  )
}