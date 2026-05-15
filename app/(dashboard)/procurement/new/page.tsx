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
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, Search, X,
  AlertTriangle, Check, ChevronRight, Sparkles, Plus, Building2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import ApprovalMatrix from '../components/ApprovalMatrix'
import CompareStep from '../components/CompareStep'
import Link from 'next/link'

// ─── Error flattener ─────────────────────────────────────────────────────────

function flattenDrfError(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    for (const item of value) { const found = flattenDrfError(item); if (found) return found }
    return ''
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = flattenDrfError(item); if (found) return found
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

/** Debounce a value by `delay` ms. Returns the debounced value. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function VendorDot({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const colors = ['#042348', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']
  const strName = String(name || '')
  const idx = strName.charCodeAt(0) % colors.length
  const bg = color || colors[idx]
  const initials = strName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: size / 4,
      background: bg, color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>{initials}</span>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  step, onBack, onContinue, continueLabel = 'Continue', continueDisabled = false, loading = false,
}: {
  step: number; onBack?: () => void; onContinue: () => void
  continueLabel?: string; continueDisabled?: boolean; loading?: boolean
}) {
  const steps = ['Quotes', 'Compare & select', 'Approval matrix']
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid hsl(var(--border))',
      // background: 'hsl(var(--background))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '12px 20px', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{
                width: 48, height: 1, margin: '0 4px',
                background: i < step ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, flexShrink: 0,
                background: i < step - 1 ? '#10b981'
                  : i === step - 1 ? 'hsl(var(--primary))'
                    : 'hsl(var(--muted))',
                color: i <= step - 1 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              }}>
                {i < step - 1 ? <Check style={{ width: 10, height: 10 }} /> : (i + 1)}
              </span>
              <span style={{
                fontSize: 16,
                fontWeight: i === step - 1 ? 600 : 400,
                color: i === step - 1 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              }}>{s}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px' }}>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        )}
        {continueLabel && (
          <Button size="sm" onClick={onContinue} disabled={continueDisabled || loading} className="gap-1">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {continueLabel} {!loading && <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── TrackingIdSearch ─────────────────────────────────────────────────────────
// Self-contained: owns search state, debounce (400 ms), and the API query.
// The API is only called when the user has typed ≥ 1 character — never on mount.

function TrackingIdSearch({
  onSelect, value, onChange,
}: {
  onSelect: (t: any) => void
  value: any | null
  onChange: (t: any | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Debounce raw input — API fires 400 ms after the user stops typing
  const debouncedSearch = useDebounce(search.trim(), 400)

  useClickOutside(wrapperRef, () => setOpen(false))

  const { data: trackingIds = [], isFetching } = useQuery({
    queryKey: ['tracking-ids-approved', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await apiClient.get(`/budget/tracking-ids/?${params.toString()}`)
      return res.data.results || []
    },
    // Never fires until the debounced value has at least 1 character
    enabled: debouncedSearch.length > 0,
    // Keep stale results visible while the next fetch is in-flight (no flicker)
    placeholderData: (prev: any) => prev,
  })

  const showDropdown = open && !value && search.trim().length > 0

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tracking code or title…"
          value={value ? value.tracking_code : search}
          onChange={(e) => {
            setSearch(e.target.value)
            onChange(null)   // clear selection while user retypes
            setOpen(true)
          }}
          onFocus={() => { if (search.trim().length > 0) setOpen(true) }}
          className="pl-8 text-sm"
        />
        {/* Spinner while debounced fetch is in flight */}
        {isFetching && !value && (
          <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-auto">
          {/* Debounce hasn't fired yet — user is still typing */}
          {debouncedSearch.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">Type to search…</div>
          ) : isFetching && (trackingIds as any[]).length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          ) : (trackingIds as any[]).length > 0 ? (
            (trackingIds as any[]).map((t: any) => (
              <button
                key={t.id}
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors border-b last:border-b-0"
                onClick={() => { onChange(t); setSearch(''); setOpen(false); onSelect(t) }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">{t.tracking_code}</span>
                  <span className="text-xs font-medium tabular-nums">{formatCurrency(t.approved_amount)}</span>
                </div>
                {t.title && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.title}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  {t.plant_name && <span className="text-[10px] text-muted-foreground">{t.plant_name}</span>}
                  {t.department_name && <span className="text-[10px] text-muted-foreground">· {t.department_name}</span>}
                </div>
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

// ─── Step 1: Quotes ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'hsl(var(--muted-foreground))',
}

function QuotesStep({
  trackingDetail, selectedTracking, onSelectTracking,
  setValue, watchedTrackingId, errors, register,
  quotations, qLoading, selectedQuotationIds, toggleQuotation,
  grandTotal, budgetRemaining, budgetExceeded,
}: any) {
  const vendorColors: Record<string, string> = {}
  const colorPalette = ['#042348', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6']
  let colorIdx = 0
  function vendorColor(name: string) {
    if (!vendorColors[name]) vendorColors[name] = colorPalette[colorIdx++ % colorPalette.length]
    return vendorColors[name]
  }

  const sortedQuotations = [...(quotations as any[])].sort((a, b) => {
    const aSelected = selectedQuotationIds.includes(a.id)
    const bSelected = selectedQuotationIds.includes(b.id)
    const aExceeds = budgetRemaining !== null && Number(a.total_amount) > budgetRemaining
    const bExceeds = budgetRemaining !== null && Number(b.total_amount) > budgetRemaining
    if (aSelected && !bSelected) return -1
    if (!aSelected && bSelected) return 1
    if (aExceeds && !bExceeds) return 1
    if (!aExceeds && bExceeds) return -1
    return 0
  })

  const hasDate = quotations.some((q: any) => q?.quotation_date)
  const hasValidity = quotations.some((q: any) => q?.valid_until)
  const hasUploadedBy = quotations.some((q: any) => q?.uploaded_by)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Procurement details</CardTitle>
            <span className="text-xs text-muted-foreground">Step 1 of 3</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tracking ID <span className="text-destructive">*</span>
            </Label>
            {/* No trackingIds prop needed — component fetches on its own */}
            <TrackingIdSearch
              value={selectedTracking}
              onChange={(t) => {
                if (!t) { onSelectTracking(null); return }
                onSelectTracking(t)
                setValue('tracking_id', t.id, { shouldDirty: true, shouldValidate: true })
                setValue('title', t.title)
                setValue('plant', t.plant)
                setValue('department', t.department)
                setValue('description', t.description || '')
              }}
              onSelect={() => { }}
            />
            {errors.tracking_id && (
              <p className="text-xs text-destructive">{errors.tracking_id.message}</p>
            )}
          </div>

          {trackingDetail && (
            <>
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">Title</span>
                    <p className="font-semibold text-foreground truncate max-w-[220px]">{trackingDetail.title || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" />Plant
                    </span>
                    <p className="font-medium">{trackingDetail.plant_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department</span>
                    <p className="font-medium">{trackingDetail.department_name}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <span className="text-muted-foreground">Priority</span>
                    <p className="font-semibold capitalize">{trackingDetail.priority || 'Normal'}</p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Budget consumed</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(trackingDetail.consumed_amount)} / {formatCurrency(trackingDetail.approved_amount)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, (Number(trackingDetail.consumed_amount) / Number(trackingDetail.approved_amount)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-muted-foreground">Remaining</span>
                    <p className={`text-sm font-bold tabular-nums ${Number(trackingDetail.remaining_amount) > 0 ? 'text-emerald-700' : 'text-destructive'}`}>
                      {formatCurrency(trackingDetail.remaining_amount)}
                    </p>
                  </div>
                </div>

                {grandTotal > 0 && budgetExceeded && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive font-medium bg-destructive/10 px-2 py-1.5 rounded-md">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    This PR exceeds remaining budget by {formatCurrency(grandTotal - budgetRemaining)}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description{' '}
                  <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Brief description of what is being procured…"
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {watchedTrackingId && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Pick quotations to compare</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedQuotationIds.length}/5 selected · auto-aligns line items across vendors
                </p>
              </div>
              <Link href="/quotation/new">
                <Button type="button" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Quotation
                </Button>
              </Link>
            </div>
          </CardHeader>

          <div className="max-h-[520px] overflow-auto rounded-b-xl" style={{ scrollbarWidth: 'thin' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'hsl(var(--background))' }}>
                <tr style={{
                  background: 'hsl(var(--muted) / 0.7)',
                  borderBottom: '1px solid hsl(var(--border))',
                }}>
                  <th style={{ width: 36, padding: '8px 12px' }} />
                  <th style={thStyle}>Quote</th>
                  <th style={thStyle}>Vendor</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Items</th>
                  {hasDate && <th style={thStyle}>Date</th>}
                  {hasValidity && <th style={thStyle}>Validity</th>}
                  {hasUploadedBy && <th style={thStyle}>Uploaded by</th>}
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>

              <tbody>
                {qLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-sm text-muted-foreground">
                      <Loader2 className="inline w-4 h-4 animate-spin mr-1" /> Loading quotations…
                    </td>
                  </tr>
                ) : sortedQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-sm text-muted-foreground">
                      No quotations found
                    </td>
                  </tr>
                ) : sortedQuotations.map((q: any) => {
                  const isSelected = selectedQuotationIds.includes(q.id)
                  const exceedsBudget = budgetRemaining !== null && Number(q.total_amount) > budgetRemaining
                  const vc = vendorColor(q.vendor_name || 'V')

                  return (
                    <tr
                      key={q.id}
                      onClick={() => !exceedsBudget && toggleQuotation(q.id)}
                      style={{
                        background: isSelected ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                        borderBottom: '1px solid hsl(var(--border))',
                        borderLeft: isSelected
                          ? '3px solid hsl(var(--primary))'
                          : exceedsBudget
                            ? '3px solid hsl(var(--destructive) / 0.25)'
                            : '3px solid transparent',
                        cursor: exceedsBudget ? 'not-allowed' : 'pointer',
                        opacity: exceedsBudget ? 0.5 : 1,
                        transition: 'background .12s',
                      }}
                      className="hover:bg-muted/20"
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 16, height: 16, borderRadius: 4,
                          border: isSelected ? 'none' : '1.5px solid hsl(var(--border))',
                          background: isSelected ? 'hsl(var(--primary))' : 'transparent',
                        }}>
                          {isSelected && (
                            <Check style={{ width: 10, height: 10, color: 'hsl(var(--primary-foreground))' }} />
                          )}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
                          color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                        }}>
                          {q.ref_no}
                        </span>
                        {q.quotation_no && (
                          <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                            {q.quotation_no}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <VendorDot name={q.vendor_name || 'V'} color={vc} size={22} />
                          <div>
                            <span style={{ fontWeight: 500 }}>{q.vendor_name}</span>
                            {q.vendor_gstin && (
                              <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
                                {q.vendor_gstin}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace' }}>
                        {q.items_count ?? '—'}
                      </td>

                      {hasDate && (
                        <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>
                          {q.quotation_date
                            ? new Date(q.quotation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      )}

                      {hasValidity && (
                        <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>
                          {q.valid_until
                            ? new Date(q.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      )}

                      {hasUploadedBy && (
                        <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>
                          {q.uploaded_by || '—'}
                        </td>
                      )}

                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {formatCurrency(q.total_amount)}
                        {exceedsBudget && (
                          <div className="text-[10px] text-destructive font-sans font-medium">
                            Exceeds budget
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
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

  const [step, setStep] = useState(1)
  const [selectedTracking, setSelectedTracking] = useState<any>(null)
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<number[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [savedPrId, setSavedPrId] = useState<string | null>(null)

  const { register, watch, setValue, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedTrackingId = watch('tracking_id')

  // ─── Queries ──────────────────────────────────────────────────────────

  // trackingIds query lives inside <TrackingIdSearch> — not here.

  const { data: trackingDetail } = useQuery({
    queryKey: ['tracking-detail', watchedTrackingId],
    queryFn: async () => (await apiClient.get(`/budget/tracking-ids/${watchedTrackingId}/`)).data,
    enabled: !!watchedTrackingId,
  })

  const { data: quotations = [], isLoading: qLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const { data } = await apiClient.get('/quotations/')
      return data?.results || data || []
    },
    enabled: !!watchedTrackingId,
  })

  // ─── Budget calculations ───────────────────────────────────────────────

  const selectedQuotationList = (quotations as any[]).filter((q: any) => selectedQuotationIds.includes(q.id))
  const subtotal = selectedQuotationList.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0)
  const taxTotal = activeTaxes.reduce((s, t) => s + subtotal * t.rate / 100, 0)
  const grandTotal = subtotal + taxTotal

  const budgetRemaining = trackingDetail ? Number(trackingDetail.remaining_amount ?? 0) : null
  const budgetExceeded = budgetRemaining !== null && grandTotal > budgetRemaining

  // ─── Mutations ────────────────────────────────────────────────────────
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const data = watch()
      const payload = { ...data, quotation_ids: selectedQuotationIds, status: 'draft' }
      if (savedPrId) {
        const { data: pr } = await apiClient.patch(`/procurement/${savedPrId}/`, payload)
        return pr
      }
      const { data: pr } = await apiClient.post('/procurement/', payload)
      return pr
    },
    onError: (err: any) => {
      const msg = flattenDrfError(err?.response?.data) || 'Something went wrong.'
      toast({ title: 'Failed to save PR', description: msg, variant: 'destructive' })
    },
  })

  const isSaving = saveDraftMutation.isPending

  // ─── Step navigation ──────────────────────────────────────────────────

  const handleContinue = async () => {
    if (step === 1) {
      const isValid = await trigger('tracking_id')
      if (!isValid) return
      if (!selectedQuotationIds.length) {
        toast({ title: 'No quotations selected', description: 'Please select at least one quotation to compare.', variant: 'destructive' })
        return
      }
      if (budgetExceeded) {
        toast({ title: 'Budget exceeded', description: 'PR total exceeds remaining budget.', variant: 'destructive' })
        return
      }
      saveDraftMutation.mutate(undefined, {
        onSuccess: (pr) => {
          setSavedPrId(pr.hash_id ?? pr.id)
          queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
          toast({ title: 'PR saved as draft.' })
          setStep(2)
        },
      })
    } else if (step === 2) {
      if (!selectedVendorId) {
        toast({ title: 'No vendor selected', description: 'Please select a vendor to proceed.', variant: 'destructive' })
        return
      }
      setStep(3)
    }
  }

  const toggleQuotation = (id: number) => {
    if (
      !selectedQuotationIds.includes(id) &&
      selectedQuotationIds.length >= 5
    ) {
      toast({
        title: 'Maximum limit reached',
        description: 'You can compare up to 5 quotations at a time.',
        variant: 'destructive',
      })
      return
    }
  
    setSelectedQuotationIds(prev =>
      prev.includes(id)
        ? prev.filter(q => q !== id)
        : [...prev, id]
    )
  }
  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* <div className="flex items-start justify-between px-1 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Purchase Requisition</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create a purchase requisition in 3 steps.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push('/procurement')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div> */}

      <StepIndicator
        step={step}
        onBack={step > 1 ? () => setStep(step - 1) : undefined}
        onContinue={handleContinue}
        continueLabel={step === 3 ? '' : 'Next'}
        continueDisabled={step === 3 && !selectedVendorId}
        loading={isSaving}
      />

      <div className="pt-5">
        {step === 1 && (
          <QuotesStep
            trackingDetail={trackingDetail}
            selectedTracking={selectedTracking}
            onSelectTracking={setSelectedTracking}
            setValue={setValue}
            watchedTrackingId={watchedTrackingId}
            errors={errors}
            register={register}
            quotations={quotations}
            qLoading={qLoading}
            selectedQuotationIds={selectedQuotationIds}
            toggleQuotation={toggleQuotation}
            grandTotal={grandTotal}
            budgetRemaining={budgetRemaining}
            budgetExceeded={budgetExceeded}
          />
        )}

        {step === 2 && (
          <CompareStep
            selectedQuotationIds={selectedQuotationIds}
            selectedVendorId={selectedVendorId}
            setSelectedVendorId={setSelectedVendorId}
          />
        )}

        {step === 3 && (
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
            selectedVendor={selectedVendorId}
          />
        )}
      </div>
    </div>
  )
}