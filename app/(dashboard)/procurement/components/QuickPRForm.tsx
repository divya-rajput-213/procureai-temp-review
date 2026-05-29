'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Plus, Trash2, Send, X, AlertTriangle, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// Shared Quick PR form — used by /procurement/quick-new (create) and
// /procurement/quick-edit/[id] (edit). The two modes differ only in the
// initial state source and the submit endpoint.

type LineItem = {
  item_code: number | null
  item_label: string
  quantity: number
  unit_of_measure: string
  unit_rate: number
}

const blankLine = (): LineItem => ({
  item_code: null, item_label: '', quantity: 1, unit_of_measure: 'NOS', unit_rate: 0,
})

export type QuickPRInitial = {
  trackingId: number | null
  selectedTracking: any | null
  vendorId: number | null
  selectedVendor: any | null
  description: string
  lines: LineItem[]
}

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; prId: string; prNumber?: string }

export function QuickPRForm({
  mode,
  initial,
}: {
  readonly mode: Mode
  readonly initial?: QuickPRInitial
}) {
  const router = useRouter()
  const { toast } = useToast()

  // ── Selection state — seeded from `initial` when in edit mode ───────────
  const [selectedTracking, setSelectedTracking] = useState<any | null>(initial?.selectedTracking ?? null)
  const trackingId = selectedTracking?.id ?? null
  const [trackingSearch, setTrackingSearch] = useState('')
  const [showTrackingDropdown, setShowTrackingDropdown] = useState(false)
  const [vendorId, setVendorId] = useState<number | null>(initial?.vendorId ?? null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [description, setDescription] = useState(initial?.description ?? '')
  // Treat preloaded description as user-touched so auto-fill doesn't overwrite it
  const [descriptionTouched, setDescriptionTouched] = useState(!!initial?.description)
  const [lines, setLines] = useState<LineItem[]>(initial?.lines?.length ? initial.lines : [blankLine()])
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({})
  const [itemDropdown, setItemDropdown] = useState<number | null>(null)
  const itemDropdownRef = useRef<HTMLTableCellElement | null>(null)

  // ── Reference data ──────────────────────────────────────────────────────
  const { data: trackingIds } = useQuery({
    queryKey: ['tracking-ids-approved', trackingSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (trackingSearch.trim()) params.set('search', trackingSearch.trim())
      const r = await apiClient.get(`/budget/tracking-ids/?${params}`)
      return r.data.results ?? r.data
    },
  })

  const { data: vendors } = useQuery({
    queryKey: ['vendors-approved', vendorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'approved' })
      if (vendorSearch.trim()) params.set('search', vendorSearch.trim())
      const r = await apiClient.get(`/vendors/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: !!trackingId && (vendorSearch.trim().length >= 2 || !vendorId),
  })
  // Use the preloaded vendor first; otherwise resolve from search results
  const selectedVendor = initial?.selectedVendor && initial.selectedVendor.id === vendorId
    ? initial.selectedVendor
    : (vendors || []).find((v: any) => v.id === vendorId)

  const currentRow = itemDropdown
  const currentSearch = currentRow != null ? (itemSearch[currentRow] || '') : ''
  const { data: items } = useQuery({
    queryKey: ['items', currentSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (currentSearch.trim()) params.set('search', currentSearch.trim())
      params.set('is_active', 'true')
      const r = await apiClient.get(`/procurement/items/?${params}`)
      return r.data.results ?? r.data
    },
    enabled: currentRow != null,
  })

  // ── Derived ─────────────────────────────────────────────────────────────
  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_rate) || 0), 0),
    [lines],
  )
  const remaining = selectedTracking ? Number(selectedTracking.remaining_amount || 0) : null
  const overBudget = remaining !== null && total > remaining

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trackingId) { setVendorId(null); setVendorSearch('') }
  }, [trackingId])

  useEffect(() => {
    if (!selectedTracking || descriptionTouched) return
    const parts = [selectedTracking.title, selectedTracking.description]
      .map(s => (s || '').trim()).filter(Boolean)
    setDescription(parts.join(' — '))
  }, [selectedTracking, descriptionTouched])

  useEffect(() => {
    if (itemDropdown == null) return
    const onDown = (e: MouseEvent) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setItemDropdown(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [itemDropdown])

  const pickedItemCodes = useMemo(
    () => new Set(lines.map(l => l.item_code).filter((v): v is number => v != null)),
    [lines],
  )

  // ── Submit ──────────────────────────────────────────────────────────────
  const buildPayload = (statusValue: 'draft' | 'pending_approval') => ({
    plant: selectedTracking?.plant ?? null,
    department: selectedTracking?.department ?? null,
    tracking_id: trackingId,
    selected_vendor: vendorId,
    description: description.trim(),
    status: statusValue,
    line_items_data: lines
      .filter(l => l.item_code != null && Number(l.quantity) > 0)
      .map(l => ({
        item_code: l.item_code,
        quantity: l.quantity,
        unit_of_measure: l.unit_of_measure || 'NOS',
        unit_rate: l.unit_rate || 0,
      })),
  })

  const submitMutation = useMutation({
    mutationFn: async (statusValue: 'draft' | 'pending_approval') => {
      if (mode.kind === 'create') {
        const { data } = await apiClient.post('/procurement/quick-create/', buildPayload(statusValue))
        return data
      }
      const { data } = await apiClient.patch(
        `/procurement/${mode.prId}/quick-update/`,
        buildPayload(statusValue),
      )
      return data
    },
    onSuccess: (data) => {
      const verb = mode.kind === 'create' ? 'created' : 'updated'
      toast({ title: `PR ${data.pr_number} ${verb}` })
      router.push(`/procurement/${data.hash_id ?? data.id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string'
        ? detail
        : detail?.detail
          || (detail && Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '))
          || (mode.kind === 'create' ? 'Failed to create PR' : 'Failed to update PR')
      toast({ title: String(msg), variant: 'destructive' })
    },
  })

  // ── Row helpers ─────────────────────────────────────────────────────────
  const updateLine = (idx: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))

  const pickItem = (idx: number, item: any) => {
    updateLine(idx, {
      item_code: item.id,
      item_label: `${item.code} — ${item.description}`,
      unit_of_measure: item.unit_of_measure || 'NOS',
      unit_rate: Number(item.unit_rate) || 0,
    })
    setItemDropdown(null)
    setItemSearch(prev => ({ ...prev, [idx]: '' }))
  }

  const validForSubmit =
    !!trackingId
    && !!selectedTracking?.plant
    && !!selectedTracking?.department
    && !!vendorId
    && lines.some(l => l.item_code != null && Number(l.quantity) > 0)

  const title = mode.kind === 'create' ? 'Quick Purchase Requisition' : `Edit ${mode.prNumber ?? 'Purchase Requisition'}`
  const subtitle = mode.kind === 'create'
    ? 'Pick a Tracking ID · vendor + items from the master'
    : 'Make changes to this draft PR'

  return (
    <>
      <style jsx>{`
        .pr-root { font-family: 'DM Sans', sans-serif; color: #1a1a18; }
        .pr-root .form-sec { background: #fff; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 12px; margin-bottom: 14px; }
        .pr-root .form-sec-head { padding: 12px 16px; border-bottom: 0.5px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .pr-root .fsh-title { font-size: 14px; font-weight: 600; color: #1a1a18; }
        .pr-root .form-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
        .pr-root .lbl { font-size: 12px; font-weight: 600; color: #5a5a57; display: block; margin-bottom: 5px; }
        .pr-root .req { color: #E24B4A; margin-left: 2px; }
        .pr-root .inp { padding: 8px 11px; border-radius: 8px; border: 0.5px solid rgba(0,0,0,0.14); background: #fff; font-family: inherit; font-size: 13px; color: #1a1a18; outline: none; width: 100%; transition: border-color 0.15s; height: 36px; }
        .pr-root .inp:focus { border-color: hsl(var(--primary)); }
        .pr-root .inp::placeholder { color: #9a9a96; }
        .pr-root .pr-textarea { padding: 8px 11px; border-radius: 8px; border: 0.5px solid rgba(0,0,0,0.14); background: #fff; font-family: inherit; font-size: 13px; color: #1a1a18; outline: none; width: 100%; resize: vertical; min-height: 60px; transition: border-color 0.15s; }
        .pr-root .pr-textarea:focus { border-color: hsl(var(--primary)); }
        .pr-root .pr-textarea::placeholder { color: #9a9a96; }
        .pr-root .info-row { font-size: 11px; color: #9a9a96; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px; }
        .pr-root .info-val { font-size: 13px; font-weight: 600; color: #1a1a18; }
        .pr-root .info-card { background: #F7F9FD; border: 0.5px solid rgba(0,0,0,0.06); border-radius: 8px; padding: 12px 14px; }
        .pr-root .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; }
        .pr-root .item-tbl { width: 100%; font-size: 13px; }
        .pr-root .item-tbl thead th { background: #F7F9FD; padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #9a9a96; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 0.5px solid rgba(0,0,0,0.08); }
        .pr-root .item-tbl tbody td { padding: 9px 12px; border-bottom: 0.5px solid rgba(0,0,0,0.08); vertical-align: top; }
        .pr-root .item-tbl tfoot td { padding: 10px 12px; background: #F7F9FD; font-size: 12px; font-weight: 600; }
        .pr-root .item-tbl input { height: 32px; padding: 6px 10px; }
        .pr-root .pr-sticky { background: #fff; border-top: 0.5px solid rgba(0,0,0,0.14); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-radius: 0 0 12px 12px; position: sticky; bottom: 0; z-index: 20; margin-left: -16px; margin-right: -16px; }
        @media (min-width: 768px) { .pr-root .pr-sticky { margin-left: -12px; margin-right: -12px; } }
      `}</style>

      <div className="pr-root">
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>{title}</div>
            <div style={{ fontSize: 13, color: '#5a5a57', marginTop: 2 }}>{subtitle}</div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(mode.kind === 'edit' ? `/procurement/${mode.prId}` : '/procurement')}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </div>

        {/* Step 1 — Tracking ID */}
        <div className="form-sec">
          <div className="form-sec-head">
            <span className="fsh-title">1. Tracking ID</span>
          </div>
          <div className="form-body">
            <div>
              <label className="lbl">Tracking ID<span className="req">*</span></label>
              {selectedTracking ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#F7F9FD' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--primary))' }}>{selectedTracking.tracking_code}</div>
                    {selectedTracking.title && <div style={{ fontSize: 12, color: '#5a5a57', marginTop: 2 }}>{selectedTracking.title}</div>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedTracking(null); setTrackingSearch(''); setShowTrackingDropdown(false); setDescriptionTouched(false); setDescription('') }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    className="inp"
                    placeholder="Type code, title or department…"
                    value={trackingSearch}
                    onChange={e => { setTrackingSearch(e.target.value); setShowTrackingDropdown(true) }}
                    onFocus={() => setShowTrackingDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTrackingDropdown(false), 200)}
                  />
                  {showTrackingDropdown && trackingSearch.trim().length > 0 && (trackingIds?.length ?? 0) > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, maxHeight: 280, overflowY: 'auto', zIndex: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                      {trackingIds.map((t: any) => (
                        <button
                          key={t.id} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setSelectedTracking(t); setTrackingSearch(''); setShowTrackingDropdown(false) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'transparent', border: 0, cursor: 'pointer' }}
                          onMouseOver={e => (e.currentTarget.style.background = '#F7F9FD')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--primary))' }}>{t.tracking_code}</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(t.approved_amount)}</span>
                          </div>
                          {t.title && <div style={{ fontSize: 12, color: '#5a5a57', marginTop: 2 }}>{t.title}</div>}
                          <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>
                            {t.plant_name}{t.department_name && ` · ${t.department_name}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedTracking && (
              <div className="info-card">
                <div className="info-grid">
                  <div><div className="info-row">Plant</div><div className="info-val">{selectedTracking.plant_name || '—'}</div></div>
                  <div><div className="info-row">Department</div><div className="info-val">{selectedTracking.department_name || '—'}</div></div>
                  <div><div className="info-row">Priority</div><div className="info-val" style={{ textTransform: 'capitalize' }}>{selectedTracking.priority || '—'}</div></div>
                  <div><div className="info-row">Approved</div><div className="info-val">{formatCurrency(selectedTracking.approved_amount)}</div></div>
                  <div><div className="info-row">Spent</div><div className="info-val" style={{ color: '#854F0B' }}>{formatCurrency(selectedTracking.consumed_amount)}</div></div>
                  <div>
                    <div className="info-row">Remaining</div>
                    <div className="info-val" style={{ color: Number(selectedTracking.remaining_amount) > 0 ? '#3B6D11' : '#A32D2D' }}>
                      {formatCurrency(selectedTracking.remaining_amount)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 — Vendor */}
        {selectedTracking && (
          <div className="form-sec">
            <div className="form-sec-head">
              <span className="fsh-title">2. Vendor</span>
            </div>
            <div className="form-body">
              <div>
                <label className="lbl">Vendor<span className="req">*</span></label>
                {selectedVendor ? (
                  <div style={{ position: 'relative', padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#F7F9FD' }}>
                    <Button
                      type="button" variant="ghost" size="sm"
                      style={{ position: 'absolute', top: 6, right: 6 }}
                      onClick={() => { setVendorId(null); setVendorSearch('') }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{selectedVendor.company_name}</div>
                    <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>
                      {selectedVendor.vendor_code}
                      {selectedVendor.gst_number && ` · GSTIN ${selectedVendor.gst_number}`}
                    </div>
                    <div className="info-grid" style={{ marginTop: 12 }}>
                      {(selectedVendor.city || selectedVendor.state) && (
                        <div>
                          <div className="info-row">Location</div>
                          <div className="info-val">{[selectedVendor.city, selectedVendor.state].filter(Boolean).join(', ')}</div>
                        </div>
                      )}
                      {selectedVendor.contact_name && (
                        <div><div className="info-row">Contact</div><div className="info-val">{selectedVendor.contact_name}</div></div>
                      )}
                      {selectedVendor.contact_email && (
                        <div><div className="info-row">Email</div><div className="info-val" style={{ wordBreak: 'break-all' }}>{selectedVendor.contact_email}</div></div>
                      )}
                      {selectedVendor.contact_phone && (
                        <div><div className="info-row">Phone</div><div className="info-val">{selectedVendor.contact_phone}</div></div>
                      )}
                      {selectedVendor.payment_terms && (
                        <div><div className="info-row">Payment Terms</div><div className="info-val" style={{ textTransform: 'uppercase' }}>{selectedVendor.payment_terms}</div></div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      className="inp"
                      placeholder="Type vendor name (at least 2 chars)…"
                      value={vendorSearch}
                      onChange={e => setVendorSearch(e.target.value)}
                    />
                    {vendorSearch.trim().length >= 2 && (vendors?.length ?? 0) > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', zIndex: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        {vendors.map((v: any) => (
                          <button
                            key={v.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setVendorId(v.id); setVendorSearch('') }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'transparent', border: 0, cursor: 'pointer' }}
                            onMouseOver={e => (e.currentTarget.style.background = '#F7F9FD')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{v.company_name}</div>
                            <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 2 }}>
                              {v.vendor_code}{v.gst_number && ` · ${v.gst_number}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="lbl">Description / Notes</label>
                <textarea
                  className="pr-textarea"
                  value={description}
                  onChange={e => { setDescription(e.target.value); setDescriptionTouched(true) }}
                  placeholder="What is this PR for?"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Items */}
        {selectedTracking && (
          <div className="form-sec">
            <div className="form-sec-head">
              <span className="fsh-title">3. Items</span>
              <Button type="button" size="sm" variant="outline" className="gap-1.5"
                onClick={() => setLines(prev => [...prev, blankLine()])}>
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="item-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Item (from master)</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
                    <th style={{ width: 80 }}>UOM</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const amount = (Number(line.quantity) || 0) * (Number(line.unit_rate) || 0)
                    const showDropdown = itemDropdown === idx
                    return (
                      <tr key={idx}>
                        <td style={{ color: '#9a9a96', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{String(idx + 1).padStart(2, '0')}</td>
                        <td
                          style={{ position: 'relative', minWidth: 260 }}
                          ref={showDropdown ? itemDropdownRef : undefined}
                        >
                          {line.item_code != null ? (
                            <span style={{ fontSize: 13 }}>{line.item_label}</span>
                          ) : (
                            <>
                              <input
                                className="inp"
                                placeholder="Search code or description…"
                                value={itemSearch[idx] || ''}
                                onChange={e => { setItemSearch(prev => ({ ...prev, [idx]: e.target.value })); setItemDropdown(idx) }}
                                onFocus={() => setItemDropdown(idx)}
                              />
                              {showDropdown && (itemSearch[idx] || '').trim().length > 0 && (() => {
                                const available = (items || []).filter((it: any) => !pickedItemCodes.has(it.id))
                                if (available.length === 0) return null
                                return (
                                  <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 4, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', zIndex: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                    {available.map((it: any) => (
                                      <button
                                        key={it.id} type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => pickItem(idx, it)}
                                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'transparent', border: 0, cursor: 'pointer' }}
                                        onMouseOver={e => (e.currentTarget.style.background = '#F7F9FD')}
                                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600 }}>{it.code}</div>
                                        <div style={{ fontSize: 11, color: '#9a9a96', marginTop: 1 }}>
                                          {it.description}
                                          {it.unit_of_measure && ` · ${it.unit_of_measure}`}
                                          {it.unit_rate != null && ` · ${formatCurrency(it.unit_rate)}`}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )
                              })()}
                            </>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number" step="0.01" min="0" className="inp"
                            style={{ textAlign: 'right' }}
                            value={line.quantity || ''}
                            onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            className="inp"
                            value={line.unit_of_measure}
                            onChange={e => updateLine(idx, { unit_of_measure: e.target.value })}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number" step="0.01" min="0" className="inp"
                            style={{ textAlign: 'right' }}
                            value={line.unit_rate || ''}
                            onChange={e => updateLine(idx, { unit_rate: Number(e.target.value) })}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {lines.length > 1 && (
                            <button type="button" style={{ color: '#9a9a96', background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'right', color: '#9a9a96', textTransform: 'uppercase', letterSpacing: 0.4 }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: overBudget ? '#A32D2D' : '#3B6D11', fontSize: 14 }}>
                      {formatCurrency(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {overBudget && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: 8, color: '#A32D2D', fontSize: 13, marginBottom: 14 }}>
            <AlertTriangle className="w-4 h-4" />
            PR total exceeds the remaining budget on this Tracking ID.
          </div>
        )}

        {/* Sticky bottom bar */}
        <div className="pr-sticky">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(mode.kind === 'edit' ? `/procurement/${mode.prId}` : '/procurement')}>
            <X className="w-3.5 h-3.5" /> {mode.kind === 'edit' ? 'Cancel' : 'Discard'}
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              disabled={submitMutation.isPending || !validForSubmit}
              onClick={() => submitMutation.mutate('draft')}
            >
              {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {mode.kind === 'edit' ? 'Save Changes' : 'Save Draft'}
            </Button>
            <Button
              size="sm" className="gap-1.5"
              disabled={submitMutation.isPending || !validForSubmit}
              onClick={() => submitMutation.mutate('pending_approval')}
            >
              {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit for Approval
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
