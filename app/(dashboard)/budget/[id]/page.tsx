'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Send, Pencil, X,
  ChevronDown, ChevronRight, Plus, Trash2, Check,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime, getSLAPercentage, getSLAColor } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string
  item_name: string
  description: string
  qty: string
  uom: string
  unit_rate: string
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), item_name: '', description: '', qty: '1', uom: 'Nos', unit_rate: '0' }
}

// ─── Line Items Table (read-only) ──────────────────────────────────────────────

function LineItemsTable({ items }: { items: any[] }) {
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground italic py-2">No items added.</p>
  }

  const grandTotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_rate) || 0), 0)

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
            const total = (Number(item.qty) || 0) * (Number(item.unit_rate) || 0)
            return (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium">{item.item_name || '—'}</span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">{item.qty || '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.uom || '—'}</td>
                <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_rate)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(total)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total Estimated</td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Line Items Editor (edit mode) ────────────────────────────────────────────

function LineItemsEditor({ items, onChange }: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<LineItem | null>(null)

  const addItem = () => {
    const item = newLineItem()
    const next = [...items, item]
    onChange(next)
    setEditingId(item.id)
    setEditForm(item)
  }

  const startEdit = (item: LineItem) => {
    setEditingId(item.id)
    setEditForm({ ...item })
  }

  const saveEdit = () => {
    if (!editForm) return
    onChange(items.map(i => (i.id === editForm.id ? editForm : i)))
    setEditingId(null)
    setEditForm(null)
  }

  const cancelEdit = () => {
    // If item is empty (just added) and user cancels, remove it
    if (editForm && !editForm.item_name) {
      onChange(items.filter(i => i.id !== editForm.id))
    }
    setEditingId(null)
    setEditForm(null)
  }

  const deleteItem = (id: string) => {
    if (editingId === id) { setEditingId(null); setEditForm(null) }
    onChange(items.filter(i => i.id !== id))
  }

  const setF = (k: keyof LineItem, v: string) => {
    if (!editForm) return
    setEditForm({ ...editForm, [k]: v })
  }

  const grandTotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_rate) || 0), 0)

  return (
    <div className="space-y-2">
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium w-8">#</th>
              <th className="text-left px-3 py-2 font-medium">Item Name</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-2 py-2 font-medium w-20">Qty</th>
              <th className="text-left px-2 py-2 font-medium w-20">UOM</th>
              <th className="text-right px-2 py-2 font-medium w-28">Unit Rate</th>
              <th className="text-right px-3 py-2 font-medium w-28">Amount</th>
              <th className="px-2 py-2 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground italic">
                  No items yet. Click + Add Item below.
                </td>
              </tr>
            )}
            {items.map((item, idx) => {
              const isEditing = editingId === item.id

              if (isEditing && editForm) {
                const editTotal = (Number(editForm.qty) || 0) * (Number(editForm.unit_rate) || 0)
                return (
                  <tr key={item.id} className="bg-primary/5">
                    <td className="px-3 py-1.5 text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-1 py-1.5">
                      <Input value={editForm.item_name} onChange={e => setF('item_name', e.target.value)}
                        className="h-7 text-xs" placeholder="Item name *" />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input value={editForm.description} onChange={e => setF('description', e.target.value)}
                        className="h-7 text-xs" placeholder="Optional" />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input type="number" value={editForm.qty} onChange={e => setF('qty', e.target.value)}
                        className="h-7 text-xs text-right" min="0" />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input value={editForm.uom} onChange={e => setF('uom', e.target.value)}
                        className="h-7 text-xs" placeholder="Nos" />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input type="number" value={editForm.unit_rate} onChange={e => setF('unit_rate', e.target.value)}
                        className="h-7 text-xs text-right" min="0" step="0.01" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">{formatCurrency(editTotal)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button type="button" onClick={saveEdit}
                          className="text-green-600 hover:text-green-700 p-0.5 rounded hover:bg-green-50">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={cancelEdit}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }

              const rowTotal = (Number(item.qty) || 0) * (Number(item.unit_rate) || 0)
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{item.item_name || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.description || '—'}</td>
                  <td className="px-3 py-2.5 text-right">{item.qty}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.uom}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_rate)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(rowTotal)}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => startEdit(item)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t">
                <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                  Total Estimated
                </td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-7 text-xs">
        <Plus className="w-3.5 h-3.5" /> Add Item
      </Button>
    </div>
  )
}

