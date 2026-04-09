'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Search, X, ChevronDown, ChevronUp, Loader2, Trash2, Pencil } from 'lucide-react'
import apiClient from '@/lib/api/client'

const CLAUSE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'custom', label: 'Custom' },
  { value: 'mandatory', label: 'Mandatory' },
]

const CATEGORIES = [
  { value: 'payment', label: 'Payment Terms' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'liability', label: 'Liability' },
  { value: 'termination', label: 'Termination' },
  { value: 'confidentiality', label: 'Confidentiality' },
  { value: 'ip', label: 'IP' },
  { value: 'force_majeure', label: 'Force Majeure' },
  { value: 'dispute', label: 'Dispute' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'penalty', label: 'Penalty' },
  { value: 'general', label: 'General' },
]

const CONTRACT_TYPES_ALL = ['MSA', 'LTA', 'SLA', 'Tooling', 'NDA', 'SOW']

export default function ContractClausesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // New/Edit clause form
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('standard')
  const [formCategory, setFormCategory] = useState('general')
  const [formBody, setFormBody] = useState('')
  const [formApplicable, setFormApplicable] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['contract-clauses-all', search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ active_only: 'true' })
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      const { data } = await apiClient.get(`/contracts/clauses/?${params}`)
      return data.results ?? data
    },
  })

  const clauses: any[] = data || []

  const resetForm = () => {
    setFormTitle(''); setFormType('standard'); setFormCategory('general')
    setFormBody(''); setFormApplicable([])
    setEditingId(null); setShowAdd(false)
  }

  const startEdit = (c: any) => {
    setFormTitle(c.title)
    setFormType(c.clause_type)
    setFormCategory(c.category)
    setFormBody(c.body)
    setFormApplicable(c.applicable_contract_types || [])
    setEditingId(c.id)
    setShowAdd(true)
    setExpandedId(null)
  }

  const toggleApplicable = (type: string) => {
    setFormApplicable(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: formTitle,
        clause_type: formType,
        category: formCategory,
        body: formBody,
        applicable_contract_types: formApplicable,
        is_active: true,
      }
      if (editingId) {
        const { data } = await apiClient.patch(`/contracts/clauses/${editingId}/`, payload)
        return data
      } else {
        const { data } = await apiClient.post('/contracts/clauses/', payload)
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-clauses-all'] })
      resetForm()
      toast({ title: editingId ? 'Clause updated' : 'Clause created' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/contracts/clauses/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-clauses-all'] })
      toast({ title: 'Clause deleted' })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Clause Library</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-9 h-9 w-48" placeholder="Search clauses..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="h-9 border rounded-md px-3 text-sm bg-background"
            value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {(search || categoryFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setCategoryFilter('') }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setShowAdd(true) }}>
            <Plus className="w-3.5 h-3.5" /> New Clause
          </Button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <Card className="border-primary">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{editingId ? 'Edit Clause' : 'New Clause'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input className="h-8 text-sm" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Force Majeure" />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <select className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                  value={formType} onChange={e => setFormType(e.target.value)}>
                  {CLAUSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                  value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Applicable Contract Types</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CONTRACT_TYPES_ALL.map(type => (
                  <button key={type} type="button"
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      formApplicable.includes(type)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-muted-foreground border-slate-200 hover:border-primary'
                    }`}
                    onClick={() => toggleApplicable(type)}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Clause Body</Label>
              <textarea className="w-full min-h-[150px] border rounded-md p-3 text-xs font-mono bg-background resize-y"
                value={formBody} onChange={e => setFormBody(e.target.value)}
                placeholder="Enter the full clause text..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" disabled={!formTitle || !formBody || saveMutation.isPending}
                onClick={() => saveMutation.mutate()} className="gap-1.5">
                {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {!isLoading && (
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.filter(c => clauses.some((cl: any) => cl.category === c.value)).map(c => {
            const count = clauses.filter((cl: any) => cl.category === c.value).length
            return (
              <button key={c.value}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  categoryFilter === c.value ? 'bg-primary text-white border-primary' : 'hover:border-primary'
                }`}
                onClick={() => setCategoryFilter(categoryFilter === c.value ? '' : c.value)}>
                {c.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Clauses list */}
      {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
      {!isLoading && clauses.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">No clauses found.</div>
      )}

      <div className="space-y-2">
        {clauses.map((c: any) => {
          const isExpanded = expandedId === c.id
          return (
            <Card key={c.id}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant={c.clause_type === 'mandatory' ? 'destructive' : c.clause_type === 'custom' ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0">{c.clause_type}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px]">{c.category}</Badge>
                      {(c.applicable_contract_types || []).map((t: string) => (
                        <span key={t} className="text-[9px] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={e => { e.stopPropagation(); startEdit(c) }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                    onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.hash_id || c.id) }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 border-t">
                  <div className="mt-3 p-4 bg-slate-50 rounded-lg border overflow-auto max-h-[400px]">
                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{c.body}</pre>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
