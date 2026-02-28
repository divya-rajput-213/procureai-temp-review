'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Search, Pencil, Loader2, X } from 'lucide-react'
import apiClient from '@/lib/api/client'

interface Item {
  id: number
  code: string
  description: string
  unit_of_measure: string
  category: string
  sap_material_code: string
  is_active: boolean
}

interface ItemFormData {
  code: string
  description: string
  unit_of_measure: string
  category: string
  sap_material_code: string
  is_active: boolean
}

const EMPTY_FORM: ItemFormData = {
  code: '',
  description: '',
  unit_of_measure: 'EA',
  category: '',
  sap_material_code: '',
  is_active: true,
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

function ItemModal({
  item,
  onClose,
}: {
  item: Item | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = item !== null

  const [form, setForm] = useState<ItemFormData>(
    isEdit
      ? {
          code: item.code,
          description: item.description,
          unit_of_measure: item.unit_of_measure,
          category: item.category ?? '',
          sap_material_code: item.sap_material_code ?? '',
          is_active: item.is_active,
        }
      : { ...EMPTY_FORM },
  )
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormData, string>>>({})

  const saveMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      if (isEdit) {
        return (await apiClient.patch(`/inventory/items/${item.id}/`, data)).data
      }
      return (await apiClient.post('/inventory/items/', data)).data
    },
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
    if (!form.unit_of_measure.trim()) errs.unit_of_measure = 'Unit of measure is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) saveMutation.mutate(form)
  }

  function set(field: keyof ItemFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Code */}
              <div className="space-y-1">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder="e.g. BOLT-M10"
                />
                {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
              </div>

              {/* Unit of Measure */}
              <div className="space-y-1">
                <Label>Unit of Measure <span className="text-destructive">*</span></Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={form.unit_of_measure}
                  onChange={(e) => set('unit_of_measure', e.target.value)}
                >
                  {['EA', 'KG', 'LTR', 'MTR', 'PCS', 'SET', 'BOX', 'BAG', 'TON', 'NOS'].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                {errors.unit_of_measure && <p className="text-xs text-destructive">{errors.unit_of_measure}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Full item description"
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-1">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  placeholder="e.g. Fasteners"
                />
              </div>

              {/* SAP Material Code */}
              <div className="space-y-1">
                <Label className="text-xs">Unit Rate (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  onChange={(e) => set('sap_material_code', e.target.value)}
                                      />
              </div>

            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
            </div>
          </div>

          {/* Footer */}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ItemsInventoryPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ['items-inventory', search, showInactive],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (showInactive) params.set('is_active', 'false')
      const r = await apiClient.get(`/inventory/items/?${params.toString()}`)
      return r.data.results ?? r.data
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await apiClient.patch(`/inventory/items/${id}/`, { is_active })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-inventory'] })
      toast({ title: 'Item status updated' })
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  })

  function openAdd() {
    setEditingItem(null)
    setModalOpen(true)
  }

  function openEdit(item: Item) {
    setEditingItem(item)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Items Inventory</h1>
        <Button onClick={openAdd} className="gap-1">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-primary w-4 h-4"
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading items…
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No items found.{' '}
              <button type="button" onClick={openAdd} className="text-primary underline underline-offset-2">
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
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">SAP Code</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{item.description}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{item.category || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">
                        {item.sap_material_code || '—'}
                      </td>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {modalOpen && <ItemModal item={editingItem} onClose={closeModal} />}
    </div>
  )
}
