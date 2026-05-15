'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertCircle,
  Sparkles,
  Download,
  Truck,
  CreditCard,
  Star,
  Loader2,
  Check,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  Info,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useQuery } from '@tanstack/react-query'

// ─── Palette ─────────────────────────────────────────────────────────────────
// Fixed vendor-distinguishing palette — intentionally not using --primary
// because these are data-series colors (like chart lines), not brand colors.
const VENDOR_PALETTE = [
  { bg: 'hsl(221 83% 53%)', text: '#fff', light: 'hsl(221 83% 96%)', border: 'hsl(221 83% 70%)' },
  { bg: 'hsl(142 71% 45%)', text: '#fff', light: 'hsl(142 71% 94%)', border: 'hsl(142 71% 60%)' },
  { bg: 'hsl(38 92% 50%)', text: '#fff', light: 'hsl(38 92% 94%)', border: 'hsl(38 92% 65%)' },
  { bg: 'hsl(0 72% 51%)', text: '#fff', light: 'hsl(0 72% 95%)', border: 'hsl(0 72% 70%)' },
  { bg: 'hsl(258 90% 66%)', text: '#fff', light: 'hsl(258 90% 96%)', border: 'hsl(258 90% 75%)' },
  { bg: 'hsl(173 80% 40%)', text: '#fff', light: 'hsl(173 80% 93%)', border: 'hsl(173 80% 55%)' },
]
const SELECTED_COLOR = {
  bg: 'hsl(221 83% 53%)',
  text: '#fff',
  light: 'hsl(221 83% 96%)',
  border: 'hsl(221 83% 70%)',
}
function vendorPalette(idx: number) {
  return VENDOR_PALETTE[idx % VENDOR_PALETTE.length]
}

