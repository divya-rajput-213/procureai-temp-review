'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Search, X, ChevronDown, ChevronUp, Loader2, Trash2, Save } from 'lucide-react'
import apiClient from '@/lib/api/client'

const CONTRACT_TYPES = [
  { value: 'MSA', label: 'MSA' },
  { value: 'LTA', label: 'LTA' },
  { value: 'SLA', label: 'SLA' },
  { value: 'Tooling', label: 'Tooling' },
  { value: 'NDA', label: 'NDA' },
  { value: 'SOW', label: 'SOW' },
]

export default function ContractTemplatesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [typeFilter, setTypeFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // New template form
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('MSA')
  const [newBody, setNewBody] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['contract-templates-all', typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (typeFilter) params.set('contract_type', typeFilter)
      const { data } = await apiClient.get(`/contracts/templates/?${params}`)
      return data.results ?? data
    },
  })

  const templates: any[] = data || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/contracts/templates/', {
        name: newName,
        contract_type: newType,
        body_template: newBody,
        is_active: true,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates-all'] })
      setShowAdd(false)
      setNewName(''); setNewBody('')
      toast({ title: 'Template created' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/contracts/templates/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates-all'] })
      toast({ title: 'Template deleted' })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Contract Templates</h1>
        <div className="flex items-center gap-2">
          <select className="h-9 border rounded-md px-3 text-sm bg-background"
            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-3.5 h-3.5" /> New Template
          </Button>
        </div>
      </div>

      {/* Add template form */}
      {showAdd && (
        <Card className="border-primary">
          <CardHeader className="py-3"><CardTitle className="text-sm">New Template</CardTitle></CardHeader>
          <CardContent className="space-y-3 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Template Name</Label>
                <Input className="h-8 text-sm" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Standard MSA for Auto Components" />
              </div>
              <div>
                <Label className="text-xs">Contract Type</Label>
                <select className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                  value={newType} onChange={e => setNewType(e.target.value)}>
                  {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Template Body (use {`{{vendor_name}}`}, {`{{contract_value}}`}, {`{{start_date}}`}, {`{{end_date}}`} as placeholders)</Label>
              <textarea className="w-full min-h-[200px] border rounded-md p-3 text-xs font-mono bg-background resize-y"
                value={newBody} onChange={e => setNewBody(e.target.value)}
                placeholder="Paste or type the contract template body here..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" disabled={!newName || !newBody || createMutation.isPending}
                onClick={() => createMutation.mutate()} className="gap-1.5">
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates list */}
      {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
      {!isLoading && templates.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">No templates found. Create one or run the seed command.</div>
      )}

      <div className="space-y-2">
        {templates.map((t: any) => {
          const isExpanded = expandedId === t.id
          return (
            <Card key={t.id} className={isExpanded ? 'border-primary/50' : ''}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[10px] w-14 justify-center">{t.contract_type}</Badge>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.clause_count ? `${t.clause_count} clauses` : 'No clauses'}
                      {t.category_name && ` \u00B7 ${t.category_name}`}
                      {` \u00B7 ${(t.body_template || t.body || '').length} chars`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                    onClick={e => { e.stopPropagation(); deleteMutation.mutate(t.hash_id || t.id) }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 border-t">
                  <div className="mt-3 p-4 bg-slate-50 rounded-lg border overflow-auto max-h-[500px]">
                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                      {t.body_template || t.body || 'No body content'}
                    </pre>
                  </div>
                  {t.default_clauses_detail && t.default_clauses_detail.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Linked Clauses ({t.default_clauses_detail.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.default_clauses_detail.map((c: any) => (
                          <Badge key={c.id} variant="outline" className="text-[10px]">{c.title}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
