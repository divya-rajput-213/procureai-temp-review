'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { useSettingsStore } from '@/lib/stores/settings.store'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Send, Pencil, X,
  Plus, Trash2, Check, Save,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime, getSLAPercentage, getSLAColor } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

const PRIORITY_OPTS = [
  { value: 'low',    label: 'Low',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'high',   label: 'High',   color: 'bg-red-100 text-red-700 border-red-200' },
]

function getAmountInputCls(hasError: boolean, amount: number) {
  if (hasError) return 'h-10 pl-7 border-destructive focus-visible:ring-destructive/30'
  if (amount >= 1000) return 'h-10 pl-7 border-emerald-400 focus-visible:ring-emerald-300/40'
  return 'h-10 pl-7'
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
              <tr key={item.item_name + idx} className="hover:bg-slate-50/50">
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

// ─── Line Items Editor ─────────────────────────────────────────────────────────

function LineItemsEditor({ items, onChange }: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<LineItem | null>(null)

  const addItem = () => {
    const item = newLineItem()
    onChange([...items, item])
    setEditingId(item.id)
    setEditForm(item)
  }

  const startEdit = (item: LineItem) => { setEditingId(item.id); setEditForm({ ...item }) }

  const saveEdit = () => {
    if (!editForm) return
    onChange(items.map(i => (i.id === editForm.id ? editForm : i)))
    setEditingId(null); setEditForm(null)
  }

  const cancelEdit = () => {
    if (editForm && !editForm.item_name) onChange(items.filter(i => i.id !== editForm.id))
    setEditingId(null); setEditForm(null)
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
                    <td className="px-1 py-1.5"><Input value={editForm.item_name} onChange={e => setF('item_name', e.target.value)} className="h-7 text-xs" placeholder="Item name *" /></td>
                    <td className="px-1 py-1.5"><Input value={editForm.description} onChange={e => setF('description', e.target.value)} className="h-7 text-xs" placeholder="Optional" /></td>
                    <td className="px-1 py-1.5"><Input type="number" value={editForm.qty} onChange={e => setF('qty', e.target.value)} className="h-7 text-xs text-right" min="0" /></td>
                    <td className="px-1 py-1.5"><Input value={editForm.uom} onChange={e => setF('uom', e.target.value)} className="h-7 text-xs" placeholder="Nos" /></td>
                    <td className="px-1 py-1.5"><Input type="number" value={editForm.unit_rate} onChange={e => setF('unit_rate', e.target.value)} className="h-7 text-xs text-right" min="0" step="0.01" /></td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">{formatCurrency(editTotal)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button type="button" onClick={saveEdit} className="text-green-600 hover:text-green-700 p-0.5 rounded hover:bg-green-50"><Check className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100"><X className="w-3.5 h-3.5" /></button>
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
                      <button type="button" onClick={() => startEdit(item)} className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t">
                <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total Estimated</td>
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

// ─── Approval Steps Table ──────────────────────────────────────────────────────

function actionStepClass(action: string) {
  if (action === 'approved') return 'bg-green-50 border-green-200 text-green-700'
  if (action === 'rejected') return 'bg-red-50 border-red-200 text-red-700'
  if (action === 'held')     return 'bg-amber-50 border-amber-200 text-amber-700'
  return 'bg-slate-50 border-slate-200 text-slate-500'
}

function ActionStepIcon({ action }: { action: string }) {
  if (action === 'approved') return <CheckCircle className="w-3 h-3" />
  if (action === 'rejected') return <XCircle className="w-3 h-3" />
  return <Clock className="w-3 h-3" />
}

function levelBubbleCls(action: string, isCurrent: boolean): string {
  if (action === 'approved') return 'bg-green-100 text-green-700'
  if (action === 'rejected') return 'bg-red-100 text-red-700'
  if (action === 'held')     return 'bg-amber-100 text-amber-700'
  if (isCurrent)             return 'bg-amber-200 text-amber-800'
  return 'bg-slate-100 text-slate-500'
}

function ApprovalSteps({ actions, currentLevel }: { actions: any[]; currentLevel?: number }) {
  if (!actions?.length) return null
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
          {actions.map((a: any) => {
            const isPending = !a.action || a.action === 'pending'
            const isCurrent = isPending && a.level_number === currentLevel
            const effectiveAction = a.action ?? 'pending'
            let actionLabel = 'Pending'
            if (effectiveAction === 'approved') actionLabel = 'Approved'
            else if (effectiveAction === 'rejected') actionLabel = 'Rejected'
            else if (effectiveAction === 'held') actionLabel = 'On Hold'
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
            )
          })}
        </tbody>
      </table>
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
      <p className="text-xs font-medium text-muted-foreground">Your action required — Level {pendingAction.level}</p>
      <textarea
        className="w-full border rounded-md p-2 text-sm resize-none h-16"
        placeholder="Comments (required for Reject / Hold)…"
        value={comments}
        onChange={e => setComments(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => handle('approved')} disabled={busy}>
          {loading === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Approve
        </Button>
        <Button size="sm" variant="destructive" className="gap-1" onClick={() => handle('rejected')} disabled={busy || !comments}>
          {loading === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Reject
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300" onClick={() => handle('held')} disabled={busy || !comments}>
          {loading === 'held' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Hold
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
      let toastMsg = 'Held.'
      if (action === 'approved') toastMsg = 'Approved successfully.'
      else if (action === 'rejected') toastMsg = 'Rejected.'
      toast({ title: toastMsg })
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

  let headerBg = 'bg-amber-50'
  let headerText = 'text-amber-800'
  let headerSub = 'text-amber-600'
  if (reqStatus === 'approved') { headerBg = 'bg-green-50'; headerText = 'text-green-800'; headerSub = 'text-green-600' }
  else if (reqStatus === 'rejected') { headerBg = 'bg-red-50'; headerText = 'text-red-800'; headerSub = 'text-red-600' }

  let StatusIcon = <Clock className="w-4 h-4 text-amber-600" />
  if (reqStatus === 'approved') StatusIcon = <CheckCircle className="w-4 h-4 text-green-600" />
  else if (reqStatus === 'rejected') StatusIcon = <XCircle className="w-4 h-4 text-red-600" />

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${headerBg}`}>
        <div className="flex items-center gap-2">
          {StatusIcon}
          <span className={`text-sm font-medium ${headerText}`}>{levelLabel}</span>
          {approvalRequest && <span className={`text-xs ${headerSub}`}>via {approvalRequest.matrix_name}</span>}
        </div>
        {myPendingAction && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSLAColor(pct)}`}>{slaLabel}</span>
        )}
      </div>
      {isLoading && (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}
      {!isLoading && (
        <>
          <ApprovalSteps actions={approvalRequest?.actions ?? []} currentLevel={approvalRequest?.current_level} />
          {myPendingAction && <MyActionPanel pendingAction={myPendingAction} onProcess={processAction} />}
        </>
      )}
    </div>
  )
}

// ─── Preferred Vendors Card (read-only view) ───────────────────────────────────

function vendorStatusCls(status: string): string {
  if (status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function PreferredVendorsCard({ vendors }: { vendors: any[] }) {
  if (!vendors?.length) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-sm font-semibold">Preferred Vendors</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground italic">
          No preferred vendors specified.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4 border-b">
        <CardTitle className="text-sm font-semibold">Preferred Vendors ({vendors.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Location</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vendors.map((v: any) => {
              let location = '—'
              if (v.city && v.state) location = `${v.city}, ${v.state}`
              else if (v.city) location = v.city
              return (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{v.company_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{v.category_name || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{location}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{v.contact_email || '—'}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    {v.status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vendorStatusCls(v.status)}`}>
                        {v.status.replaceAll('_', ' ')}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

// ─── Edit Budget Form ──────────────────────────────────────────────────────────

function EditBudgetForm({ budget, plants, departments, onSave, onCancel, saving, isDraft, amountOnly, onSubmitApproval }: {
  budget: any
  plants: any[]
  departments: any[]
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  saving: boolean
  isDraft?: boolean
  amountOnly?: boolean
  onSubmitApproval?: (matrixId: number | null) => Promise<void>
}) {
  const { currencySymbol } = useSettingsStore()

  const [title, setTitle] = useState<string>(budget.title ?? '')
  const [description, setDescription] = useState<string>(budget.description ?? '')
  const [requestedAmount, setRequestedAmount] = useState<number>(Number(budget.requested_amount) || 0)
  const [priority, setPriority] = useState<string>(budget.priority ?? 'medium')
  const [plant, setPlant] = useState<number | ''>(budget.plant ?? '')
  const [department, setDepartment] = useState<number | ''>(budget.department ?? '')
  const [selectedVendors, setSelectedVendors] = useState<any[]>(budget.preferred_vendors ?? [])
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorSearch, setShowVendorSearch] = useState(false)
  const [amountError, setAmountError] = useState('')
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [submittingApproval, setSubmittingApproval] = useState(false)

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

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'budget_approval'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'budget_approval', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
    enabled: !!isDraft,
  })

  const addVendor = (v: any) => {
    if (!selectedVendors.some((x: any) => x.id === v.id)) setSelectedVendors(prev => [...prev, v])
    setShowVendorSearch(false)
    setVendorSearch('')
  }
  const removeVendor = (id: number) => setSelectedVendors(prev => prev.filter((v: any) => v.id !== id))

  const handleAmountChange = (val: number) => {
    const clamped = Math.min(val, 100_000_000)
    setRequestedAmount(clamped)
    if (clamped > 0 && clamped < 1000) {
      setAmountError(`Minimum budget is ${currencySymbol}1,000`)
    } else {
      setAmountError('')
    }
  }

  const handleSave = () => {
    if (amountOnly) {
      onSave({ requested_amount: requestedAmount })
      return
    }
    onSave({
      title,
      description,
      requested_amount: requestedAmount,
      priority,
      plant: plant || null,
      department: department || null,
      preferred_vendor_ids: selectedVendors.map((v: any) => v.id),
    })
  }

  const handleSubmit = async () => {
    if (!onSubmitApproval) return
    setSubmittingApproval(true)
    try {
      await onSubmitApproval(selectedMatrix)
    } finally {
      setSubmittingApproval(false)
    }
  }

  const matrixCount = matrices?.length ?? 0
  const canSubmit = !submittingApproval && (matrixCount === 0 || selectedMatrix !== null)

  const selectCls = 'w-full h-10 border border-input rounded-md px-3 text-sm bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'
  const textareaCls = 'w-full border border-input rounded-md p-3 text-sm bg-background text-foreground resize-none h-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors placeholder:text-muted-foreground'
  const amountInputCls = getAmountInputCls(!!amountError, requestedAmount)

  return (
    <div className="space-y-5">

      {/* ── Basic Information (hidden in amount-only mode) ─────────────────── */}
      {!amountOnly && <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Enterprise Laptop Procurement" className="h-10" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Priority <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                {PRIORITY_OPTS.map(p => {
                  const isSelected = priority === p.value
                  const cls = isSelected
                    ? `${p.color} border-current shadow-sm`
                    : 'border-input text-muted-foreground hover:border-slate-300 hover:text-foreground'
                  return (
                    <label key={p.value} className={`flex-1 border rounded-lg px-2 py-2.5 cursor-pointer text-center text-xs font-semibold transition-all ${cls}`}>
                      <input type="radio" value={p.value} checked={priority === p.value} onChange={() => setPriority(p.value)} className="sr-only" />
                      {p.label}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Plant</Label>
              <select className={selectCls} value={plant} onChange={e => setPlant(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select plant...</option>
                {plants.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Department</Label>
              <select className={selectCls} value={department} onChange={e => setDepartment(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select department...</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description <span className="text-destructive">*</span></Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className={textareaCls} placeholder="Brief description of what you need..." maxLength={500} />
            <div className="flex items-center justify-between">
              {description.length > 0 && description.length < 10
                ? <p className="text-xs text-destructive">Minimum 10 characters</p>
                : <span />}
              <p className="text-xs text-muted-foreground">{description.length} / 500</p>
            </div>
          </div>

        </CardContent>
      </Card>}

      {/* ── Budget Amount ──────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {amountOnly ? 'Update Budget Amount' : `Estimated Budget (${currencySymbol})`}
          </CardTitle>
          {amountOnly && (
            <p className="text-xs text-muted-foreground mt-1">You can update the requested amount while the budget is under review.</p>
          )}
        </CardHeader>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[10000, 50000, 100000, 500000, 1000000, 5000000].map(amt => (
              <button key={amt} type="button" onClick={() => handleAmountChange(amt)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  requestedAmount === amt
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}>
                {amt >= 100000 ? `${currencySymbol}${amt / 100000}L` : `${currencySymbol}${amt / 1000}K`}
              </button>
            ))}
          </div>
          <div className="max-w-xs space-y-1.5">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">{currencySymbol}</span>
              <Input
                type="number" step="1" min={1000} max={100000000} placeholder="0"
                className={amountInputCls}
                value={requestedAmount || ''}
                onChange={e => handleAmountChange(Number(e.target.value))}
                onInput={e => { const el = e.currentTarget; if (Number(el.value) > 100_000_000) el.value = '100000000' }}
              />
            </div>
            {requestedAmount >= 1000 && !amountError && (
              <p className="text-xs font-semibold text-emerald-600">{formatCurrency(requestedAmount, budget.currency_code)}</p>
            )}
            {amountError && (
              <p className="text-xs text-destructive flex items-center gap-1"><span>⚠</span> {amountError}</p>
            )}
            <p className="text-xs text-muted-foreground">Min {currencySymbol}1,000 · Max {currencySymbol}1,00,00,000</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Preferred Vendors (hidden in amount-only mode) ─────────────────── */}
      {!amountOnly && <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferred Vendors</CardTitle>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-3">
          <div className="relative">
            <Input
              placeholder="Search approved vendors..."
              value={vendorSearch}
              onChange={e => { setVendorSearch(e.target.value); setShowVendorSearch(true) }}
              onFocus={() => setShowVendorSearch(true)}
              onBlur={() => setTimeout(() => setShowVendorSearch(false), 150)}
              className="h-10"
            />
            {showVendorSearch && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-lg bg-background shadow-lg max-h-56 overflow-y-auto divide-y">
                {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).map((v: any) => (
                  <button key={v.id} type="button" onMouseDown={e => e.preventDefault()}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors"
                    onClick={() => addVendor(v)}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{v.company_name}</span>
                      <span className="text-xs text-emerald-600 font-medium">{v.status}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      {v.category_name && <span>{v.category_name}</span>}
                      {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                    </div>
                  </button>
                ))}
                {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).length === 0 && vendorSearch && (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">No vendors found.</p>
                )}
              </div>
            )}
          </div>
          {selectedVendors.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Location</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Email</th>
                    <th className="w-8 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedVendors.map((v: any) => {
                    let location = '—'
                    if (v.city && v.state) location = `${v.city}, ${v.state}`
                    else if (v.city) location = v.city
                    return (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-foreground">{v.company_name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{v.category_name || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{location}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{v.contact_email || '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button type="button" onClick={() => removeVendor(v.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* ── Select Approval Matrix (draft only) ──────────────────────────── */}
      {isDraft && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Approval Matrix</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Choose the approval workflow for this budget request.</p>
          </CardHeader>
          <CardContent className="pt-5">
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
                onSelect={id => { setSelectedMatrix(id); setExpandedMatrix(id) }}
                onToggleExpand={id => setExpandedMatrix(prev => (prev === id ? null : id))}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-muted-foreground">
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={handleSave} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
          {isDraft && onSubmitApproval && (
            <Button type="button" disabled={!canSubmit} onClick={handleSubmit} className="gap-2">
              {submittingApproval ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit for Approval
            </Button>
          )}
        </div>
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

  const handleSubmitApproval = async (matrixId: number | null) => {
    try {
      const body: Record<string, any> = {}
      if (matrixId) body.matrix_id = matrixId
      await apiClient.post(`/budget/tracking-ids/${id}/submit-for-approval/`, body)
      toast({ title: 'Submitted for approval. Approvers have been notified.' })
      queryClient.invalidateQueries({ queryKey: ['budget', id] })
      queryClient.invalidateQueries({ queryKey: ['budget-approval', id] })
      setIsEditing(false)
      setActiveTab('approval')
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err?.response?.data?.error, variant: 'destructive' })
    }
  }

  if (isLoading) return (
    <div className="p-8 text-center text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…
    </div>
  )
  if (!budget) return <div className="p-8 text-center text-muted-foreground">Budget not found.</div>

  const isDraft = budget.status === 'draft'
  const canEdit = budget.status !== 'approved'

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
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

        <div className="flex items-center gap-2 shrink-0">
          {canEdit && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => router.push('/budget')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
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
            <EditBudgetForm
              budget={budget}
              plants={plants ?? []}
              departments={departments ?? []}
              onSave={data => editMutation.mutate(data)}
              onCancel={() => setIsEditing(false)}
              saving={editMutation.isPending}
              isDraft={isDraft}
              amountOnly={!isDraft}
              onSubmitApproval={handleSubmitApproval}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Budget Details</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {[
                      ['Plant', budget.plant_name || '—'],
                      ['Department', budget.department_name || '—'],
                      ['Requested Amount', formatCurrency(budget.requested_amount, budget.currency_code)],
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
                          {formatCurrency(budget.remaining_amount, budget.currency_code)}
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
            <div className="border rounded-lg p-6 flex items-start gap-4 bg-muted/30">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Not yet submitted</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This budget is still a draft. Go to the Details tab, click <span className="font-medium">Edit</span>, select an approval matrix, and click <span className="font-medium">Submit for Approval</span>.
                </p>
              </div>
            </div>
          ) : (
            <ApprovalProgressPanel
              budgetId={id}
              onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['budget', id] })}
            />
          )}
        </div>
      )}
    </div>
  )
}
