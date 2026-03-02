'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Search, Pencil, Loader2, X, Trash2 } from 'lucide-react'
import apiClient from '@/lib/api/client'

interface Category {
  id: number
  name: string
  description: string
  is_active: boolean
  created_at: string
}

interface CategoryFormData {
  name: string
  description: string
  is_active: boolean
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  description: '',
  is_active: true,
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

function CategoryModal({
  category,
  onClose,
}: {
  category: Category | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = category !== null

  const [form, setForm] = useState<CategoryFormData>(
    isEdit
      ? { name: category.name, description: category.description, is_active: category.is_active }
      : { ...EMPTY_FORM },
  )
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({})

  const saveMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (isEdit) {
        return (await apiClient.patch(`/procurement/categories/${category.id}/`, data)).data
      }
      return (await apiClient.post('/procurement/categories/', data)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] })
      toast({ title: isEdit ? 'Category updated' : 'Category created' })
      onClose()
    },
    onError: () => toast({ title: 'Failed to save category', variant: 'destructive' }),
  })

  function validate(): boolean {
    const errs: Partial<Record<keyof CategoryFormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) saveMutation.mutate(form)
  }

  function set(field: keyof CategoryFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Category' : 'Add Category'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Fasteners"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional description"
              />
            </div>

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

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirm({
  category,
  onClose,
}: {
  category: Category
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/procurement/categories/${category.id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] })
      toast({ title: 'Category deleted' })
      onClose()
    },
    onError: () => toast({ title: 'Failed to delete category', variant: 'destructive' }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h2 className="text-base font-semibold">Delete Category</h2>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-medium text-foreground">{category.name}</span>?
          Items using this category will have it cleared.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            className="gap-2"
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ItemCategoriesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['item-categories', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const r = await apiClient.get(`/procurement/categories/?${params.toString()}`)
      return r.data.results ?? r.data
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await apiClient.patch(`/procurement/categories/${id}/`, { is_active })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] })
      toast({ title: 'Category status updated' })
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="sm:ml-auto">
          <Button onClick={() => { setEditingCategory(null); setModalOpen(true) }} className="gap-1">
            <Plus className="w-4 h-4" /> Add Category
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading categories…
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No categories found.{' '}
              <button
                type="button"
                onClick={() => { setEditingCategory(null); setModalOpen(true) }}
                className="text-primary underline underline-offset-2"
              >
                Add the first one.
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Description</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{cat.name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {cat.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={cat.is_active ? 'default' : 'secondary'}
                          className="text-xs cursor-pointer"
                          onClick={() => toggleActiveMutation.mutate({ id: cat.id, is_active: !cat.is_active })}
                        >
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setEditingCategory(cat); setModalOpen(true) }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeletingCategory(cat)}
                          >
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
        <CategoryModal
          category={editingCategory}
          onClose={() => { setModalOpen(false); setEditingCategory(null) }}
        />
      )}

      {deletingCategory && (
        <DeleteConfirm
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
        />
      )}
    </div>
  )
}