// ─── VendorDot ────────────────────────────────────────────────────────────────
function VendorDot({ name, paletteIdx = 0, size = 28 }: { name: string; paletteIdx?: number; size?: number }) {
  const { bg } = vendorPalette(paletteIdx)
  const initials = String(name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: size / 4,
      background: bg, color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>{initials}</span>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n != null ? formatCurrency(n) : '—'

const thBase: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'hsl(var(--muted-foreground))',
  whiteSpace: 'nowrap',
}

// ─── CompareStep ──────────────────────────────────────────────────────────────
function CompareStep({
  selectedQuotationIds,
  selectedVendorId,
  setSelectedVendorId,
  isDisabled = false,
}: any) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['quotation-comparison', selectedQuotationIds],
    queryFn: async () => {
      const res = await apiClient.post('/quotations/compare/', {
        quotation_ids: selectedQuotationIds,
      })
      return res.data
    },
    enabled: selectedQuotationIds?.length > 0,
    retry: false,
  })

  // ── Derived data ────────────────────────────────────────────────────────────
  const matrix = data?.matrix || {}
  const aiRec = data?.ai_recommendation || {}
  const vendors: any[] = matrix.vendors || []
  const items: any[] = matrix.items || []

  // Assign a stable palette index per vendor (by position in array)
  const vendorIdx: Record<number, number> = {}
  vendors.forEach((v, i) => { vendorIdx[v.vendor_id] = i })

  // Totals per vendor
  const totals = vendors.map(v => Number(v.total_amount) || 0)
  const minTotal = totals.length ? Math.min(...totals) : 0
  const maxTotal = totals.length ? Math.max(...totals) : 0

  // GST: use per-vendor rates from API (cgst + sgst, or igst)
  const gstAmount = (v: any, subtotal: number) => {
    const rate = v.igst_rate > 0
      ? v.igst_rate
      : (v.cgst_rate || 0) + (v.sgst_rate || 0)
    return Math.round(subtotal * rate / 100)
  }
  const landedTotal = (v: any) => Number(v.total_amount) + gstAmount(v, Number(v.total_amount))

  const landedTotals = vendors.map(v => landedTotal(v))
  const minLanded = landedTotals.length ? Math.min(...landedTotals) : 0
  const maxLanded = landedTotals.length ? Math.max(...landedTotals) : 0

  const selV = vendors.find(v => v.vendor_id === selectedVendorId) || vendors[0]

  // Per-item: find best (lowest) unit_price across vendors
  const itemBestVendor = (item: any): number | null => {
    const prices = Object.entries(item.vendor_prices || {}) as [string, any][]
    if (!prices.length) return null
    const sorted = prices.sort((a, b) => a[1].unit_price - b[1].unit_price)
    return Number(sorted[0][0])
  }

  const itemWorstVendor = (item: any): number | null => {
    const prices = Object.entries(item.vendor_prices || {}) as [string, any][]
    if (prices.length < 2) return null
    const sorted = prices.sort((a, b) => b[1].unit_price - a[1].unit_price)
    return Number(sorted[0][0])
  }

  const aiRanking: any[] = aiRec.ranking || []
  const aiRecommended = aiRec.recommended
  const keyTakeaways: string[] = aiRec.key_takeaways || []
  const riskIndicators: string[] = aiRec.risk_indicators || []

  // ── Loading / empty states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <div className="p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading comparison…
        </div>
      </Card>
    )
  }

  if (!vendors.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <AlertCircle className="w-4 h-4 mr-2" />
        No quotations selected. Go back and select at least one.
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Main comparison table ─────────────────────────────────────────── */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Quotation comparison</CardTitle>
              {!isDisabled&&<p className="text-xs text-muted-foreground mt-0.5">
                Click a vendor column to select · {items.length} item{items.length !== 1 ? 's' : ''} · {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
              </p>}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
          </div>
        </CardHeader>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              {/* ── Vendor header row ── */}
              <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>

                {/* Fixed left columns */}
                <th style={{ ...thBase, textAlign: 'left', minWidth: 220, background: 'hsl(var(--muted)/0.4)', borderRight: '1px solid hsl(var(--border))' }}>
                  Item
                </th>
                <th style={{ ...thBase, textAlign: 'center', width: 80, background: 'hsl(var(--muted)/0.4)', borderRight: '1px solid hsl(var(--border))' }}>
                  Qty
                </th>
                <th style={{ ...thBase, textAlign: 'center', width: 70, background: 'hsl(var(--muted)/0.4)', borderRight: '2px solid hsl(var(--border))' }}>
                  UOM
                </th>

                {/* One column per vendor */}
                {vendors.map((v) => {
                  const isSel = v.vendor_id === selectedVendorId
                  const pi = vendorIdx[v.vendor_id]
                  const pal = SELECTED_COLOR
                  const aiRank = aiRanking.find(r => r.vendor_id === v.vendor_id)
                  const isAiPick = aiRecommended?.vendor_id === v.vendor_id

                  return (
                    <th
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: 0,
                        minWidth: 170,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.6 : 1,
                        borderRight: '1px solid hsl(var(--border))',
                        borderTop: isSel ? `3px solid ${pal.bg}` : '3px solid transparent',
                        background: isSel ? pal.light : 'hsl(var(--muted)/0.2)',
                        transition: 'background .12s',
                        verticalAlign: 'top',
                      }}
                    >
                      <div style={{ padding: '10px 14px' }}>
                        {/* Radio + dot + name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* <span style={{
                            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                            border: isSel ? 'none' : `2px solid hsl(var(--border))`,
                            background: isSel ? pal.bg : 'transparent',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isSel && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
                          </span> */}
                          {/* <VendorDot name={v.vendor_name} paletteIdx={pi} size={22} /> */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'hsl(var(--foreground))', lineHeight: 1.2 }}>
                              {v.vendor_name}
                            </div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>
                              {[
                                v.delivery_lead_time_days ? `${v.delivery_lead_time_days}d` : null,
                                v.payment_terms_display || v.payment_terms || null,
                                v.performance_score != null ? `${v.performance_score}/100` : null,
                              ].filter(Boolean).join(' · ') || v.city || '—'}
                            </div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          {isAiPick && (
                            <span style={{ fontSize: 10, fontWeight: 600, background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Sparkles style={{ width: 8, height: 8 }} />AI pick
                            </span>
                          )}
                          {v.vendor_status === 'new' && (
                            <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 6px' }}>
                              New vendor
                            </span>
                          )}
                          {v.is_msme && (
                            <span style={{ fontSize: 10, fontWeight: 600, background: '#d1fae5', color: '#065f46', borderRadius: 4, padding: '1px 6px' }}>
                              MSME
                            </span>
                          )}
                        </div>

                        {/* Select button */}
                        <div style={{
                          marginTop: 8,
                          fontSize: 11,
                          padding: '3px 0',
                          borderRadius: 6,
                          textAlign: 'center',
                          fontWeight: 600,
                          background: isSel ? pal.bg : 'hsl(var(--muted))',
                          color: isSel ? '#fff' : 'hsl(var(--muted-foreground))',
                          width: 120,        // Set fixed width
                          display: 'inline-block' // So it doesn’t stretch full width
                        }}>
                          {isSel ? (
                            <>
                              <Check style={{ width: 9, height: 9, display: 'inline', marginRight: 3 }} />
                              Selected
                            </>
                          ) : 'Select vendor'}
                        </div>
                      </div>
                    </th>
                  )
                })}

                {/* Best column */}
                <th style={{ ...thBase, textAlign: 'center', width: 90, background: 'hsl(var(--muted)/0.4)' }}>
                  Best
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ── Item price rows ─────────────────────────────────────────── */}
              {items.map((item) => {
                const bestVid = itemBestVendor(item)
                const worstVid = itemWorstVendor(item)
                const bestVendor = vendors.find(v => v.vendor_id === bestVid)
                const bpi = bestVendor ? vendorIdx[bestVendor.vendor_id] : 0
                const bpal = vendorPalette(bpi)

                return (
                  <tr key={item.master_item_id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    {/* Item name */}
                    <td style={{ padding: '10px 14px', borderRight: '1px solid hsl(var(--border))' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                        {item.item_code}
                      </div>
                      <div style={{ fontWeight: 500, fontSize: 12.5, lineHeight: 1.3, marginTop: 1 }}>
                        {item.item_name}
                      </div>
                      {item.hsn_code && (
                        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>
                          HSN: {item.hsn_code}
                        </div>
                      )}
                    </td>

                    {/* Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, borderRight: '1px solid hsl(var(--border))' }}>
                      {item.total_quantity}
                    </td>

                    {/* UOM */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 11, borderRight: '2px solid hsl(var(--border))' }}>
                      {item.unit_of_measure}
                    </td>

                    {/* Per-vendor price cell */}
                    {vendors.map((v) => {
                      const pi = vendorIdx[v.vendor_id]
                      const pal = SELECTED_COLOR
                      const isSel = v.vendor_id === selectedVendorId
                      const priceInfo = item.vendor_prices?.[v.vendor_id]
                      const isBest = v.vendor_id === bestVid
                      const isWorst = v.vendor_id === worstVid && vendors.length > 1

                      const cellBg = isBest
                        ? 'hsl(142 71% 96%)'
                        : isWorst
                          ? 'hsl(0 72% 97%)'
                          : isSel
                            ? pal.light
                            : 'transparent'

                      const borderL = isSel
                        ? `2px solid ${pal.bg}`
                        : '2px solid transparent'

                      return (
                        <td
                          key={v.vendor_id}
                          onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                          style={{
                            padding: '10px 14px',
                            textAlign: 'right',
                            cursor: isDisabled ? 'default' : 'pointer',
                            background: cellBg,
                            borderLeft: borderL,
                            borderRight: '1px solid hsl(var(--border))',
                            transition: 'background .1s',
                            verticalAlign: 'top',
                          }}
                        >
                          {priceInfo ? (
                            <>
                              {/* Unit price */}
                              <div style={{
                                fontWeight: 700, fontFamily: 'monospace', fontSize: 13,
                                color: isBest ? 'hsl(142 71% 32%)' : isWorst ? 'hsl(0 72% 45%)' : 'hsl(var(--foreground))',
                              }}>
                                {fmt(priceInfo.unit_price)}
                              </div>
                              {/* Line total */}
                              <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', marginTop: 1 }}>
                                {fmt(priceInfo.total)}
                              </div>
                              {/* vs best diff */}
                              {priceInfo.vs_best && priceInfo.vs_best.amount_diff > 0 && (
                                <div style={{ fontSize: 10, color: 'hsl(0 72% 52%)', marginTop: 2, fontFamily: 'monospace' }}>
                                  +{fmt(priceInfo.vs_best.amount_diff)}
                                </div>
                              )}
                              {isBest && (
                                <div style={{ marginTop: 3 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, background: 'hsl(142 71% 88%)', color: 'hsl(142 71% 28%)', borderRadius: 3, padding: '1px 5px' }}>
                                    BEST
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Best column */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {bestVendor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <VendorDot name={bestVendor.vendor_name} paletteIdx={bpi} size={20} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'hsl(142 71% 35%)' }}>
                            {bestVendor.vendor_name.split(' ')[0].slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* ── Soft factors ──────────────────────────────────────────── */}
              <tr style={{ background: 'hsl(var(--muted)/0.5)', borderBottom: '1px solid hsl(var(--border))', borderTop: '2px solid hsl(var(--border))' }}>
                <td colSpan={3 + vendors.length + 1} style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.06em',
                  color: 'hsl(var(--muted-foreground))',
                }}>
                  Soft factors
                </td>
              </tr>

              {[
                { label: 'Lead time', icon: <Truck style={{ width: 10, height: 10 }} />, render: (v: any) => v.delivery_lead_time_days != null ? `${v.delivery_lead_time_days}d` : '—' },
                { label: 'Payment terms', icon: <CreditCard style={{ width: 10, height: 10 }} />, render: (v: any) => v.payment_terms_display || v.payment_terms || '—' },
                { label: 'Vendor score', icon: <Star style={{ width: 10, height: 10 }} />, render: (v: any) => v.performance_score != null ? `${v.performance_score}/100` : '—' },
                { label: 'Risk score (lower=better)', icon: <ShieldAlert style={{ width: 10, height: 10 }} />, render: (v: any) => v.risk_score != null ? String(v.risk_score) : '—' },
                { label: 'Previous POs', icon: <Info style={{ width: 10, height: 10 }} />, render: (v: any) => String(v.previous_po_count ?? '—') },
                {
                  label: 'GST', icon: null, render: (v: any) => {
                    const rate = v.igst_rate > 0 ? `IGST ${v.igst_rate}%` : `CGST ${v.cgst_rate}% + SGST ${v.sgst_rate}%`
                    return rate
                  }
                },
              ].map(({ label, icon, render }) => (
                <tr key={label} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <td colSpan={3} style={{ padding: '8px 14px', borderRight: '2px solid hsl(var(--border))' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                      {icon}{label}
                    </span>
                  </td>
                  {vendors.map((v) => {
                    const pi = vendorIdx[v.vendor_id]
                    const pal = SELECTED_COLOR
                    const isSel = v.vendor_id === selectedVendorId
                    return (
                      <td
                        key={v.vendor_id}
                        onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                        style={{
                          padding: '8px 14px', textAlign: 'right', cursor: 'pointer',
                          fontSize: 12, fontWeight: 500,
                          background: isSel ? pal.light : 'transparent',
                          borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                          borderRight: '1px solid hsl(var(--border))',
                          color: 'hsl(var(--foreground))',
                        }}
                      >
                        {render(v)}
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 14px' }} />
                </tr>
              ))}

              {/* ── Totals ────────────────────────────────────────────────── */}
              <tr style={{ background: 'hsl(var(--muted)/0.5)', borderTop: '2px solid hsl(var(--border))', borderBottom: '1px solid hsl(var(--border))' }}>
                <td colSpan={3} style={{ padding: '8px 14px', fontWeight: 700, fontSize: 12.5, borderRight: '2px solid hsl(var(--border))' }}>
                  Subtotal · INR
                </td>
                {vendors.map((v, i) => {
                  const pi = vendorIdx[v.vendor_id]
                  const pal = SELECTED_COLOR
                  const isSel = v.vendor_id === selectedVendorId
                  const t = totals[i]
                  return (
                    <td
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: '8px 14px', textAlign: 'right', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'monospace',
                        background: t === minTotal
                          ? 'hsl(142 71% 93%)'
                          : t === maxTotal && vendors.length > 1
                            ? 'hsl(0 72% 95%)'
                            : isSel ? pal.light : 'transparent',
                        borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                        borderRight: '1px solid hsl(var(--border))',
                        color: t === minTotal ? 'hsl(142 71% 30%)' : t === maxTotal && vendors.length > 1 ? 'hsl(0 72% 40%)' : 'hsl(var(--foreground))',
                      }}
                    >
                      {formatCurrency(t)}
                    </td>
                  )
                })}
                <td style={{ padding: '8px 14px' }} />
              </tr>

              <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <td colSpan={3} style={{ padding: '7px 14px', color: 'hsl(var(--muted-foreground))', fontSize: 12, borderRight: '2px solid hsl(var(--border))' }}>
                  + GST
                </td>
                {vendors.map((v) => {
                  const pi = vendorIdx[v.vendor_id]
                  const pal =SELECTED_COLOR
                  const isSel = v.vendor_id === selectedVendorId
                  const gst = gstAmount(v, Number(v.total_amount))
                  return (
                    <td
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: '7px 14px', textAlign: 'right', fontSize: 12,
                        fontFamily: 'monospace', cursor: 'pointer',
                        background: isSel ? pal.light : 'transparent',
                        borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                        borderRight: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {formatCurrency(gst)}
                      <div style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>
                        {v.igst_rate > 0 ? `IGST ${v.igst_rate}%` : `${(v.cgst_rate || 0) + (v.sgst_rate || 0)}%`}
                      </div>
                    </td>
                  )
                })}
                <td style={{ padding: '7px 14px' }} />
              </tr>

              {/* Landed total — highlighted row */}
              <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                <td colSpan={3} style={{ padding: '11px 14px', fontWeight: 700, fontSize: 13.5, borderRight: '2px solid hsl(var(--border))' }}>
                  Landed total
                </td>
                {vendors.map((v, i) => {
                  const pi = vendorIdx[v.vendor_id]
                  const pal = SELECTED_COLOR
                  const isSel = v.vendor_id === selectedVendorId
                  const lt = landedTotals[i]
                  const isBestL = lt === minLanded
                  const isWorstL = lt === maxLanded && vendors.length > 1
                  return (
                    <td
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: '11px 14px', textAlign: 'right',
                        fontWeight: 700, fontSize: 14, fontFamily: 'monospace',
                        cursor: 'pointer',
                        background: isBestL
                          ? 'hsl(142 71% 90%)'
                          : isWorstL
                            ? 'hsl(0 72% 94%)'
                            : isSel ? pal.light : 'hsl(var(--muted)/0.2)',
                        borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                        borderRight: '1px solid hsl(var(--border))',
                        color: isBestL ? 'hsl(142 71% 28%)' : isWorstL ? 'hsl(0 72% 40%)' : 'hsl(var(--foreground))',
                      }}
                    >
                      {formatCurrency(lt)}
                      {isBestL && (
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(142 71% 32%)', marginTop: 1 }}>LOWEST</div>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding: '11px 14px' }} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Selected vendor footer ─────────────────────────────────────────── */}
        {selV && (() => {
          const pi = vendorIdx[selV.vendor_id]
          const pal = SELECTED_COLOR
          const selIdx = vendors.findIndex(v => v.vendor_id === selV.vendor_id)
          const selLand = landedTotals[selIdx] ?? 0
          const savings = maxLanded - selLand

          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderTop: '1px solid hsl(var(--border))',
              background: pal.light,
            }}>
              <VendorDot name={selV.vendor_name} paletteIdx={pi} size={26} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{selV.vendor_name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, background: pal.bg, color: '#fff', borderRadius: 4, padding: '1px 6px' }}>
                    Selected vendor
                  </span>
                  {selV.vendor_status === 'new' && (
                    <span style={{ fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 6px' }}>
                      New vendor
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                  Landed {formatCurrency(selLand)}
                  {selV.delivery_lead_time_days != null && ` · ${selV.delivery_lead_time_days}d lead`}
                  {(selV.payment_terms_display || selV.payment_terms) && ` · ${selV.payment_terms_display || selV.payment_terms}`}
                  {selV.performance_score != null && ` · score ${selV.performance_score}/100`}
                </span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>
                    Saving vs worst
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: savings > 0 ? 'hsl(142 71% 35%)' : 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
                    {savings > 0 ? `+${formatCurrency(savings)}` : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>
                    Gap to best
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace', color: selLand === minLanded ? 'hsl(142 71% 35%)' : 'hsl(38 92% 45%)' }}>
                    {selLand === minLanded ? 'Best price' : `+${formatCurrency(selLand - minLanded)}`}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </Card>

      {/* ── AI Recommendation + Risk ──────────────────────────────────────────── */}
      {(aiRecommended || keyTakeaways.length > 0 || riskIndicators.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Why this vendor / AI summary */}
          <Card className="shadow-sm border-primary/20">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  AI recommendation
                </CardTitle>
                {aiRecommended && (() => {
                  const rank = aiRanking.find(r => r.vendor_id === aiRecommended.vendor_id)
                  const score = rank?.overall_score
                  return score != null ? (
                    <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">
                      {score}/100
                    </span>
                  ) : null
                })()}
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              {/* Summary */}
              {aiRecommended?.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {aiRecommended.summary}
                </p>
              )}

              {/* Key takeaways */}
              {keyTakeaways.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Key takeaways
                  </p>
                  <ul className="space-y-1">
                    {keyTakeaways.map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <TrendingDown className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Per-vendor factor analysis */}
              {aiRanking.length > 0 && aiRanking[0]?.key_factors && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Factor analysis
                  </p>
                  {aiRanking.map((r) => {
                    const vIdx = vendors.findIndex(v => v.vendor_id === r.vendor_id)
                    return (
                      <div key={r.vendor_id} className="mb-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <VendorDot name={r.vendor_name} paletteIdx={vIdx >= 0 ? vIdx : 0} size={16} />
                          <span className="text-xs font-semibold">{r.vendor_name}</span>
                          {r.overall_tag && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, borderRadius: 4, padding: '1px 5px',
                              background: r.overall_tag.toLowerCase().includes('risk') ? '#fee2e2' : '#d1fae5',
                              color: r.overall_tag.toLowerCase().includes('risk') ? '#991b1b' : '#065f46',
                            }}>
                              {r.overall_tag}
                            </span>
                          )}
                        </div>
                        {Object.entries(r.key_factors || {}).map(([factor, desc]) => (
                          <div key={factor} className="ml-5 text-[11px] text-muted-foreground leading-snug">
                            <span className="font-medium capitalize text-foreground">{factor.replace(/_/g, ' ')}: </span>
                            {String(desc)}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk indicators */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Risk indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-4">
              {riskIndicators.length > 0 ? (
                <ul className="space-y-2">
                  {riskIndicators.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No risk indicators flagged.</p>
              )}

              {/* Vendor quick stats */}
              {vendors.map((v) => {
                const pi = vendorIdx[v.vendor_id]
                return (
                  <div key={v.vendor_id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <VendorDot name={v.vendor_name} paletteIdx={pi} size={20} />
                      <span className="text-xs font-semibold">{v.vendor_name}</span>
                      {v.vendor_status === 'new' && (
                        <span style={{ fontSize: 9, fontWeight: 600, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px' }}>
                          New
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
                      {[
                        { label: 'Previous POs', value: v.previous_po_count ?? '—' },
                        { label: 'Perf. score', value: v.performance_score != null ? `${v.performance_score}/100` : '—' },
                        { label: 'Risk score', value: v.risk_score != null ? v.risk_score : '—' },
                        { label: 'GST no.', value: v.gst_number || '—' },
                        { label: 'Location', value: [v.city, v.state].filter(Boolean).join(', ') || '—' },
                        { label: 'MSME', value: v.is_msme ? (v.is_msme_certified ? 'Certified' : 'Yes') : 'No' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <span className="text-muted-foreground">{label}: </span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default CompareStep