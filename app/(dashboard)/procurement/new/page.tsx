'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, ArrowRight, Loader2, Search, X, Send, Save, AlertTriangle, Check, Badge, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import ComparisonTab from '../components/ComparisonTab'
import ApprovalMatrix from '../components/ApprovalMatrix'

function flattenDrfError(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = flattenDrfError(item)
      if (found) return found
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = flattenDrfError(item)
      if (found) return found
    }
  }
  return ''
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  tracking_id: z.number({ required_error: 'Tracking ID is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  description: z.string().optional(),
  title: z.string().optional(),
  matrix_id: z.number().optional(),
  // invited_vendor_ids: z
  //   .array(z.number())
  //   .min(1, 'Please select at least one vendor')
  //   .max(5, 'You can select maximum 5 vendors')
  //   .default([]),

  // line_items: z.array(
  //   z.object({
  //     item_code: z.number({
  //       required_error: 'Item is required',
  //     }).refine((val) => val > 0, {
  //       message: 'Item is required',
  //     }),
  //     quantity: z
  //       .number({ required_error: 'Quantity required' })
  //       .positive('Quantity must be greater than zero')
  //       .max(99999, 'Maximum Quantity limit: 99,999')
  //       .refine(v => Number.isFinite(v), 'Invalid quantity'),

  //     unit_rate: z
  //       .number({ required_error: 'Unit rate required' })
  //       .positive('Unit rate must be greater than zero')
  //       .max(9999999.99, 'Maximum Unit Rate limit: 99,99,999.99')
  //       .refine(v => /^\d+(\.\d{1,2})?$/.test(String(v)), {
  //         message: 'Maximum 2 decimal places allowed',
  //       }),

  //     unit_of_measure: z.string().min(1, 'UOM required'),
  //   })
  // )
  //   .min(1, 'At least one line item required')
})

type FormData = z.infer<typeof schema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}

