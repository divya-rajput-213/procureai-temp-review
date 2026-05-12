'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
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
import { ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Search, X, Send, Save, AlertTriangle, Check, Badge, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import ComparisonTab from '../components/ComparisonTab'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively walks a DRF validation error response and returns the first
 * human-readable string. Handles strings, arrays, and nested objects (e.g.
 * `{ line_items: [{ unit_of_measure: ["..."] }] }`). Returns '' if nothing
 * usable is found — the caller should provide a fallback message.
 */
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

// ─── ItemSearch ───────────────────────────────────────────────────────────────

function ItemSearch({ onSelect, placeholder, displayValue, hasError, disabled }: {
  onSelect: (item: any) => void
  placeholder?: string
  displayValue?: string
  hasError: any
  disabled?: boolean
}) {
  const [search, setSearch] = useState(displayValue ?? '')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: items, isFetching } = useQuery({
    queryKey: ['items', search],
    queryFn: async () => {
      const r = await apiClient.get(`/procurement/items/?search=${encodeURIComponent(search)}`)
      return r.data.results ?? r.data
    },
    enabled: !disabled && search.length > 0,
  })

  useClickOutside(wrapperRef, () => setOpen(false))

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          disabled={disabled}
          placeholder={placeholder ?? 'Search item code…'}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => !disabled && search.length > 0 && setOpen(true)}
          className={`pl-8 text-sm ${hasError ? 'border-destructive' : ''}`}
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {!disabled && open && search.length > 0 && (
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
  const combinedTaxRate = activeTaxes.reduce((s, t) => s + t.rate, 0)

  const [activeTab, setActiveTab] = useState<'details' | 'comparison'>('details')
  const [selectedVendors, setSelectedVendors] = useState<any[]>([])
  const [removedVendorIds, setRemovedVendorIds] = useState<Set<number>>(new Set())
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorSearch, setShowVendorSearch] = useState(false)
  const [selectedTracking, setSelectedTracking] = useState<any>(null)
  const [itemLabels, setItemLabels] = useState<Record<number, string>>({})
  const [itemSources, setItemSources] = useState<Record<number, { vendor_name: string; quotation_no: string }>>({})

  // Stable color per vendor for line-item differentiation
  const VENDOR_COLOR_PALETTE = [
    { border: 'border-l-blue-500', bg: 'bg-blue-50', pill: 'bg-blue-100 text-blue-700' },
    { border: 'border-l-emerald-500', bg: 'bg-emerald-50', pill: 'bg-emerald-100 text-emerald-700' },
    { border: 'border-l-amber-500', bg: 'bg-amber-50', pill: 'bg-amber-100 text-amber-700' },
    { border: 'border-l-violet-500', bg: 'bg-violet-50', pill: 'bg-violet-100 text-violet-700' },
    { border: 'border-l-rose-500', bg: 'bg-rose-50', pill: 'bg-rose-100 text-rose-700' },
    { border: 'border-l-cyan-500', bg: 'bg-cyan-50', pill: 'bg-cyan-100 text-cyan-700' },
  ] as const

  const vendorColorMap = useMemo(() => {
    const map = new Map<string, typeof VENDOR_COLOR_PALETTE[number]>()
    let i = 0
    Object.values(itemSources).forEach(src => {
      if (src?.vendor_name && !map.has(src.vendor_name)) {
        map.set(src.vendor_name, VENDOR_COLOR_PALETTE[i % VENDOR_COLOR_PALETTE.length])
        i++
      }
    })
    return map
  }, [itemSources])

  const [activeQuotationKey, setActiveQuotationKey] = useState<string | null>(null)
  const [savedPrId, setSavedPrId] = useState<string | null>(null)
  const [prIdForComparison, setPrIdForComparison] = useState<number | null>(null)
  const [quotationSearch, setQuotationSearch] = useState('')
  const [quotationOpen, setQuotationOpen] = useState(false)
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<number[]>([])
  const [isApplyingQuotations, setIsApplyingQuotations] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Use a ref to track which rows are quotation-filled so we never get stale closures
  // true  = row was injected by quotation aggregate
  // false = row was added/edited manually
  const quotationFilledRowsRef = useRef<boolean[]>([false]) // starts with the 1 default blank row

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

  const { data: matrices, isLoading: loadingMatrices } = useQuery({
    queryKey: ['approval-matrices-pr'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/matrices/', {
        params: { matrix_type: 'purchase_requisition', is_active: 'true' },
      })
      return r.data.results ?? r.data
    },
  })

  // ─── Form ─────────────────────────────────────────────────────────────

  const {
    register, control, handleSubmit, watch, setValue, trigger, clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // defaultValues: {
    //   invited_vendor_ids: [],
    //   line_items: [
    //     {
    //       item_code: undefined,
    //       quantity: 1,
    //       unit_of_measure: 'EA',
    //       unit_rate: 0,
    //     },
    //   ],
    // },
  })

  const watchedPlant = watch('plant')
  const watchedTrackingId = watch('tracking_id')
  // const watchedItems = watch('line_items')

  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved', vendorSearch, watchedPlant],
    queryFn: async () => {
      const r = await apiClient.get('/vendors/', {
        params: {
          status: 'approved',
          search: vendorSearch,
          page_size: 20,
          ...(watchedPlant ? { plant: watchedPlant } : {}),
        },
      })
      return r.data.results ?? r.data
    },
    enabled: vendorSearch.length >= 1,
  })

  // const { fields: lineItemFields, append, remove, replace } = useFieldArray({
  //   control,
  //   // name: 'line_items',
  // })

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
    if (Array.isArray(trackingDetail.preferred_vendors) && trackingDetail.preferred_vendors.length > 0) {
      setSelectedVendors(trackingDetail.preferred_vendors)
    } else {
      setSelectedVendors([])
    }
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

  // ─── Group line items by source quotation (for tabs) ────────────────────
  // const groupedLineItems = useMemo(() => {
  //   const map = new Map<string, { key: string; vendor_name: string; quotation_no: string; rows: { idx: number; field: any }[]; color: typeof VENDOR_COLOR_PALETTE[number] | null }>()
  //   lineItemFields.forEach((field, idx) => {
  //     const src = itemSources[idx]
  //     const key = src ? `${src.vendor_name}::${src.quotation_no}` : '__manual__'
  //     if (!map.has(key)) {
  //       map.set(key, {
  //         key,
  //         vendor_name: src?.vendor_name ?? 'Manual entries',
  //         quotation_no: src?.quotation_no ?? '',
  //         rows: [],
  //         color: src?.vendor_name ? vendorColorMap.get(src.vendor_name) ?? null : null,
  //       })
  //     }
  //     map.get(key)!.rows.push({ idx, field })
  //   })
  //   return Array.from(map.values())
  // }, [lineItemFields, itemSources, vendorColorMap])

  // const activeGroup = useMemo(() => {
  //   if (groupedLineItems.length === 0) return null
  //   const found = activeQuotationKey ? groupedLineItems.find(g => g.key === activeQuotationKey) : null
  //   return found ?? groupedLineItems[0]
  // }, [groupedLineItems, activeQuotationKey])

  // useEffect(() => {
  //   if (groupedLineItems.length > 0 && (!activeQuotationKey || !groupedLineItems.find(g => g.key === activeQuotationKey))) {
  //     setActiveQuotationKey(groupedLineItems[0].key)
  //   }
  // }, [groupedLineItems, activeQuotationKey])


  const budgetRemaining = trackingDetail
    ? Number(trackingDetail.remaining_amount ?? (trackingDetail.approved_amount ?? trackingDetail.requested_amount) - trackingDetail.consumed_amount)
    : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  // ─── Vendor helpers ───────────────────────────────────────────────────

  // const addVendor = (v: any) => {
  //   if (selectedVendors.length >= 5) {
  //     toast({ title: 'Limit reached', description: 'You can select maximum 5 vendors', variant: 'destructive' })
  //     return
  //   }
  //   if (!selectedVendors.some(x => x.id === v.id)) {
  //     const updated = [...selectedVendors, v]
  //     setSelectedVendors(updated)
  //     // setValue('invited_vendor_ids', updated.map(v => v.id), { shouldValidate: true, shouldDirty: true })
  //   }
  //   // clearErrors('invited_vendor_ids')
  //   setShowVendorSearch(false)
  //   setVendorSearch('')
  // }

  // const removeVendor = (id: number) => {
  //   const updated = selectedVendors.filter(v => v.id !== id)
  //   setSelectedVendors(updated)
  //   setRemovedVendorIds(prev => new Set(prev).add(id))
  //   setValue('invited_vendor_ids', updated.map(v => v.id), { shouldValidate: true, shouldDirty: true })
  // }

  // ─── Quotation aggregate apply / revert ───────────────────────────────

  /**
   * Reads current form values directly (no stale closure) and returns
   * only the manually-entered rows, with their labels.
   */
  const getManualRows = useCallback(() => {
    // control._formValues always returns live form state - no stale closure risk
    const currentItems = control._formValues?.line_items ?? []
    const flags = quotationFilledRowsRef.current

    const manualItems: typeof currentItems = []
    const manualLabels: Record<number, string> = {}

    currentItems.forEach((item: any, idx: number) => {
      const isQuotationRow = flags[idx] === true
      // Only keep rows that were manually filled AND have a real item selected.
      // Blank default rows (item_code falsy/0) are discarded so they don't appear
      // as empty ghost rows when autofill runs.
      const hasItem = item.item_code && Number(item.item_code) > 0
      if (!isQuotationRow && hasItem) {
        manualLabels[manualItems.length] = itemLabels[idx] ?? ''
        manualItems.push(item)
      }
    })

    return { manualItems, manualLabels }
  }, [control, itemLabels])

  /**
   * Applies aggregate data (vendors + items) from the API.
   * Manual rows already present are KEPT — quotation rows are merged in after them.
   */
  // const applyQuotationAggregate = useCallback((data: any) => {
  //   if (!data) return

  //   // 1. Vendors — exclude any the user has manually removed
  //   const incomingVendors: any[] = (data.vendors ?? []).filter((v: any) => !removedVendorIds.has(v.id))
  //   setSelectedVendors(incomingVendors)
  //   setValue('invited_vendor_ids', incomingVendors.map((v: any) => v.id), { shouldValidate: true, shouldDirty: true })

  //   // 2. Build new quotation rows
  //   const items: any[] = data.items ?? []
  //   const quotationRows = items.map((item: any) => ({
  //     item_code: item.master_item_id ? Number(item.master_item_id) : 0,
  //     quantity: Number(item.quantity ?? 1),
  //     unit_rate: Number(item.item_price ?? 0),
  //     unit_of_measure: item.unit_of_measure ?? 'EA',
  //   }))

  //   // 3. Get existing manual rows (so we don't wipe them)
  //   const { manualItems, manualLabels } = getManualRows()

  //   // 4. Merge: manual rows first, then quotation rows
  //   const merged = [...manualItems, ...quotationRows]
  //   replace(merged)

  //   // 5. Update the ref: manual rows stay false, new quotation rows are true
  //   quotationFilledRowsRef.current = [
  //     ...manualItems.map(() => false),
  //     ...quotationRows.map(() => true),
  //   ]

  //   // 6. Labels: keep manual labels, add quotation labels after them
  //   const newLabels: Record<number, string> = { ...manualLabels }
  //   const newSources: Record<number, { vendor_name: string; quotation_no: string }> = {}
  //   items.forEach((item: any, i: number) => {
  //     const rowIdx = manualItems.length + i
  //     newLabels[rowIdx] = `${item.item_code} — ${item.item_name}`
  //     if (item.vendor_name) {
  //       newSources[rowIdx] = {
  //         vendor_name: item.vendor_name,
  //         quotation_no: item.quotation_no ?? item.quotation_ref_no ?? '',
  //       }
  //     }
  //   })
  //   setItemLabels(newLabels)
  //   setItemSources(newSources)

  //   // 7. Clear stale validation errors and re-validate
  //   clearErrors('line_items')
  //   clearErrors('invited_vendor_ids')
  //   setTimeout(() => {
  //     trigger('line_items')
  //     trigger('invited_vendor_ids')
  //   }, 0)
  // }, [getManualRows, replace, setValue, clearErrors, trigger, removedVendorIds])

  /**
   * Reverts only the quotation-injected rows; manual rows stay untouched.
   * Also reverts vendors back to trackingDetail preferred vendors.
   */
  // const revertQuotationData = useCallback(() => {
  //   const { manualItems, manualLabels } = getManualRows()

  //   if (manualItems.length > 0) {
  //     replace(manualItems)
  //     quotationFilledRowsRef.current = manualItems.map(() => false)
  //     setItemLabels(manualLabels)
  //   } else {
  //     // Nothing manual — reset to one blank row
  //     replace([{ item_code: undefined as any, quantity: 1, unit_of_measure: 'EA', unit_rate: 0 }])
  //     quotationFilledRowsRef.current = [false]
  //     setItemLabels({})
  //   }

  //   // Revert vendors to tracking preferred vendors (or empty)
  //   const preferredVendors = trackingDetail?.preferred_vendors ?? []
  //   setSelectedVendors(preferredVendors)
  //   setValue('invited_vendor_ids', preferredVendors.map((v: any) => v.id), { shouldValidate: true, shouldDirty: true })

  //   clearErrors('line_items')
  //   clearErrors('invited_vendor_ids')
  // }, [getManualRows, replace, setValue, clearErrors, trackingDetail])

  // ─── Debounced aggregate call on checkbox change ───────────────────────

  /**
   * Schedules an aggregate API call 800 ms after the last checkbox toggle.
   * If ids drops to [] the debounce is cancelled and revert runs immediately
   * — but only after a short delay so the user can re-check if they want.
   */
  // const scheduleAggregate = useCallback((ids: number[]) => {
  //   if (debounceRef.current) clearTimeout(debounceRef.current)

  //   if (ids.length === 0) {
  //     // Small delay so unchecking one and rechecking another doesn't flash a revert
  //     debounceRef.current = setTimeout(() => {
  //       revertQuotationData()
  //     }, 300)
  //     return
  //   }

  //   // Wait 800 ms after the last toggle before hitting the API
  //   debounceRef.current = setTimeout(async () => {
  //     setIsApplyingQuotations(true)
  //     try {
  //       const { data } = await apiClient.post('/quotations/aggregate/', { quotation_ids: ids })
  //       applyQuotationAggregate(data)
  //       toast({ title: 'Quotations applied', description: 'Vendors and items auto-filled successfully.' })
  //     } catch (err) {
  //       console.error(err)
  //       toast({ title: 'Failed to apply quotations', variant: 'destructive' })
  //     } finally {
  //       setIsApplyingQuotations(false)
  //     }
  //   }, 800)
  // }, [applyQuotationAggregate, revertQuotationData, toast])

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
                //  watchedTrackingId
                //   ? await trigger(['line_items', 'tracking_id', 'invited_vendor_ids'])
                //   : 
                  await trigger('tracking_id')
                if (!isValid) return
                if (budgetExceeded) {
                  toast({ title: 'Budget exceeded', description: `PR total (${formatCurrency(grandTotal)}) exceeds remaining budget (${formatCurrency(budgetRemaining)}).`, variant: 'destructive' })
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
                    // const data = watch()
                    // saveDraftMutation.mutate(data, {
                    //   onSuccess: (pr) => {
                    //     setSavedPrId(pr.hash_id ?? pr.id)
                    //     setPrIdForComparison(pr.id)
                    //     queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
                    //     toast({ title: 'PR saved as draft.' })
                    //     setShowSaveConfirm(false)
                    //     setActiveTab('comparison')
                    //   },
                    // })
                    setActiveTab('comparison')
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
          <ComparisonTab prId={prIdForComparison} />
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
                variant="outline"
                disabled={isSaving}
                className="gap-2"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
                  router.push('/procurement')
                }}
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </Button>
              <Button
                type="button"
                disabled={isSaving}
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