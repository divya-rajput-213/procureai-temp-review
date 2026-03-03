'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/lib/stores/auth.store'
import {
  Loader2, ArrowLeft, CheckCircle, XCircle, PauseCircle,
  Clock, User, GitBranch, Package, FileText, Users,
  Building2, ExternalLink,
} from 'lucide-react'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// ─── Entity helpers ────────────────────────────────────────────────────────────

function EntityTypeIcon({ type }: { type: string }) {
  if (type === 'purchaserequisition') return <Package className="w-4 h-4 text-blue-500" />
  if (type === 'trackingid') return <FileText className="w-4 h-4 text-purple-500" />
  if (type === 'vendor') return <Users className="w-4 h-4 text-green-500" />
  return <Building2 className="w-4 h-4 text-muted-foreground" />
}

function entityTypeLabel(type: string): string {
  if (type === 'purchaserequisition') return 'Purchase Requisition'
  if (type === 'trackingid') return 'Budget / Tracking ID'
  if (type === 'vendor') return 'Vendor Onboarding'
  return type
}

// ─── Entity Detail components ─────────────────────────────────────────────────

function PRDetail({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
      <div>
        <span className="text-muted-foreground">PR Number</span>
        <p className="font-semibold text-sm mt-0.5">{d.pr_number}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Total Amount</span>
        <p className="font-bold text-sm mt-0.5 text-primary">{formatCurrency(d.total_amount)}</p>
      </div>
      {d.purchase_type && (
        <div>
          <span className="text-muted-foreground">Type</span>
          <p className="font-medium mt-0.5">{d.purchase_type}</p>
        </div>
      )}
      {d.plant_name && (
        <div>
          <span className="text-muted-foreground">Plant</span>
          <p className="font-medium mt-0.5">{d.plant_name}</p>
        </div>
      )}
      {d.department_name && (
        <div>
          <span className="text-muted-foreground">Department</span>
          <p className="font-medium mt-0.5">{d.department_name}</p>
        </div>
      )}
      <div>
        <span className="text-muted-foreground">Line Items</span>
        <p className="font-medium mt-0.5">{d.line_items_count} item{d.line_items_count === 1 ? '' : 's'}</p>
      </div>
      {d.created_by_name && (
        <div>
          <span className="text-muted-foreground">Requested By</span>
          <p className="font-medium mt-0.5">{d.created_by_name}</p>
        </div>
      )}
      {d.invited_vendor_names?.length > 0 && (
        <div className="col-span-2 sm:col-span-3">
          <span className="text-muted-foreground">Invited Vendors</span>
          <p className="font-medium mt-0.5">{d.invited_vendor_names.join(', ')}</p>
        </div>
      )}
      {d.description && (
        <div className="col-span-2 sm:col-span-3">
          <span className="text-muted-foreground">Description</span>
          <p className="mt-0.5 text-foreground">{d.description}</p>
        </div>
      )}
    </div>
  )
}

