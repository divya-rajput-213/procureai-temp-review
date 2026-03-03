'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus, Search, Pencil, Loader2, X, Download, Upload,
  CheckCircle, XCircle, ArrowLeft, Trash2, AlertTriangle,
} from 'lucide-react'
import apiClient from '@/lib/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: number; name: string; is_active: boolean }
interface Item {
  id: number; code: string; description: string; unit_of_measure: string
  category: number | null; category_name: string; unit_rate: string; is_active: boolean
}
interface ItemFormData {
  code: string; description: string; unit_of_measure: string
  category: number | ''; unit_rate: string; is_active: boolean
}

const EMPTY_FORM: ItemFormData = { code: '', description: '', unit_of_measure: 'EA', category: '', unit_rate: '', is_active: true }
const UOM_OPTIONS = ['EA', 'KG', 'LTR', 'MTR', 'PCS', 'SET', 'BOX', 'BAG', 'TON', 'NOS']

// System fields available for column mapping
const ITEM_FIELDS = [
  { key: 'code',              label: 'Item Code',         required: true },
  { key: 'description',       label: 'Description',       required: true },
  { key: 'unit_of_measure',   label: 'Unit of Measure',   required: false },
  { key: 'category',          label: 'Category',          required: false },
  { key: 'unit_rate',         label: 'Unit Rate',         required: false },
  { key: 'is_active',         label: 'Is Active',         required: false },
]

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const result: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

