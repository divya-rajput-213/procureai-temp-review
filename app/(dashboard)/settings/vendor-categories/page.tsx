'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus, Search, Pencil, Loader2, X, Trash2, Download, Upload,
  CheckCircle, XCircle, ArrowLeft,
} from 'lucide-react'
import apiClient from '@/lib/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorCategory { id: number; hash_id: string; series_code: string; name: string; is_active: boolean }
interface CategoryFormData { series_code: string; name: string; is_active: boolean }

const EMPTY_FORM: CategoryFormData = { series_code: '', name: '', is_active: true }

const CATEGORY_FIELDS = [
  { key: 'series_code', label: 'Series Code', required: true },
  { key: 'name',        label: 'Name',        required: true },
  { key: 'is_active',   label: 'Is Active',   required: false },
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
  for (const field of CATEGORY_FIELDS) {
    const match = csvHeaders.find(h =>
      h.toLowerCase().replace(/[\s_-]/g, '') === field.key.toLowerCase().replace(/[\s_-]/g, '') ||
      h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0].toLowerCase())
    )
    if (match) mapping[field.key] = match
  }
  return mapping
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function CategoryModal({ category, onClose }: Readonly<{
  category: VendorCategory | null; onClose: () => void
}>) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = category !== null

  const [form, setForm] = useState<CategoryFormData>(
    isEdit ? { series_code: category.series_code, name: category.name, is_active: category.is_active } : { ...EMPTY_FORM }
  )
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({})

  const saveMutation = useMutation({
    mutationFn: async (data: CategoryFormData) =>
      isEdit ? (await apiClient.patch(`/vendors/categories/${category.hash_id}/`, data)).data
             : (await apiClient.post('/vendors/categories/', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-categories-manage'] })
      toast({ title: isEdit ? 'Category updated' : 'Category created' })
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      if (detail && typeof detail === 'object') {
        const errs: any = {}
        for (const [k, v] of Object.entries(detail)) {
          errs[k] = Array.isArray(v) ? v[0] : v
        }
        setErrors(errs)
      } else {
        toast({ title: 'Failed to save category', variant: 'destructive' })
      }
    },
  })

  function validate(): boolean {
    const errs: Partial<Record<keyof CategoryFormData, string>> = {}
    if (!form.series_code) errs.series_code = 'Series code is required'
    if (!form.name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function set(field: keyof CategoryFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Category' : 'Add Vendor Category'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (validate()) saveMutation.mutate(form) }} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-1">
              <Label>Series Code <span className="text-destructive">*</span></Label>
              <Input
                value={form.series_code}
                onChange={e => set('series_code', e.target.value)}
                placeholder="e.g. 15, 45, 50"
                disabled={isEdit}
              />
              {errors.series_code && <p className="text-xs text-destructive">{errors.series_code}</p>}
            </div>
            <div className="space-y-1">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Capital Expenditure" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
              {isEdit ? 'Save Changes' : 'Add Category'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ category, onClose }: Readonly<{ category: VendorCategory; onClose: () => void }>) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => apiClient.delete(`/vendors/categories/${category.hash_id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-categories-manage'] })
      toast({ title: 'Category deleted' })
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to delete category'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h2 className="text-base font-semibold">Delete Vendor Category</h2>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-medium text-foreground">{category.name}</span>?
          Categories with vendors assigned cannot be deleted.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()} className="gap-2">
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

function ImportPanel({ onClose, onDone }: Readonly<{ onClose: () => void; onDone: () => void }>) {
  const { toast } = useToast()
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
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

  function applyMapping(rows: Record<string, string>[]): Record<string, string>[] {
    return rows.map(row => {
      const out: Record<string, string> = {}
      for (const field of CATEGORY_FIELDS) {
        const csvCol = mapping[field.key]
        out[field.key] = csvCol ? (row[csvCol] ?? '') : ''
      }
      return out
    })
  }

  async function runImport() {
    const requiredMissing = CATEGORY_FIELDS.filter(f => f.required && !mapping[f.key])
    if (requiredMissing.length > 0) {
      toast({ title: `Map required fields: ${requiredMissing.map(f => f.label).join(', ')}`, variant: 'destructive' })
      return
    }
    setImporting(true)
    try {
      const mapped = applyMapping(csvRows)
      const { data } = await apiClient.post('/vendors/categories/bulk-import/', { rows: mapped })
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
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold">Import Vendor Categories from CSV</h2>
      </div>

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
              <p className="text-xs text-muted-foreground">Columns: series_code, name, is_active</p>
            </div>
            <div className="mt-3 text-center">
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2"
                onClick={() => {
                  const csv = 'series_code,name,is_active\n15,CapEx - Series 15,true\n45,Productive - Series 45,true\n50,Non-Productive - Series 50,true'
                  const a = document.createElement('a')
                  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
                  a.download = 'sample_vendor_categories.csv'
                  a.click()
                }}
              >
                Download sample CSV
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {csvHeaders.length > 0 && !result && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Map Columns</CardTitle>
              <p className="text-xs text-muted-foreground">{csvRows.length} rows detected. Match each system field to a CSV column.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {CATEGORY_FIELDS.map(field => (
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preview (first {previewRows.length} rows)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {CATEGORY_FIELDS.filter(f => mapping[f.key]).map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-medium text-muted-foreground">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {CATEGORY_FIELDS.filter(f => mapping[f.key]).map(f => (
                          <td key={f.key} className="px-3 py-2 max-w-[200px] truncate">{row[mapping[f.key]] ?? ''}</td>
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
            <Button onClick={runImport} disabled={importing} className="gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {csvRows.length} Rows
            </Button>
          </div>
        </>
      )}

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

export default function VendorCategoriesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<VendorCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<VendorCategory | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const { data: categories, isLoading } = useQuery<VendorCategory[]>({
    queryKey: ['vendor-categories-manage', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const r = await apiClient.get(`/vendors/categories/?${params.toString()}`)
      return r.data.results ?? r.data
    },
  })


  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch(`/vendors/categories/${id}/`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-categories-manage'] })
      toast({ title: 'Category status updated' })
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const response = await apiClient.get('/vendors/categories/export/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'vendor_categories.csv'; a.click()
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
          queryClient.invalidateQueries({ queryKey: ['vendor-categories-manage'] })
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
          <Input placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          <Button size="sm" onClick={() => { setEditingCategory(null); setModalOpen(true) }} className="gap-1">
            <Plus className="w-4 h-4" /> Add Category
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading categories…
            </div>
          )}
          {!isLoading && (!categories || categories.length === 0) && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No vendor categories found.{' '}
              <button type="button" onClick={() => { setEditingCategory(null); setModalOpen(true) }} className="text-primary underline underline-offset-2">
                Add the first one.
              </button>
            </div>
          )}
          {!isLoading && categories && categories.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Series Code</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{cat.series_code}</td>
                      <td className="px-4 py-3 font-medium">{cat.name}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={cat.is_active ? 'default' : 'secondary'}
                          className="text-xs cursor-pointer"
                          onClick={() => toggleActiveMutation.mutate({ id: cat.hash_id, is_active: !cat.is_active })}
                        >
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingCategory(cat); setModalOpen(true) }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingCategory(cat)}>
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

      {modalOpen && (
        <CategoryModal category={editingCategory} onClose={() => { setModalOpen(false); setEditingCategory(null) }} />
      )}
      {deletingCategory && (
        <DeleteConfirm category={deletingCategory} onClose={() => setDeletingCategory(null)} />
      )}
    </div>
  )
}
