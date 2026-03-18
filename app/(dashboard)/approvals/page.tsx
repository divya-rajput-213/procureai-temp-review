'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  Loader2, Clock, CheckCircle, XCircle, PauseCircle,
  X, Building2, Package, Users, ExternalLink, FileText, Search,
} from 'lucide-react'
import { formatDateTime, formatCurrency, getSLAPercentage, getSLAColor } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// ─── SLA Badge ────────────────────────────────────────────────────────────────

function SLABadge({ deadline }: { deadline: string }) {
  const pct = getSLAPercentage(deadline)
  const colorClass = getSLAColor(pct)
  const label = pct <= 0 ? 'SLA Breached' : `${Math.round(pct)}% remaining`
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
}

// ─── Entity Detail Panel ──────────────────────────────────────────────────────

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

function PRDetail({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
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
          <p className="mt-0.5 text-foreground cursor-pointer line-clamp-3">
            {d.description}
          </p>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
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

// ─── Pending Mine Card ────────────────────────────────────────────────────────

function PendingCard({
  item,
  isSelected,
  onSelect,
  onAction,
  onReleaseHold,
  submitting,
}: {
  item: any
  isSelected: boolean
  onSelect: () => void
  onAction: (action: string, comments: string) => void
  onReleaseHold: () => void
  submitting: boolean
}) {
  const [comments, setComments] = useState('')
  const hasValidComment = /[a-zA-Z0-9]/.test(comments);

  const [loadingAct, setLoadingAct] = useState('')
  const isHeld = item.action_status === 'held'

  const handle = async (act: string) => {
    setLoadingAct(act)
    await onAction(act, comments)
    setLoadingAct('')
    setComments('')
  }

  const busy = submitting || loadingAct !== ''
  const hasDetail = item.entity_detail && Object.keys(item.entity_detail).length > 0

  return (
    <Card
      className={`transition-shadow ${isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md cursor-pointer'}`}
      role="button"
      tabIndex={0}
      onClick={isSelected ? undefined : onSelect}
      onKeyDown={e => { if (!isSelected && (e.key === 'Enter' || e.key === ' ')) onSelect() }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <EntityTypeIcon type={item.entity_type} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{entityTypeLabel(item.entity_type)}</Badge>
                <span className="font-semibold text-sm">{item.entity_label}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDateTime(item.submitted_at)}
                </span>
                <span>
                  Level {item.level}
                  {item.approver_role && ` · ${item.approver_role}`}
                  {` · ${item.matrix_name}`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <SLABadge deadline={item.sla_deadline} />
            {item.entity_detail?.link && (
              <Link
                href={item.entity_detail.link}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                onClick={e => e.stopPropagation()}
              >
                View <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Entity details (always visible) */}
        {hasDetail && (
          <div className="bg-slate-50 border rounded-md p-3">
            <EntityDetailPanel entityType={item.entity_type} detail={item.entity_detail} />
          </div>
        )}

        {/* Action panel (when card is selected) */}
        {isSelected && (
          <div className="border-t pt-3 space-y-3" onClick={e => e.stopPropagation()}>
            {isHeld ? (
              <div className="flex gap-2 items-center">
                <p className="text-xs font-medium text-amber-700">This item is on hold.</p>
                <Button size="sm" variant="outline" className="gap-1" onClick={onReleaseHold} disabled={busy}>
                  <Clock className="w-3.5 h-3.5" /> Release Hold
                </Button>
                <Button size="sm" variant="ghost" onClick={onSelect} className="ml-auto">
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium">
                    Comments <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="mt-1 w-full border rounded-md p-2 text-sm resize-none h-20 bg-white"
                    placeholder="Add your comments…"
                    value={comments}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}

                    onChange={e => setComments(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 gap-1"
                    onClick={() => handle('approved')}
                    disabled={busy || !hasValidComment}
                  >
                    {loadingAct === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => handle('rejected')}
                    disabled={busy || !hasValidComment}
                  >
                    {loadingAct === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-amber-600 border-amber-300"
                    onClick={() => handle('held')}
                    disabled={busy || !hasValidComment}
                  >
                    {loadingAct === 'held' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                    Hold
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onSelect} className="ml-auto">
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Collapsed prompt when not selected */}
        {!isSelected && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            {isHeld ? 'On Hold — click to release' : 'Click to review and take action'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── History filter bar ───────────────────────────────────────────────────────

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'purchaserequisition', label: 'Purchase Requisition' },
  { value: 'trackingid', label: 'Budget / Tracking ID' },
  { value: 'vendor', label: 'Vendor Onboarding' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'held', label: 'Held' },
  { value: 'cancelled', label: 'Cancelled' },
]

function historyStatusBadge(status: string) {
  const map: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    held: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-slate-100 text-slate-500',
    pending: 'bg-blue-100 text-blue-700',
  }
  return map[status] ?? 'bg-slate-100 text-slate-600'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine')
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // All History filters
  const [histSearch, setHistSearch] = useState('')
  const [histStatus, setHistStatus] = useState('')
  const [histEntityType, setHistEntityType] = useState('')

  const { data: pendingMine, isLoading: loadingMine } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    refetchInterval: 60000,
  })

  const { data: allRequests, isLoading: loadingAll } = useQuery({
    queryKey: ['all-approval-requests', histStatus, histEntityType],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (histStatus) params.set('status', histStatus)
      if (histEntityType) params.set('entity_type', histEntityType)
      const r = await apiClient.get(`/approvals/requests/?${params.toString()}`)
      return r.data.results ?? r.data ?? []
    },
    enabled: activeTab === 'all',
  })

  const processAction = async (item: any, action: string, comments: string) => {
    setSubmitting(true)
    try {
      await apiClient.patch(`/approvals/actions/${item.action_id}/`, { action, comments })
      toast({ title: action === 'approved' ? 'Approved.' : action === 'rejected' ? 'Rejected.' : 'Held.' })
      setSelectedActionId(null)
      queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const releaseHold = async (item: any) => {
    setSubmitting(true)
    try {
      await apiClient.post(`/approvals/actions/${item.action_id}/release-hold/`)
      toast({ title: 'Hold released. You can now approve or reject.' })
      setSelectedActionId(null)
      queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    } catch (err: any) {
      toast({ title: 'Failed to release hold', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const pending: any[] = pendingMine || []
  const allRaw: any[] = allRequests || []

  // Client-side text search on entity label + matrix name
  const all = histSearch.trim()
    ? allRaw.filter(r =>
      r.entity_label?.toLowerCase().includes(histSearch.toLowerCase()) ||
      r.matrix_name?.toLowerCase().includes(histSearch.toLowerCase())
    )
    : allRaw

  const TABS: Array<['mine' | 'all', string]> = [
    ['mine', pending.length > 0 ? `Pending My Action (${pending.length})` : 'Pending My Action'],
    ['all', 'All History'],
  ]

  return (
    <div className="space-y-4">
      <div className="border-b flex gap-1">
        {TABS.map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Pending Mine ── */}
      {activeTab === 'mine' && (
        <div className="space-y-3">
          {loadingMine && (
            <div className="text-center py-8">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}
          {!loadingMine && pending.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">No items pending your approval.</p>
            </div>
          )}
          {!loadingMine && pending.map((item: any) => (
            <PendingCard
              key={item.action_id}
              item={item}
              isSelected={selectedActionId === item.action_id}
              onSelect={() => setSelectedActionId(prev => prev === item.action_id ? null : item.action_id)}
              onAction={(action, comments) => processAction(item, action, comments)}
              onReleaseHold={() => releaseHold(item)}
              submitting={submitting}
            />
          ))}
        </div>
      )}

      {/* ── All History ── */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search entity or matrix…"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              className="h-10 border rounded-md px-3 text-sm bg-background min-w-[160px]"
              value={histEntityType}
              onChange={e => setHistEntityType(e.target.value)}
            >
              {ENTITY_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="h-10 border rounded-md px-3 text-sm bg-background min-w-[140px]"
              value={histStatus}
              onChange={e => setHistStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {(histSearch || histStatus || histEntityType) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1"
                onClick={() => { setHistSearch(''); setHistStatus(''); setHistEntityType('') }}
              >
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loadingAll && (
                <div className="p-8 text-center">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
              {!loadingAll && all.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  {histSearch || histStatus || histEntityType
                    ? 'No results match your filters.'
                    : 'No approval history yet.'}
                </div>
              )}
              {!loadingAll && all.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Entity</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Due Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Acted At</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {all.map((req: any) => {
                        const latestAction = (req.actions ?? [])
                          .filter((a: any) => a.action !== 'pending')
                          .sort((a: any, b: any) => (b.acted_at ?? '').localeCompare(a.acted_at ?? ''))[0]
                        const currentAction = (req.actions ?? []).find((a: any) => a.level_number === req.current_level)
                        const slaDeadline = currentAction?.sla_deadline || (req.actions ?? [])[0]?.sla_deadline
                        return (
                          <tr
                            key={req.id}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/approvals/${req.hash_id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <EntityTypeIcon type={req.entity_type} />
                                <div className="min-w-0">
                                  <span className="font-medium truncate block max-w-[200px]">{req.entity_label}</span>
                                  <span className="text-xs text-muted-foreground">{entityTypeLabel(req.entity_type)}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${historyStatusBadge(req.status)}`}>
                                {req.status.replaceAll('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                              {slaDeadline ? formatDateTime(slaDeadline) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                              {latestAction?.acted_at ? formatDateTime(latestAction.acted_at) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px]">
                              <p className="truncate">{latestAction?.comments || '—'}</p>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                    {all.length} record{all.length === 1 ? '' : 's'}
                    {(histSearch || histStatus || histEntityType) && allRaw.length !== all.length
                      ? ` (filtered from ${allRaw.length})`
                      : ''}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
