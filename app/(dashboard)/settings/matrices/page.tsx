'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, X, Check } from 'lucide-react'
import apiClient from '@/lib/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type MatrixLevel = {
  id?: number
  level_number: number
  user: number | ''
  role: number | ''
  sla_hours: number
}

type MatrixForm = {
  name: string
  matrix_type: string
  plant: number | ''
  is_active: boolean
  levels: MatrixLevel[]
}

const MATRIX_TYPES = [
  { value: 'vendor_onboarding',    label: 'Vendor Onboarding' },
  { value: 'budget_approval',      label: 'Budget Approval' },
  { value: 'purchase_requisition', label: 'Purchase Requisition' },
  { value: 'vendor_bid',           label: 'Vendor Bid Approval' },
]

function emptyForm(): MatrixForm {
  return {
    name: '',
    matrix_type: 'budget_approval',
    plant: '',
    is_active: true,
    levels: [{ level_number: 1, user: '', role: '', sla_hours: 72 }],
  }
}

// ─── Matrix Form ──────────────────────────────────────────────────────────────

function MatrixFormPanel({ initial, plants, users, roles, onSave, onCancel, saving }: {
  initial: MatrixForm
  plants: any[]
  users: any[]
  roles: any[]
  onSave: (data: MatrixForm) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<MatrixForm>(initial)
  const [formError, setFormError] = useState('')
  const set = (k: keyof MatrixForm, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const addLevel = () => {
    setForm(prev => {
      // Use max existing level_number + 1 (not just length+1) to handle any gaps
      const maxNum = prev.levels.reduce((m, lv) => Math.max(m, lv.level_number), 0)
      return {
        ...prev,
        levels: [...prev.levels, { level_number: maxNum + 1, user: '', role: '', sla_hours: 72 }],
      }
    })
  }

  const removeLevel = (idx: number) => {
    setForm(prev => ({
      ...prev,
      levels: prev.levels
        .filter((_, i) => i !== idx)
        .map((lv, i) => ({ ...lv, level_number: i + 1 })),
    }))
  }

  const setLevel = (idx: number, k: keyof MatrixLevel, v: any) => {
    setForm(prev => ({
      ...prev,
      levels: prev.levels.map((lv, i) => i === idx ? { ...lv, [k]: v } : lv),
    }))
  }

  return (
    <div className="space-y-5">
      {/* Basic Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Matrix Name <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} className="h-8 text-sm" placeholder="e.g. Standard Budget Approval" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Matrix Type <span className="text-destructive">*</span></Label>
          <select
            className="w-full h-8 border rounded-md px-3 text-sm bg-background"
            value={form.matrix_type}
            onChange={e => set('matrix_type', e.target.value)}
          >
            {MATRIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Plant (optional)</Label>
          <select
            className="w-full h-8 border rounded-md px-3 text-sm bg-background"
            value={form.plant}
            onChange={e => set('plant', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All Plants</option>
            {plants.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="matrix-active"
            checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)}
            className="rounded"
          />
          <label htmlFor="matrix-active" className="text-sm cursor-pointer">
            <span>Active (visible for selection)</span>
          </label>
        </div>
      </div>

      {/* Approval Levels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Approval Levels</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLevel} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Add Level
          </Button>
        </div>
        {form.levels.map((lv, idx) => (
          <div key={lv.level_number} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Level {lv.level_number}</span>
              {form.levels.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLevel(idx)}
                  className="text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Approver <span className="text-destructive">*</span></Label>
                <select
                  className="w-full h-8 border rounded-md px-3 text-sm bg-background"
                  value={lv.user}
                  onChange={e => setLevel(idx, 'user', e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select user…</option>
                  {Array.from(new Map(users.map((u: any) => [u.id, u])).values()).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role <span className="text-destructive">*</span></Label>
                <select
                  className="w-full h-8 border rounded-md px-3 text-sm bg-background"
                  value={lv.role}
                  onChange={e => setLevel(idx, 'role', e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select role…</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SLA (hours)</Label>
                <Input
                  type="number"
                  min="1"
                  value={lv.sla_hours}
                  onChange={e => setLevel(idx, 'sla_hours', Number(e.target.value) || 72)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t">
        {formError && (
          <p className="text-xs text-destructive font-medium">{formError}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving || !form.name}
            className="gap-1"
            onClick={() => {
              const nums = form.levels.map(lv => lv.level_number)
              if (new Set(nums).size !== nums.length) {
                setFormError('Duplicate level numbers detected. Each level must be unique.')
                return
              }
              const missing = form.levels.some(lv => !lv.user || !lv.role)
              if (missing) {
                setFormError('Every level must have an Approver and a Role selected.')
                return
              }
              setFormError('')
              onSave(form)
            }}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {!saving && <Check className="w-3.5 h-3.5" />}
            Save Matrix
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Matrix Row ───────────────────────────────────────────────────────────────

function MatrixRow({ matrix, onEdit, onDelete, deleting }: {
  matrix: any
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const levelCount = matrix.levels?.length ?? 0
  const typeLabel = MATRIX_TYPES.find(t => t.value === matrix.matrix_type)?.label ?? matrix.matrix_type

  return (
    <div className="border-b last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{matrix.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${matrix.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {matrix.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {typeLabel} · {matrix.plant_name || 'All Plants'} · {levelCount} level{levelCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={onDelete}
            disabled={deleting}
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
      {expanded && levelCount > 0 && (
        <div className="bg-slate-50 border-t px-6 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-slate-200">
                <th className="text-left pb-2 pr-4 font-medium">Level</th>
                <th className="text-left pb-2 pr-4 font-medium">Approver</th>
                <th className="text-left pb-2 pr-4 font-medium">Role</th>
                <th className="text-right pb-2 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrix.levels.map((lv: any) => (
                <tr key={lv.id}>
                  <td className="py-1.5 pr-4 font-medium text-muted-foreground">L{lv.level_number}</td>
                  <td className="py-1.5 pr-4 font-medium">{lv.user_name ?? '—'}</td>
                  <td className="py-1.5 pr-4 text-muted-foreground">{lv.role_name ?? '—'}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{lv.sla_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MatricesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingMatrix, setEditingMatrix] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState('')

  const { data: matrices, isLoading } = useQuery({
    queryKey: ['approval-matrices-all'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/')
      return r.data.results ?? r.data
    },
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
    enabled: showForm || !!editingMatrix,
  })

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => { const r = await apiClient.get('/users/'); return r.data.results ?? r.data },
    enabled: showForm || !!editingMatrix,
  })

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => { const r = await apiClient.get('/users/roles/'); return r.data.results ?? r.data },
    enabled: showForm || !!editingMatrix,
  })

  const saveMutation = useMutation({
    mutationFn: async (data: MatrixForm) => {
      const payload = {
        ...data,
        plant: data.plant || null,
        levels: data.levels.map(lv => ({
          ...lv,
          user: lv.user || null,
          role: lv.role || null,
        })),
      }
      if (editingMatrix) {
        return (await apiClient.put(`/approvals/matrices/${editingMatrix.id}/`, payload)).data
      }
      return (await apiClient.post('/approvals/matrices/', payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-matrices-all'] })
      toast({ title: editingMatrix ? 'Matrix updated.' : 'Matrix created.' })
      setShowForm(false)
      setEditingMatrix(null)
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err?.response?.data?.error ?? 'Please check all fields.', variant: 'destructive' })
    },
  })

  const deleteMatrix = async (id: number) => {
    setDeletingId(id)
    try {
      await apiClient.delete(`/approvals/matrices/${id}/`)
      queryClient.invalidateQueries({ queryKey: ['approval-matrices-all'] })
      toast({ title: 'Matrix deleted.' })
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (matrix: any) => {
    setEditingMatrix(matrix)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingMatrix(null)
  }

  const formInitial: MatrixForm = editingMatrix
    ? {
        name: editingMatrix.name,
        matrix_type: editingMatrix.matrix_type,
        plant: editingMatrix.plant ?? '',
        is_active: editingMatrix.is_active,
        levels: (editingMatrix.levels ?? [])
          .slice()
          .sort((a: any, b: any) => a.level_number - b.level_number)
          .map((lv: any, i: number) => ({
            id: lv.id,
            level_number: i + 1,   // normalize to sequential 1-N regardless of DB state
            user: lv.user ?? '',
            role: lv.role ?? '',
            sla_hours: lv.sla_hours ?? 72,
          })),
      }
    : emptyForm()

  const allMatrices: any[] = matrices ?? []
  const filtered = filterType ? allMatrices.filter(m => m.matrix_type === filterType) : allMatrices

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Approval Matrices</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure multi-level approval workflows for vendors, budgets, and PRs.</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Matrix
          </Button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{editingMatrix ? 'Edit Matrix' : 'New Approval Matrix'}</CardTitle>
          </CardHeader>
          <CardContent>
            <MatrixFormPanel
              key={editingMatrix?.id ?? 'new'}
              initial={formInitial}
              plants={plants ?? []}
              users={users ?? []}
              roles={roles ?? []}
              onSave={data => saveMutation.mutate(data)}
              onCancel={cancelForm}
              saving={saveMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      {!showForm && allMatrices.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <select
            className="h-7 border rounded-md px-2 text-xs bg-background"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {MATRIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

      {/* Matrix List */}
      {!showForm && (
        <Card>
          {isLoading && (
            <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No approval matrices configured.</p>
              <p className="text-xs mt-1">Click New Matrix to create your first workflow.</p>
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <div>
              {filtered.map((m: any) => (
                <MatrixRow
                  key={m.id}
                  matrix={m}
                  onEdit={() => startEdit(m)}
                  onDelete={() => deleteMatrix(m.id)}
                  deleting={deletingId === m.id}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
