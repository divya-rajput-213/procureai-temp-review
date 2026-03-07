'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Search, X, Send, Save, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { useSettingsStore } from '@/lib/stores/settings.store'

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  tracking_id: z.number({ required_error: 'Tracking ID is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  description: z.string().optional(),
  title: z.string().optional(),
  matrix_id: z.number().optional(),
  line_items: z.array(
    z.object({
      item_code: z.number({ required_error: 'Item required' }).positive('Item code is required '),
      quantity: z
        .number({ required_error: 'Quantity required' })
        .positive('Quantity must be greater than zero')
        .max(99999, 'Maximum Quantity limit: 99,999')
        .refine(v => Number.isFinite(v), 'Invalid quantity'),

      unit_rate: z
        .number({ required_error: 'Unit rate required' })
        .positive('Unit rate must be greater than zero')
        .max(9999999.99, 'Maximum Unit Rate limit: 99,99,999.99')
        .refine(v => /^\d+(\.\d{1,2})?$/.test(String(v)), {
          message: 'Maximum 2 decimal places allowed',
        }),

      unit_of_measure: z.string().min(1, 'UOM required'),
    })
  )
    .min(1, 'At least one line item required')

})

type FormData = z.infer<typeof schema>

// ─── Item Code Search ────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}
function TrackingIdSearch({
  trackingIds,
  onSelect,
  value,
  onChange,
}: {
  trackingIds: any[]
  onSelect: (tracking: any) => void
  value: any | null
  onChange: (t: any | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useClickOutside(wrapperRef, () => setOpen(false))

  const filtered = search.length > 0
    ? (trackingIds ?? []).filter(t =>
        t.tracking_code.toLowerCase().includes(search.toLowerCase()) ||
        (t.title ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : []

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by tracking code or title..."
          value={value ? value.tracking_code : search}
          onChange={(e) => {
            setSearch(e.target.value)
            onChange(null)
            setOpen(true)
          }}
          onFocus={() => { if (search.length > 0) setOpen(true) }}
          className="pl-8"
        />
        {value && (
          <button type="button" onClick={() => { onChange(null); setSearch('') }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && !value && search.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map(t => (
              <button
                key={t.id}
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors"
                onClick={() => {
                  onChange(t)
                  setSearch('')
                  setOpen(false)
                  onSelect(t)
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium">{t.tracking_code}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(t.approved_amount)}</span>
                </div>
                {t.title && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.title}</p>}
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">No approved tracking IDs found</div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemSearch({ onSelect, placeholder, displayValue,hasError }: { onSelect: (item: any) => void; placeholder?: string, displayValue?: string,hasError:any }) {
  const [search, setSearch] = useState(displayValue ?? '')
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
          className={`pl-8 text-sm ${hasError}?'border-destructive' : ''`}
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && search.length > 0 && (
        <div className="absolute z-50 w-full bottom-full mb-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewPRPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))

  const [activeTab, setActiveTab] = useState<'details' | 'matrix'>('details')
  const [selectedVendors, setSelectedVendors] = useState<any[]>([])
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorSearch, setShowVendorSearch] = useState(false)
  const [selectedTracking, setSelectedTracking] = useState<any>(null)
  const [itemLabels, setItemLabels] = useState<Record<number, string>>({})
  const [savedPrId, setSavedPrId] = useState<string | null>(null)
  // ─── Remote data ──────────────────────────────────────────────────────

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
  })
  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved', vendorSearch],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/', {
        params: { status: 'approved', search: vendorSearch, page_size: 20 },
      })
      return r.data.results ?? r.data
    },
    enabled: vendorSearch.length >= 1,
  })

  const addVendor = (v: any) => {
    if (!selectedVendors.some(x => x.id === v.id)) setSelectedVendors(prev => [...prev, v])
    setShowVendorSearch(false)
    setVendorSearch('')
  }
  const removeVendor = (id: number) => setSelectedVendors(prev => prev.filter(v => v.id !== id))

  // ─── Form ─────────────────────────────────────────────────────────────

  const {
    register, control, handleSubmit, watch, setValue, trigger, clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      line_items: [{ item_code: 0, quantity: 1, unit_of_measure: 'EA', unit_rate: 0 }],
    },
  })

  const { fields: lineItemFields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const watchedItems = watch('line_items')
  const subtotal = (watchedItems ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0),
    0,
  )
  const taxTotal = activeTaxes.reduce((s, t) => s + subtotal * t.rate / 100, 0)
  const grandTotal = subtotal + taxTotal

  const watchedTrackingId = watch('tracking_id')

  const { data: trackingDetail } = useQuery({
    queryKey: ['tracking-detail', watchedTrackingId],
    queryFn: async () => (await apiClient.get(`/budget/tracking-ids/${watchedTrackingId}/`)).data,
    enabled: !!watchedTrackingId,
  })
  useEffect(() => {
    if (!trackingDetail) return;

    // auto fill fields
    setValue('plant', trackingDetail.plant);
    setValue('department', trackingDetail.department);
    setValue('description', trackingDetail?.description)
    setValue('title', trackingDetail.title ?? '');
    // Handle vendors safely
    if (
      Array.isArray(trackingDetail.preferred_vendors) &&
      trackingDetail.preferred_vendors.length > 0
    ) {
      setSelectedVendors(trackingDetail.preferred_vendors);
    } else {
      // clear vendors if none exist
      setSelectedVendors([]);
    }

  }, [trackingDetail, setValue]);


  // ─── Mutation ─────────────────────────────────────────────────────────

  // Save as draft (create or update)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        invited_vendor_ids: selectedVendors.map(v => v.id),
        status: 'draft',
      }
      if (savedPrId) {
        const { data: pr } = await apiClient.patch(`/procurement/${savedPrId}/`, payload)
        return pr
      }
      const { data: pr } = await apiClient.post('/procurement/', payload)
      return pr
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      toast({
        title: 'Failed to save PR',
        description: typeof detail === 'object' ? JSON.stringify(detail) : String(detail ?? ''),
        variant: 'destructive',
      })
    },
  })

  // Submit for approval (update existing draft)
  const submitApprovalMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { status: 'pending_approval' }
      if (selectedMatrix) payload.matrix_id = selectedMatrix
      const { data: pr } = await apiClient.patch(`/procurement/${savedPrId}/`, payload)
      return pr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
      toast({ title: 'PR submitted for approval.' })
      router.push('/procurement')
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      toast({
        title: 'Failed to submit PR',
        description: typeof detail === 'object' ? JSON.stringify(detail) : String(detail ?? ''),
        variant: 'destructive',
      })
    },
  })

  const budgetRemaining = trackingDetail
    ? Number(trackingDetail.remaining_amount ?? (trackingDetail.approved_amount ?? trackingDetail.requested_amount) - trackingDetail.consumed_amount)
    : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  const isSaving = saveDraftMutation.isPending || submitApprovalMutation.isPending

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Purchase Requisition</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details below to create a purchase requisition.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/procurement')} className="gap-1.5 shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* Tabs — visual indicator only, navigation via Next/Back */}
      <div className="flex border-b">
        {([['details', 'Requisition Details'], ['matrix', 'Approval Matrix']] as const).map(([key, label], i) => (
          <div
            key={key}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 select-none flex items-center gap-2 ${activeTab === key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground'
              }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${activeTab === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      <form className="space-y-5">

        {/* ── Tab 1: Requisition Details ── */}
        {activeTab === 'details' && (<>
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Requisition Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {/* Tracking ID */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tracking ID <span className="text-destructive">*</span></Label>

                <TrackingIdSearch
                  trackingIds={trackingIds}
                  value={selectedTracking}           // ← add
                  onChange={setSelectedTracking}     // ← add
                  onSelect={(tracking) => {
                    setValue('tracking_id', tracking.id, { shouldDirty: true, shouldValidate: true })
                    setValue('title', tracking.title)
                  }}
                />
                {errors.tracking_id && <p className="text-xs text-destructive">{errors.tracking_id.message}</p>}
              </div>

              {/* Budget Details — compact inline */}
              {trackingDetail && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
                  <span className="font-medium text-blue-700">Budget</span>
                  <span className="text-muted-foreground">Approved: <span className="font-semibold text-foreground">{formatCurrency(trackingDetail.approved_amount ?? trackingDetail.requested_amount)}</span></span>
                  <span className="text-muted-foreground">Consumed: <span className="font-semibold text-foreground">{formatCurrency(trackingDetail.consumed_amount)}</span></span>
                  <span className="text-muted-foreground">Remaining: <span className={`font-semibold ${budgetRemaining !== null && budgetRemaining > 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(budgetRemaining ?? 0)}</span></span>
                  {grandTotal > 0 && budgetExceeded && (
                    <span className="flex items-center gap-1 text-red-600 font-medium ml-auto">
                      <AlertTriangle className="w-3 h-3" />
                      Exceeds by {formatCurrency(grandTotal - (budgetRemaining ?? 0))}
                    </span>
                  )}
                </div>
              )}

              {watchedTrackingId &&
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
                    <Input disabled {...register('title')} placeholder="e.g. Enterprise Laptop Procurement" className="h-10 bg-muted cursor-not-allowed text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                    </Label>
                    <textarea
                      {...register('description')}
                      rows={3}
                      placeholder="Brief description of what is being procured…"
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Department</Label>
                      <select
                        disabled
                        value={trackingDetail?.department ?? ''}
                        className="w-full h-10 border border-input rounded-md px-3 text-sm bg-muted cursor-not-allowed text-muted-foreground"
                      >
                        <option value="">{trackingDetail?.department_name ?? '…'}</option>
                      </select>
                    </div>
                    {/* Plant (auto-filled) */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Plant</Label>
                      <select
                        disabled
                        value={trackingDetail?.plant ?? ''}
                        className="w-full h-10 border border-input rounded-md px-3 text-sm bg-muted cursor-not-allowed text-muted-foreground"
                      >
                        <option value="">{trackingDetail?.plant_name ?? '…'}</option>
                      </select>
                    </div>

                  </div>
                </>
              }
            </CardContent>
          </Card>

          {/* ── Invited Vendors ── */}
          {watchedTrackingId && <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Invited Vendors</CardTitle>
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Search and add vendors who will be invited to bid on this requisition.</p>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="relative">
                <Input
                  placeholder="Search approved vendors…"
                  value={vendorSearch}
                  onChange={e => { setVendorSearch(e.target.value); setShowVendorSearch(true) }}
                  onFocus={() => setShowVendorSearch(true)}
                  onBlur={() => setTimeout(() => setShowVendorSearch(false), 150)}
                  className="h-10"
                />
                {showVendorSearch && vendorSearch && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 border rounded-lg bg-background shadow-lg max-h-56 overflow-y-auto divide-y">
                    {(vendors || [])
                      .filter((v: any) => !selectedVendors.some(s => s.id === v.id))
                      .map((v: any) => (
                        <button
                          key={v.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => addVendor(v)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{v.company_name}</span>
                            <span className="text-xs text-emerald-600 font-medium">{v.status}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            {v.category_name && <span>{v.category_name}</span>}
                            {v.city && <span>{v.city}{v.state ? `, ${v.state}` : ''}</span>}
                          </div>
                        </button>
                      ))}
                    {(vendors || []).filter((v: any) => !selectedVendors.some(s => s.id === v.id)).length === 0 && (
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
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Location</th>
                        <th className="w-8 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedVendors.map(v => (
                        <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 font-medium">{v.company_name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{v.category_name || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                            {v.city ? [v.city, v.state].filter(Boolean).join(', ') : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button type="button" onClick={() => removeVendor(v.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>}

          {/* ── Line Items ── */}
          {watchedTrackingId && <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Line Items</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSubmit(() => {
                    // Proceed with adding a new row only if validation passes
                    append({ item_code: 0, quantity: 1, unit_of_measure: 'EA', unit_rate: 0 })
                  })}
                  className="gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="border border-border rounded-lg overflow-visible">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[40%]">Item <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">Qty <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[10%]">UOM</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-[15%]">Rate <span className="text-destructive">*</span></th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide w-[15%]">Total</th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lineItemFields.map((field, idx) => (
                      <tr key={field.id} className="group">
                        <td className="px-2 py-1.5">
                          <ItemSearch
                            displayValue={itemLabels[idx]}
                            onSelect={item => {
                              const duplicateIdx = (watchedItems ?? []).findIndex((li, i) => i !== idx && li.item_code === item.id)
                              if (duplicateIdx !== -1) {
                                remove(duplicateIdx)
                                const newIdx = duplicateIdx < idx ? idx - 1 : idx
                                setValue(`line_items.${newIdx}.item_code`, item.id)
                                setValue(`line_items.${newIdx}.unit_of_measure`, item.unit_of_measure ?? 'EA')
                                if (item.unit_rate) setValue(`line_items.${newIdx}.unit_rate`, Number(item.unit_rate))
                                return
                              }
                              setValue(`line_items.${idx}.item_code`, item.id)
                              setValue(`line_items.${idx}.unit_of_measure`, item.unit_of_measure ?? 'EA')
                              if (item.unit_rate) setValue(`line_items.${idx}.unit_rate`, Number(item.unit_rate))
                              clearErrors(`line_items.${idx}.item_code`)
                              setItemLabels(prev => ({ ...prev, [idx]: `${item.code} — ${item.description}` }))
                            }}
                            placeholder="Search item…"
                            hasError={errors.line_items?.[idx]?.item_code && errors.line_items[idx]?.item_code?.message}
                          />
                          {errors.line_items?.[idx]?.item_code && (
                            <p className="text-xs text-destructive mt-0.5">{errors.line_items[idx]?.item_code?.message}</p>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0.01" max="99999" step="0.01" placeholder="1"
                            className={`h-8 text-xs ${errors.line_items?.[idx]?.quantity ? 'border-destructive' : ''}`}
                            {...register(`line_items.${idx}.quantity`, {
                              valueAsNumber: true,
                              onChange: e => {
                                let value = Number(e.target.value)
                                if (value > 99999) { value = 99999; setValue(`line_items.${idx}.quantity`, value) }
                                clearErrors(`line_items.${idx}.quantity`)
                              },
                            })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input placeholder="EA" className="h-8 text-xs" {...register(`line_items.${idx}.unit_of_measure`)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0.01" max="9999999.99" step="0.01" placeholder="0.00"
                            className={`h-8 text-xs ${errors.line_items?.[idx]?.unit_rate ? 'border-destructive' : ''}`}
                            {...register(`line_items.${idx}.unit_rate`, {
                              valueAsNumber: true,
                              onChange: e => {
                                let value = Number(e.target.value)
                                if (value > 9999999.99) value = 9999999.99
                                value = Number(value.toFixed(2))
                                setValue(`line_items.${idx}.unit_rate`, value)
                                clearErrors(`line_items.${idx}.unit_rate`)
                              },
                            })}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm font-medium text-muted-foreground">
                          {formatCurrency((watchedItems?.[idx]?.quantity || 0) * (watchedItems?.[idx]?.unit_rate || 0))}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {lineItemFields.length > 1 && (
                            <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.line_items?.root && (
                <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
              )}

              {/* Invoice Total */}
              <div className="border border-border rounded-lg overflow-hidden mt-2">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    <tr className="bg-muted/30">
                      <td className="px-4 py-2.5 text-muted-foreground">Subtotal</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(subtotal)}</td>
                    </tr>
                    {activeTaxes.map(tax => (
                      <tr key={tax.id}>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {tax.name} <span className="text-xs">({tax.rate}%)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(subtotal * tax.rate / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2 border-border">
                      <td className="px-4 py-3 font-semibold">Grand Total</td>
                      <td className="px-4 py-3 text-right font-bold text-base">{formatCurrency(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
          }
          <div className="flex items-center justify-end">
            <Button
              type="button"
              className="gap-1.5"
              disabled={isSaving}
              onClick={async () => {
                const isValid = watchedTrackingId
                  ? await trigger(['line_items', 'tracking_id'])
                  : await trigger('tracking_id');
                if (!isValid) return
                if (budgetExceeded) {
                  toast({ title: 'Budget exceeded', description: `PR total (${formatCurrency(grandTotal)}) exceeds remaining budget (${formatCurrency(budgetRemaining)}).`, variant: 'destructive' })
                  return
                }
                const data = watch()
                saveDraftMutation.mutate(data, {
                  onSuccess: (pr) => {
                    setSavedPrId(pr.hash_id)
                    queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
                    toast({ title: 'PR saved as draft.' })
                    setActiveTab('matrix')
                  },
                })
              }}
            >
              {saveDraftMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              Save & Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </>)}

        {/* ── Tab 2: Approval Matrix ── */}
        {activeTab === 'matrix' && (
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Approval Matrix</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Choose the approval workflow for this requisition. Leave unselected to use the default matrix.</p>
            </CardHeader>
            <CardContent className="pt-5">
              {loadingMatrices && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
                </div>
              )}
              {!loadingMatrices && (matrices ?? []).length === 0 && (
                <p className="text-xs text-amber-600 font-medium">No active PR approval matrices configured. The system will use the default matrix.</p>
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
            </CardContent>
          </Card>
        )}

        {/* ── Tab 2 actions ── */}
        {activeTab === 'matrix' && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setActiveTab('details')} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                className="gap-2"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
                  router.push('/procurement')
                }}
              >
                <Save className="w-4 h-4" />
                Keep as Draft
              </Button>
              <Button
                type="button"
                disabled={isSaving || !selectedMatrix}
                className="gap-2"
                onClick={() => submitApprovalMutation.mutate()}
              >
                {submitApprovalMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                Submit for Approval
              </Button>
            </div>
          </div>
        )}

      </form>
    </div>
  )
}