// ─── Approval Timeline ─────────────────────────────────────────────────────────

function stepStyle(action: string) {
  if (action === 'approved') return { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' }
  if (action === 'rejected') return { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' }
  if (action === 'held')     return { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' }
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
                  <span className="text-xs text-muted-foreground ml-2">Level {a.level_number}</span>
                  {a.is_delegated && (
                    <span className="text-xs text-blue-500 ml-1">(delegated)</span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{label}</span>
              </div>
              {a.acted_at && (
                <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(a.acted_at)}</p>
              )}
              {a.action === 'pending' && a.sla_deadline && (
                <p className="text-xs text-amber-600 mt-0.5">Due: {formatDateTime(a.sla_deadline)}</p>
              )}
              {a.comments && (
                <p className="text-xs text-slate-500 mt-1 italic">"{a.comments}"</p>
              )}
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

  const handle = async (act: string) => {
    setLoading(act)
    await onProcess(act, comments)
    setLoading('')
    setComments('')
  }

  const busy = loading !== ''

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

function ApprovalProgressPanel({ budgetId, onStatusChange }: {
  budgetId: string | string[]
  onStatusChange: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: approvalRequest, isLoading } = useQuery({
    queryKey: ['budget-approval', budgetId],
    queryFn: async () => {
      const res = await apiClient.get('/approvals/requests/', {
        params: { entity_type: 'trackingid', object_id: budgetId },
      })
      const list: any[] = res.data.results ?? res.data
      return list.find(r => ['pending', 'in_progress'].includes(r.status)) ?? list[0] ?? null
    },
  })

  const { data: myPendingAction } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    select: (data: any[]) =>
      data.find(a => a.entity_type === 'trackingid' && String(a.object_id) === String(budgetId)),
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['budget', budgetId] })
    queryClient.invalidateQueries({ queryKey: ['budget-approval', budgetId] })
    queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    onStatusChange()
  }

  const processAction = async (action: string, comments: string) => {
    if (!myPendingAction) return
    try {
      await apiClient.patch(`/approvals/actions/${myPendingAction.action_id}/`, { action, comments })
      toast({ title: action === 'approved' ? 'Approved successfully.' : action === 'rejected' ? 'Rejected.' : 'Held.' })
      invalidateAll()
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.response?.data?.error, variant: 'destructive' })
    }
  }

  const pct = myPendingAction ? getSLAPercentage(myPendingAction.sla_deadline) : 100
  const slaLabel = pct <= 0 ? 'SLA Breached' : `SLA: ${Math.round(pct)}% remaining`
  const reqStatus = approvalRequest?.status

  let levelLabel = 'Pending Approval'
  if (isLoading) levelLabel = 'Loading…'
  else if (reqStatus === 'approved') levelLabel = 'Fully Approved'
  else if (reqStatus === 'rejected') levelLabel = 'Rejected'
  else if (approvalRequest) levelLabel = `In Progress — Level ${approvalRequest.current_level}`

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
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${headerBg}`}>
        <div className="flex items-center gap-2">
          {StatusIcon}
          <span className={`text-sm font-medium ${headerText}`}>{levelLabel}</span>
          {approvalRequest && (
            <span className={`text-xs ${headerSub}`}>via {approvalRequest.matrix_name}</span>
          )}
        </div>
        {myPendingAction && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSLAColor(pct)}`}>{slaLabel}</span>
        )}
      </div>

      {/* Timeline */}
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
    </div>
  )
}

// ─── Matrix Selector ───────────────────────────────────────────────────────────

