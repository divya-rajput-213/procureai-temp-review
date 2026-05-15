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

const fmt = (n: number | null | undefined) =>
  n != null ? formatCurrency(n) : '—'

// ── thBase: 12 → 13
const thBase: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'hsl(var(--muted-foreground))',
  whiteSpace: 'nowrap',
}

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

  const matrix = data?.matrix || {}
  const aiRec = data?.ai_recommendation || {}
  const vendors: any[] = matrix.vendors || []
  const items: any[] = matrix.items || []

  const vendorIdx: Record<number, number> = {}
  vendors.forEach((v, i) => { vendorIdx[v.vendor_id] = i })

  const totals = vendors.map(v => Number(v.total_amount) || 0)
  const minTotal = totals.length ? Math.min(...totals) : 0
  const maxTotal = totals.length ? Math.max(...totals) : 0

  const gstAmount = (v: any, subtotal: number) => {
    const rate = v.igst_rate > 0 ? v.igst_rate : (v.cgst_rate || 0) + (v.sgst_rate || 0)
    return Math.round(subtotal * rate / 100)
  }
  const landedTotal = (v: any) => Number(v.total_amount) + gstAmount(v, Number(v.total_amount))

  const landedTotals = vendors.map(v => landedTotal(v))
  const minLanded = landedTotals.length ? Math.min(...landedTotals) : 0
  const maxLanded = landedTotals.length ? Math.max(...landedTotals) : 0

  const selV = vendors.find(v => v.vendor_id === selectedVendorId) || vendors[0]

  const itemBestVendor = (item: any): number | null => {
    const prices = Object.entries(item.vendor_prices || {}) as [string, any][]
    if (!prices.length) return null
    return Number(prices.sort((a, b) => a[1].unit_price - b[1].unit_price)[0][0])
  }

  const itemWorstVendor = (item: any): number | null => {
    const prices = Object.entries(item.vendor_prices || {}) as [string, any][]
    if (prices.length < 2) return null
    return Number(prices.sort((a, b) => b[1].unit_price - a[1].unit_price)[0][0])
  }

  const aiRanking: any[] = aiRec.ranking || []
  const aiRecommended = aiRec.recommended
  const keyTakeaways: string[] = aiRec.key_takeaways || []
  const riskIndicators: string[] = aiRec.risk_indicators || []

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Quotation comparison</CardTitle>
              {!isDisabled && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click a vendor column to select · {items.length} item{items.length !== 1 ? 's' : ""} · {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
          </div>
        </CardHeader>

        <div style={{ overflowX: 'auto' }}>
          {/* ── table: base 13 → 15 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                <th style={{ ...thBase, textAlign: 'left', minWidth: 240, background: 'hsl(var(--muted)/0.4)', borderRight: '1px solid hsl(var(--border))' }}>
                  Item
                </th>
                <th style={{ ...thBase, textAlign: 'center', width: 80, background: 'hsl(var(--muted)/0.4)', borderRight: '1px solid hsl(var(--border))' }}>
                  Qty
                </th>
                <th style={{ ...thBase, textAlign: 'center', width: 70, background: 'hsl(var(--muted)/0.4)', borderRight: '2px solid hsl(var(--border))' }}>
                  UOM
                </th>

                {vendors.map((v) => {
                  const isSel = v.vendor_id === selectedVendorId
                  const pal = SELECTED_COLOR
                  const isAiPick = aiRecommended?.vendor_id === v.vendor_id

                  return (
                    <th
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: 0,
                        minWidth: 180,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.6 : 1,
                        borderRight: '1px solid hsl(var(--border))',
                        borderTop: isSel ? `3px solid ${pal.bg}` : '3px solid transparent',
                        background: isSel ? pal.light : 'hsl(var(--muted)/0.2)',
                        transition: 'background .12s',
                        verticalAlign: 'top',
                      }}
                    >
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ minWidth: 0 }}>
                          {/* vendor name: 14 → 16 */}
                          <div style={{ fontWeight: 700, fontSize: 16, color: 'hsl(var(--foreground))', lineHeight: 1.2 }}>
                            {v.vendor_name}
                          </div>
                          {/* meta line: 12 → 13 */}
                          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                            {[
                              v.delivery_lead_time_days ? `${v.delivery_lead_time_days}d` : null,
                              v.payment_terms_display || v.payment_terms || null,
                              v.performance_score != null ? `${v.performance_score}/100` : null,
                            ].filter(Boolean).join(' · ') || v.city || '—'}
                          </div>
                        </div>

                        {/* badges: 11 → 12 */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
                          {isAiPick && (
                            <span style={{ fontSize: 12, fontWeight: 600, background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Sparkles style={{ width: 9, height: 9 }} />AI pick
                            </span>
                          )}
                          {v.vendor_status === 'new' && (
                            <span style={{ fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 7px' }}>
                              New vendor
                            </span>
                          )}
                          {v.is_msme && (
                            <span style={{ fontSize: 12, fontWeight: 600, background: '#d1fae5', color: '#065f46', borderRadius: 4, padding: '2px 7px' }}>
                              MSME
                            </span>
                          )}
                        </div>

                        {/* select button: 13 → 14 */}
                        <div style={{
                          marginTop: 9,
                          fontSize: 14,
                          padding: '4px 0',
                          borderRadius: 6,
                          textAlign: 'center',
                          fontWeight: 600,
                          background: isSel ? pal.bg : 'hsl(var(--muted))',
                          color: isSel ? '#fff' : 'hsl(var(--muted-foreground))',
                          width: 130,
                          display: 'inline-block',
                        }}>
                          {isSel ? (
                            <>
                              <Check style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />
                              Selected
                            </>
                          ) : 'Select vendor'}
                        </div>
                      </div>
                    </th>
                  )
                })}

                <th style={{ ...thBase, textAlign: 'center', width: 90, background: 'hsl(var(--muted)/0.4)' }}>
                  Best
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => {
                const bestVid = itemBestVendor(item)
                const worstVid = itemWorstVendor(item)
                const bestVendor = vendors.find(v => v.vendor_id === bestVid)
                const bpi = bestVendor ? vendorIdx[bestVendor.vendor_id] : 0

                return (
                  <tr key={item.master_item_id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    {/* item cell */}
                    <td style={{ padding: '11px 14px', borderRight: '1px solid hsl(var(--border))' }}>
                      {/* item_code: 11 → 13 */}
                      <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
                        {item.item_code}
                      </div>
                      {/* item_name: 12.5 → 15 */}
                      <div style={{ fontWeight: 500, fontSize: 15, lineHeight: 1.35, marginTop: 2 }}>
                        {item.item_name}
                      </div>
                      {item.hsn_code && (
                        // HSN: 10 → 12
                        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                          HSN: {item.hsn_code}
                        </div>
                      )}
                    </td>

                    {/* qty — inherits table fontSize (15) */}
                    <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid hsl(var(--border))' }}>
                      {item.total_quantity}
                    </td>

                    {/* UOM: 11 → 13 */}
                    <td style={{ padding: '11px 14px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 13, borderRight: '2px solid hsl(var(--border))' }}>
                      {item.unit_of_measure}
                    </td>

                    {vendors.map((v) => {
                      const pal = SELECTED_COLOR
                      const isSel = v.vendor_id === selectedVendorId
                      const priceInfo = item.vendor_prices?.[v.vendor_id]
                      const isBest = v.vendor_id === bestVid
                      const isWorst = v.vendor_id === worstVid && vendors.length > 1

                      const cellBg = isBest ? 'hsl(142 71% 96%)' : isWorst ? 'hsl(0 72% 97%)' : isSel ? pal.light : 'transparent'
                      const borderL = isSel ? `2px solid ${pal.bg}` : '2px solid transparent'

                      return (
                        <td
                          key={v.vendor_id}
                          onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                          style={{
                            padding: '11px 14px',
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
                              {/* unit price: 13 → 15 */}
                              <div style={{
                                fontWeight: 700, fontSize: 15,
                                color: isBest ? 'hsl(142 71% 32%)' : isWorst ? 'hsl(0 72% 45%)' : 'hsl(var(--foreground))',
                              }}>
                                {fmt(priceInfo.unit_price)}
                              </div>
                              {/* line total: 10 → 12 */}
                              <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                                {fmt(priceInfo.total)}
                              </div>
                              {/* vs best diff: 10 → 12 */}
                              {priceInfo.vs_best && priceInfo.vs_best.amount_diff > 0 && (
                                <div style={{ fontSize: 12, color: 'hsl(0 72% 52%)', marginTop: 2 }}>
                                  +{fmt(priceInfo.vs_best.amount_diff)}
                                </div>
                              )}
                              {isBest && (
                                <div style={{ marginTop: 4 }}>
                                  {/* BEST badge: 9 → 11 */}
                                  <span style={{ fontSize: 11, fontWeight: 700, background: 'hsl(142 71% 88%)', color: 'hsl(142 71% 28%)', borderRadius: 3, padding: '1px 6px' }}>
                                    BEST
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* best column */}
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      {bestVendor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <VendorDot name={bestVendor.vendor_name} paletteIdx={bpi} size={22} />
                          {/* abbrev: 9 → 11 */}
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(142 71% 35%)' }}>
                            {bestVendor.vendor_name.split(' ')[0].slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* soft factors section header — unchanged at 15 since it's already a divider */}
              <tr style={{ background: 'hsl(var(--muted)/0.5)', borderBottom: '1px solid hsl(var(--border))', borderTop: '2px solid hsl(var(--border))' }}>
                <td colSpan={3 + vendors.length + 1} style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.08em',
                  color: 'hsl(var(--muted-foreground))',
                }}>
                  Soft factors
                </td>
              </tr>

              {[
                { label: 'Lead time', icon: <Truck style={{ width: 12, height: 12 }} />, render: (v: any) => v.delivery_lead_time_days != null ? `${v.delivery_lead_time_days}d` : '—' },
                { label: 'Payment terms', icon: <CreditCard style={{ width: 12, height: 12 }} />, render: (v: any) => v.payment_terms_display || v.payment_terms || '—' },
                { label: 'Vendor score', icon: <Star style={{ width: 12, height: 12 }} />, render: (v: any) => v.performance_score != null ? `${v.performance_score}/100` : '—' },
                { label: 'Risk score (lower=better)', icon: <ShieldAlert style={{ width: 12, height: 12 }} />, render: (v: any) => v.risk_score != null ? String(v.risk_score) : '—' },
                { label: 'Previous POs', icon: <Info style={{ width: 12, height: 12 }} />, render: (v: any) => String(v.previous_po_count ?? '—') },
                {
                  label: 'GST', icon: null, render: (v: any) =>
                    v.igst_rate > 0 ? `IGST ${v.igst_rate}%` : `CGST ${v.cgst_rate}% + SGST ${v.sgst_rate}%`
                },
              ].map(({ label, icon, render }) => (
                <tr key={label} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <td colSpan={3} style={{ padding: '9px 14px', borderRight: '2px solid hsl(var(--border))' }}>
                    {/* label: 13 → 14 */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
                      {icon}{label}
                    </span>
                  </td>
                  {vendors.map((v) => {
                    const pal = SELECTED_COLOR
                    const isSel = v.vendor_id === selectedVendorId
                    return (
                      <td
                        key={v.vendor_id}
                        onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                        style={{
                          padding: '9px 14px', textAlign: 'right', cursor: 'pointer',
                          // value: 15 — inherits table base
                          fontWeight: 500,
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
                  <td style={{ padding: '9px 14px' }} />
                </tr>
              ))}

              {/* subtotal row: 15 → 16 */}
              <tr style={{ background: 'hsl(var(--muted)/0.5)', borderTop: '2px solid hsl(var(--border))', borderBottom: '1px solid hsl(var(--border))' }}>
                <td colSpan={3} style={{ padding: '9px 14px', fontWeight: 700, fontSize: 16, borderRight: '2px solid hsl(var(--border))' }}>
                  Subtotal · INR
                </td>
                {vendors.map((v, i) => {
                  const pal = SELECTED_COLOR
                  const isSel = v.vendor_id === selectedVendorId
                  const t = totals[i]
                  return (
                    <td
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: '9px 14px', textAlign: 'right', fontWeight: 700, fontSize: 16,
                        cursor: 'pointer',
                        background: t === minTotal ? 'hsl(142 71% 93%)' : t === maxTotal && vendors.length > 1 ? 'hsl(0 72% 95%)' : isSel ? pal.light : 'transparent',
                        borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                        borderRight: '1px solid hsl(var(--border))',
                        color: t === minTotal ? 'hsl(142 71% 30%)' : t === maxTotal && vendors.length > 1 ? 'hsl(0 72% 40%)' : 'hsl(var(--foreground))',
                      }}
                    >
                      {formatCurrency(t)}
                    </td>
                  )
                })}
                <td style={{ padding: '9px 14px' }} />
              </tr>

              {/* GST row: amount 12 → 14, rate label 9 → 11 */}
              <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <td colSpan={3} style={{ padding: '8px 14px', color: 'hsl(var(--muted-foreground))', fontSize: 14, borderRight: '2px solid hsl(var(--border))' }}>
                  + GST
                </td>
                {vendors.map((v) => {
                  const pal = SELECTED_COLOR
                  const isSel = v.vendor_id === selectedVendorId
                  const gst = gstAmount(v, Number(v.total_amount))
                  return (
                    <td
                      key={v.vendor_id}
                      onClick={() => !isDisabled && setSelectedVendorId(v.vendor_id)}
                      style={{
                        padding: '8px 14px', textAlign: 'right', fontSize: 14,
                        cursor: 'pointer',
                        background: isSel ? pal.light : 'transparent',
                        borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                        borderRight: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {formatCurrency(gst)}
                      <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>
                        {v.igst_rate > 0 ? `IGST ${v.igst_rate}%` : `${(v.cgst_rate || 0) + (v.sgst_rate || 0)}%`}
                      </div>
                    </td>
                  )
                })}
                <td style={{ padding: '8px 14px' }} />
              </tr>

              {/* landed total: label 16 → 18, value 14 → 16, LOWEST badge 9 → 11 */}
              <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                <td colSpan={3} style={{ padding: '12px 14px', fontWeight: 700, fontSize: 18, borderRight: '2px solid hsl(var(--border))' }}>
                  Landed total
                </td>
                {vendors.map((v, i) => {
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
                        padding: '12px 14px', textAlign: 'right',
                        fontWeight: 700, fontSize: 16,
                        cursor: 'pointer',
                        background: isBestL ? 'hsl(142 71% 90%)' : isWorstL ? 'hsl(0 72% 94%)' : isSel ? pal.light : 'hsl(var(--muted)/0.2)',
                        borderLeft: isSel ? `2px solid ${pal.bg}` : '2px solid transparent',
                        borderRight: '1px solid hsl(var(--border))',
                        color: isBestL ? 'hsl(142 71% 28%)' : isWorstL ? 'hsl(0 72% 40%)' : 'hsl(var(--foreground))',
                      }}
                    >
                      {formatCurrency(lt)}
                      {isBestL && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(142 71% 32%)', marginTop: 2 }}>LOWEST</div>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding: '12px 14px' }} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* selected vendor footer */}
        {selV && (() => {
          const pi = vendorIdx[selV.vendor_id]
          const pal = SELECTED_COLOR
          const selIdx = vendors.findIndex(v => v.vendor_id === selV.vendor_id)
          const selLand = landedTotals[selIdx] ?? 0
          const savings = maxLanded - selLand

          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px', borderTop: '1px solid hsl(var(--border))',
              background: pal.light,
            }}>
              <VendorDot name={selV.vendor_name} paletteIdx={pi} size={30} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {/* vendor name: 13 → 15 */}
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{selV.vendor_name}</span>
                  {/* "Selected vendor" badge: 10 → 12 */}
                  <span style={{ fontSize: 12, fontWeight: 600, background: pal.bg, color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                    Selected vendor
                  </span>
                  {selV.vendor_status === 'new' && (
                    <span style={{ fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 8px' }}>
                      New vendor
                    </span>
                  )}
                </div>
                {/* meta line: 11 → 13 */}
                <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                  Landed {formatCurrency(selLand)}
                  {selV.delivery_lead_time_days != null && ` · ${selV.delivery_lead_time_days}d lead`}
                  {(selV.payment_terms_display || selV.payment_terms) && ` · ${selV.payment_terms_display || selV.payment_terms}`}
                  {selV.performance_score != null && ` · score ${selV.performance_score}/100`}
                </span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  {/* label: 10 → 11 */}
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>
                    Saving vs worst
                  </div>
                  {/* value: 14 → 16 */}
                  <div style={{ fontWeight: 700, fontSize: 16, color: savings > 0 ? 'hsl(142 71% 35%)' : 'hsl(var(--muted-foreground))' }}>
                    {savings > 0 ? `+${formatCurrency(savings)}` : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>
                    Gap to best
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: selLand === minLanded ? 'hsl(142 71% 35%)' : 'hsl(38 92% 45%)' }}>
                    {selLand === minLanded ? 'Best price' : `+${formatCurrency(selLand - minLanded)}`}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </Card>

      {/* AI Recommendation + Risk */}
      {(aiRecommended || keyTakeaways.length > 0 || riskIndicators.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

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
                    <span className="text-xs font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">
                      {score}/100
                    </span>
                  ) : null
                })()}
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              {/* summary: xs → sm */}
              {aiRecommended?.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {aiRecommended.summary}
                </p>
              )}

              {keyTakeaways.length > 0 && (
                <div>
                  {/* section label: 10 → 11 */}
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Key takeaways
                  </p>
                  <ul className="space-y-1.5">
                    {keyTakeaways.map((t, i) => (
                      // items: xs → sm
                      <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <TrendingDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiRanking.length > 0 && aiRanking[0]?.key_factors && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Factor analysis
                  </p>
                  {aiRanking.map((r) => {
                    const vIdx = vendors.findIndex(v => v.vendor_id === r.vendor_id)
                    return (
                      <div key={r.vendor_id} className="mb-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <VendorDot name={r.vendor_name} paletteIdx={vIdx >= 0 ? vIdx : 0} size={18} />
                          {/* vendor name: xs → sm */}
                          <span className="text-sm font-semibold">{r.vendor_name}</span>
                          {r.overall_tag && (
                            // tag: 9 → 11
                            <span style={{
                              fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
                              background: r.overall_tag.toLowerCase().includes('risk') ? '#fee2e2' : '#d1fae5',
                              color: r.overall_tag.toLowerCase().includes('risk') ? '#991b1b' : '#065f46',
                            }}>
                              {r.overall_tag}
                            </span>
                          )}
                        </div>
                        {Object.entries(r.key_factors || {}).map(([factor, desc]) => (
                          // factor rows: 11 → 12
                          <div key={factor} className="ml-5 text-xs text-muted-foreground leading-snug">
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
                    // items: xs → sm
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                      <span className="text-muted-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                // no-risk msg: xs → sm
                <p className="text-sm text-muted-foreground">No risk indicators flagged.</p>
              )}

              {vendors.map((v) => {
                const pi = vendorIdx[v.vendor_id]
                return (
                  <div key={v.vendor_id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <VendorDot name={v.vendor_name} paletteIdx={pi} size={22} />
                      {/* vendor name: xs → sm */}
                      <span className="text-sm font-semibold">{v.vendor_name}</span>
                      {v.vendor_status === 'new' && (
                        // badge: 9 → 11
                        <span style={{ fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 6px' }}>
                          New
                        </span>
                      )}
                    </div>
                    {/* stats grid: 11 → 13 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 13 }}>
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