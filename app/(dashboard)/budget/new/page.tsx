'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Loader2, X, ChevronDown, ChevronRight, Save, Send } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  priority: z.enum(['low', 'medium', 'high']),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  description: z.string().min(5, 'Description is required'),
  justification: z.string().optional(),
  requested_amount: z.number().positive('Budget amount is required'),
})

type FormData = z.infer<typeof schema>

const PRIORITY_OPTS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700 border-red-200' },
]

export default function NewBudgetPage() {
  const router = useRouter()
  const { toast } = useToast()
  const submitModeRef = useRef<'draft' | 'approval'>('draft')

  const [selectedVendors, setSelectedVendors] = useState<any[]>([])
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorSearch, setShowVendorSearch] = useState(false)
  const [showApprovalPanel, setShowApprovalPanel] = useState(false)
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
  })
  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved', vendorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (vendorSearch) params.set('search', vendorSearch)
      const r = await apiClient.get(`/vendors/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: showVendorSearch,
  })
  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'budget_approval'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/?matrix_type=budget_approval&is_active=true')
      return r.data.results ?? r.data
    },
    enabled: showApprovalPanel,
  })

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium' },
  })

  const watchedPriority = watch('priority')
  const watchedAmount = watch('requested_amount')

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const mode = submitModeRef.current
      const payload = {
        ...data,
        preferred_vendor_ids: selectedVendors.map(v => v.id),
        status: 'draft',
      }
      const { data: budget } = await apiClient.post('/budget/tracking-ids/', payload)
      if (mode === 'approval') {
        const body: Record<string, any> = {}
        if (selectedMatrix) body.matrix_id = selectedMatrix
        await apiClient.post(`/budget/tracking-ids/${budget.id}/submit-for-approval/`, body)
      }
      return { budget, mode }
    },
    onSuccess: ({ budget, mode }) => {
      if (mode === 'approval') {
        toast({ title: `Budget ${budget.tracking_code} submitted for approval.` })
      } else {
        toast({ title: `Budget ${budget.tracking_code} saved as draft.` })
      }
      router.push('/budget')
    },
    onError: (err: any) => {
      toast({ title: 'Submission failed', description: JSON.stringify(err?.response?.data), variant: 'destructive' })
    },
  })

  const addVendor = (v: any) => {
    if (!selectedVendors.some(x => x.id === v.id)) {
      setSelectedVendors(prev => [...prev, v])
    }
    setShowVendorSearch(false)
    setVendorSearch('')
  }
  const removeVendor = (id: number) => setSelectedVendors(prev => prev.filter(v => v.id !== id))

  const handleDraft = handleSubmit(data => {
    submitModeRef.current = 'draft'
    createMutation.mutate(data)
  })

  const handleApproval = handleSubmit(data => {
    submitModeRef.current = 'approval'
    createMutation.mutate(data)
  })

  const toggleMatrixExpand = (id: number) => {
    setExpandedMatrix(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/budget')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-lg font-semibold">New Budget Request</h1>
      </div>

      <form className="space-y-6">

        {/* ── Section 1: Basic Information ────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input {...register('title')} placeholder="e.g. Enterprise Laptop Procurement" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Priority *</Label>
                <div className="flex gap-2">
                  {PRIORITY_OPTS.map(p => {
                    const isSelected = watchedPriority === p.value
                    const labelCls = isSelected
                      ? `${p.color} border-current`
                      : 'border-slate-200 text-muted-foreground hover:border-slate-300'
                    return (
                    <label key={p.value} className={`flex-1 border rounded-lg px-2 py-2.5 cursor-pointer text-center text-xs font-medium transition-all ${labelCls}`}>
                      <input type="radio" value={p.value} {...register('priority')} className="sr-only" />
                      {p.label}
                    </label>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Plant *</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  onChange={e => setValue('plant', Number(e.target.value))}
                >
                  <option value="">Select plant...</option>
                  {(plants || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
                {errors.plant && <p className="text-xs text-destructive">{errors.plant.message}</p>}
              </div>

              <div className="space-y-1">
                <Label>Department *</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  onChange={e => setValue('department', Number(e.target.value))}
                >
                  <option value="">Select department...</option>
                  {(departments || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Requirements ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input {...register('description')} placeholder="Brief description of what you need..." />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Detailed Requirements</Label>
              <textarea
                {...register('justification')}
                className="w-full border rounded-md p-3 text-sm resize-none h-28"
                placeholder="Detailed specifications, technical requirements, business justification..."
              />
            </div>

            <div className="space-y-1 max-w-xs">
              <Label>Estimated Budget (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('requested_amount', { valueAsNumber: true })}
              />
              {watchedAmount > 0 && (
                <p className="text-xs text-muted-foreground">{formatCurrency(watchedAmount)}</p>
              )}
              {errors.requested_amount && <p className="text-xs text-destructive">{errors.requested_amount.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 3: Preferred Vendors ────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Preferred Vendors{' '}
              <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              List vendors you'd prefer to source from. Finance may suggest alternatives during review.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search input with dropdown */}
            <div className="relative">
              <Input
                placeholder="Search approved vendors..."
                value={vendorSearch}
                onChange={e => { setVendorSearch(e.target.value); setShowVendorSearch(true) }}
                onFocus={() => setShowVendorSearch(true)}
                onBlur={() => setTimeout(() => setShowVendorSearch(false), 150)}
                className="h-9"
              />
              {showVendorSearch && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-md bg-background shadow-md max-h-56 overflow-y-auto divide-y">
                  {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm"
                      onClick={() => addVendor(v)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{v.company_name}</span>
                        <span className="text-xs text-muted-foreground">{v.status}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        {v.category_name && <span>{v.category_name}</span>}
                        {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                      </div>
                    </button>
                  ))}
                  {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).length === 0 && vendorSearch && (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">No vendors found.</p>
                  )}
                </div>
              )}
            </div>

            {/* Selected vendor cards */}
            {selectedVendors.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {selectedVendors.map((v: any) => (
                  <div key={v.id} className="relative border rounded-lg p-3 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => removeVendor(v.id)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="font-medium text-sm pr-5">{v.company_name}</p>
                    {v.category_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{v.category_name}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                      {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                      {v.contact_email && <span>{v.contact_email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Approval Matrix Selector ─────────────────────────── */}
        {showApprovalPanel && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Approval Matrix</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Choose the approval workflow for this budget request.</p>
            </CardHeader>
            <CardContent>
              {(() => {
                if (matrices && matrices.length > 0) return (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Matrix Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Plant</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Levels</th>
                        <th className="w-8 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {matrices.map((m: any) => (
                        <>
                          <tr
                            key={m.id}
                            className={`cursor-pointer transition-colors ${selectedMatrix === m.id ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                            onClick={() => { setSelectedMatrix(m.id); setExpandedMatrix(m.id) }}
                          >
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="radio"
                                name="approval-matrix"
                                checked={selectedMatrix === m.id}
                                onChange={() => { setSelectedMatrix(m.id); setExpandedMatrix(m.id) }}
                                className="accent-primary"
                                onClick={e => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-3 py-2.5 font-medium">{m.name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{m.plant_name || 'All Plants'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{m.levels?.length ?? 0} level{(m.levels?.length ?? 0) === 1 ? '' : 's'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); toggleMatrixExpand(m.id) }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {expandedMatrix === m.id
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                          {expandedMatrix === m.id && m.levels?.length > 0 && (
                            <tr key={`${m.id}-levels`}>
                              <td colSpan={5} className="p-0">
                                <div className="bg-slate-50 border-t px-6 py-3">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground">
                                        <th className="text-left py-1 pr-4 font-medium">Level #</th>
                                        <th className="text-left py-1 pr-4 font-medium">Approver</th>
                                        <th className="text-left py-1 pr-4 font-medium">Role</th>
                                        <th className="text-left py-1 font-medium">SLA</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {m.levels.map((lv: any) => (
                                        <tr key={lv.id}>
                                          <td className="py-1.5 pr-4 text-muted-foreground">L{lv.level_number}</td>
                                          <td className="py-1.5 pr-4 font-medium">{lv.user_name ?? '—'}</td>
                                          <td className="py-1.5 pr-4 text-muted-foreground">{lv.role_name ?? '—'}</td>
                                          <td className="py-1.5 text-muted-foreground">{lv.sla_hours ? `${lv.sla_hours}h` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
                )
                if (matrices && matrices.length === 0) return (
                  <p className="text-xs text-amber-600">No active budget approval matrices configured.</p>
                )
                return (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices...
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button type="button" variant="outline" onClick={() => router.push('/budget')}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              className="gap-2"
              onClick={handleDraft}
            >
              {createMutation.isPending && submitModeRef.current === 'draft'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              Save as Draft
            </Button>
            {showApprovalPanel ? (
              <Button
                type="button"
                disabled={createMutation.isPending || (matrices && matrices.length > 0 && selectedMatrix === null)}
                className="gap-2"
                onClick={handleApproval}
              >
                {createMutation.isPending && submitModeRef.current === 'approval'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                Confirm &amp; Submit
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-2"
                onClick={() => setShowApprovalPanel(true)}
              >
                <Send className="w-4 h-4" />
                Submit for Approval
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
