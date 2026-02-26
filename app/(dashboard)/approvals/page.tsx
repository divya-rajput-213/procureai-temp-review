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
  Plus, Trash2, Pencil, X, Settings, ChevronDown, ChevronUp,
  Building2, Package, Users, ExternalLink, FileText,
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
  submitting,
}: {
  item: any
  isSelected: boolean
  onSelect: () => void
  onAction: (action: string, comments: string) => void
  submitting: boolean
}) {
  const [comments, setComments] = useState('')
  const [loadingAct, setLoadingAct] = useState('')

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
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Comments <span className="text-muted-foreground">(required for Reject / Hold)</span>
              </label>
              <textarea
                className="w-full border rounded-md p-2 text-sm resize-none h-20 bg-white"
                placeholder="Add your comments…"
                value={comments}
                onChange={e => setComments(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={() => handle('approved')}
                disabled={busy}
              >
                {loadingAct === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1"
                onClick={() => handle('rejected')}
                disabled={busy || !comments.trim()}
              >
                {loadingAct === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-amber-600 border-amber-300"
                onClick={() => handle('held')}
                disabled={busy || !comments.trim()}
              >
                {loadingAct === 'held' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                Hold
              </Button>
              <Button size="sm" variant="ghost" onClick={onSelect} className="ml-auto">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Collapsed prompt when not selected */}
        {!isSelected && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            Click to review and take action
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Matrix Form ──────────────────────────────────────────────────────────────

type LevelDraft = { level_number: number; user: string; role: string; sla_hours: number }
type MatrixDraft = { name: string; matrix_type: string; is_active: boolean; plant: string; levels: LevelDraft[] }

const EMPTY_DRAFT: MatrixDraft = {
  name: '', matrix_type: 'purchase_requisition', is_active: true, plant: '',
  levels: [{ level_number: 1, user: '', role: '', sla_hours: 72 }],
}

const MATRIX_TYPE_OPTIONS = [
  { value: 'purchase_requisition', label: 'Purchase Requisition' },
  { value: 'budget_approval', label: 'Budget Approval' },
  { value: 'vendor_onboarding', label: 'Vendor Onboarding' },
]

function MatrixForm({ initial, onSave, onCancel, saving }: {
  initial?: MatrixDraft; onSave: (d: MatrixDraft) => void; onCancel: () => void; saving: boolean
}) {
  const [form, setForm] = useState<MatrixDraft>(initial ?? EMPTY_DRAFT)

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: users } = useQuery({
    queryKey: ['users-active'],
    queryFn: async () => {
      const r = await apiClient.get('/users/?status=active')
      return Array.isArray(r.data) ? r.data : (r.data.results || [])
    },
  })

  const approverOptions: { value: string; label: string }[] = (users || []).flatMap((u: any) =>
    (u.roles || []).map((r: any) => ({
      value: `${u.id}:${r.id}`,
      label: `${u.full_name || u.email} › ${r.display_name}`,
    }))
  )

  const set = (k: keyof MatrixDraft, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const setLevelApprover = (i: number, combined: string) => {
    const [userId, roleId] = combined.split(':')
    setForm(f => ({
      ...f,
      levels: f.levels.map((l, idx) => idx === i ? { ...l, user: userId ?? '', role: roleId ?? '' } : l),
    }))
  }
  const setLevelSla = (i: number, v: number) =>
    setForm(f => ({ ...f, levels: f.levels.map((l, idx) => idx === i ? { ...l, sla_hours: v } : l) }))
  const addLevel = () =>
    setForm(f => ({ ...f, levels: [...f.levels, { level_number: f.levels.length + 1, user: '', role: '', sla_hours: 72 }] }))
  const removeLevel = (i: number) =>
    setForm(f => ({ ...f, levels: f.levels.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, level_number: idx + 1 })) }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-3 space-y-1">
          <Label>Matrix Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PR Approval — Standard" />
        </div>
        <div className="space-y-1">
          <Label>Type *</Label>
          <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" value={form.matrix_type} onChange={e => set('matrix_type', e.target.value)}>
            {MATRIX_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Plant (blank = all plants)</Label>
          <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" value={form.plant} onChange={e => set('plant', e.target.value)}>
            <option value="">All Plants</option>
            {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="h-4 w-4" />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Approval Levels</Label>
          <Button type="button" size="sm" variant="outline" onClick={addLevel} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Level
          </Button>
        </div>
        {form.levels.map((level, idx) => (
          <div key={level.level_number} className="flex items-center gap-2 border rounded-lg p-3 bg-slate-50">
            <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">L{level.level_number}</span>
            <select
              className="flex-1 h-9 border rounded-md px-2 text-sm bg-background"
              value={level.user && level.role ? `${level.user}:${level.role}` : ''}
              onChange={e => setLevelApprover(idx, e.target.value)}
            >
              <option value="">Select approver…</option>
              {approverOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex items-center gap-1 shrink-0">
              <Input type="number" className="w-20 h-9 text-sm" value={level.sla_hours}
                onChange={e => setLevelSla(idx, Number(e.target.value))} />
              <span className="text-xs text-muted-foreground">hrs</span>
            </div>
            {form.levels.length > 1 && (
              <button type="button" onClick={() => removeLevel(idx)} className="text-red-400 hover:text-red-600 ml-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(form)} disabled={saving || !form.name || form.levels.some(l => !l.user || !l.role)}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Save Matrix
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Matrix Row ───────────────────────────────────────────────────────────────

function MatrixRow({ matrix, onEdit, onDelete, onToggle }: {
  matrix: any; onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50">
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{matrix.name}</span>
            <Badge variant="secondary" className="text-xs capitalize">
              {MATRIX_TYPE_OPTIONS.find(o => o.value === matrix.matrix_type)?.label ?? matrix.matrix_type}
            </Badge>
            {!matrix.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {matrix.plant_name ?? 'All Plants'} · {matrix.levels?.length ?? 0} level(s)
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onToggle} className="text-xs">
            {matrix.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="bg-slate-50 border-t px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left pb-1 font-medium">Level</th>
                <th className="text-left pb-1 font-medium">Approver</th>
                <th className="text-left pb-1 font-medium">Role</th>
                <th className="text-left pb-1 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(matrix.levels ?? []).map((l: any) => (
                <tr key={l.id}>
                  <td className="py-1.5">L{l.level_number}</td>
                  <td className="py-1.5 font-medium">{l.user_name || l.user}</td>
                  <td className="py-1.5 text-muted-foreground">{l.role_name || l.role}</td>
                  <td className="py-1.5">{l.sla_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Matrix Config Tab ────────────────────────────────────────────────────────

function MatrixConfigTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const { data: matrices, isLoading } = useQuery({
    queryKey: ['approval-matrices'],
    queryFn: async () => (await apiClient.get('/approvals/matrices/')).data.results ?? (await apiClient.get('/approvals/matrices/')).data,
  })

  const saveMatrix = async (data: MatrixDraft, id?: number) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        plant: data.plant || null,
        levels: data.levels.map(l => ({
          level_number: l.level_number,
          user: Number(l.user),
          role: Number(l.role),
          sla_hours: l.sla_hours,
        })),
      }
      if (id) {
        await apiClient.put(`/approvals/matrices/${id}/`, payload)
        toast({ title: 'Matrix updated.' })
      } else {
        await apiClient.post('/approvals/matrices/', payload)
        toast({ title: 'Matrix created.' })
      }
      queryClient.invalidateQueries({ queryKey: ['approval-matrices'] })
      setCreating(false)
      setEditTarget(null)
    } catch (err: any) {
      toast({ title: 'Save failed', description: JSON.stringify(err?.response?.data), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const deleteMatrix = async (id: number) => {
    if (!confirm('Delete this matrix? This cannot be undone.')) return
    try {
      await apiClient.delete(`/approvals/matrices/${id}/`)
      toast({ title: 'Matrix deleted.' })
      queryClient.invalidateQueries({ queryKey: ['approval-matrices'] })
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  const toggleMatrix = async (m: any) => {
    try {
      await apiClient.patch(`/approvals/matrices/${m.id}/`, { is_active: !m.is_active })
      queryClient.invalidateQueries({ queryKey: ['approval-matrices'] })
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' })
    }
  }

  const toEditDraft = (m: any): MatrixDraft => ({
    name: m.name,
    matrix_type: m.matrix_type,
    is_active: m.is_active,
    plant: m.plant ? String(m.plant) : '',
    levels: (m.levels ?? []).map((l: any) => ({
      level_number: l.level_number,
      user: String(l.user),
      role: String(l.role),
      sla_hours: l.sla_hours,
    })),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure who approves each request type at each level.
        </p>
        {!creating && !editTarget && (
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> New Matrix
          </Button>
        )}
      </div>

      {(creating || editTarget) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editTarget ? 'Edit Matrix' : 'New Approval Matrix'}</CardTitle>
          </CardHeader>
          <CardContent>
            <MatrixForm
              initial={editTarget ? toEditDraft(editTarget) : undefined}
              onSave={data => saveMatrix(data, editTarget?.id)}
              onCancel={() => { setCreating(false); setEditTarget(null) }}
              saving={saving}
            />
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>}
      {!isLoading && (matrices ?? []).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No approval matrices configured.</p>
          <p className="text-xs mt-1">Create one to enable approval workflows.</p>
        </div>
      )}
      {!isLoading && (matrices ?? []).length > 0 && (
        <div className="space-y-2">
          {(matrices ?? []).map((m: any) => (
            <MatrixRow key={m.id} matrix={m}
              onEdit={() => { setEditTarget(m); setCreating(false) }}
              onDelete={() => deleteMatrix(m.id)}
              onToggle={() => toggleMatrix(m)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── History Status Badge ─────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  if (status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'matrix'>('mine')
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: pendingMine, isLoading: loadingMine } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    refetchInterval: 60000,
  })
  const { data: allRequests, isLoading: loadingAll } = useQuery({
    queryKey: ['all-approval-requests'],
    queryFn: async () => (await apiClient.get('/approvals/requests/')).data.results || [],
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
      setSubmitting(false) }
  }

  const pending: any[] = pendingMine || []
  const all: any[] = allRequests || []

  const TABS: Array<['mine' | 'all' | 'matrix', string]> = [
    ['mine', pending.length > 0 ? `Pending My Action (${pending.length})` : 'Pending My Action'],
    ['all', 'All History'],
    ['matrix', 'Matrix Config'],
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
              submitting={submitting}
            />
          ))}
        </div>
      )}

      {/* ── All History ── */}
      {activeTab === 'all' && (
        <Card>
          <CardContent className="p-0">
            {loadingAll && (
              <div className="p-8 text-center">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            {!loadingAll && all.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No approval history yet.</div>
            )}
            {!loadingAll && all.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['Entity', 'Matrix', 'Level', 'Status', 'Submitted', 'Completed'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {all.map((req: any) => (
                      <tr
                        key={req.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => router.push(`/approvals/${req.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <EntityTypeIcon type={req.entity_type} />
                            <div>
                              <span className="font-medium">{req.entity_label}</span>
                              <Badge variant="secondary" className="text-xs ml-2 capitalize">
                                {entityTypeLabel(req.entity_type)}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{req.matrix_name}</td>
                        <td className="px-4 py-3">L{req.current_level}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusBadgeClass(req.status)}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.created_at)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {req.completed_at ? formatDateTime(req.completed_at) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Matrix Config ── */}
      {activeTab === 'matrix' && <MatrixConfigTab />}
    </div>
  )
}