function BudgetDetail({ d }: { d: any }) {
  const PRIORITY_COLORS: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
      <div>
        <span className="text-muted-foreground">Tracking Code</span>
        <p className="font-semibold text-sm mt-0.5">{d.tracking_code}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Requested Amount</span>
        <p className="font-bold text-sm mt-0.5 text-primary">{formatCurrency(d.requested_amount)}</p>
      </div>
      {d.priority && (
        <div>
          <span className="text-muted-foreground">Priority</span>
          <p className="mt-0.5">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${PRIORITY_COLORS[d.priority] ?? 'bg-slate-100'}`}>
              {d.priority}
            </span>
          </p>
        </div>
      )}
      {d.plant_name && (
        <div>
          <span className="text-muted-foreground">Plant</span>
          <p className="font-medium mt-0.5">{d.plant_name}</p>
        </div>
      )}
      {d.department_name && (
        <div>
          <span className="text-muted-foreground">Department</span>
          <p className="font-medium mt-0.5">{d.department_name}</p>
        </div>
      )}
      {d.title && (
        <div className="col-span-2 sm:col-span-3">
          <span className="text-muted-foreground">Title</span>
          <p className="font-medium mt-0.5">{d.title}</p>
        </div>
      )}
      {d.description && (
        <div className="col-span-2 sm:col-span-3">
          <span className="text-muted-foreground">Description</span>
          <p className="mt-0.5 text-foreground">{d.description}</p>
        </div>
      )}
    </div>
  )
}

function VendorDetail({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
      <div>
        <span className="text-muted-foreground">Company</span>
        <p className="font-semibold text-sm mt-0.5">{d.company_name}</p>
      </div>
      {d.category_name && (
        <div>
          <span className="text-muted-foreground">Category</span>
          <p className="font-medium mt-0.5">{d.category_name}</p>
        </div>
      )}
      {d.registration_number && (
        <div>
          <span className="text-muted-foreground">Reg. Number</span>
          <p className="font-medium mt-0.5">{d.registration_number}</p>
        </div>
      )}
      {d.contact_email && (
        <div>
          <span className="text-muted-foreground">Email</span>
          <p className="font-medium mt-0.5">{d.contact_email}</p>
        </div>
      )}
      {d.contact_phone && (
        <div>
          <span className="text-muted-foreground">Phone</span>
          <p className="font-medium mt-0.5">{d.contact_phone}</p>
        </div>
      )}
      {d.address && (
        <div className="col-span-2 sm:col-span-3">
          <span className="text-muted-foreground">Address</span>
          <p className="mt-0.5 text-foreground">{d.address}</p>
        </div>
      )}
    </div>
  )
}

function EntityDetailPanel({ entityType, detail }: { entityType: string; detail: any }) {
  if (!detail || Object.keys(detail).length === 0) return null
  if (entityType === 'purchaserequisition') return <PRDetail d={detail} />
  if (entityType === 'trackingid') return <BudgetDetail d={detail} />
  if (entityType === 'vendor') return <VendorDetail d={detail} />
  return null
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function actionStatusClass(action: string) {
  if (action === 'approved') return 'bg-green-100 text-green-700'
  if (action === 'rejected') return 'bg-red-100 text-red-700'
  if (action === 'held') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

function ActionIcon({ action }: { action: string }) {
  if (action === 'approved') return <CheckCircle className="w-4 h-4 text-green-600" />
  if (action === 'rejected') return <XCircle className="w-4 h-4 text-red-600" />
  if (action === 'held') return <PauseCircle className="w-4 h-4 text-amber-500" />
  return <Clock className="w-4 h-4 text-slate-400" />
}

function requestStatusClass(status: string) {
  if (status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<string | null>(null)

  const id = params?.id as string

  const { data: request, isLoading, error } = useQuery({
    queryKey: ['approval-request', id],
    queryFn: async () => (await apiClient.get(`/approvals/requests/${id}/`)).data,
    enabled: !!id,
  })

  const myPendingAction = (request?.actions ?? []).find(
    (a: any) => a.action === 'pending' && a.approver === user?.id,
  )

  const processAction = async (action: string) => {
    if (!myPendingAction) return
    if ((action === 'rejected' || action === 'held') && !comments.trim()) {
      toast({ title: 'Comments required for Reject / Hold', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    setSubmittingAction(action)
    try {
      await apiClient.patch(`/approvals/actions/${myPendingAction.id}/`, { action, comments })
      const actionLabels: Record<string, string> = { approved: 'Approved', rejected: 'Rejected', held: 'Held' }
      toast({ title: `${actionLabels[action] ?? 'Done'} successfully.` })
      queryClient.invalidateQueries({ queryKey: ['approval-request', id] })
      queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
      setComments('')
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setSubmitting(false)
      setSubmittingAction(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="py-12 text-center text-muted-foreground space-y-2">
        <p>Approval request not found.</p>
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    )
  }

  const sortedActions = [...(request.actions ?? [])].sort(
    (a: any, b: any) => a.level_number - b.level_number,
  )
  const hasEntityDetail = request.entity_detail && Object.keys(request.entity_detail).length > 0

  return (
    <div className="space-y-4 ">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
 
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <EntityTypeIcon type={request.entity_type} />
            <Badge variant="secondary" className="capitalize text-xs">{entityTypeLabel(request.entity_type)}</Badge>
            <h1 className="text-lg font-semibold">{request.entity_label}</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {request.matrix_name} · Submitted {formatDateTime(request.created_at)}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${requestStatusClass(request.status)}`}>
          {request.status}
        </span>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* ── Entity Detail Card ── */}
      {hasEntityDetail && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <EntityTypeIcon type={request.entity_type} />
                {entityTypeLabel(request.entity_type)} Details
              </span>
              {request.entity_detail?.link && (
                <Link
                  href={request.entity_detail.link}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-normal"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EntityDetailPanel entityType={request.entity_type} detail={request.entity_detail} />
          </CardContent>
        </Card>
      )}

      {/* ── Action Panel for current user ── */}
      {myPendingAction && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Your Action Required — Level {myPendingAction.level_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="action-comments" className="text-xs font-medium">
                Comments <span className="text-muted-foreground">(required for Reject / Hold)</span>
              </label>
              <textarea
                id="action-comments"
                className="w-full border rounded-md p-2 text-sm resize-none h-24 bg-white"
                placeholder="Add your comments…"
                value={comments}
                onChange={e => setComments(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={() => processAction('approved')}
                disabled={submitting}
              >
                {submitting && submittingAction === 'approved'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1"
                onClick={() => processAction('rejected')}
                disabled={submitting || !comments.trim()}
              >
                {submitting && submittingAction === 'rejected'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <XCircle className="w-3.5 h-3.5" />}
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-amber-600 border-amber-300"
                onClick={() => processAction('held')}
                disabled={submitting || !comments.trim()}
              >
                {submitting && submittingAction === 'held'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <PauseCircle className="w-3.5 h-3.5" />}
                Hold
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Approval Timeline ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" /> Approval Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedActions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No approval actions yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {['Level', 'Approver / Role', 'Status', 'Date', 'Comments'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedActions.map((a: any) => (
                  <tr key={a.id} className={a.action === 'pending' ? 'bg-amber-50' : ''}>
                    <td className="px-4 py-3 font-medium text-xs">L{a.level_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <span className="text-sm font-medium">{a.approver_name || `User #${a.approver}`}</span>
                          {a.role_name && (
                            <p className="text-xs text-muted-foreground">{a.role_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ActionIcon action={a.action} />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${actionStatusClass(a.action)}`}>
                          {a.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.acted_at && formatDateTime(a.acted_at)}
                      {!a.acted_at && a.sla_deadline && <span className="text-amber-600">Due {formatDateTime(a.sla_deadline)}</span>}
                      {!a.acted_at && !a.sla_deadline && '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {a.comments || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
