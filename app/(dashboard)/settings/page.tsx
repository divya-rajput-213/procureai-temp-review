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
  ChevronUp,
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

// ─── Approval Matrices Tab ────────────────────────────────────────────────────

// ─── Matrix Form ──────────────────────────────────────────────────────────────

type LevelDraft = { level_number: number; user: string; role: string; sla_hours: number }
type MatrixDraft = { name: string; matrix_type: string; is_active: boolean; plant: string; levels: LevelDraft[] }

const EMPTY_DRAFT: MatrixDraft = {
  name: '', matrix_type: 'purchase_requisition', is_active: true, plant: '',
  levels: [{ level_number: 1, user: '', role: '', sla_hours: 72 }],
}

const MATRIX_TYPE_OPTIONS = [
  { value: 'purchase_requisition', label: 'Purchase Requisition' },
  { value: 'budget_approval',      label: 'Budget Approval' },
  { value: 'vendor_onboarding',    label: 'Vendor Onboarding' },
  { value: 'vendor_bid',           label: 'Vendor Bid Approval' },
]

function MatrixForm({ initial, onSave, onCancel, saving }: {
  initial?: MatrixDraft; onSave: (d: MatrixDraft) => void; onCancel: () => void; saving: boolean
}) {
  const [form, setForm] = useState<MatrixDraft>(initial ?? EMPTY_DRAFT)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

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

  const validate = () => {
    let formErrors: { [key: string]: string } = {}
    if (!form.name) formErrors.name = 'Matrix name is required.'
    if (!form.matrix_type) formErrors.matrix_type = 'Matrix type is required.'
    if (form.levels.length === 0) formErrors.levels = 'At least one approval level is required.'

    // Validate each level
    form.levels.forEach((level, idx) => {
      if (!level.user || !level.role) {
        formErrors[`level_${idx}`] = 'Both user and role are required for this level.'
      }
      if (level.sla_hours <= 0) {
        formErrors[`sla_${idx}`] = 'SLA hours must be greater than 0.'
      }
    })

    setErrors(formErrors)
    return Object.keys(formErrors).length === 0
  }

  const handleSave = () => {
    if (validate()) {
      onSave(form)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-3 space-y-1">
          <Label>Matrix Name *</Label>
          <Input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. PR Approval — Standard"
          />
          {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
        </div>
        <div className="space-y-1">
          <Label>Type *</Label>
          <select
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
            value={form.matrix_type}
            onChange={e => set('matrix_type', e.target.value)}
          >
            {MATRIX_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors.matrix_type && <p className="text-red-500 text-xs">{errors.matrix_type}</p>}
        </div>
        <div className="space-y-1">
          <Label>Plant</Label>
          <select
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
            value={form.plant}
            onChange={e => set('plant', e.target.value)}
          >
            <option value="">All Plants</option>
            {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
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
          <>
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
                <Input
                  type="number"
                  className="w-20 h-9 text-sm"
                  value={level.sla_hours}
                  onChange={e => setLevelSla(idx, Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">hrs</span>
              </div>
              {errors[`sla_${idx}`] && <p className="text-red-500 text-xs">{errors[`sla_${idx}`]}</p>}
              {form.levels.length > 1 && (
                <button type="button" onClick={() => removeLevel(idx)} className="text-red-400 hover:text-red-600 ml-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {errors[`level_${idx}`] && <p className="text-red-500 text-xs">{errors[`level_${idx}`]}</p>}
          </>


        ))}

      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Save Matrix
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}


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
          {/* <Settings className="w-8 h-8 mx-auto mb-2 opacity-30" /> */}
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

// ─── System Settings Tab ──────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham (د.إ)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (S$)' },
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

  const [activeTab, setActiveTab] = useState<'account' | 'matrices' | 'system'>('account')
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
    { key: 'account', label: 'Account' },
    { key: 'matrices', label: 'Matrix Config'},
    { key: 'system', label: 'System' },
  ] as const

  return (
    <div className="space-y-4">
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
      {activeTab === 'matrices' && <MatrixConfigTab />}

      {/* System Tab */}
      {activeTab === 'system' && <SystemSettingsTab />}


    </div>
  )
}