function autoDetectMapping(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const field of ITEM_FIELDS) {
    const match = csvHeaders.find(h =>
      h.toLowerCase().replace(/[\s_-]/g, '') === field.key.toLowerCase().replace(/[\s_-]/g, '') ||
      h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
    )
    if (match) mapping[field.key] = match
  }
  return mapping
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function ItemModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = item !== null

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['item-categories-active'],
    queryFn: async () => (await apiClient.get('/procurement/categories/?active_only=true')).data.results ?? (await apiClient.get('/procurement/categories/?active_only=true')).data,
  })

  const [form, setForm] = useState<ItemFormData>(
    isEdit
      ? { code: item.code, description: item.description, unit_of_measure: item.unit_of_measure, category: item.category ?? '', unit_rate: item.unit_rate ?? '', is_active: item.is_active }
      : { ...EMPTY_FORM }
  )
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormData, string>>>({})

  const saveMutation = useMutation({
    mutationFn: async (data: ItemFormData) =>
      isEdit ? (await apiClient.patch(`/procurement/items/${item.id}/`, data)).data
             : (await apiClient.post('/procurement/items/', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-inventory'] })
      toast({ title: isEdit ? 'Item updated' : 'Item created' })
      onClose()
    },
    onError: () => toast({ title: 'Failed to save item', variant: 'destructive' }),
  })

  function validate(): boolean {
    const errs: Partial<Record<keyof ItemFormData, string>> = {}
    if (!form.code.trim()) errs.code = 'Code is required'
    if (!form.description.trim()) errs.description = 'Description is required'
    if (!form.category) errs.category = 'Category is required'
    if (!form.unit_rate) errs.unit_rate = 'Unit Rate is required'
    if (!form.unit_of_measure.trim()) errs.unit_of_measure = 'Unit of measure is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function set(field: keyof ItemFormData, value: string | boolean | number | null) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (validate()) saveMutation.mutate(form) }}>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Full item description" />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. BOLT-M10" />
                {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
              </div>
              <div className="space-y-1">
                <Label>Unit of Measure <span className="text-destructive">*</span></Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" value={form.unit_of_measure} onChange={e => set('unit_of_measure', e.target.value)}>
                  {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                {errors.unit_of_measure && <p className="text-xs text-destructive">{errors.unit_of_measure}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background" value={form.category} onChange={e => set('category', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select category…</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
              </div>
              <div className="space-y-1">
                <Label>Unit Rate (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.unit_rate} onChange={e => set('unit_rate', e.target.value)} />
                {errors.unit_rate && <p className="text-xs text-destructive">{errors.unit_rate}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="is_active" type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="accent-primary w-4 h-4" />
              <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

function ImportPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})    // field.key → csv header
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; errors: { row: number; error: string }[] } | null>(null)

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target?.result as string)
      setCsvHeaders(headers)
      setCsvRows(rows)
      setMapping(autoDetectMapping(headers))
      setResult(null)
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] }, maxFiles: 1,
  })

  const duplicateCodes = useMemo(() => {
    const codeCol = mapping['code']
    if (!codeCol || csvRows.length === 0) return []
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const row of csvRows) {
      const code = (row[codeCol] ?? '').trim().toUpperCase()
      if (code) {
        if (seen.has(code)) dupes.add(code)
        seen.add(code)
      }
    }
    return [...dupes]
  }, [csvRows, mapping])

  function applyMapping(rows: Record<string, string>[]): Record<string, string>[] {
    return rows.map(row => {
      const out: Record<string, string> = {}
      for (const field of ITEM_FIELDS) {
        const csvCol = mapping[field.key]
        out[field.key] = csvCol ? (row[csvCol] ?? '') : ''
      }
      return out
    })
  }

  async function runImport() {
    const requiredMissing = ITEM_FIELDS.filter(f => f.required && !mapping[f.key])
    if (requiredMissing.length > 0) {
      toast({ title: `Map required fields: ${requiredMissing.map(f => f.label).join(', ')}`, variant: 'destructive' })
      return
    }
    if (duplicateCodes.length > 0) {
      toast({ title: `Fix duplicate codes before importing: ${duplicateCodes.join(', ')}`, variant: 'destructive' })
      return
    }
    setImporting(true)
    try {
      const mapped = applyMapping(csvRows)
      const { data } = await apiClient.post('/procurement/items/bulk-import/', { rows: mapped })
      setResult(data)
      if (data.errors.length === 0) {
        toast({ title: `Import complete: ${data.created} created, ${data.updated} updated.` })
        onDone()
      }
    } catch {
      toast({ title: 'Import failed', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const previewRows = csvRows.slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold">Import Items from CSV</h2>
      </div>

      {/* Drop zone */}
      {csvHeaders.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Drop CSV file here or click to select</p>
              <p className="text-xs text-muted-foreground">Columns: code, description, unit_of_measure, category, unit_rate</p>
            </div>
            <div className="mt-3 text-center">
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2"
                onClick={() => {
                  const csv = 'code,description,unit_of_measure,category,unit_rate,is_active\nBOLT-M10,M10 Hex Bolt,EA,Fasteners,12.50,true\nCBL-2.5,2.5mm Copper Cable,MTR,Electrical,85.00,true'
                  const a = document.createElement('a')
                  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
                  a.download = 'sample_items.csv'
                  a.click()
                }}
              >
                Download sample CSV
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column mapping + preview */}
      {csvHeaders.length > 0 && !result && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Map Columns</CardTitle>
              <p className="text-xs text-muted-foreground">{csvRows.length} rows detected. Match each system field to a CSV column.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ITEM_FIELDS.map(field => (
                  <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.required && <span className="text-destructive text-xs">*</span>}
                    </div>
                    <select
                      className="h-9 border rounded-md px-3 text-sm bg-background w-full"
                      value={mapping[field.key] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                    >
                      <option value="">— skip —</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Duplicate warning */}
          {duplicateCodes.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Duplicate codes detected:</strong> {duplicateCodes.join(', ')}. Remove duplicates from your CSV before importing.
              </span>
            </div>
          )}

          {/* Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preview (first {previewRows.length} rows)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {ITEM_FIELDS.filter(f => mapping[f.key]).map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-medium text-muted-foreground">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {ITEM_FIELDS.filter(f => mapping[f.key]).map(f => (
                          <td key={f.key} className="px-3 py-2 max-w-[160px] truncate">{row[mapping[f.key]] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => { setCsvHeaders([]); setCsvRows([]) }}>
              Choose Different File
            </Button>
            <Button onClick={runImport} disabled={importing || duplicateCodes.length > 0} className="gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {csvRows.length} Rows
            </Button>
          </div>
        </>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-6">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">{result.created} created</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">{result.updated} updated</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-4 h-4" />
                  <span className="font-medium">{result.errors.length} errors</span>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="border rounded-md overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2">Row</th>
                      <th className="text-left px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.errors.map((e, i) => (
                      <tr key={i} className="bg-red-50/50">
                        <td className="px-3 py-2">{e.row}</td>
                        <td className="px-3 py-2 text-red-700">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button variant="outline" onClick={onClose}>Done</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ItemsInventoryPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deletingItem, setDeletingItem] = useState<Item | null>(null)

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ['items-inventory', search, showInactive],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (showInactive) params.set('is_active', 'false')
      const r = await apiClient.get(`/procurement/items/?${params.toString()}`)
      return r.data.results ?? r.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/procurement/items/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-inventory'] })
      toast({ title: 'Item deleted' })
      setDeletingItem(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to delete item'
      toast({ title: msg, variant: 'destructive' })
      setDeletingItem(null)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiClient.patch(`/procurement/items/${id}/`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-inventory'] })
      toast({ title: 'Item status updated' })
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const response = await apiClient.get('/procurement/items/export/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'items.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  if (showImport) {
    return (
      <ImportPanel
        onClose={() => setShowImport(false)}
        onDone={() => {
          setShowImport(false)
          queryClient.invalidateQueries({ queryKey: ['items-inventory'] })
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search code or description..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="accent-primary w-4 h-4" />
          Show inactive
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setModalOpen(true) }} className="gap-1">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading items…
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No items found.{' '}
              <button type="button" onClick={() => { setEditingItem(null); setModalOpen(true) }} className="text-primary underline underline-offset-2">
                Add the first one.
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Code</th>
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Unit</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Category</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Unit Rate</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{item.description}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{item.category_name || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">{item.unit_rate || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={item.is_active ? 'default' : 'secondary'}
                          className="text-xs cursor-pointer"
                          onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingItem(item); setModalOpen(true) }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingItem(item)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && <ItemModal item={editingItem} onClose={() => { setModalOpen(false); setEditingItem(null) }} />}

      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Delete Item</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">{deletingItem.code}</span>?
              This cannot be undone. Items used in purchase requisitions cannot be deleted — deactivate them instead.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingItem.id)}
                className="gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
