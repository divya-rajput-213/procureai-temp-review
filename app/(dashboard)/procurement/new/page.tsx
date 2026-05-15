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
  AlertTriangle, Check, FileText, ChevronRight, Sparkles, Plus,  Star, TrendingDown, Building2, MapPin, Package, Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useSettingsStore } from '@/lib/stores/settings.store'
import ApprovalMatrix from '../components/ApprovalMatrix'
import CompareStep from '../components/CompareStep'

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

 function VendorDot({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const colors = ['#042348', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']
  const idx = name.charCodeAt(0) % colors.length
  const bg = color || colors[idx]
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: size / 4,
      background: bg, color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0
    }}>{initials}</span>
  )
}

  function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 90 ? '#10b981' : value >= 75 ? '#f59e0b' : '#ef4444'
  const bg = value >= 90 ? '#d1fae5' : value >= 75 ? '#fef3c7' : '#fee2e2'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: bg, color, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
      <Sparkles style={{ width: 9, height: 9 }} />{value}%
    </span>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, onBack, onContinue, continueLabel = 'Continue', continueDisabled = false, loading = false }:
  { step: number; onBack?: () => void; onContinue: () => void; continueLabel?: string; continueDisabled?: boolean; loading?: boolean }) {
  const steps = ['Quotes', 'Compare & select', 'Review & save']
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      borderBottom: '1px solid hsl(var(--border))',
      padding: '0 0 0 0', background: 'hsl(var(--background))',
      // position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '12px 20px', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {i > 0 && (
              <div style={{ width: 48, height: 1, background: i < step ? '#042348' : 'hsl(var(--border))', margin: '0 4px' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: i < step - 1 ? '#10b981' : i === step - 1 ? '#042348' : 'hsl(var(--muted))',
                color: i <= step - 1 ? '#fff' : 'hsl(var(--muted-foreground))',
                fontSize: 11, fontWeight: 700, flexShrink: 0
              }}>
                {i < step - 1 ? <Check style={{ width: 10, height: 10 }} /> : (i + 1)}
              </span>
              <span style={{
                fontSize: 13, fontWeight: i === step - 1 ? 600 : 400,
                color: i === step - 1 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'
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
        <Button size="sm" onClick={onContinue} disabled={continueDisabled || loading} className="gap-1">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {continueLabel} {!loading && <ChevronRight className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  )
}

// ─── TrackingIdSearch ─────────────────────────────────────────────────────────

function TrackingIdSearch({ trackingIds, onSelect, value, onChange }:
  { trackingIds: any[]; onSelect: (t: any) => void; value: any | null; onChange: (t: any | null) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, () => setOpen(false))

  const filtered = search.length > 0
    ? (trackingIds ?? []).filter(t =>
      t.tracking_code.toLowerCase().includes(search.toLowerCase()) ||
      (t.title ?? '').toLowerCase().includes(search.toLowerCase()))
    : (trackingIds ?? []).slice(0, 8)

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tracking code or title..."
          value={value ? `${value.tracking_code || ''}` : search}
          onChange={(e) => { setSearch(e.target.value); onChange(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="pl-8 font-mono text-sm"
        />
        {value && (
          <button type="button" onClick={() => { onChange(null); setSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
          {(filtered ?? []).length > 0 ? filtered.map(t => (
            <button key={t.id} type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm transition-colors border-b last:border-b-0"
              onClick={() => { onChange(t); setSearch(''); setOpen(false); onSelect(t) }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-primary">{t.tracking_code}</span>
                <span className="text-xs font-medium tabular-nums">{formatCurrency(t.approved_amount)}</span>
              </div>
              {t.title && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.title}</p>}
              <div className="flex items-center gap-2 mt-0.5">
                {t.plant_name && <span className="text-[10px] text-muted-foreground">{t.plant_name}</span>}
                {t.department_name && <span className="text-[10px] text-muted-foreground">· {t.department_name}</span>}
              </div>
            </button>
          )) : (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">No approved tracking IDs found</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 1: Quotes ───────────────────────────────────────────────────────────

function QuotesStep({
  trackingIds, trackingDetail, selectedTracking, onSelectTracking,
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Procurement details card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Procurement details</CardTitle>
              <span className="text-xs text-muted-foreground">Step 1 of 3</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Tracking ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking ID <span className="text-destructive">*</span></Label>
              <TrackingIdSearch
                trackingIds={trackingIds || []}
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
              {errors.tracking_id && <p className="text-xs text-destructive">{errors.tracking_id.message}</p>}
            </div>

            {/* Prefilled fields from tracking */}
            {trackingDetail && (
              <>
                {/* Budget summary bar */}
                <div className="rounded-lg border bg-slate-50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Title</span>
                      <p className="font-semibold text-foreground truncate max-w-[220px]">{trackingDetail.title || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />Plant</span>
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
                        <span className="font-medium text-foreground">{formatCurrency(trackingDetail.consumed_amount)} / {formatCurrency(trackingDetail.approved_amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (Number(trackingDetail.consumed_amount) / Number(trackingDetail.approved_amount)) * 100)}%` }} />
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

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description <span className="font-normal normal-case text-muted-foreground">(optional)</span>
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

        {/* Quotations table */}
        {watchedTrackingId && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Pick quotations to compare</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedQuotationIds.length} selected · auto-aligns line items across vendors
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-primary  border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                    <Sparkles className="w-3.5 h-3.5" />AI suggest vendors
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />Request new RFQ
                  </Button>
                </div>
              </div>
            </CardHeader>
            <div
              className="max-h-[520px] overflow-auto rounded-b-xl"
              style={{
                scrollbarWidth: 'thin',
              }}
            >              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: 'white',
                  }}
                >
                  <tr
                    style={{
                      background: 'hsl(var(--muted) / 0.7)',
                      borderBottom: '1px solid hsl(var(--border))',
                      backdropFilter: 'blur(8px)',
                    }}
                  >                   
                   <th style={{ width: 36, padding: '8px 12px' }}></th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>Quote</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>Vendor</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>Items</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>Validity</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>AI conf.</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {qLoading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
                      <Loader2 style={{ display: 'inline', width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Loading quotations...
                    </td></tr>
                  ) : (quotations as any[]).length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
                      No quotations found
                    </td></tr>
                  ) : (quotations as any[]).map((q: any) => {
                    const isSelected = selectedQuotationIds.includes(q.id)
                    const exceedsBudget = budgetRemaining !== null && Number(q.total_amount) > budgetRemaining
                    const vc = vendorColor(q.vendor_name || 'V')
                    return (
                      <tr
                        key={q.id}
                        onClick={() => !exceedsBudget && toggleQuotation(q.id)}
                        style={{
                          background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                          borderBottom: '1px solid hsl(var(--border))',
                          borderLeft: isSelected ? '3px solid #042348' : '3px solid transparent',
                          cursor: exceedsBudget ? 'not-allowed' : 'pointer',
                          opacity: exceedsBudget ? 0.55 : 1,
                          transition: 'background .12s',
                        }}
                        className="hover:bg-muted/30"
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 16, height: 16, borderRadius: 4,
                            border: isSelected ? 'none' : '1.5px solid hsl(var(--border))',
                            background: isSelected ? '#042348' : 'transparent',
                          }}>
                            {isSelected && <Check style={{ width: 10, height: 10, color: '#fff' }} />}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: isSelected ? '#042348' : 'hsl(var(--foreground))' }}>
                            {q.ref_no}
                          </span>
                          {q.quotation_no && <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{q.quotation_no}</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <VendorDot name={q.vendor_name || 'V'} color={vc} size={22} />
                            <span style={{ fontWeight: 500 }}>{q.vendor_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace' }}>{q.items_count ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{q.date || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{q.valid_till || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {q.confidence != null ? <ConfidenceBadge value={q.confidence} /> : <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {formatCurrency(q.total_amount)}
                          {exceedsBudget && (
                            <div style={{ fontSize: 10, color: '#ef4444', fontFamily: 'inherit' }}>Exceeds budget</div>
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

      {/* Right sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* AI suggestions */}
        <Card className="shadow-sm border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />AI suggestions for this PR
              </CardTitle>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#042348', background: '#ede9fe', borderRadius: 6, padding: '2px 6px' }}>91%</span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Based on your spend patterns, I recommend selecting quotations from <strong className="text-foreground">multiple vendors</strong> for comparison.</p>
            <p>Only quotations <strong className="text-foreground">within the remaining budget</strong> of <strong className="text-emerald-700">{formatCurrency(budgetRemaining ?? 0)}</strong> are selectable.</p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" className="gap-1  text-white text-xs h-7">
                <Sparkles className="w-3 h-3" />Use AI panel
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7">Skip</Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferred vendors from tracking */}
        {trackingDetail?.preferred_vendors?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold">Preferred vendors</CardTitle>
              <p className="text-xs text-muted-foreground">From tracking ID</p>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {trackingDetail.preferred_vendors.map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 py-1.5 border-b last:border-b-0">
                  <VendorDot name={v.company_name} size={22} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{v.company_name}</p>
                    <p className="text-[10px] text-muted-foreground">{v.city}, {v.state}</p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
                    background: v.status === 'approved' ? '#d1fae5' : '#fef3c7',
                    color: v.status === 'approved' ? '#065f46' : '#92400e'
                  }}>{v.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Linked PRs */}
        {trackingDetail?.linked_prs?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold">Linked PRs</CardTitle>
              <p className="text-xs text-muted-foreground">Previous PRs on this tracking</p>
            </CardHeader>
            <CardContent className="pt-3 space-y-1.5">
              {trackingDetail.linked_prs.slice(0, 4).map((pr: any) => (
                <div key={pr.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
                  <span className="font-mono text-xs font-medium text-primary">{pr.pr_number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(pr.total_amount)}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
                      background: pr.status === 'approved' ? '#d1fae5' : pr.status === 'draft' ? '#f3f4f6' : '#fef3c7',
                      color: pr.status === 'approved' ? '#065f46' : pr.status === 'draft' ? '#6b7280' : '#92400e'
                    }}>{pr.status}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div >
  )
}

// ─── Step 3: Review & Save ────────────────────────────────────────────────────

function ReviewStep({ selectedVendorId, quotations, selectedQuotationIds, trackingDetail, onSubmit, showApprovalModal, setShowApprovalModal, savedPrId, onApprovalSuccess, isSaving }: any) {
  const selectedQuotations: any[] = (quotations as any[]).filter((q: any) => selectedQuotationIds.includes(q.id))
  const vendorQuotations = selectedQuotations.filter((q: any) => q.vendor_name === selectedVendorId)
  const subtotal = vendorQuotations.reduce((s, q) => s + Number(q.total_amount), 0)
  const gst = Math.round(subtotal * 0.15)
  const landed = subtotal + gst
  const allTotal = selectedQuotations.reduce((s, q) => s + Number(q.total_amount), 0) * 1.15
  const savings = Math.round(allTotal - landed)

  const colorPalette = ['#042348', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']
  const vendorColor = colorPalette[0]

  const otherVendors = Array.from(
    new Set(
      selectedQuotations
        .filter(q => q.vendor_name !== selectedVendorId)
        .map(q => q.vendor_name)
    )
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
          <Check style={{ width: 14, height: 14, color: '#059669', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#065f46' }}>{selectedVendorId} selected</strong> for this procurement. Review the order below and submit for approval.
          </div>
        </div>

        {/* Vendor + source quote */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold">Selected vendor & source quotes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <VendorDot name={selectedVendorId || 'V'} color={vendorColor} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{selectedVendorId}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, background: '#e0e7ff', color: '#4338ca', borderRadius: 4, padding: '2px 8px' }}>Awarded vendor</span>
                  {vendorQuotations.map((q: any) => (
                    <span key={q.id} style={{ fontSize: 11, fontWeight: 500, background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace' }}>{q.ref_no}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                  {vendorQuotations.length} quote{vendorQuotations.length !== 1 ? 's' : ''} selected
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>Landed total</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(landed)}</div>
                {savings > 0 && <div style={{ fontSize: 12, color: '#059669' }}>+{formatCurrency(savings)} vs worst</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected quotations detail */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold">Attached quotations</CardTitle>
            <p className="text-xs text-muted-foreground">Awarded to {selectedVendorId}</p>
          </CardHeader>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'hsl(var(--muted)/0.4)', borderBottom: '1px solid hsl(var(--border))' }}>
                  {['#', 'Quote Ref', 'Vendor', 'Items', 'Valid Till', 'Total'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorQuotations.map((q: any, i: number) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{String(i + 1).padStart(2, '0')}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#042348' }}>{q.ref_no}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{q.vendor_name}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{q.items_count ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{q.valid_till || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(q.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} /><td style={{ padding: '8px 12px', textAlign: 'right', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>Subtotal</td><td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(subtotal)}</td></tr>
                <tr><td colSpan={4} /><td style={{ padding: '8px 12px', textAlign: 'right', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>GST (12-18%)</td><td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(gst)}</td></tr>
                <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                  <td colSpan={4} />
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13.5 }}>Landed total</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>{formatCurrency(landed)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Approval routing */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold">Approval routing</CardTitle>
            <p className="text-xs text-muted-foreground">Auto-triggers on submit</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {['Requestor', 'Manager', 'Finance'].map((role, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {i > 0 && <div style={{ width: 24, height: 1, background: '#e5e7eb' }} />}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: i === 0 ? '#ede9fe' : '#f3f4f6',
                    borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 500,
                    color: i === 0 ? '#6d28d9' : '#374151', border: i === 0 ? '1px solid #c4b5fd' : '1px solid #e5e7eb'
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#8b5cf6' : '#9ca3af', flexShrink: 0 }} />
                    {role}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Finance approval required for amounts above ₹5L. This PR is at {formatCurrency(landed)}.</p>
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Award summary */}
        <Card className="shadow-sm border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />Award summary
              </CardTitle>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#042348', background: '#ede9fe', borderRadius: 6, padding: '2px 6px' }}>94%</span>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Landed', value: formatCurrency(landed), sub: 'incl. GST', color: '#1e40af', bg: '#eff6ff', icon: <Package style={{ width: 10, height: 10 }} /> },
                { label: 'Savings', value: savings > 0 ? formatCurrency(savings) : '—', sub: 'vs. worst quote', color: '#065f46', bg: '#ecfdf5', icon: <TrendingDown style={{ width: 10, height: 10 }} /> },
                { label: 'Quotes', value: vendorQuotations.length, sub: 'selected', color: '#6d28d9', bg: '#f5f3ff', icon: <FileText style={{ width: 10, height: 10 }} /> },
                { label: 'Vendors', value: Array.from(
                  new Set(selectedQuotations.map((q: any) => q.vendor_name))
                ).length, sub: 'compared', color: '#92400e', bg: '#fffbeb', icon: <Star style={{ width: 10, height: 10 }} /> },
              ].map(({ label, value, sub, color, bg, icon }, i) => (
                <div key={i} style={{ background: bg, borderRadius: 8, padding: '10px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color, fontSize: 10, fontWeight: 600, marginBottom: 4 }}>{icon}{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{sub}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side effects */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Side-effects on submit</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'hsl(var(--muted-foreground))' }}>
              {trackingDetail && <li>Link PR to tracking <strong className="text-foreground">{trackingDetail.tracking_code}</strong></li>}
              <li>Award to <strong className="text-foreground">{selectedVendorId}</strong> ({formatCurrency(landed)})</li>
              <li>Reserve {formatCurrency(landed)} against budget</li>
              <li>Route to manager then finance for approval</li>
              {savings > 0 && <li>Log {formatCurrency(savings)} savings to FY26 tracker</li>}
            </ul>
          </CardContent>
        </Card>

        {/* Not selected */}
        {otherVendors.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold">Not selected</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {otherVendors.map((vname: string, i) => {
                const vQuotes = selectedQuotations.filter((q: any) => q.vendor_name === vname)
                const vTotal = vQuotes.reduce((s, q) => s + Number(q.total_amount), 0) * 1.15
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px dashed hsl(var(--border))' }}>
                    <VendorDot name={vname} size={20} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{vname}</span>
                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>+{formatCurrency(Math.round(vTotal - landed))}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '1px 6px' }}>Not selected</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Submit button */}
        {/* <Button
          className="gap-2 text-white w-full"
          disabled={!selectedVendorId || isSaving}
          onClick={() => setShowApprovalModal(true)}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Select approvers & submit
        </Button> */}
      </div>
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

  const {
    register, watch, setValue, trigger,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const watchedTrackingId = watch('tracking_id')

  // ─── Queries ──────────────────────────────────────────────────────────

  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved'],
    queryFn: async () => (await apiClient.get('/budget/tracking-ids/?status=approved')).data.results || [],
  })

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

  const budgetRemaining = trackingDetail
    ? Number(trackingDetail.remaining_amount ?? 0)
    : null

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

  const submitApprovalMutation = useMutation({
    mutationFn: async () => (await apiClient.post(`/procurement/${savedPrId}/submit/`, {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
      toast({ title: 'PR submitted for approval.' })
      router.push('/procurement')
    },
    onError: (err: any) => {
      const msg = flattenDrfError(err?.response?.data) || 'Something went wrong.'
      toast({ title: 'Failed to submit PR', description: msg, variant: 'destructive' })
    },
  })

  const isSaving = saveDraftMutation.isPending || submitApprovalMutation.isPending

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
        toast({ title: 'Budget exceeded', description: `PR total exceeds remaining budget.`, variant: 'destructive' })
        return
      }
      // Save draft on step 1 → 2
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
    } else if (step === 3) {
      setShowApprovalModal(true)
    }
  }

  const toggleQuotation = (id: number) => {
    setSelectedQuotationIds(prev => prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id])
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* Page header */}
      <div className="flex items-start justify-between px-1 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Purchase Requisition</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create a purchase requisition in 3 steps.</p>
        </div>

        <Button type="button" variant="outline" onClick={() => router.push('/procurement')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* Step indicator + nav */}
      <StepIndicator
        step={step}
        onBack={step > 1 ? () => setStep(step - 1) : undefined}
        onContinue={handleContinue}
        continueLabel={step === 3 ? 'Submit for approval' : 'Continue'}
        continueDisabled={step === 3 && !selectedVendorId}
        loading={saveDraftMutation.isPending}
      />

      {/* Body */}
      <div className="pt-5">
        {step === 1 && (
          <QuotesStep
            trackingIds={trackingIds}
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
          <ReviewStep
            selectedVendorId={selectedVendorId}
            quotations={quotations}
            selectedQuotationIds={selectedQuotationIds}
            trackingDetail={trackingDetail}
            showApprovalModal={showApprovalModal}
            setShowApprovalModal={setShowApprovalModal}
            savedPrId={savedPrId}
            isSaving={isSaving}
            onApprovalSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
              toast({ title: 'PR submitted for approval.' })
              router.push('/procurement')
            }}
          />
        )}
      </div>

      {/* Approval Matrix Modal */}
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
    </div>
  )
}