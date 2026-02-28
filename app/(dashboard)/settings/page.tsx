'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Pencil, X, Loader2, Check, Plus, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useSettingsStore } from '@/lib/stores/settings.store'
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

// ─── Matrix Form Panel ────────────────────────────────────────────────────────

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
  const set = (k: keyof MatrixForm, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const addLevel = () => {
    const next = form.levels.length + 1
    setForm(prev => ({
      ...prev,
      levels: [...prev.levels, { level_number: next, user: '', role: '', sla_hours: 72 }],
    }))
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

  const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.id, u])).values())

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Matrix Name <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} className="h-8 text-sm" placeholder="e.g. Standard Budget Approval" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Matrix Type <span className="text-destructive">*</span></Label>
          <select className="w-full h-8 border rounded-md px-3 text-sm bg-background" value={form.matrix_type} onChange={e => set('matrix_type', e.target.value)}>
            {MATRIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Plant (optional)</Label>
          <select className="w-full h-8 border rounded-md px-3 text-sm bg-background" value={form.plant} onChange={e => set('plant', e.target.value ? Number(e.target.value) : '')}>
            <option value="">All Plants</option>
            {plants.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="matrix-active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
          <label htmlFor="matrix-active" className="text-sm cursor-pointer">Active (visible for selection)</label>
        </div>
      </div>

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
                <button type="button" onClick={() => removeLevel(idx)} className="text-muted-foreground hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Approver <span className="text-destructive">*</span></Label>
                <select className="w-full h-8 border rounded-md px-3 text-sm bg-background" value={lv.user} onChange={e => setLevel(idx, 'user', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Select user…</option>
                  {uniqueUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role <span className="text-destructive">*</span></Label>
                <select className="w-full h-8 border rounded-md px-3 text-sm bg-background" value={lv.role} onChange={e => setLevel(idx, 'role', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Select role…</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SLA (hours)</Label>
                <Input type="number" min="1" value={lv.sla_hours} onChange={e => setLevel(idx, 'sla_hours', Number(e.target.value) || 72)} className="h-8 text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-1"><X className="w-3.5 h-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.name} className="gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Matrix
        </Button>
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
        <button type="button" onClick={() => setExpanded(p => !p)} className="text-muted-foreground hover:text-foreground shrink-0">
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
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
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

// ─── Approval Matrices Tab ────────────────────────────────────────────────────

function ApprovalMatricesTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingMatrix, setEditingMatrix] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState('')

  const { data: matrices, isLoading } = useQuery({
    queryKey: ['approval-matrices-all'],
    queryFn: async () => (await apiClient.get('/approvals/matrices/')).data.results ?? (await apiClient.get('/approvals/matrices/')).data,
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
        levels: data.levels.map(lv => ({ ...lv, user: lv.user || null, role: lv.role || null })),
      }
      if (editingMatrix) return (await apiClient.put(`/approvals/matrices/${editingMatrix.id}/`, payload)).data
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

  const cancelForm = () => { setShowForm(false); setEditingMatrix(null) }

  const formInitial: MatrixForm = editingMatrix
    ? {
        name: editingMatrix.name,
        matrix_type: editingMatrix.matrix_type,
        plant: editingMatrix.plant ?? '',
        is_active: editingMatrix.is_active,
        levels: (editingMatrix.levels ?? []).map((lv: any) => ({
          id: lv.id,
          level_number: lv.level_number,
          user: lv.user ?? '',
          role: lv.role ?? '',
          sla_hours: lv.sla_hours ?? 72,
        })),
      }
    : emptyForm()

  const allMatrices: any[] = matrices ?? []
  const filtered = filterType ? allMatrices.filter(m => m.matrix_type === filterType) : allMatrices

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">Configure multi-level approval workflows for vendors, budgets, and PRs.</p>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Matrix
          </Button>
        )}
      </div>

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

      {!showForm && allMatrices.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <select className="h-7 border rounded-md px-2 text-xs bg-background" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {MATRIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      )}

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
                  onEdit={() => { setEditingMatrix(m); setShowForm(true) }}
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

// ─── System Settings Tab ──────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹',    label: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$',    label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€',    label: 'Euro (€)' },
  { code: 'GBP', symbol: '£',    label: 'British Pound (£)' },
  { code: 'AED', symbol: 'د.إ',  label: 'UAE Dirham (د.إ)' },
  { code: 'SGD', symbol: 'S$',   label: 'Singapore Dollar (S$)' },
]

const EMPTY_TAX = { name: '', rate: '', description: '', is_active: true }

function SystemSettingsTab() {
  const { toast } = useToast()
  const { currencyCode, currencySymbol, taxComponents, updateCurrency, addTax, updateTax, deleteTax } = useSettingsStore()

  // ── Currency section ─────────────────────────────────────
  const [currForm, setCurrForm] = useState({ currencyCode, currencySymbol })
  const [currSaving, setCurrSaving] = useState(false)
  const [editingCurr, setEditingCurr] = useState(false)

  const handleCurrencySelect = (code: string) => {
    const opt = CURRENCY_OPTIONS.find(o => o.code === code)
    setCurrForm({ currencyCode: code, currencySymbol: opt?.symbol ?? currForm.currencySymbol })
  }

  const saveCurrency = async () => {
    setCurrSaving(true)
    try {
      await updateCurrency(currForm)
      toast({ title: 'Currency updated.' })
      setEditingCurr(false)
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setCurrSaving(false)
    }
  }

  const cancelCurrency = () => {
    setCurrForm({ currencyCode, currencySymbol })
    setEditingCurr(false)
  }

  // ── Tax section ──────────────────────────────────────────
  const [taxForm, setTaxForm] = useState(EMPTY_TAX)
  const [editingTaxId, setEditingTaxId] = useState<number | null>(null)
  const [showTaxForm, setShowTaxForm] = useState(false)
  const [taxSaving, setTaxSaving] = useState(false)
  const [deletingTaxId, setDeletingTaxId] = useState<number | null>(null)

  const openAddTax = () => { setTaxForm(EMPTY_TAX); setEditingTaxId(null); setShowTaxForm(true) }

  const openEditTax = (t: any) => {
    setTaxForm({ name: t.name, rate: String(t.rate), description: t.description, is_active: t.is_active })
    setEditingTaxId(t.id)
    setShowTaxForm(true)
  }

  const cancelTax = () => { setShowTaxForm(false); setEditingTaxId(null) }

  const saveTax = async () => {
    if (!taxForm.name || !taxForm.rate) {
      toast({ title: 'Name and rate are required.', variant: 'destructive' })
      return
    }
    setTaxSaving(true)
    try {
      const payload = {
        name: taxForm.name,
        rate: Number(taxForm.rate),
        description: taxForm.description,
        is_active: taxForm.is_active,
      }
      if (editingTaxId !== null) {
        await updateTax(editingTaxId, payload)
        toast({ title: 'Tax component updated.' })
      } else {
        await addTax(payload)
        toast({ title: 'Tax component added.' })
      }
      setShowTaxForm(false)
      setEditingTaxId(null)
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setTaxSaving(false)
    }
  }

  const handleDeleteTax = async (id: number) => {
    setDeletingTaxId(id)
    try {
      await deleteTax(id)
      toast({ title: 'Tax component removed.' })
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setDeletingTaxId(null)
    }
  }

  const activeTaxTotal = taxComponents
    .filter(t => t.is_active)
    .reduce((sum, t) => sum + t.rate, 0)

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Currency ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Currency</CardTitle>
              <CardDescription>Platform currency applied to all new records. Existing records retain the currency they were created with.</CardDescription>
            </div>
            {!editingCurr && (
              <Button variant="outline" size="sm" onClick={() => setEditingCurr(true)} className="gap-1.5 shrink-0">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingCurr ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                    value={currForm.currencyCode}
                    onChange={e => handleCurrencySelect(e.target.value)}
                  >
                    {CURRENCY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                    <option value="__custom__">Other (custom)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Symbol</Label>
                  <Input
                    value={currForm.currencySymbol}
                    onChange={e => setCurrForm(p => ({ ...p, currencySymbol: e.target.value }))}
                    className="h-9 text-sm"
                    placeholder="e.g. ₹"
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground">Auto-filled; override if needed.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={cancelCurrency} disabled={currSaving} className="gap-1">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={saveCurrency} disabled={currSaving} className="gap-1">
                  {currSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Code</p>
                <p className="font-semibold">{currencyCode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Symbol</p>
                <p className="font-semibold text-lg leading-none">{currencySymbol}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tax Components ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Tax Components</CardTitle>
              <CardDescription>
                Define multiple taxes (e.g. CGST 9% + SGST 9%). Active taxes are shown during document creation.
                {taxComponents.length > 0 && (
                  <span className="ml-1 text-foreground font-medium">
                    Total active: {activeTaxTotal.toFixed(2)}%
                  </span>
                )}
              </CardDescription>
            </div>
            {!showTaxForm && (
              <Button size="sm" onClick={openAddTax} className="gap-1.5 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add Tax
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Add / Edit form */}
          {showTaxForm && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {editingTaxId !== null ? 'Edit Tax Component' : 'New Tax Component'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={taxForm.name}
                    onChange={e => setTaxForm(p => ({ ...p, name: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="e.g. CGST, VAT"
                    maxLength={30}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate (%) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxForm.rate}
                    onChange={e => setTaxForm(p => ({ ...p, rate: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="e.g. 9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={taxForm.description}
                    onChange={e => setTaxForm(p => ({ ...p, description: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="Optional note"
                    maxLength={120}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tax-active"
                  checked={taxForm.is_active}
                  onChange={e => setTaxForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="tax-active" className="text-sm cursor-pointer">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={cancelTax} disabled={taxSaving} className="gap-1">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={saveTax} disabled={taxSaving} className="gap-1">
                  {taxSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editingTaxId !== null ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
          )}

          {/* Tax components table */}
          {taxComponents.length === 0 && !showTaxForm && (
            <p className="text-sm text-muted-foreground italic py-2">No tax components configured. Click Add Tax to create one.</p>
          )}
          {taxComponents.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2.5 font-medium">Name</th>
                    <th className="text-right px-3 py-2.5 font-medium w-24">Rate</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Description</th>
                    <th className="text-center px-3 py-2.5 font-medium w-20">Status</th>
                    <th className="px-3 py-2.5 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {taxComponents.map(t => (
                    <tr key={t.id} className={`hover:bg-muted/30 transition-colors ${!t.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2.5 font-medium">{t.name}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{t.rate}%</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{t.description || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {t.is_active ? 'Active' : 'Off'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => openEditTax(t)}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTax(t.id)}
                            disabled={deletingTaxId === t.id}
                            className="text-muted-foreground hover:text-red-600 p-0.5 rounded hover:bg-red-50"
                          >
                            {deletingTaxId === t.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {taxComponents.some(t => t.is_active) && (
                  <tfoot>
                    <tr className="bg-muted/50 border-t">
                      <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total active</td>
                      <td className="px-3 py-2 text-right font-bold text-sm">{activeTaxTotal.toFixed(2)}%</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const setTokens = useAuthStore((s) => s.setTokens)
  const accessToken = useAuthStore((s) => s.accessToken)
  const refreshToken = useAuthStore((s) => s.refreshToken)

  const [activeTab, setActiveTab] = useState<'account' | 'matrices' | 'system' | 'platform'>('account')
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    designation: user?.designation ?? '',
  })

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/users/${user?.id}/`, {
        first_name: form.first_name,
        last_name: form.last_name,
        designation: form.designation,
      })
      return res.data
    },
    onSuccess: (updated) => {
      if (accessToken && refreshToken) {
        setTokens(accessToken, refreshToken, { ...user!, ...updated })
      }
      toast({ title: 'Profile updated.' })
      setIsEditing(false)
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err?.response?.data?.error, variant: 'destructive' })
    },
  })

  const handleCancel = () => {
    setForm({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', designation: user?.designation ?? '' })
    setIsEditing(false)
  }

  const TABS = [
    { key: 'account',  label: 'Account' },
    { key: 'matrices', label: 'Approval Matrices' },
    { key: 'system',   label: 'System' },
    { key: 'platform', label: 'Platform' },
  ] as const

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Tab bar */}
      <div className="border-b flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your current account settings</CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5 shrink-0">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name</Label>
                      <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Designation</Label>
                    <Input value={form.designation} onChange={e => set('designation', e.target.value)} className="h-8 text-sm" placeholder="e.g. Purchase Manager" />
                  </div>
                  <div className="space-y-2 pt-2 border-t text-sm">
                    {([
                      ['Email', user?.email],
                      ['Account Type', user?.account_type],
                      ['Plant', user?.plant_name || '—'],
                      ['Department', user?.department_name || '—'],
                    ] as [string, string | undefined][]).map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1" disabled={editMutation.isPending}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="gap-1">
                      {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {([
                    ['Name', `${user?.first_name} ${user?.last_name}`],
                    ['Email', user?.email],
                    ['Designation', user?.designation || '—'],
                    ['Account Type', user?.account_type],
                    ['Plant', user?.plant_name || '—'],
                    ['Department', user?.department_name || '—'],
                  ] as [string, string | undefined][]).map(([label, value]) => (
                    <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value ?? '—'}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Roles</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {user?.roles?.map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-xs">{r.display_name}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Matrices Tab */}
      {activeTab === 'matrices' && <ApprovalMatricesTab />}

      {/* System Tab */}
      {activeTab === 'system' && <SystemSettingsTab />}

      {/* Platform Tab */}
      {activeTab === 'platform' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Platform Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {([
                ['Platform', 'ProcureAI'],
                ['Version', '1.0.0'],
                ['AI Model', 'Claude Sonnet 4.6'],
                ['Environment', process.env.NODE_ENV],
              ] as [string, string | undefined][]).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
