'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, ShoppingCart, Award, Shield, MapPin, LayoutDashboard, ShieldCheck, History, CheckCircle2, FileBadge, CreditCard, Landmark, Building2, BadgeCheck, User, ChartNoAxesColumnIncreasing, FileText, TrendingUp, Trophy, Truck, Receipt } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor, formatCurrency, DOC_TYPE_LABELS } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import EditVendorPage from '../components/Editvendorpage'

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
      <p className="text-[13px] font-semibold   tracking-wide mb-2">Approval Timeline</p>
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
            setExpandedMatrix(id) // Expands the matrix when selected
          }}
          onToggleExpand={(id) => {
            setExpandedMatrix(prev => (prev === id ? null : id)) // Toggles expand/collapse
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

// ─── VendorDashboard — matches reference exactly ──────────────────────────────
function VendorDashboard({ vendorId, vendor, dash, isLoading }: { vendorId: string | string[]; vendor: any, dash: any, isLoading: boolean }) {

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  if (!dash) return null

  const stats = dash?.stats ?? {}
  const recentPOs: any[] = vendor?.purchase_orders ?? []
  const recentQuotations: any[] = vendor?.quotations ?? []
  const recentInvoices: any[] = vendor?.invoices ?? []
  const perfScore = dash?.performance_score != null ? Math.round(Number(dash.performance_score))
    : vendor.performance_score != null ? Math.round(Number(vendor.performance_score))
      : null
  const riskScore = dash.risk_score != null ? Math.round(Number(dash.risk_score))
    : vendor.risk_score != null ? Math.round(Number(vendor.risk_score))
      : null


  return (
    <div className="grid grid-cols-1 xl:grid-cols-[70%_1fr] gap-4 min-w-0">      {/* LEFT */}
      <div className="space-y-4 min-w-0 overflow-x-hidden">
        {/* Purchase Orders */}
        <Card>
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><ShoppingCart className="h-3.5 w-3.5" /></span>
              Recent Purchase Orders
            </CardTitle>
            <Link href="/purchase-orders"><Button variant="outline" size="sm" className="text-[12px] h-7">View</Button></Link>
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
                    <tr key={po.id} className="border-t hover:bg-slate-50 transition-colors">
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
            <Link href="/quotations"><Button variant="outline" size="sm" className="text-[12px] h-7">View</Button></Link>
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
                    <tr key={q.id ?? q.bid_id} className="border-t hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{q.ref_no || q.pr_number || '—'}</td>
                      <td className="px-4 py-2.5 max-w-[160px] truncate">{q.quotation_no || q.title || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{q.valid_until ? formatDate(q.valid_until) : '—'}</td>
                      <td className="px-4 py-2.5 text-right">{(q.total_amount ?? q.bid_amount) != null ? formatCurrency(q.total_amount ?? q.bid_amount) : '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={q.status} />
                      </td>
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
            <Link href="/invoices"><Button variant="outline" size="sm" className="text-[12px] h-7">View</Button></Link>
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
                    <tr key={inv.id} className="border-t hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px]">{inv.invoice_number || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize">{inv.invoice_type?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{inv.po_number || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{inv.total_amount != null ? formatCurrency(inv.total_amount) : '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
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

        {/* ── Charts ───────────────────────────────────────────────────────── */}
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
            {(dash.spend_trend ?? []).every((d: any) => d.spend === 0) ? (
              <div className="h-[140px] flex items-center justify-center text-[12px] text-muted-foreground">No spend data yet</div>
            ) : (
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
            )}
          </CardContent>
        </Card>
        {/* Bid Win Rate + Delivery Performance side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Bid Win Rate Donut — 3 segments: won / rejected / pending */}
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

          {/* Delivery Performance — trend line over 6 months */}
          <Card className="rounded-xl border shadow-none">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                Delivery Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {(dash.delivery_trend ?? []).every((d: any) => d.actual === null) ? (
                <div className="h-[120px] flex items-center justify-center text-[12px] text-muted-foreground">No delivery data</div>
              ) : (
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
              )}
              {stats.otd_pct != null && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  {stats.otd_pct}% on-time delivery
                </p>
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
            {[
              { label: 'GST Certificate', value: vendor.gst_number, icon: FileBadge, bg: 'bg-blue-100', color: 'text-blue-700', empty: 'Missing', mono: true },
              { label: 'PAN Card', value: vendor.pan_number, icon: CreditCard, bg: 'bg-green-100', color: 'text-green-700', empty: 'Missing', mono: true },
              { label: 'Bank Verification', value: vendor.bank_account ? `XXXX ${vendor.bank_account.slice(-4)}` : null, icon: Landmark, bg: 'bg-purple-100', color: 'text-purple-700', empty: 'Not provided', mono: true },
              { label: 'MSME Registration', value: vendor.msme_number, icon: BadgeCheck, bg: 'bg-green-100', color: 'text-green-700', empty: 'Not registered' },
              { label: 'SEZ Unit', value: vendor.sez_number, icon: Building2, bg: 'bg-purple-100', color: 'text-purple-700', empty: 'Not registered' },
              { label: 'ISO Certificate', value: vendor.iso_type, icon: Award, bg: 'bg-amber-100', color: 'text-amber-700', empty: 'Not certified' },
            ].map(item => {
              const hasValue = !!item.value
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-md flex items-center justify-center ${item.bg}`}>
                      <Icon className={`h-3 w-3 ${item.color}`} />
                    </div>
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-medium ${hasValue ? 'text-green-700' : 'text-red-600'}`}>
                    {hasValue ? (
                      <><CheckCircle2 className="h-3 w-3 shrink-0" /><span className={item.mono ? 'font-mono' : ''}>{item.value}</span></>
                    ) : (
                      <><XCircle className="h-3 w-3 shrink-0" /><span>{item.empty}</span></>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Risk */}
        <Card className="rounded-xl border overflow-hidden">
          <CardHeader className="py-2.5 px-4 flex-row justify-between items-center border-b">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><Shield className="h-3.5 w-3.5" /></span>
              Risk Assessment
            </CardTitle>

            <Badge
              className={
                dash.risk_level === "High"
                  ? "bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium"
                  : dash.risk_level === "Medium"
                    ? "bg-orange-100 text-orange-700 text-xs px-2 py-0.5 font-medium"
                    : "bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium"
              }
            >
              {dash.risk_level}
            </Badge>
          </CardHeader>

          <CardContent className="p-4">
            {/* Risk Score */}
            <div className="text-center mb-3">
              <div className="text-[30px] font-bold tracking-tight text-red-600">
                {riskScore || 80}
              </div>

              <div className="text-[11px] text-muted-foreground">
                Risk Score
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2">
              {[
                {
                  label: "Financial",
                  value: dash.score_breakdown?.financial_stability ?? 0,
                  color: "bg-orange-400",
                  text: "text-orange-700",
                },
                {
                  label: "Operational",
                  value: dash.score_breakdown?.quality_delivery ?? 0,
                  color: "bg-orange-400",
                  text: "text-orange-700",
                },
                {
                  label: "Compliance",
                  value: dash.score_breakdown?.compliance ?? 0,
                  color: "bg-green-500",
                  text: "text-green-700",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center py-1 border-b last:border-0"
                >
                  <span className="w-[90px] text-[12px] text-muted-foreground">
                    {item.label}
                  </span>

                  <div className="flex-1 h-1 bg-slate-100 rounded-full mx-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>

                  <span className={`text-[12px] font-bold ${item.text}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>



        {/* Contact */}
        <Card>

          <CardHeader className="py-3 px-4 border-b">

            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><User className="h-3.5 w-3.5" /></span>
              Contact Details
            </CardTitle>

          </CardHeader>


          <CardContent className="p-4">

            <div className="flex gap-3">


              <div className="flex-1">

                <div className="text-[13px] font-medium">
                  {vendor.contact_name}
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Owner
                </div>

              </div>


              <div>

                <div className="text-[12px]">
                  {vendor.contact_email}                </div>

                <div className="text-[11px] text-muted-foreground">
                  {vendor.contact_phone}                </div>

              </div>


            </div>

          </CardContent>

        </Card>

        {/* Vendor Score */}
        <Card className="rounded-xl border shadow-none">
          <CardHeader className="py-3 px-4 flex-row items-center justify-between border-b">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><ChartNoAxesColumnIncreasing className="h-3.5 w-3.5" /></span>
              Vendor Score Breakdown
            </CardTitle>

            <Badge className="text-[11px] px-2 py-0.5">
              {perfScore ? `${perfScore}/100` : "Not scored"}
            </Badge>
          </CardHeader>

          <CardContent className="p-4 space-y-3">

            {[
              {
                label: "Quality & Delivery",
                value: dash.score_breakdown?.quality_delivery ?? 0,
              },
              {
                label: "Pricing & Value",
                value: dash.score_breakdown?.pricing_value ?? 0,
              },
              {
                label: "Compliance",
                value: dash.score_breakdown?.compliance ?? 0,
              },
              {
                label: "Communication",
                value: dash.score_breakdown?.communication ?? 0,
              },
              {
                label: "Financial Stability",
                value: dash.score_breakdown?.financial_stability ?? 0,
              },
            ].map(item => (

              <div key={item.label} className="flex items-center gap-3">

                <span className="w-32 text-[12px] text-muted-foreground">
                  {item.label}
                </span>

                <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${item.value}%` }}
                  />
                </div>

                <span className="text-[12px] font-semibold w-5 text-right text-red-600">
                  {item.value}
                </span>

              </div>

            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

export default function VendorDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const router = useRouter()

  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTabKey, setActiveTabKey] = useState<'overview' | 'documents' | 'approval'>('overview')

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/`)).data,
  })

  const { data: dash, isLoading: dashLoading, } = useQuery({
    queryKey: ['vendor-dashboard', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/dashboard/`)).data,
  })

  const { data: vendorDocs = [] } = useQuery({
    queryKey: ['vendor-docs', id],
    queryFn: async () => { const r = await apiClient.get(`/vendors/${id}/documents/`); return r.data.results ?? r.data },
    enabled: activeTabKey === 'documents',
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

  const validateCompliancePairs = (): boolean => {
    const errs: Record<string, string> = {}
    // Documents are optional. Only these fields are mandatory.
    if (!docFields.gst_number) errs['field_gst_number'] = 'GST Number is required'
    if (!docFields.pan_number) errs['field_pan_number'] = 'PAN Number is required'

    const bankMissing = !docFields.bank_account || !docFields.bank_ifsc || !docFields.bank_name
    if (bankMissing) errs['field_bank_account'] = 'Bank Name, Account No and IFSC Code are required'
    return Object.keys(errs).length === 0
  }

  const saveDocChanges = async () => {
    if (!validateCompliancePairs()) return

    setSavingDocs(true)

    try {
      await apiClient.patch(`/vendors/${id}/`, docFields)

      queryClient.invalidateQueries({ queryKey: ['vendor', id] })

      toast({
        title: 'Documents saved.'
      })

      setIsEditing(false)
    } catch (err: any) {
      const errors = err?.response?.data

      const message =
        typeof errors === 'object'
          ? Object.values(errors).flat().join('\n')
          : errors?.error || 'Please try again.'

      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSavingDocs(false)
    }
  }


  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!vendor) return <div className="p-8 text-center text-muted-foreground">Vendor not found.</div>

  const canFullEdit = vendor.status === 'draft'
  const canUploadDoc = ['draft', 'pending_approval', 'approved'].includes(vendor.status)
  const isLocked = ['rejected', 'blocked'].includes(vendor.status)

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    { key: 'approval', label: 'Approval' },
  ]
  return (
    <>
      {isEditing ? <EditVendorPage setIsEditing={setIsEditing} vendorStatus={vendor?.status}/> : <div className="space-y-3 w-full min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white p-[22px]">

          {/* Top */}
          <div className="flex justify-between items-start gap-4">

            {/* Left */}
            <div className="flex items-center gap-[14px]">

              {/* Avatar */}
              <div className="w-[52px] h-[52px] rounded-[12px] bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <span className="text-[17px] font-bold">
                  {(vendor.company_name ?? '?')[0].toUpperCase()}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[19px] font-semibold tracking-[-0.4px]">{vendor.company_name}</h1>
                  <StatusBadge status={vendor.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-[13px] text-[#5a5a57]">

                  <div className="flex items-center gap-1">
                    <MapPin className="w-[13px] h-[13px]" />
                    <span>
                      {vendor.city}, {vendor.state}
                    </span>
                  </div>

                </div>
              </div>
            </div>


            {/* Actions */}
            <div className="flex gap-2">
              {canFullEdit && (
                <Button variant="outline" size="sm" className="text-[13px]" onClick={() => setIsEditing(true)}>
                  <Pencil className="w-[14px] h-[14px] mr-1" />
                  Edit
                </Button>
              )}
              {canUploadDoc && !canFullEdit && (
                <Button variant="outline" size="sm" className="text-[13px]" onClick={() => setIsEditing(true)}>
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
          </div>


          {/* Divider */}
          <div className="border-t border-[rgba(0,0,0,0.08)] my-[18px]" />


          {/* Bottom stats */}
          <div className="grid grid-cols-6">

            {[
              ['Vendor ID', vendor.vendor_code],
              [
                'Plant/ Category',
                [vendor?.plant_name, vendor?.category_name].filter(Boolean).join(' / ') || '—',
              ],
              ['GSTIN', vendor.gst_number],
              ['PAN', vendor.pan_number],
              ['Created At', formatDate(vendor.created_at)],
              ['Vendor Score', dash?.performance_score],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`${index !== 0 ? 'border-l border-[rgba(0,0,0,0.08)] pl-[18px]' : ''}`}
              >
                <p className="text-[11px] uppercase font-semibold tracking-[0.4px] text-[#9a9a96] mb-1">
                  {label}
                </p>

                <p
                  className={`
          text-[13px] font-medium
          ${label === 'GSTIN' || label === 'PAN'
                      ? 'font-mono text-[#5a5a57]'
                      : 'text-[#1a1a18]'
                    }
        `}
                >
                  {value}
                </p>
              </div>
            ))}

          </div>

        </div>
        {/* Tabs */}
        <div className="flex w-full border border-[rgba(0,0,0,0.08)] rounded-t-xl overflow-hidden bg-white mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTabKey(tab.key as 'overview' | 'documents' | 'approval')
                setIsEditing(false)
              }}
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
              {tab.key === 'overview' && (
                <LayoutDashboard className="w-[14px] h-[14px]" />
              )}

              {tab.key === 'documents' && (
                <FileText className="w-[14px] h-[14px]" />
              )}

              {tab.key === 'approval' && (
                <ShieldCheck className="w-[14px] h-[14px]" />
              )}

              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {/* Overview Tab */}
        {activeTabKey === 'overview' && <VendorDashboard vendorId={id} vendor={vendor} dash={dash} isLoading={dashLoading} />}



        {/* Documents Tab */}
        {activeTabKey === 'documents' && (
          <div className="space-y-4">

            {/* Upload button — reuse edit form (starts at compliance step) */}
            {canUploadDoc && canFullEdit &&  (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="text-[13px]" onClick={() => setIsEditing(true)}>
                  <FileText className="w-[14px] h-[14px] mr-1" />
                  Upload Documents
                </Button>
              </div>
            )}

            {/* Locked notice — rejected / blocked */}
            {isLocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-[13px] text-red-700">
                <XCircle className="h-4 w-4 shrink-0" />
                This vendor is <strong>{vendor.status}</strong>. Document uploads are disabled.
              </div>
            )}

            {/* Documents table */}
            {vendorDocs.length === 0 ? (
              <div className="rounded-xl border bg-white p-10 text-center text-[13px] text-muted-foreground">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-[13px] font-semibold uppercase text-left text-muted-foreground">Document</th>
                      <th className="px-4 py-2.5 text-[13px] font-semibold uppercase text-left text-muted-foreground">Type</th>
                      <th className="px-4 py-2.5 text-[13px] font-semibold uppercase text-left text-muted-foreground">Uploaded</th>
                      <th className="px-4 py-2.5 text-[13px] font-semibold uppercase text-center text-muted-foreground">AI Status</th>
                      <th className="px-4 py-2.5 text-[13px] font-semibold uppercase text-center text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorDocs.map((doc: any) => {
                      const isVerified = doc.ai_validation_status === 'passed' || doc.ai_validation_status === 'valid'
                      const isFailed = doc.ai_validation_status === 'failed' || doc.ai_validation_status === 'invalid'
                      const docLabel = (doc.doc_type ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      return (
                        <tr key={doc.id ?? doc.hash_id} className="border-t hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                                <FileText className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <span className="font-medium text-[13px] max-w-[200px] truncate">{doc.original_filename || doc.title || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-[13px]">{docLabel}</td>
                          <td className="px-4 py-3 text-muted-foreground text-[13px]">
                            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center ">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[13px] font-semibold ${isVerified ? 'bg-green-100 text-green-700' :
                              isFailed ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                              {isVerified ? 'Verified' : isFailed ? 'Failed' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-[13px]">
                            {doc.file_url ? (
                              <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[13px] text-blue-600 hover:underline font-medium">View</a>
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
                  queryClient.invalidateQueries({ queryKey: ['vendor', id] })
                  router.push(`/vendors`)
                }}
              />
            )}
          </div>
        )}

      </div>}
    </>

  )
}
