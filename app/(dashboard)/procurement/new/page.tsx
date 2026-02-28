'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Search, X,
  ChevronDown, ChevronRight, Send,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const STEPS = ['Requisition Details', 'Vendors & Items', 'Approver & Submit']

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}

function stepCircleClass(i: number, current: number): string {
  if (i === current) return 'bg-primary text-white'
  if (i < current) return 'bg-green-500 text-white'
  return 'bg-slate-200 text-slate-500'
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  tracking_id: z.number({ required_error: 'Tracking ID is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  description: z.string().optional(),
  line_items: z.array(z.object({
    item_code: z.number({ required_error: 'Item required' }).min(1, 'Item required'),
    description: z.string().min(1, 'Description required'),
    quantity: z.number().positive('Must be positive'),
    unit_of_measure: z.string().min(1, 'UOM required'),
    unit_rate: z.number().positive('Must be positive'),
  })).min(1, 'At least one line item required'),
})

type FormData = z.infer<typeof schema>

// ─── Vendor Multi-Select ─────────────────────────────────────────────────────

function VendorMultiSelect({
  selectedVendors,
  onAdd,
  onRemove,
}: {
  selectedVendors: any[]
  onAdd: (vendor: any) => void
  onRemove: (id: number) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: vendors, isFetching } = useQuery({
    queryKey: ['vendors-search', search],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/', {
        params: { status: 'approved', search, page_size: 20 },
      })
      return r.data.results ?? r.data
    },
    enabled: search.length >= 1,
  })

  useClickOutside(wrapperRef, () => setOpen(false))

  const filteredVendors = (vendors as any[] ?? []).filter(
    v => !selectedVendors.some(s => s.id === v.id)
  )

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* Selected tags */}
      {selectedVendors.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border rounded-md">
          {selectedVendors.map(v => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1.5 bg-white border rounded-md px-2 py-1 text-xs font-medium shadow-sm"
            >
              {v.company_name}
              {v.category_name && (
                <span className="text-muted-foreground font-normal">({v.category_name})</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(v.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search vendors by name…"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => search.length >= 1 && setOpen(true)}
          className="pl-8 text-sm"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {open && search.length >= 1 && (
        <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto mt-1">
          {filteredVendors.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              {isFetching ? 'Searching…' : 'No vendors found'}
            </p>
          ) : (
            filteredVendors.map((v: any) => (
              <button
                key={v.id}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 border-b last:border-0"
                onClick={() => { onAdd(v); setSearch(''); setOpen(false) }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{v.company_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.category_name || 'No category'}
                    {v.contact_email ? ` · ${v.contact_email}` : ''}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{v.status}</Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Item Code Search ────────────────────────────────────────────────────────

function ItemSearch({
  onSelect,
  placeholder,
}: {
  onSelect: (item: any) => void
  placeholder?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: items, isFetching } = useQuery({
    queryKey: ['items', search],
    queryFn: async () => {
      const r = await apiClient.get(`/procurement/items/?search=${encodeURIComponent(search)}`)
      return r.data.results ?? r.data
    },
    enabled: search.length > 0,
  })

  useClickOutside(wrapperRef, () => setOpen(false))

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder={placeholder ?? 'Search item code…'}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => search.length > 0 && setOpen(true)}
          className="pl-8 text-sm"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && search.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {!items || items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {isFetching ? 'Searching…' : 'No items found'}
            </p>
          ) : (
            (items as any[]).map((item: any) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                onClick={() => {
                  onSelect(item)
                  setSearch(`${item.code} — ${item.description}`)
                  setOpen(false)
                }}
              >
                <span className="font-mono text-xs bg-slate-100 px-1 rounded">{item.code}</span>
                <span className="truncate">{item.description}</span>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">{item.unit_of_measure}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Matrix Selector ─────────────────────────────────────────────────────────

function MatrixSelectorTable({
  matrices,
  selectedMatrix,
  expandedMatrix,
  onSelect,
  onToggleExpand,
}: {
  matrices: any[]
  selectedMatrix: number | null
  expandedMatrix: number | null
  onSelect: (id: number) => void
  onToggleExpand: (id: number) => void
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="w-8 px-3 py-2" />
            <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Matrix Name</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Plant</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Levels</th>
            <th className="w-8 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {matrices.map((m: any) => {
            const levelCount = m.levels?.length ?? 0
            const isSelected = selectedMatrix === m.id
            const isExpanded = expandedMatrix === m.id
            return (
              <>
                <tr
                  key={m.id}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                  onClick={() => onSelect(m.id)}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => onSelect(m.id)}
                      className="accent-primary"
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium">{m.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                    {m.plant_name || 'All Plants'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {levelCount} level{levelCount === 1 ? '' : 's'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onToggleExpand(m.id) }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
                {isExpanded && levelCount > 0 && (
                  <tr key={`${m.id}-lvl`}>
                    <td colSpan={5} className="p-0">
                      <div className="bg-slate-50 border-t px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1 pr-4 font-medium">Level</th>
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
                                <td className="py-1.5 text-muted-foreground">
                                  {lv.sla_hours ? `${lv.sla_hours}h` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewPRPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [prId, setPrId] = useState<number | null>(null)
  const [selectedVendors, setSelectedVendors] = useState<any[]>([])
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)

  // ─── Remote data ──────────────────────────────────────────────────────

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
  })
  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved'],
    queryFn: async () => (await apiClient.get('/budget/tracking-ids/?status=approved')).data.results || [],
  })
  const { data: matrices, isLoading: loadingMatrices } = useQuery({
    queryKey: ['approval-matrices-pr'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'purchase_requisition', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
    enabled: step === 2,
  })
  
  // ─── Form ─────────────────────────────────────────────────────────────

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      line_items: [{ item_code: 0, description: '', quantity: 1, unit_of_measure: 'EA', unit_rate: 0 }],
    },
  })

  const { fields: lineItemFields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const watchedItems = watch('line_items')
  const totalAmount = (watchedItems ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0),
    0,
  )

  const watchedTrackingId = watch('tracking_id')
  const watchedPlant = watch('plant')
  const watchedDepartment = watch('department')
  const step0Valid = !!watchedTrackingId && !!watchedPlant && !!watchedDepartment

  const { data: trackingDetail } = useQuery({
    queryKey: ['tracking-detail', watchedTrackingId],
    queryFn: async () => {
      const r = await apiClient.get(
        `/budget/tracking-ids/${watchedTrackingId}/`
      )
      return r.data
    },
    enabled: !!watchedTrackingId,
  })
  useEffect(() => {
    if (!trackingDetail) return
  
    setValue('plant', trackingDetail.plant_name)
    setValue('department', trackingDetail.department_name)
  
  }, [trackingDetail, setValue])
  // ─── Mutations ────────────────────────────────────────────────────────

  const createPRMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        invited_vendor_ids: selectedVendors.map(v => v.id),
      }
      const { data: pr } = await apiClient.post('/procurement/', payload)
      return pr
    },
    onSuccess: (pr: any) => {
      setPrId(pr.id)
      setStep(2)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      toast({
        title: 'Failed to create PR',
        description: typeof detail === 'object' ? JSON.stringify(detail) : String(detail ?? ''),
        variant: 'destructive',
      })
    },
  })

  const submitPRMutation = useMutation({
    mutationFn: async () => {
      const body = selectedMatrix ? { matrix_id: selectedMatrix } : {}
      await apiClient.post(`/procurement/${prId}/submit/`, body)
    },
    onSuccess: () => {
      toast({ title: 'PR submitted for approval!' })
      router.push('/procurement')
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to submit PR',
        description: err?.response?.data?.error,
        variant: 'destructive',
      })
    },
  })

  // ─── Navigation ───────────────────────────────────────────────────────

  const goStep0Next = () => {
    if (!step0Valid) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' })
      return
    }
    setStep(1)
  }

  const onStep1Submit = handleSubmit(data => createPRMutation.mutate(data))

  const canSubmit = !submitPRMutation.isPending

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
        New Purchase Requisition        </h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/procurement')}          
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>
      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const circleClass = stepCircleClass(i, step)
          return (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${circleClass}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 mx-1 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* ── Step 0: Requisition Details ── */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Requisition Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tracking ID */}
              <div className="space-y-2">
                <Label>Tracking ID <span className="text-destructive">*</span></Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  onChange={e => setValue('tracking_id', Number(e.target.value))}
                  defaultValue=""
                >
                  <option value="" disabled>Select approved Tracking ID…</option>
                  {(trackingIds || []).map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.tracking_code} — ₹{t.remaining_amount?.toLocaleString('en-IN') ?? '?'} remaining
                    </option>
                  ))}
                </select>
                {errors.tracking_id && (
                  <p className="text-xs text-destructive">{errors.tracking_id.message}</p>
                )}
              </div>

              {watchedTrackingId && trackingDetail && (
                <>
                  {/* Plant */}
                  <div className="space-y-2">
                    <Label>Plant</Label>
                    <select
                      disabled
                      value={trackingDetail.plant}
                      className="w-full h-10 border rounded-md px-3 text-sm bg-slate-100 cursor-not-allowed"
                    >
                      <option>
                        {trackingDetail.plant_name}
                      </option>
                    </select>
                  </div>

                  {/* Department */}
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <select
                      disabled
                      value={trackingDetail.department}
                      className="w-full h-10 border rounded-md px-3 text-sm bg-slate-100 cursor-not-allowed"
                    >
                      <option>
                        {trackingDetail.department_name}
                      </option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Brief description of what is being procured…"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={goStep0Next} className="gap-1">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Vendors & Line Items ── */}
      {step === 1 && (
        <form onSubmit={onStep1Submit} className="space-y-4">
          {/* Vendors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invited Vendors</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Search and add multiple vendors who will be invited to bid.
              </p>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <VendorMultiSelect
                  selectedVendors={selectedVendors}
                  onAdd={v => setSelectedVendors(prev => [...prev, v])}
                  onRemove={id => setSelectedVendors(prev => prev.filter(v => v.id !== id))}
                />
              </div>
              {selectedVendors.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  No vendors selected. You can add vendors later from the PR detail page.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: <span className="font-semibold">{formatCurrency(totalAmount)}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ item_code: 0, description: '', quantity: 1, unit_of_measure: 'EA', unit_rate: 0 })}
                  className="gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItemFields.map((field, idx) => (
                <div key={field.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                    {lineItemFields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} className="h-6 w-6 p-0">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    )}
                  </div>

                  {/* Item code search */}
                  <div className="space-y-1">
                    <Label className="text-xs">Item Code <span className="text-destructive">*</span></Label>
                    <ItemSearch
                      onSelect={item => {
                        setValue(`line_items.${idx}.item_code`, item.id)
                        setValue(`line_items.${idx}.description`, item.description ?? '')
                        setValue(`line_items.${idx}.unit_of_measure`, item.unit_of_measure ?? 'EA')
                      }}
                      placeholder="Search by code or description…"
                    />
                    {errors.line_items?.[idx]?.item_code && (
                      <p className="text-xs text-destructive">{errors.line_items[idx]?.item_code?.message}</p>
                    )}
                  </div>

                  {/* Description + Qty + UOM + Rate */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-5 space-y-1">
                      <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="Item description"
                        {...register(`line_items.${idx}.description`)}
                      />
                      {errors.line_items?.[idx]?.description && (
                        <p className="text-xs text-destructive">{errors.line_items[idx]?.description?.message}</p>
                      )}
                    </div>

                    <div className="col-span-4 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Qty <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="1"
                        {...register(`line_items.${idx}.quantity`, { valueAsNumber: true })}
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-2 space-y-1">
                      <Label className="text-xs">UOM <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="EA"
                        {...register(`line_items.${idx}.unit_of_measure`)}
                      />
                    </div>

                    <div className="col-span-5 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Unit Rate (₹) <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...register(`line_items.${idx}.unit_rate`, { valueAsNumber: true })}
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-1 space-y-1">
                      <Label className="text-xs hidden sm:block">Total</Label>
                      <p className="text-sm font-medium h-10 flex items-center sm:justify-end tabular-nums">
                        {formatCurrency(
                          (watchedItems?.[idx]?.quantity || 0) * (watchedItems?.[idx]?.unit_rate || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {errors.line_items?.root && (
                <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button type="submit" disabled={createPRMutation.isPending} className="gap-2">
              {createPRMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save & Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      )}

      {/* ── Step 2: Submit for Approval ── */}
      {step === 2 && !prId && (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Saving PR…
        </div>
      )}
      {step === 2 && prId && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit for Approval</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Your PR has been saved as a draft. Select an approval matrix and submit.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Summary */}
              <div className="bg-slate-50 border rounded-md p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Items</span>
                  <span>{lineItemFields.length} item{lineItemFields.length === 1 ? '' : 's'}</span>
                </div>
                {selectedVendors.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invited Vendors</span>
                    <span>{selectedVendors.map(v => v.company_name).join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Approval Matrix */}
              <div className="space-y-2">
                <Label>Approval Matrix <span className="text-muted-foreground text-xs">(optional — system auto-matches if not selected)</span></Label>
                {loadingMatrices && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
                  </div>
                )}
                {!loadingMatrices && (matrices ?? []).length === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    No active PR approval matrices found. The system will use the default matrix.
                  </p>
                )}
                {!loadingMatrices && (matrices ?? []).length > 0 && (
                  <MatrixSelectorTable
                    matrices={matrices}
                    selectedMatrix={selectedMatrix}
                    expandedMatrix={expandedMatrix}
                    onSelect={id => { setSelectedMatrix(id); setExpandedMatrix(id) }}
                    onToggleExpand={id => setExpandedMatrix(prev => prev === id ? null : id)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => router.push(`/procurement/${prId}`)}
              className="gap-1"
            >
              Skip — View PR
            </Button>
            <Button
              onClick={() => submitPRMutation.mutate()}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitPRMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              Submit for Approval
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
