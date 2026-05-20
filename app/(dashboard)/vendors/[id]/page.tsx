'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { ArrowLeft, ExternalLink, Trash2, Upload, FileText, Loader2, CheckCircle, XCircle, Clock, SendHorizonal, Pencil, X, ChevronDown, ChevronRight, Plus, TrendingUp, TrendingDown, ShoppingCart, Star, AlertTriangle, Shield, DollarSign, BarChart3, Award, Zap, Lightbulb, Package, Download, ChevronLeft, MapPin, LayoutDashboard, ShieldCheck, FolderOpen, History, CheckCircle2, FileBadge, CreditCard, Landmark, Building2, BadgeCheck, User, ChartNoAxesColumnIncreasing } from 'lucide-react'
import { formatDate, formatDateTime, getSLAPercentage, getSLAColor, formatCurrency, DOC_CONFIG, ALPHANUM_WITH_SPACES, DIGITS_ONLY, PINCODE_DIGITS_ONLY } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import {
  AreaChart, Area, LineChart, Line,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import VendorAnalysisPanel from '../components/VendorAnalysisPanel'
import EditVendorPage from '../components/Editvendorpage'
import { Progress } from '@/components/ui/progress'


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
        <CardHeader className="pb-4 ">
          {/* <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Approval Matrix</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Choose the approval workflow for this budget request.</p> */}
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

// ─── VendorDashboard — matches reference exactly ──────────────────────────────
function VendorDashboard({ vendorId, vendor,dash,isLoading }: { vendorId: string | string[]; vendor: any, dash:any , isLoading:boolean}) {

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>


  if (!dash) return null

  const stats = dash?.stats ?? {}
  const transactions: any[] = dash?.recent_transactions ?? []
  const perfScore = dash?.performance_score != null ? Math.round(Number(dash.performance_score))
    : vendor.performance_score != null ? Math.round(Number(vendor.performance_score))
      : null
  const riskScore = dash.risk_score != null ? Math.round(Number(dash.risk_score))
    : vendor.risk_score != null ? Math.round(Number(vendor.risk_score))
      : null


  return (
    <div className="grid grid-cols-1 xl:grid-cols-[70%_30%] gap-4">      {/* LEFT */}
      <div className="space-y-4">

        {/* Vendor Score */}
        <Card className="rounded-xl border shadow-none">
          <CardHeader className="py-3 px-4 flex-row items-center justify-between border-b">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><ChartNoAxesColumnIncreasing className="h-3.5 w-3.5" /></span>
              Vendor Score Breakdown
            </CardTitle>

            <Badge className="text-[10px] px-2 py-0.5">
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
              {
                label: 'GST Certificate',
                value: vendor.gst_number,
                icon: FileBadge,
                bg: 'bg-blue-100',
                color: 'text-blue-700',
                empty: 'Missing',
                mono: true
              },

              {
                label: 'PAN Card',
                value: vendor.pan_number,
                icon: CreditCard,
                bg: 'bg-green-100',
                color: 'text-green-700',
                empty: 'Missing',
                mono: true
              },

              {
                label: 'Bank Verification',
                value: vendor.bank_account
                  ? `XXXX ${vendor.bank_account.slice(-4)}`
                  : null,
                icon: Landmark,
                bg: 'bg-purple-100',
                color: 'text-purple-700',
                empty: 'Not provided',
                mono: true
              },

              {
                label: 'MSME Registration',
                value: vendor.msme_number,
                icon: BadgeCheck,
                bg: 'bg-green-100',
                color: 'text-green-700',
                empty: 'Not registered'
              },

              {
                label: 'SEZ Unit',
                value: vendor.sez_number,
                icon: Building2,
                bg: 'bg-purple-100',
                color: 'text-purple-700',
                empty: 'Not registered'
              },

              {
                label: 'ISO Certificate',
                value: vendor.iso_type,
                icon: Award,
                bg: 'bg-amber-100',
                color: 'text-amber-700',
                empty: 'Not certified'
              }

            ].map(item => {
              const hasValue = !!item.value
              const Icon = item.icon

              return (

                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-2 border-b last:border-0"
                >

                  {/* Left */}
                  <div className="flex items-center gap-2">

                    <div
                      className={`h-6 w-6 rounded-md flex items-center justify-center ${item.bg}`}
                    >
                      <Icon
                        className={`h-3 w-3 ${item.color}`}
                      />
                    </div>

                    <span className="text-[11px] font-medium">
                      {item.label}
                    </span>

                  </div>


                  {/* Right */}
                  <div
                    className={`
          flex items-center gap-1 text-[10px] font-medium
          ${hasValue
                        ? 'text-green-700'
                        : 'text-red-600'
                      }
        `}
                  >

                    {hasValue ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 shrink-0" />

                        <span className={item.mono ? 'font-mono' : ''}>
                          {item.value}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 shrink-0" />

                        <span>
                          {item.empty}
                        </span>
                      </>
                    )}

                  </div>

                </div>

              )
            })}

          </CardContent>

        </Card>


        {/* Purchase Orders */}
        <Card>
          <CardHeader className="py-3 px-4 border-b">

            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <span><ShoppingCart className="h-3.5 w-3.5" /></span>
              Recent Purchase Orders
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">

            <table className="w-full text-[12px]">

              <thead className="bg-slate-50">

                <tr>

                  <th className="px-4 py-2 text-[11px] uppercase text-left">
                    PO Number
                  </th>

                  <th className="px-4 py-2 text-[11px] uppercase text-left">
                    Description
                  </th>

                  <th className="px-4 py-2 text-[11px] uppercase">
                    Amount
                  </th>

                  <th className="px-4 py-2 text-[11px] uppercase">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody>

                {transactions.length ? (
                  transactions.map(tx => (

                    <tr key={tx.id} className="border-t">

                      <td className="px-4 py-3">
                        {tx.po_number}
                      </td>

                      <td className="px-4 py-3">
                        {tx.description}
                      </td>

                      <td className="px-4 py-3">
                        {formatCurrency(tx.amount)}
                      </td>

                      <td className="px-4 py-3">
                        {tx.status}
                      </td>

                    </tr>

                  ))
                ) : (

                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-[12px] text-muted-foreground"
                    >
                      No purchase orders yet
                    </td>
                  </tr>

                )}

              </tbody>

            </table>

          </CardContent>
        </Card>

      </div>



      {/* RIGHT SIDEBAR */}
      <div className="space-y-4">

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
                  ? "bg-red-100 text-red-700 text-[11px] px-2 py-0.5"
                  : dash.risk_level === "Medium"
                    ? "bg-orange-100 text-orange-700 text-[11px] px-2 py-0.5"
                    : "bg-green-100 text-green-700 text-[11px] px-2 py-0.5"
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
  const { toast } = useToast()
  const router = useRouter()

  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [activeTabKey, setActiveTabKey] = useState<'overview' | 'details' | 'documents' | 'approval'>('overview')

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/`)).data,
  })

  const { data: dash,  isLoading: dashLoading,} = useQuery({
    queryKey: ['vendor-dashboard', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/dashboard/`)).data,
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
    const errs: Record<string, string> = {}
    // Documents are optional. Only these fields are mandatory.
    if (!docFields.gst_number) errs['field_gst_number'] = 'GST Number is required'
    if (!docFields.pan_number) errs['field_pan_number'] = 'PAN Number is required'

    const bankMissing = !docFields.bank_account || !docFields.bank_ifsc || !docFields.bank_name
    if (bankMissing) errs['field_bank_account'] = 'Bank Name, Account No and IFSC Code are required'
    setComplianceErrors(errs)
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

  const canEdit = ['draft', 'pending_approval'].includes(vendor.status)
  const tabs = [
    {
      key: 'overview',
      label: 'Overview',
    },
    {
      key: 'approval',
      label: 'Approval',
    },
  ]
  return (
    <>
      {isEditing ? <EditVendorPage setIsEditing={setIsEditing} /> : <div className="space-y-3">
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
                <h1 className="text-[19px] font-semibold tracking-[-0.4px]">
                  {vendor.company_name}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-[13px] text-[#5a5a57]">

                  <div className="flex items-center gap-1">
                    <MapPin className="w-[13px] h-[13px]" />
                    <span>
                      {vendor.city}, {vendor.state}
                    </span>
                  </div>

                  <span className="text-[#9a9a96]">•</span>

                  <Badge
                    className="text-[11px] font-semibold rounded-full bg-green-100 text-green-700"
                  >
                    {vendor?.category_name ?? 'Uncategorized'}
                  </Badge>

                  <span className="text-[#9a9a96]">•</span>

                  {/* status color from component */}
                  <StatusBadge status={vendor.status} />

                  <span className="text-[#9a9a96]">•</span>

                  <Badge
                    className={`text-[11px] font-semibold rounded-full
            ${dash?.risk_level === 'High'
                        ? 'bg-red-100 text-red-700'
                        : dash?.risk_level === 'Medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : dash?.risk_level === 'Low'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                  >
                    {dash?.risk_level ?? 'Unknown'}
                  </Badge>

                </div>
              </div>
            </div>


            {/* Actions */}
            {vendor.status ==="draft" &&<div className="flex gap-2">

              <Button
                variant="outline"
                size="sm"
                className="text-[13px]"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-[14px] h-[14px] mr-1" />
                Edit
              </Button>

            </div>}
          </div>


          {/* Divider */}
          <div className="border-t border-[rgba(0,0,0,0.08)] my-[18px]" />


          {/* Bottom stats */}
          <div className="grid grid-cols-6">

            {[
              ['Vendor ID', vendor.vendor_code],
              ['Plant', vendor.plant_name ?? '—'],
              ['GSTIN', vendor.gst_number],
              ['PAN', vendor.pan_number],
              ['Registered', formatDate(vendor.created_at)],
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
                setActiveTabKey(tab.key as 'overview' | 'approval')
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
                  ? 'text-[#1a1a18] border-black bg-white'
                  : 'text-[#9a9a96] border-transparent hover:bg-[#f8f8f6] hover:text-[#1a1a18]'
                }
      `}
            >
              {tab.key === 'overview' && (
                <LayoutDashboard className="w-[14px] h-[14px]" />
              )}

              {tab.key === 'approval' && (
                <ShieldCheck className="w-[14px] h-[14px]" />
              )}

              {tab.key === 'activity' && (
                <History className="w-[14px] h-[14px]" />
              )}

              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {/* Overview Tab */}
        {activeTabKey === 'overview' && <VendorDashboard vendorId={id} vendor={vendor} dash={dash} isLoading={dashLoading}/>}

        {/* Details Tab */}
        {activeTabKey === 'details' && (
          <div className="space-y-4">
            {/* {isEditing ? (
            <EditDetailsForm
              vendor={vendor}
              categories={categories ?? []}
              plants={plants ?? []}
              onSave={data => editMutation.mutate(data)}
              onCancel={() => setIsEditing(false)}
              saving={editMutation.isPending}
            />
          ) : ( */}
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
            {/* )} */}
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
