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
import { ArrowLeft, Loader2, X, Save, Send, Sparkles, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useSettingsStore } from '@/lib/stores/settings.store'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  priority: z.enum(['low', 'medium', 'high']),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description cannot exceed 500 characters'),
  requested_amount: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .min(1000, 'Minimum budget is ₹1,000')
    .max(100_000_000, 'Maximum budget is ₹10 Crore'),
})

type FormData = z.infer<typeof schema>

const PRIORITY_OPTS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700 border-red-200' },
]

function getAmountInputCls(hasError: boolean, amount: number) {
  if (hasError) return 'h-10 pl-7 border-destructive focus-visible:ring-destructive/30'
  if (amount >= 1000) return 'h-10 pl-7 border-emerald-400 focus-visible:ring-emerald-300/40'
  return 'h-10 pl-7'
}


export default function NewBudgetPage() {
  const router = useRouter()
  const { toast } = useToast()
  const submitModeRef = useRef<'draft' | 'approval'>('draft')
  const { currencySymbol } = useSettingsStore()

  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const [selectedVendors, setSelectedVendors] = useState<any[]>([])
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorSearch, setShowVendorSearch] = useState(false)
  const [showApprovalPanel, setShowApprovalPanel] = useState(true)
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
  
      const payload: Record<string, any> = {
        ...data,
        preferred_vendor_ids: selectedVendors.map(v => v.id),
        status: mode === 'approval' ? 'pending_approval' : 'draft',
      }
  
      //  send matrix only in approval mode
      if (mode === 'approval' && selectedMatrix) {
        payload.matrix_id = selectedMatrix
      }
  
      const response = await apiClient.post(
        '/budget/tracking-ids/',
        payload
      )
  
      const budget =
        response.data?.data ?? response.data
  
      return { budget, mode }
    },
  
    onSuccess: ({ budget, mode }) => {
      toast({
        title:
          mode === 'approval'
            ? `Budget submitted for approval.`
            : `Budget  saved as draft.`,
      })
  
      router.push('/budget')
    },
  
    onError: (err: any) => {
      toast({
        title: 'Submission failed',
        description:
          err?.response?.data?.message ||
          'Something went wrong',
        variant: 'destructive',
      })
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

  const handleAiFill = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)
    try {
      const { data } = await apiClient.post('/budget/ai-fill/', { description: aiInput })
      if (data.title) setValue('title', data.title)
      if (data.priority) setValue('priority', data.priority)
      if (data.description) setValue('description', data.description)
      if (data.requested_amount) setValue('requested_amount', data.requested_amount)
      setAiOpen(false)
      toast({ title: 'Form filled by AI', description: 'Review and adjust the fields before submitting.' })
    } catch {
      toast({ title: 'AI fill failed', description: 'Could not generate form data. Please try again.', variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  const selectCls = 'w-full h-10 border border-input rounded-md px-3 text-sm bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'
  const textareaCls = 'w-full border border-input rounded-md p-3 text-sm bg-background text-foreground resize-none h-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors placeholder:text-muted-foreground'

  const amountInputCls = getAmountInputCls(!!errors.requested_amount, watchedAmount)

  return (
    <div className="space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Budget Request</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details below to create a budget request.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setAiOpen(prev => !prev)}
            className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
          >
            <Sparkles className="w-4 h-4" />
            Create with AI
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/budget')} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      {/* ── AI Fill Panel ─────────────────────────────────────────────────── */}
      {aiOpen && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-semibold text-indigo-900">Describe your budget need</p>
          </div>
          <p className="text-xs text-indigo-700">
            Write a brief description — AI will auto-fill the title, priority, description, and estimated amount.
          </p>
          <textarea
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            placeholder="e.g. We need 20 laptops for the new engineering hires joining next month. These are high-performance machines for software development, estimated around ₹1.5L each."
            className="w-full border border-indigo-200 rounded-lg p-3 text-sm bg-white resize-none h-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 placeholder:text-slate-400"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAiOpen(false); setAiInput('') }} className="text-slate-500">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!aiInput.trim() || aiLoading}
              onClick={handleAiFill}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      )}

      <form className="space-y-5">

        {/* ── Basic Information ────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
              <Input {...register('title')} placeholder="e.g. Enterprise Laptop Procurement" className="h-10" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Description <span className="text-destructive">*</span>
                </Label>

                <p className="text-xs text-muted-foreground">
                  {(watch('description') ?? '').length} / 500
                </p>
              </div>

              <textarea {...register('description')} className={textareaCls} placeholder="Brief description of what you need..." />
              <div className="flex items-center justify-between">
                {errors.description
                  ? <p className="text-xs text-destructive">{errors.description.message}</p>
                  : <span />}
              </div>
            </div>

            {/* Priority / Plant / Department */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-0">
                <Label className="text-sm font-medium">Priority <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  {PRIORITY_OPTS.map(p => {
                    const isSelected = watchedPriority === p.value
                    const cls = isSelected
                      ? `${p.color} border-current shadow-sm`
                      : 'border-input text-muted-foreground hover:border-slate-300 hover:text-foreground'
                    return (
                      <label key={p.value} className={`flex-1 border rounded-lg px-2 py-2.5 cursor-pointer text-center text-xs font-semibold transition-all ${cls}`}>
                        <input type="radio" value={p.value} {...register('priority')} className="sr-only" />
                        {p.label}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-0">
                <Label className="text-sm font-medium">Plant <span className="text-destructive">*</span></Label>
                <select className={selectCls} onChange={e =>
                  setValue('plant', Number(e.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }>
                  <option value="">Select plant...</option>
                  {(plants || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
                {errors.plant && <p className="text-xs text-destructive">{errors.plant.message}</p>}
              </div>

              <div className="space-y-0">
                <Label className="text-sm font-medium">Department <span className="text-destructive">*</span></Label>
                <select className={selectCls} onChange={e =>
                  setValue('department', Number(e.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }>
                  <option value="">Select department...</option>
                  {(departments || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>
            </div>

            {/* Estimated Budget */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Estimated Budget ({currencySymbol}) <span className="text-destructive">*</span></Label>
              {/* Quick-select chips */}
              <div className="flex flex-wrap gap-1.5">
                {[10000, 50000, 100000, 500000, 1000000, 5000000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setValue('requested_amount', amt, { shouldValidate: true })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      watchedAmount === amt
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {amt >= 100000 ? `${currencySymbol}${amt / 100000}L` : `${currencySymbol}${amt / 1000}K`}
                  </button>
                ))}
              </div>
              <div className="max-w-xs space-y-1.5">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">{currencySymbol}</span>
                  <Input
                    type="number"
                    step="1"
                    min={1000}
                    max={100000000}
                    placeholder="0"
                    className={amountInputCls}
                    {...register('requested_amount', {
                      valueAsNumber: true,
                      max: { value: 100_000_000, message: 'Maximum budget is ₹10 Crore' },
                    })}
                    onInput={e => {
                      const el = e.currentTarget
                      if (Number(el.value) > 100_000_000) el.value = '100000000'
                    }}
                  />
                </div>
                {errors.requested_amount && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <span>⚠</span> {errors.requested_amount.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Min {currencySymbol}1,000 · Max {currencySymbol}1,00,00,000</p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ── Preferred Vendors ────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferred Vendors</CardTitle>
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              List vendors you'd prefer to source from. Finance may suggest alternatives during review.
            </p>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            <div className="relative">
              <Input
                placeholder="Search approved vendors..."
                value={vendorSearch}
                onChange={e => { setVendorSearch(e.target.value); setShowVendorSearch(true) }}
                onFocus={() => setShowVendorSearch(true)}
                onBlur={() => setTimeout(() => setShowVendorSearch(false), 150)}
                className="h-10"
              />
              {showVendorSearch && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-lg bg-background shadow-lg max-h-56 overflow-y-auto divide-y">
                  {(vendors || []).filter((v: any) => !selectedVendors.some((s: any) => s.id === v.id)).map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors"
                      onClick={() => addVendor(v)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{v.company_name}</span>
                        <span className="text-xs text-emerald-600 font-medium">{v.status}</span>
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

            {selectedVendors.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Location</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Email</th>
                      <th className="w-8 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedVendors.map((v: any) => {
                      let location = '—'
                      if (v.city && v.state) location = `${v.city}, ${v.state}`
                      else if (v.city) location = v.city
                      return (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-foreground">{v.company_name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{v.category_name || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {location}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{v.contact_email || '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeVendor(v.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )})}

                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Approval Matrix ──────────────────────────────────────────────── */}
        {showApprovalPanel && (
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Approval Matrix</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Choose the approval workflow for this budget request.</p>
            </CardHeader>
            <CardContent className="pt-5">
              {!matrices && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices...
                </div>
              )}
              {matrices && matrices.length === 0 && (
                <p className="text-xs text-amber-600 font-medium">No active budget approval matrices configured.</p>
              )}
              {matrices && matrices.length > 0 && (
                <MatrixSelectorTable
                  matrices={matrices}
                  selectedMatrix={selectedMatrix}
                  expandedMatrix={expandedMatrix}
                  onSelect={id => { setSelectedMatrix(id); setExpandedMatrix(id) }}
                  onToggleExpand={toggleMatrixExpand}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={() => router.push('/budget')} className="text-muted-foreground">
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
