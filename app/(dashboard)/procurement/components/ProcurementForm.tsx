'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, Search, X,
  Check, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, ChevronsUpDown, Plus, Lock, Calendar,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isWithinInterval, isBefore, addMonths, subMonths, getDay, parseISO,
} from 'date-fns'
import { formatCurrency, PAGE_SIZE } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import ApprovalMatrix from './ApprovalMatrix'
import CompareStep from './CompareStep'
import Link from 'next/link'

const PR_STEPS = [
  { label: 'Quotes', sub: 'Select quotations to compare' },
  { label: 'Compare & Select', sub: 'Pick the winning vendor' },
  { label: 'Approval', sub: 'Submit for approval' },
]

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

const schema = z.object({
  tracking_id: z.number({ required_error: 'Tracking ID is required' }),
  plant: z.number({ required_error: 'Plant is required' }),
  department: z.number({ required_error: 'Department is required' }),
  description: z.string().optional(),
  title: z.string().optional(),
  matrix_id: z.number().optional(),
})

type FormData = z.infer<typeof schema>

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
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

function TrackingIdSearch({
  onSelect, value, onChange, hasError,
}: {
  onSelect: (t: any) => void
  value: any | null
  onChange: (t: any | null) => void
  hasError?: boolean
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [debouncedSearch] = useDebounce(search.trim(), 400)

  useClickOutside(wrapperRef, () => setOpen(false))

  const { data: trackingIds = [], isFetching } = useQuery({
    queryKey: ['tracking-ids-approved', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await apiClient.get(`/budget/tracking-ids/?${params.toString()}`)
      return res.data.results || []
    },
    enabled: debouncedSearch.length > 0,
    placeholderData: (prev: any) => prev,
  })

  const showDropdown = open && !value && search.trim().length > 0

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" style={{ color: '#9a9a96' }} />
        <input
          placeholder="Search tracking code or title…"
          value={value ? value.tracking_code : search}
          onChange={(e) => {
            setSearch(e.target.value)
            onChange(null)
            setOpen(true)
          }}
          onFocus={() => { if (search.trim().length > 0) setOpen(true) }}
          className={`pr-search-input${hasError ? ' inp-error' : ''}`}
        />
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
        <div className="absolute z-[200] w-full mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-auto">
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

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'hsl(var(--muted-foreground))',
}

type SortKey = 'ref_no' | 'vendor_name' | 'items_count' | 'quotation_date' | 'valid_until' | 'total_amount'
type SortDir = 'asc' | 'desc'

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  const commonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', lineHeight: 1 }
  if (sortKey !== column) {
    return <span style={commonStyle} aria-hidden="true"><ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /></span>
  }
  return (
    <span style={commonStyle} aria-hidden="true">
      {sortDir === 'asc'
        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
    </span>
  )
}

const Q_PAGE_SIZE = 10

function DateRangePicker({ dateFrom, dateTo, onChange }: {
  dateFrom: string; dateTo: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [selecting, setSelecting] = useState<'start' | 'end'>('start')
  const [hover, setHover] = useState<Date | null>(null)
  const [pendingStart, setPendingStart] = useState<Date | null>(null)

  useEffect(() => {
    if (!dateFrom && !dateTo) {
      setPendingStart(null)
      setSelecting('start')
    }
  }, [dateFrom, dateTo])

  const startDate = dateFrom ? parseISO(dateFrom) : null
  const endDate = dateTo ? parseISO(dateTo) : null

  // While picking end date, use pendingStart for range display; otherwise use confirmed startDate
  const effectiveStart = selecting === 'end' ? (pendingStart ?? startDate) : startDate

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingBlanks = getDay(monthStart) // 0=Sun

  const isInRange = (day: Date) => {
    if (!effectiveStart) return false
    const end = selecting === 'end' && hover ? hover : endDate
    if (!end) return false
    const [s, e] = isBefore(effectiveStart, end) ? [effectiveStart, end] : [end, effectiveStart]
    return isWithinInterval(day, { start: s, end: e })
  }

  const handleDay = (day: Date) => {
    if (selecting === 'start') {
      // Store start locally — do NOT call onChange yet (no API call until both selected)
      setPendingStart(day)
      setSelecting('end')
    } else {
      const s = pendingStart ?? startDate
      if (!s) { setPendingStart(day); setSelecting('end'); return }
      const [from, to] = isBefore(s, day) ? [s, day] : [day, s]
      onChange(format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'))
      setPendingStart(null)
      setSelecting('start')
      setOpen(false)
    }
  }

  const displayStart = selecting === 'end' ? pendingStart : startDate
  const label = displayStart && endDate
    ? `${format(displayStart, 'dd MMM yy')} – ${format(endDate, 'dd MMM yy')}`
    : displayStart
    ? `${format(displayStart, 'dd MMM yy')} – ?`
    : 'Date range'

  const hasValue = !!(dateFrom || dateTo)

  const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelecting('start'); setPendingStart(null); setHover(null) } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
            minWidth: 190,
            borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff',
            fontFamily: "'DM Sans',sans-serif", fontSize: 12,
            color: hasValue ? '#1a1a18' : '#9a9a96', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <Calendar style={{ width: 13, height: 13, flexShrink: 0 }} />
          {label}
          {hasValue && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange('', ''); setPendingStart(null); setSelecting('start'); setOpen(false) }}
              style={{ marginLeft: 2, display: 'flex', color: '#9a9a96' }}
            >
              <X style={{ width: 11, height: 11 }} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" style={{ width: 'auto', padding: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#1a1a18', display: 'flex' }}>
            <ChevronLeft style={{ width: 14, height: 14 }} />
          </button>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600 }}>
            {format(viewDate, 'MMMM yyyy')}
          </span>
          <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#1a1a18', display: 'flex' }}>
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
        {/* Day names */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,32px)', gap: 2, marginBottom: 4 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#9a9a96', fontFamily: "'DM Sans',sans-serif" }}>{d}</div>
          ))}
        </div>
        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,32px)', gap: 2 }}>
          {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
          {days.map(day => {
            const isStart = !!(effectiveStart && isSameDay(day, effectiveStart))
            const isEnd = !!(endDate && isSameDay(day, endDate))
            const inRange = isInRange(day)
            const isEdge = isStart || isEnd
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDay(day)}
                onMouseEnter={() => selecting === 'end' && setHover(day)}
                onMouseLeave={() => setHover(null)}
                style={{
                  width: 32, height: 32, borderRadius: isEdge ? 8 : inRange ? 0 : 8,
                  border: 'none', cursor: 'pointer',
                  background: isEdge ? 'hsl(var(--primary))' : inRange ? 'hsl(var(--primary)/0.12)' : 'transparent',
                  color: isEdge ? '#fff' : '#1a1a18',
                  fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: isEdge ? 700 : 400,
                  transition: 'background .1s',
                }}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        {startDate && !endDate && (
          <p style={{ marginTop: 8, fontSize: 11, color: '#9a9a96', fontFamily: "'DM Sans',sans-serif" }}>
            Click a second date to set range end
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function QuotesStep({
  trackingDetail, selectedTracking, onSelectTracking,
  setValue, watchedTrackingId, errors, register,
  selectedQuotationIds, toggleQuotation,
  grandTotal, budgetRemaining, budgetExceeded,
  setSelectedQuotationIds, isEditMode, currentPrId,
}: any) {
  const vendorColors: Record<string, string> = {}
  const colorPalette = ['#042348', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6']
  let colorIdx = 0
  function vendorColor(name: string) {
    if (!vendorColors[name]) vendorColors[name] = colorPalette[colorIdx++ % colorPalette.length]
    return vendorColors[name]
  }

  const [sortKey, setSortKey] = useState<SortKey>('ref_no')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'within' | 'exceeds'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [search] = useDebounce(searchInput, 400)
  const [vendorFilter, setVendorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // reset page when filters change
  useEffect(() => { setPage(1) }, [search, vendorFilter, dateFrom, dateTo])

  const ordering = sortDir === 'asc' ? sortKey : `-${sortKey}`

  const { data: vendorsList = [] } = useQuery({
    queryKey: ['vendors-list-pick'],
    queryFn: async () => { const r = await apiClient.get('/vendors/?ordering=company_name'); return r.data?.results ?? r.data ?? [] },
  })

  const { data: qData, isLoading: qLoading, isFetching: qFetching } = useQuery({
    queryKey: ['quotations-pick', search, page, ordering, vendorFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), page_size: String(Q_PAGE_SIZE), ordering }
      if (search) params.search = search
      if (vendorFilter) params.vendor_id = vendorFilter
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const { data } = await apiClient.get('/quotations/', { params })
      return data
    },
    enabled: !!watchedTrackingId,
    placeholderData: (prev: any) => prev,
  })

  const quotations: any[] = qData?.results ?? (Array.isArray(qData) ? qData : [])
  const totalCount: number = qData?.count ?? quotations.length
  const totalPages = Math.max(1, Math.ceil(totalCount / Q_PAGE_SIZE))
  const qLoaded = !qLoading

  const hasDate = quotations.some((q: any) => q?.quotation_date)
  const hasValidity = quotations.some((q: any) => q?.valid_until)
  const hasUploadedBy = quotations.some((q: any) => q?.uploaded_by)

  const processedQuotations = quotations.filter((q: any) => {
    // Exclude quotations already linked to a different PR
    if (q.pr_id !== null && q.pr_id !== undefined && String(q.pr_id) !== String(currentPrId ?? '')) return false
    if (budgetFilter === 'within' && budgetRemaining !== null && Number(q.total_amount) > budgetRemaining) return false
    if (budgetFilter === 'exceeds' && (budgetRemaining === null || Number(q.total_amount) <= budgetRemaining)) return false
    return true
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  function Th({ col, label, style }: { col: SortKey; label: string; style?: React.CSSProperties }) {
    return (
      <th
        style={{ ...thStyle, ...style, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          <span>{label}</span>
          <SortIcon column={col} sortKey={sortKey} sortDir={sortDir} />
        </span>
      </th>
    )
  }

  const activeFilterCount = (searchInput ? 1 : 0) + (budgetFilter !== 'all' ? 1 : 0) + (vendorFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-sec">
        <div className="form-sec-head">
          <span className="fsh-title">Procurement details</span>
          <span style={{ fontSize: 11, color: '#9a9a96' }}>Step 1 of 3</span>
        </div>
        <div className="form-body">
          <div>
            <label className="lbl">
              Tracking ID {!isEditMode && <span className="req">*</span>}
            </label>
            {isEditMode ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 11px', borderRadius: 8,
                border: '0.5px solid rgba(0,0,0,0.08)', background: '#f8f8f6',
              }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#1a1a18' }}>
                  {selectedTracking?.tracking_code || '—'}
                </span>
                <Lock style={{ width: 12, height: 12, color: '#9a9a96', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#9a9a96' }}>cannot be changed</span>
              </div>
            ) : (
              <TrackingIdSearch
                value={selectedTracking}
                hasError={!!errors.tracking_id}
                onChange={(t) => {
                  if (!t) {
                    onSelectTracking(null)
                    setValue('tracking_id', undefined as any, { shouldDirty: true, shouldValidate: false })
                    setValue('plant', undefined as any)
                    setValue('department', undefined as any)
                    setValue('title', undefined as any)
                    setValue('description', '')
                    setSelectedQuotationIds([])
                    return
                  }
                  onSelectTracking(t)
                  setValue('tracking_id', t.id, { shouldDirty: true, shouldValidate: true })
                  setValue('title', t.title)
                  setValue('plant', t.plant)
                  setValue('department', t.department)
                  setValue('description', t.description || '')
                }}
                onSelect={() => { }}
              />
            )}
            {errors.tracking_id && !isEditMode && (
              <p style={{ fontSize: 12, color: '#E24B4A', marginTop: 4 }}>{errors.tracking_id.message}</p>
            )}
          </div>

          {trackingDetail && (
            <>
              <div style={{ background: '#f8f8f6', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 10 }}>
                  {[
                    { label: 'Title', value: trackingDetail.title },
                    { label: 'Plant', value: trackingDetail.plant_name },
                    { label: 'Department', value: trackingDetail.department_name },
                    { label: 'Priority', value: trackingDetail.priority || 'Normal' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="info-row">{label}</div>
                      <div className="info-val">{value || '—'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9a9a96', marginBottom: 4 }}>
                      <span>Budget consumed</span>
                      <span style={{ fontWeight: 600, color: '#1a1a18' }}>
                        {formatCurrency(trackingDetail.consumed_amount)} / {formatCurrency(trackingDetail.approved_amount)}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: '#e8e8e4', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, background: '#1a1a18', transition: 'width .3s',
                        width: `${Math.min(100, (Number(trackingDetail.consumed_amount) / Number(trackingDetail.approved_amount)) * 100)}%`,
                      }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#9a9a96' }}>Remaining</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", color: Number(trackingDetail.remaining_amount) > 0 ? '#3B6D11' : '#A32D2D' }}>
                      {formatCurrency(trackingDetail.remaining_amount)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="lbl">Description <span style={{ fontWeight: 400, color: '#9a9a96' }}>(optional)</span></label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Brief description of what is being procured…"
                  className="pr-textarea"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {watchedTrackingId && (
        <div className="form-sec">
          <div className="form-sec-head">
            <div style={{ flex: 1 }}>
              <div className="fsh-title">Pick quotations to compare</div>
              <div style={{ fontSize: 12, color: '#9a9a96', marginTop: 2 }}>
                {selectedQuotationIds.length}/5 selected · auto-aligns line items across vendors
              </div>
            </div>
            <Link href="/quotation/new">
              <Button type="button" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Quotation
              </Button>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap', borderBottom: '0.5px solid rgba(0,0,0,0.06)', rowGap: 6 }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: 180, flex: 1, maxWidth: 260 }}>
              <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#9a9a96', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search quote no…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: '100%', height: 32, paddingLeft: 28, paddingRight: searchInput ? 28 : 10,
                  borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff',
                  fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#1a1a18', outline: 'none',
                }}
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9a9a96', display: 'flex' }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>

            {/* Vendor filter */}
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              style={{ height: 32, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: vendorFilter ? '#1a1a18' : '#9a9a96', padding: '0 8px', outline: 'none', minWidth: 140 }}
            >
              <option value="">All vendors</option>
              {(vendorsList as any[]).map((v: any) => (
                <option key={v.id} value={v.id}>{v.company_name}</option>
              ))}
            </select>

            {/* Date range picker */}
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
            />

            {/* Budget filter */}
            {budgetRemaining !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Budget</span>
                <select
                  value={budgetFilter}
                  onChange={(e) => setBudgetFilter(e.target.value as any)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                >
                  <option value="all">All</option>
                  <option value="within">Within budget</option>
                  <option value="exceeds">Exceeds</option>
                </select>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setBudgetFilter('all'); setVendorFilter(''); setDateFrom(''); setDateTo('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: 'hsl(var(--muted-foreground))',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                }}
              >
                <X style={{ width: 11, height: 11 }} />
                Clear ({activeFilterCount})
              </button>
            )}

            <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginLeft: 'auto' }}>
              {qLoading ? '…' : `${quotations.length} of ${totalCount}`}
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            {qFetching && !qLoading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0 0 12px 12px' }}>
                <Loader2 style={{ width: 18, height: 18, color: 'hsl(var(--primary))' }} className="animate-spin" />
              </div>
            )}
          <div className="max-h-[520px] overflow-auto" style={{ scrollbarWidth: 'thin', borderRadius: '0 0 12px 12px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'hsl(var(--background))' }}>
                <tr style={{ background: 'hsl(var(--muted) / 0.7)', borderBottom: '1px solid hsl(var(--border))' }}>
                  <th style={{ width: 36, padding: '8px 12px' }} />
                  <Th col="ref_no" label="Quote" />
                  <Th col="vendor_name" label="Vendor" />
                  <Th col="items_count" label="Items" style={{ textAlign: 'center' }} />
                  {hasDate && <Th col="quotation_date" label="Date" />}
                  {hasValidity && <Th col="valid_until" label="Validity" />}
                  {hasUploadedBy && <th style={thStyle}>Uploaded by</th>}
                  <Th col="total_amount" label="Total" style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {qLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-sm text-muted-foreground">
                      <Loader2 className="inline w-4 h-4 animate-spin mr-1" /> Loading quotations…
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-sm text-muted-foreground">
                      {activeFilterCount > 0 ? 'No quotations match the current filters.' : 'No quotations found'}
                    </td>
                  </tr>
                ) : quotations?.map((q: any) => {
                  const isSelected = selectedQuotationIds.includes(q.id)
                  const exceedsBudget = budgetRemaining !== null && Number(q.total_amount) > budgetRemaining
                  const vc = vendorColor(q.vendor_name || 'V')

                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleQuotation(q.id)}
                      style={{
                        background: isSelected ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                        borderBottom: '1px solid hsl(var(--border))',
                        borderLeft: isSelected
                          ? '3px solid hsl(var(--primary))'
                          : exceedsBudget
                            ? '3px solid hsl(var(--destructive) / 0.4)'
                            : '3px solid transparent',
                        cursor: 'pointer',
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
                          {isSelected && <Check style={{ width: 10, height: 10, color: 'hsl(var(--primary-foreground))' }} />}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                          {q.ref_no}
                        </span>
                        {q.quotation_no && (
                          <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{q.quotation_no}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <VendorDot name={q.vendor_name || 'V'} color={vc} size={22} />
                          <div>
                            <span style={{ fontWeight: 500 }}>{q.vendor_name}</span>
                            {q.vendor_gstin && (
                              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{q.vendor_gstin}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{q.items_count ?? '—'}</td>
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
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                        {formatCurrency(q.total_amount)}
                        {exceedsBudget && (
                          <div className="text-[11px] text-destructive font-medium">Exceeds budget</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '0.5px solid rgba(0,0,0,0.06)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontSize: 12 }}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                  const p = start + i
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      style={{ padding: '4px 8px', minWidth: 30, borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.14)', background: p === page ? 'hsl(var(--primary))' : '#fff', color: p === page ? '#fff' : '#1a1a18', cursor: 'pointer', fontSize: 12, fontWeight: p === page ? 600 : 400 }}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.14)', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, fontSize: 12 }}
                >
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}
          </div>{/* end position:relative loader wrapper */}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ProcurementFormProps {
  mode: 'add' | 'edit'
  procurementId?: string
  initialStep?: number
}

export default function ProcurementForm({ mode, procurementId, initialStep = 1 }: ProcurementFormProps) {
  const isEditMode = mode === 'edit'
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const activeTaxes = useSettingsStore(s => s.taxComponents.filter(t => t.is_active))

  const [step, setStep] = useState(initialStep)
  const [selectedTracking, setSelectedTracking] = useState<any>(null)
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<number[]>([])
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  // Use a ref so mutationFn always reads the latest ID without stale-closure issues
  const savedPrIdRef = useRef<string | null>(isEditMode ? (procurementId ?? null) : null)
  const [savedPrId, _setSavedPrId] = useState<string | null>(isEditMode ? (procurementId ?? null) : null)
  const setSavedPrId = (id: string | null) => { savedPrIdRef.current = id; _setSavedPrId(id) }

  const [prId, setPrId] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState(false)
  const lastSavedTrackingIdRef = useRef<string | null>(null)
  const [lastSavedTrackingId, _setLastSavedTrackingId] = useState<string | null>(null)
  const setLastSavedTrackingId = (id: string | null) => { lastSavedTrackingIdRef.current = id; _setLastSavedTrackingId(id) }

  const { register, watch, setValue, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const watchedTrackingId = watch('tracking_id')

  // ─── Fetch existing PR in edit mode ───────────────────────────────────

  const { data: existingPR, isLoading: prLoading } = useQuery({
    queryKey: ['procurement-edit', procurementId],
    queryFn: async () => (await apiClient.get(`/procurement/${procurementId}/`)).data,
    enabled: isEditMode && !!procurementId,
  })

  useEffect(() => {
    if (!existingPR || !isEditMode || prefilled) return
    setValue('tracking_id', existingPR.tracking_id, { shouldDirty: false, shouldValidate: false })
    setValue('plant', existingPR.plant, { shouldDirty: false })
    setValue('department', existingPR.department, { shouldDirty: false })
    setValue('title', existingPR.title || '')
    setValue('description', existingPR.description || '')
    setSelectedQuotationIds((existingPR.linked_quotations ?? []).map((q: any) => q.id))
    setSavedPrId(procurementId ?? null)
    setPrId(existingPR.id ? String(existingPR.id) : null)
    setSelectedTracking({
      id: existingPR.tracking_id,
      tracking_code: existingPR.tracking_code ?? existingPR.budget_info?.tracking_code,
      title: existingPR.title,
      plant: existingPR.plant,
      plant_name: existingPR.plant_name,
      department: existingPR.department,
      department_name: existingPR.department_name,
    })
    setLastSavedTrackingId(String(existingPR.tracking_id ?? ''))
    setPrefilled(true)
  }, [existingPR, isEditMode, prefilled])

  // ─── Queries ──────────────────────────────────────────────────────────

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

  // Reads savedPrIdRef so it always sees the latest ID regardless of closure timing
  const saveDraftMutation = useMutation({
    mutationFn: async ({ forceNew }: { forceNew: boolean }) => {
      const currentId = savedPrIdRef.current
      const data = watch()
      const payload = { ...data, quotation_ids: selectedQuotationIds, status: 'draft' }
      if (currentId && !forceNew) {
        const { data: pr } = await apiClient.patch(`/procurement/${currentId}/`, payload)
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
      if (!isEditMode) {
        const isValid = await trigger('tracking_id')
        if (!isValid) return
      }
      if (!selectedQuotationIds.length) {
        toast({ title: 'No quotations selected', description: 'Please select at least one quotation to compare.', variant: 'destructive' })
        return
      }

      const currentTrackingId = String(watch('tracking_id') ?? '')
      // Force new PR only if tracking_id changed from what was last saved
      const forceNew = !savedPrIdRef.current || (lastSavedTrackingIdRef.current !== null && currentTrackingId !== lastSavedTrackingIdRef.current)

      saveDraftMutation.mutate({ forceNew }, {
        onSuccess: (pr) => {
          const newId = pr?.id ? String(pr.id) : null
          if (newId) { setSavedPrId(newId); setPrId(newId) }
          setLastSavedTrackingId(currentTrackingId)
          queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
          if (isEditMode && procurementId) {
            queryClient.invalidateQueries({ queryKey: ['pr', procurementId] })
            queryClient.invalidateQueries({ queryKey: ['procurement-edit', procurementId] })
          }
          toast({ title: isEditMode ? 'PR updated.' : 'PR saved as draft.' })
          setStep(2)
        },
      })
    } else if (step === 2) {
      if (!selectedQuotationId) {
        toast({ title: 'No vendor selected', description: 'Please select a vendor to proceed.', variant: 'destructive' })
        return
      }
      setStep(3)
    }
  }

  const toggleQuotation = (id: number) => {
    if (!selectedQuotationIds.includes(id) && selectedQuotationIds.length >= 5) {
      toast({
        title: 'Maximum limit reached',
        description: 'You can compare up to 5 quotations at a time.',
        variant: 'destructive',
      })
      return
    }
    setSelectedQuotationIds(prev =>
      prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]
    )
  }

  // ─── Loading state for edit mode ──────────────────────────────────────

  if (isEditMode && prLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading purchase requisition…
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .pr-root{font-family:'DM Sans',sans-serif;font-size:13px;color:#1a1a18}
        .pr-root .pr-stepper{display:flex;background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;margin-bottom:20px}
        .pr-root .pr-step-item{flex:1;padding:14px 16px;display:flex;align-items:center;gap:10px;border-right:0.5px solid rgba(0,0,0,0.08);background:transparent;border-top:none;border-left:none;border-bottom:none;cursor:default}
        .pr-root .pr-step-item:last-child{border-right:none}
        .pr-root .pr-step-item.prs-done{background:#f8f8f6}
        .pr-root .pr-step-num{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
        .pr-root .psn-idle{background:#f2f1ee;color:#9a9a96}
        .pr-root .psn-act{background:#1a1a18;color:#fff}
        .pr-root .psn-done{background:#EAF3DE;color:#3B6D11}
        .pr-root .pr-step-lbl{font-size:13px;font-weight:600;color:#9a9a96}
        .pr-root .pr-step-item.prs-active .pr-step-lbl{color:#1a1a18}
        .pr-root .pr-step-item.prs-done .pr-step-lbl{color:#5a5a57}
        .pr-root .pr-step-sub{font-size:12px;color:#9a9a96}
        .pr-root .form-sec{background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:12px;}
        .pr-root .form-sec-head{padding:12px 16px;border-bottom:0.5px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:space-between;gap:10px}
        .pr-root .fsh-title{font-size:14px;font-weight:600;color:#1a1a18;font-family:'DM Sans',sans-serif}
        .pr-root .form-body{padding:16px;display:flex;flex-direction:column;gap:14px}
        .pr-root .lbl{font-size:12px;font-weight:600;color:#5a5a57;display:block;margin-bottom:5px;font-family:'DM Sans',sans-serif}
        .pr-root .req{color:#E24B4A;margin-left:2px}
        .pr-root .inp{padding:8px 11px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.14);background:#fff;font-family:'DM Sans',sans-serif;font-size:13px;color:#1a1a18;outline:none;width:100%;transition:border-color 0.15s}
        .pr-root .inp:focus{border-color:hsl(var(--primary))}
        .pr-root .inp.inp-error{border-color:#E24B4A!important}
        .pr-root .inp::placeholder{color:#9a9a96}
        .pr-root .pr-textarea{padding:8px 11px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.14);background:#fff;font-family:'DM Sans',sans-serif;font-size:13px;color:#1a1a18;outline:none;width:100%;resize:vertical;min-height:60px;transition:border-color 0.15s}
        .pr-root .pr-textarea:focus{border-color:hsl(var(--primary))}
        .pr-root .pr-textarea::placeholder{color:#9a9a96}
        .pr-root .pr-search-input{padding:8px 11px 8px 32px;border-radius:8px;border:0.5px solid rgba(0,0,0,0.14);background:#fff;font-family:'DM Sans',sans-serif;font-size:13px;color:#1a1a18;outline:none;width:100%;transition:border-color 0.15s;height:36px}
        .pr-root .pr-search-input:focus{border-color:hsl(var(--primary))}
        .pr-root .pr-search-input.inp-error{border-color:#E24B4A!important}
        .pr-root .pr-search-input::placeholder{color:#9a9a96}
        .pr-root .info-row{font-size:12px;color:#5a5a57;font-family:'DM Sans',sans-serif}
        .pr-root .info-val{font-size:13px;font-weight:600;color:#1a1a18;margin-top:1px;font-family:'DM Sans',sans-serif}
        .pr-root{display:flex;flex-direction:column;min-height:calc(100vh - 90px)}
        .pr-root .pr-content{flex:1}
        .pr-root .pr-sticky{background:#fff;border-top:0.5px solid rgba(0,0,0,0.14);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:0 0 12px 12px}
        @media(max-width:640px){
          .pr-root .pr-stepper{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
          .pr-root .pr-stepper::-webkit-scrollbar{display:none}
          .pr-root .pr-step-item{padding:10px 12px;gap:6px;min-width:0;flex-shrink:0}
          .pr-root .pr-step-sub{display:none}
          .pr-root .pr-step-lbl{font-size:12px;white-space:nowrap}
          .pr-root .pr-step-num{width:22px;height:22px;font-size:11px}
        }
      `}</style>

      <div className="pr-root">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>
              {isEditMode ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx2,#5a5a57)', marginTop: 2 }}>
              Select quotations · Compare &amp; select vendor · Submit for approval
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/procurement')}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </div>

        <div className="pr-stepper">
          {PR_STEPS.map((s, i) => {
            const stepNum = i + 1
            const isDone = step > stepNum
            const isActive = step === stepNum
            return (
              <div key={i} className={`pr-step-item${isActive ? ' prs-active' : ''}${isDone ? ' prs-done' : ''}`}>
                <div className={`pr-step-num ${isDone ? 'psn-done' : isActive ? 'psn-act' : 'psn-idle'}`}>
                  {isDone ? <Check style={{ width: 10, height: 10 }} /> : stepNum}
                </div>
                <div>
                  <div className="pr-step-lbl">{s.label}</div>
                  <div className="pr-step-sub">{s.sub}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="pr-content">
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
              setSelectedQuotationIds={setSelectedQuotationIds}
              isEditMode={isEditMode}
              currentPrId={savedPrId}
            />
          )}

          {step === 2 && (
            <CompareStep
              selectedQuotationIds={selectedQuotationIds}
              selectedQuotationId={selectedQuotationId}
              setSelectedQuotationId={setSelectedQuotationId}
              prId={prId}
              budgetRemaining={budgetRemaining}
            />
          )}

          {step === 3 && (
            <ApprovalMatrix
              open={showApprovalModal}
              onOpenChange={setShowApprovalModal}
              prId={(isEditMode? procurementId:savedPrId) || ''}
              onClose={() => setShowApprovalModal(false)}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
                if (isEditMode && procurementId) {
                  queryClient.invalidateQueries({ queryKey: ['pr', procurementId] })
                  queryClient.invalidateQueries({ queryKey: ['procurement-edit', procurementId] })
                }
                toast({ title: 'PR submitted for approval.' })
                router.push('/procurement')
              }}
              selectedVendor={selectedQuotationId}
              setStep={setStep}
              step={step}
            />
          )}
        </div>

        {step <= 2 && (
          <div className="pr-sticky rounded-b-xl">
            <div>
              {step > 1 && (
                <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
              )}
            </div>
            <Button size="sm" onClick={handleContinue} disabled={isSaving} className="gap-1">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Next {!isSaving && <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