// ─── TrackingIdSearch ─────────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewPRPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))

  const [activeTab, setActiveTab] = useState<'details' | 'comparison'>('details')
  const [selectedVendor, setSelectedVendor] = useState<any>("")
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [selectedTracking, setSelectedTracking] = useState<any>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [savedPrId, setSavedPrId] = useState<string | null>(null)
  const [quotationSearch, setQuotationSearch] = useState('')
  const [quotationOpen, setQuotationOpen] = useState(false)
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<number[]>([])
  const [isApplyingQuotations, setIsApplyingQuotations] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Use a ref to track which rows are quotation-filled so we never get stale closures
  // true  = row was injected by quotation aggregate
  // false = row was added/edited manually

  const quotationWrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(quotationWrapperRef, () => setQuotationOpen(false))

  // ─── Remote data ──────────────────────────────────────────────────────

  const { data: quotations = [], isLoading: qLoading } = useQuery({
    queryKey: ['quotations', quotationSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (quotationSearch) params.set('search', quotationSearch)
      const { data } = await apiClient.get(`/quotations/?${params.toString()}`)
      return data?.results || data || []
    },
  })

  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved'],
    queryFn: async () => (await apiClient.get('/budget/tracking-ids/?status=approved')).data.results || [],
  })


  // ─── Form ─────────────────────────────────────────────────────────────

  const {
    register, control, handleSubmit, watch, setValue, trigger, clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedTrackingId = watch('tracking_id')

  const { data: trackingDetail } = useQuery({
    queryKey: ['tracking-detail', watchedTrackingId],
    queryFn: async () => (await apiClient.get(`/budget/tracking-ids/${watchedTrackingId}/`)).data,
    enabled: !!watchedTrackingId,
  })

  useEffect(() => {
    if (!trackingDetail) return
    setValue('plant', trackingDetail.plant)
    setValue('department', trackingDetail.department)
    setValue('description', trackingDetail?.description)
    setValue('title', trackingDetail.title ?? '')
  }, [trackingDetail, setValue])

  // ─── Totals ───────────────────────────────────────────────────────────

  const selectedQuotationList = (quotations as any[]).filter((q: any) =>
    selectedQuotationIds.includes(q.id)
  )

  const subtotal = selectedQuotationList.reduce(
    (sum, quotation) => sum + (Number(quotation.total_amount) || 0),
    0,
  )
  const taxTotal = activeTaxes.reduce((s, t) => s + subtotal * t.rate / 100, 0)
  const grandTotal = subtotal + taxTotal

  const budgetRemaining = trackingDetail
    ? Number(trackingDetail.remaining_amount ?? (trackingDetail.approved_amount ?? trackingDetail.requested_amount) - trackingDetail.consumed_amount)
    : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  // Cleanup on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const toggleQuotation = (id: number) => {
    setSelectedQuotationIds(prev => {
      const next = prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]
      // scheduleAggregate(next)
      return next
    })
  }

  const selectedQuotations = (quotations as any[]).filter((q: any) => selectedQuotationIds.includes(q.id))

  // ─── Mutations ────────────────────────────────────────────────────────

  const saveDraftMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        // invited_vendor_ids: selectedVendors.map(v => v.id),
        quotation_ids: selectedQuotationIds,
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
      const msg = flattenDrfError(detail) || 'Something went wrong.'
      toast({ title: 'Failed to save PR', description: msg, variant: 'destructive' })
    },
  })

  const submitApprovalMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {}
      const { data: pr } = await apiClient.post(`/procurement/${savedPrId}/submit/`, payload)
      return pr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
      toast({ title: 'PR submitted for approval.' })
      router.push('/procurement')
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = flattenDrfError(detail) || 'Something went wrong.'
      toast({ title: 'Failed to submit PR', description: msg, variant: 'destructive' })
    },
  })

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

      {/* Tabs */}
      <div className="flex border-b">
        {([['details', 'Requisition Details'], ['comparison', 'Comparison']] as const).map(([key, label], i) => (
          <div
            key={key}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 select-none flex items-center gap-2 ${activeTab === key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground'
              }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${activeTab === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
              {i + 1}
            </span>
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
                  value={selectedTracking}
                  onChange={setSelectedTracking}
                  onSelect={(tracking) => {
                    setValue('tracking_id', tracking.id, { shouldDirty: true, shouldValidate: true })
                    setValue('title', tracking.title)
                  }}
                />
                {errors.tracking_id && <p className="text-xs text-destructive">{errors.tracking_id.message}</p>}
              </div>

              {/* Single-line compact summary */}
              {watchedTrackingId && trackingDetail && (
                <div className="rounded-md border bg-slate-50/60 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                  <span className="font-semibold text-foreground truncate max-w-[260px]">{trackingDetail.title || '—'}</span>
                  {trackingDetail.department_name && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />{trackingDetail.department_name}
                    </span>
                  )}
                  {trackingDetail.plant_name && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />{trackingDetail.plant_name}
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-3">
                    <span className="text-muted-foreground">Approved <span className="font-semibold text-foreground tabular-nums">{formatCurrency(trackingDetail.approved_amount ?? trackingDetail.requested_amount)}</span></span>
                    <span className="text-muted-foreground">Consumed <span className="font-semibold text-foreground tabular-nums">{formatCurrency(trackingDetail.consumed_amount)}</span></span>
                    <span className="text-muted-foreground">Remaining <span className={`font-semibold tabular-nums ${budgetRemaining !== null && budgetRemaining > 0 ? 'text-emerald-700' : 'text-destructive'}`}>{formatCurrency(budgetRemaining ?? 0)}</span></span>
                  </span>
                  {grandTotal > 0 && budgetExceeded && (
                    <span className="basis-full inline-flex items-center gap-1 text-destructive font-medium bg-destructive/10 px-2 py-1 rounded-md">
                      <AlertTriangle className="w-3 h-3" />
                      Exceeds by {formatCurrency(grandTotal - (budgetRemaining ?? 0))}
                    </span>
                  )}
                </div>
              )}

              {watchedTrackingId && (
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
              )}
            </CardContent>
          </Card>

          {/* ── Select Quotations ── */}
          {watchedTrackingId && (
            <Card className="shadow-sm">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
                      Attach Quotes for Evaluation                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Attach the vendor quotes you've received. These will be compared in the PR detail view for the approver.
                    </p>
                  </div>
                  {isApplyingQuotations && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying…
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-3">
                {/* Search input */}
                <div ref={quotationWrapperRef} className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search quotation ref no..."
                    value={quotationSearch}
                    onChange={(e) => { setQuotationSearch(e.target.value); setQuotationOpen(true) }}
                    onFocus={() => setQuotationOpen(true)}
                    className="pl-8"
                  />

                  {/* Dropdown */}
                  {quotationOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                      {qLoading ? (
                        <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                      ) : (quotations as any[]).length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">No quotations found</div>
                      ) : (
                        (quotations as any[]).map((q: any) => {
                          const isSelected = selectedQuotationIds.includes(q.id)
                          return (
                            <label
                              key={q.id}
                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm border-l-2 transition-colors ${isSelected
                                ? 'bg-primary/5 border-l-primary'
                                : 'border-l-transparent hover:bg-muted'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleQuotation(q.id)}
                                disabled={isApplyingQuotations}
                                className="w-4 h-4 accent-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-xs ${isSelected ? 'text-primary font-semibold' : 'text-foreground'}`}>{q.ref_no}</span>
                                  {q.quotation_no && q.quotation_no !== '—' && (
                                    <span className="text-[10px] text-muted-foreground">· {q.quotation_no}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                  {q.vendor_name && <span className="truncate">{q.vendor_name}</span>}
                                  {q.items_count != null && <span>· {q.items_count} item{q.items_count === 1 ? '' : 's'}</span>}
                                  {q.total_amount != null && <span className="tabular-nums">· {formatCurrency(q.total_amount)}</span>}
                                </div>
                              </div>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Selected chips */}
                {/* Selected Quotations Cards */}
                {selectedQuotations.length > 0 && (
                  <div className="space-y-3">


                    <div className="space-y-2">
                      {selectedQuotations.map((q: any) => {
                        const isPending = q.status === 'pending'
                        const isNewVendor = q.is_new_vendor

                        return (
                          <div
                            key={q.id}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all
              ${isPending
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-border bg-background'
                              }`}
                          >
                            {/* Left */}
                            <div className="flex items-center gap-3 min-w-0">
                              {/* File Icon */}
                              <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-red-500" />
                              </div>

                              {/* Details */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-semibold text-foreground truncate">
                                    {q.vendor_name}
                                  </h4>

                                  {isNewVendor && (
                                    <Badge
                                      // variant="outline"
                                      className="text-[10px] bg-amber-100 text-amber-700 border-amber-200"
                                    >
                                      New Vendor
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <span>{q.ref_no}</span>

                                  {q.item_name && (
                                    <>
                                      <span>·</span>
                                      <span>{q.item_name}</span>
                                    </>
                                  )}

                                  {q.valid_till && (
                                    <>
                                      <span>·</span>
                                      <span>Valid till {q.valid_till}</span>
                                    </>
                                  )}

                                  {q.score && (
                                    <>
                                      <span>·</span>
                                      <span>Score: {q.score}/100</span>
                                    </>
                                  )}

                                  {isPending && (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-600 font-medium">
                                        Pending Review
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right */}
                            <div className="flex items-center gap-4 shrink-0">
                              {/* Amount */}
                              <div className="text-sm font-semibold tabular-nums">
                                {formatCurrency(q.total_amount)}
                              </div>

                              {/* Selected Icon */}
                              <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => toggleQuotation(q.id)}
                                disabled={isApplyingQuotations}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}


          <div className="flex items-center justify-end">
            <Button
              type="button"
              className="gap-1.5"
              disabled={isSaving}
              onClick={async () => {
                const isValid =
                  await trigger('tracking_id')
                if (!isValid) return
                if (budgetExceeded) {
                  toast({ title: 'Budget exceeded', description: `PR total (${formatCurrency(grandTotal)}) exceeds remaining budget (${formatCurrency(budgetRemaining)}).`, variant: 'destructive' })
                  return
                }
                if (!selectedQuotationIds.length) {
                  toast({ title: 'No quotations attached', description: 'Please attach at least one quotation for approver comparison.', variant: 'destructive' })
                  return
                }
                setShowSaveConfirm(true)
              }}
            >
              {saveDraftMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              Save & Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Save Confirmation Modal */}
          <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Save Purchase Requisition?</DialogTitle>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Review the summary before saving as a draft. You can still edit before submitting for approval.</p>
              </div>

              <DialogFooter>
                <Button variant="outline" disabled={isSaving} onClick={() => setShowSaveConfirm(false)}>Cancel</Button>
                <Button
                  className="gap-1.5"
                  disabled={isSaving}
                  onClick={() => {
                    const data = watch()
                    saveDraftMutation.mutate(data, {
                      onSuccess: (pr) => {
                        setSavedPrId(pr.hash_id ?? pr.id)
                        queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
                        toast({ title: 'PR saved as draft.' })
                        setShowSaveConfirm(false)
                        setActiveTab('comparison')
                      },
                    })
                  }}
                >
                  {saveDraftMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />}
                  Save Draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>)}

        {/* ── Tab 2: Approval Matrix ── */}
        {activeTab === 'comparison' && (
          <ComparisonTab
            selectedQuotationIds={selectedQuotationIds}
            selected={selectedVendor}
            setSelected={setSelectedVendor}
          />
        )}

        {/* ── Tab 2 actions ── */}
        {activeTab === 'comparison' && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setActiveTab('details')} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={isSaving || selectedVendor?.length === 0}
                className="gap-2"
                // onClick={() => submitApprovalMutation.mutate()}
                onClick={() => setShowApprovalModal(true)}
              >
                {submitApprovalMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                Select approvers & submit
              </Button>
            </div>
          </div>
        )}
        <ApprovalMatrix
          open={showApprovalModal}
          onOpenChange={setShowApprovalModal}
          prId={savedPrId || ''}
          onClose={() => setShowApprovalModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
            toast({ title: 'PR submitted for approval.' })
            router.push('/procurement')
          }}
          selectedVendor={selectedVendor}
        />
      </form>
    </div>
  )
}