function MatrixSelectorTable({ matrices, selectedMatrix, expandedMatrix, onSelect, onToggleExpand }: {
  matrices: any[]
  selectedMatrix: number | null
  expandedMatrix: number | null
  onSelect: (id: number) => void
  onToggleExpand: (id: number) => void
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="w-8 px-3 py-2" />
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Matrix Name</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Plant</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Levels</th>
            <th className="w-8 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {matrices.map((m: any) => {
            const levelCount: number = m.levels?.length ?? 0
            const isSelected = selectedMatrix === m.id
            const isExpanded = expandedMatrix === m.id
            return (
              <>
                <tr
                  key={m.id}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                  onClick={() => onSelect(m.id)}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input type="radio" name="budget-matrix" checked={isSelected}
                      onChange={() => onSelect(m.id)} className="accent-primary"
                      onClick={e => e.stopPropagation()} />
                  </td>
                  <td className="px-3 py-2.5 font-medium">{m.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.plant_name || 'All Plants'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{levelCount} level{levelCount === 1 ? '' : 's'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button type="button"
                      onClick={e => { e.stopPropagation(); onToggleExpand(m.id) }}
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
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1 pr-4 font-medium">Level</th>
                              <th className="text-left py-1 pr-4 font-medium">Approver</th>
                              <th className="text-left py-1 pr-4 font-medium">Role</th>
                              <th className="text-left py-1 font-medium">SLA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {m.levels.map((lv: any) => (
                              <tr key={lv.id}>
                                <td className="py-1.5 pr-4 text-muted-foreground">L{lv.level_number}</td>
                                <td className="py-1.5 pr-4 font-medium">{lv.user_name ?? '—'}</td>
                                <td className="py-1.5 pr-4 text-muted-foreground">{lv.role_name ?? '—'}</td>
                                <td className="py-1.5 text-muted-foreground">{lv.sla_hours ? `${lv.sla_hours}h` : '—'}</td>
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
  )
}

// ─── Submit for Approval Panel ─────────────────────────────────────────────────

function SubmitForApprovalPanel({ budgetId, onSuccess }: {
  budgetId: string | string[]
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'budget_approval'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'budget_approval', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
  })

  const handleSelect = (id: number) => { setSelectedMatrix(id); setExpandedMatrix(id) }
  const handleToggle = (id: number) => setExpandedMatrix(prev => (prev === id ? null : id))

  const submit = async () => {
    setSubmitting(true)
    try {
      const body: Record<string, any> = {}
      if (selectedMatrix) body.matrix_id = selectedMatrix
      await apiClient.post(`/budget/tracking-ids/${budgetId}/submit-for-approval/`, body)
      toast({ title: 'Submitted for approval. Approvers have been notified.' })
      onSuccess()
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const matrixCount = matrices?.length ?? 0
  const canSubmit = !submitting && (matrixCount === 0 || selectedMatrix !== null)

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Select an approval matrix to route this request.</p>
      {!matrices && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
        </div>
      )}
      {matrices && matrices.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          No active budget approval matrices found.
        </p>
      )}
      {matrices && matrices.length > 0 && (
        <MatrixSelectorTable
          matrices={matrices}
          selectedMatrix={selectedMatrix}
          expandedMatrix={expandedMatrix}
          onSelect={handleSelect}
          onToggleExpand={handleToggle}
        />
      )}
      <Button onClick={submit} disabled={!canSubmit} className="gap-1.5 w-full">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit for Approval
      </Button>
    </div>
  )
}

// ─── Preferred Vendors Card ────────────────────────────────────────────────────

function vendorStatusCls(status: string): string {
  if (status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function PreferredVendorsCard({ vendors }: { vendors: any[] }) {
  const [search, setSearch] = useState('')
  if (!vendors?.length) return null

  const filtered = search.trim()
    ? vendors.filter(v =>
        v.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.category_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.city?.toLowerCase().includes(search.toLowerCase())
      )
    : vendors

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm">Preferred Vendors ({vendors.length})</CardTitle>
          {vendors.length > 3 && (
            <input
              type="text"
              placeholder="Search vendors…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 border rounded-md px-2 text-xs w-48 bg-background"
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No vendors match.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v: any) => (
            <div key={v.id} className="border rounded-lg p-3 space-y-1.5 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{v.company_name}</p>
                {v.status && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${vendorStatusCls(v.status)}`}>
                    {v.status.replaceAll('_', ' ')}
                  </span>
                )}
              </div>
              {v.category_name && (
                <p className="text-xs text-muted-foreground">{v.category_name}</p>
              )}
              {(v.city || v.state) && (
                <p className="text-xs text-muted-foreground">
                  {[v.city, v.state].filter(Boolean).join(', ')}
                </p>
              )}
              {v.contact_email && (
                <p className="text-xs text-slate-500 truncate">{v.contact_email}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Edit Budget Form ──────────────────────────────────────────────────────────

function EditBudgetForm({ budget, plants, departments, onSave, onCancel, saving }: {
  budget: any
  plants: any[]
  departments: any[]
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    title: budget.title ?? '',
    description: budget.description ?? '',
    justification: budget.justification ?? '',
    requested_amount: budget.requested_amount ?? '',
    priority: budget.priority ?? 'medium',
    plant: budget.plant ?? '',
    department: budget.department ?? '',
  })
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const [selectedVendors, setSelectedVendors] = useState<any[]>(budget.preferred_vendors ?? [])
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorSearch, setShowVendorSearch] = useState(false)

  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved-edit', vendorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (vendorSearch) params.set('search', vendorSearch)
      const r = await apiClient.get(`/vendors/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: showVendorSearch,
  })

  const addVendor = (v: any) => {
    if (!selectedVendors.some((x: any) => x.id === v.id)) {
      setSelectedVendors(prev => [...prev, v])
    }
    setShowVendorSearch(false)
    setVendorSearch('')
  }
  const removeVendor = (id: number) => setSelectedVendors(prev => prev.filter((v: any) => v.id !== id))

  const PRIORITY_OPTS = [
    { value: 'low',    label: 'Low',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    { value: 'medium', label: 'Medium', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'high',   label: 'High',   cls: 'bg-red-100 text-red-700 border-red-200' },
  ]

  const handleSave = () => {
    onSave({ ...form, preferred_vendor_ids: selectedVendors.map((v: any) => v.id) })
  }

  return (
    <div className="space-y-5">
      {/* Basic Fields */}
      <div className="space-y-1">
        <Label className="text-xs">Title *</Label>
        <Input value={form.title} onChange={e => set('title', e.target.value)} className="h-8 text-sm" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Priority</Label>
        <div className="flex gap-2 max-w-xs">
          {PRIORITY_OPTS.map(p => {
            const sel = form.priority === p.value
            return (
              <label key={p.value}
                className={`flex-1 border rounded-lg px-2 py-2 cursor-pointer text-center text-xs font-medium transition-all
                  ${sel ? `${p.cls} border-current` : 'border-slate-200 text-muted-foreground hover:border-slate-300'}`}>
                <input type="radio" value={p.value} checked={sel}
                  onChange={() => set('priority', p.value)} className="sr-only" />
                {p.label}
              </label>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Plant</Label>
          <select className="w-full h-8 border rounded-md px-3 text-sm bg-background"
            value={form.plant} onChange={e => set('plant', e.target.value ? Number(e.target.value) : '')}>
            <option value="">— none —</option>
            {plants.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Department</Label>
          <select className="w-full h-8 border rounded-md px-3 text-sm bg-background"
            value={form.department} onChange={e => set('department', e.target.value ? Number(e.target.value) : '')}>
            <option value="">— none —</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Description *</Label>
        <Input value={form.description} onChange={e => set('description', e.target.value)} className="h-8 text-sm" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Detailed Requirements</Label>
        <textarea className="w-full border rounded-md p-2 text-sm resize-none h-20"
          value={form.justification} onChange={e => set('justification', e.target.value)}
          placeholder="Specifications, justification…" />
      </div>

      <div className="space-y-1 max-w-xs">
        <Label className="text-xs">Estimated Budget (₹)</Label>
        <Input type="number" step="0.01" value={form.requested_amount}
          onChange={e => set('requested_amount', e.target.value)} className="h-8 text-sm" />
      </div>

      {/* Preferred Vendors */}
      <div className="space-y-2">
        <Label className="text-xs">Preferred Vendors</Label>
        <div className="relative">
          <Input
            placeholder="Search approved vendors..."
            value={vendorSearch}
            onChange={e => { setVendorSearch(e.target.value); setShowVendorSearch(true) }}
            onFocus={() => setShowVendorSearch(true)}
            onBlur={() => setTimeout(() => setShowVendorSearch(false), 150)}
            className="h-8 text-sm"
          />
          {showVendorSearch && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-md bg-background shadow-md max-h-48 overflow-y-auto divide-y">
              {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                  onClick={() => addVendor(v)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.company_name}</span>
                    <span className="text-xs text-muted-foreground">{v.status}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    {v.category_name && <span>{v.category_name}</span>}
                    {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                  </div>
                </button>
              ))}
              {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).length === 0 && vendorSearch && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No vendors found.</p>
              )}
            </div>
          )}
        </div>
        {selectedVendors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedVendors.map((v: any) => (
              <div key={v.id} className="relative border rounded-lg p-2.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => removeVendor(v.id)}
                  className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="font-medium text-xs pr-4">{v.company_name}</p>
                {v.category_name && <p className="text-xs text-muted-foreground">{v.category_name}</p>}
                {v.city && (
                  <p className="text-xs text-muted-foreground">{v.city}{v.state ? `, ${v.state}` : ''}</p>
                )}
              </div>
            ))}
          </div>
        )}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BudgetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'approval'>('details')

  const { data: budget, isLoading } = useQuery({
    queryKey: ['budget', id],
    queryFn: async () => (await apiClient.get(`/budget/tracking-ids/${id}/`)).data,
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

  const editMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const payload = { ...data }
      if (!payload.plant) payload.plant = null
      if (!payload.department) payload.department = null
      if (payload.requested_amount) payload.requested_amount = Number(payload.requested_amount)
      return (await apiClient.patch(`/budget/tracking-ids/${id}/`, payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', id] })
      toast({ title: 'Budget details updated.' })
      setIsEditing(false)
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err?.response?.data?.error ?? 'Update failed.', variant: 'destructive' })
    },
  })

  if (isLoading) return (
    <div className="p-8 text-center text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…
    </div>
  )
  if (!budget) return <div className="p-8 text-center text-muted-foreground">Budget not found.</div>

  const isDraft = budget.status === 'draft'

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/budget')} className="gap-1 shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{budget.tracking_code}</span>
              <StatusBadge status={budget.status} />
              {budget.priority && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[budget.priority] ?? PRIORITY_COLORS.medium}`}>
                  {budget.priority}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold mt-0.5">{budget.title || budget.description}</h1>
          </div>
        </div>

        {isDraft && !isEditing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button size="sm" onClick={() => setShowSubmitModal(true)} className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Submit for Approval
            </Button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="border-b flex gap-1">
        {(['details', 'approval'] as const).map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setIsEditing(false) }}
            className={`px-4 py-2 text-sm capitalize font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {isEditing ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">Edit Budget Details</CardTitle></CardHeader>
              <CardContent>
                <EditBudgetForm
                  budget={budget}
                  plants={plants ?? []}
                  departments={departments ?? []}
                  onSave={data => editMutation.mutate(data)}
                  onCancel={() => setIsEditing(false)}
                  saving={editMutation.isPending}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Info cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Budget Details</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {[
                      ['Plant', budget.plant_name || '—'],
                      ['Department', budget.department_name || '—'],
                      ['Purchase Type', budget.purchase_type || '—'],
                      ['Requested Amount', formatCurrency(budget.requested_amount)],
                      ['Approved Amount', budget.approved_amount ? formatCurrency(budget.approved_amount) : '—'],
                      ['Created', formatDate(budget.created_at)],
                      ['Requested By', budget.requested_by_name || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">{label}</span>
                        <span className="font-medium text-right">{value}</span>
                      </div>
                    ))}
                    {budget.remaining_amount !== null && budget.remaining_amount !== undefined && (
                      <div className="flex justify-between gap-2 border-t pt-2 mt-1">
                        <span className="text-muted-foreground shrink-0">Remaining</span>
                        <span className={`font-semibold ${Number(budget.remaining_amount) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {formatCurrency(budget.remaining_amount)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Requirements</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p>{budget.description || '—'}</p>
                    </div>
                    {budget.justification && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Detailed Requirements</p>
                        <p className="whitespace-pre-wrap">{budget.justification}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <PreferredVendorsCard vendors={budget.preferred_vendors ?? []} />
            </>
          )}
        </div>
      )}

      {/* ── Approval Tab ── */}
      {activeTab === 'approval' && (
        <div>
          {isDraft ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground space-y-1">
              <Clock className="w-5 h-5 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-medium">No approval in progress</p>
              <p className="text-xs">Click Submit for Approval to start the workflow.</p>
            </div>
          ) : (
            <ApprovalProgressPanel
              budgetId={id}
              onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['budget', id] })}
            />
          )}
        </div>
      )}

      {/* ── Submit for Approval Modal ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close"
            onClick={() => setShowSubmitModal(false)} />
          <Card className="relative z-10 w-full max-w-lg">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Submit for Approval</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSubmitModal(false)} className="h-7 w-7 p-0">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <SubmitForApprovalPanel
                budgetId={id}
                onSuccess={() => {
                  setShowSubmitModal(false)
                  setActiveTab('approval')
                  queryClient.invalidateQueries({ queryKey: ['budget', id] })
                  queryClient.invalidateQueries({ queryKey: ['budget-approval', id] })
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
