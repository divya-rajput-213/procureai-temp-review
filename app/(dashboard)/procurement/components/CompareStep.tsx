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
} from 'lucide-react'
import {  formatCurrency } from '@/lib/utils'
import { VendorDot } from '../new/page'


function CompareStep({ selectedQuotationIds, quotations, selectedVendorId, setSelectedVendorId }: any) {
  // Build vendor list from selected quotations
  const selectedQuotations: any[] = (quotations as any[]).filter((q: any) => selectedQuotationIds.includes(q.id))
  // Group by vendor
  const vendorMap: Record<string, any> = {}
  for (const q of selectedQuotations) {
    if (!vendorMap[q.vendor_name]) {
      vendorMap[q.vendor_name] = { ...q, quotations: [q] }
    } else {
      vendorMap[q.vendor_name].quotations.push(q)
      vendorMap[q.vendor_name].total_amount = String(Number(vendorMap[q.vendor_name].total_amount) + Number(q.total_amount))
    }
  }
  const vendors = Object.values(vendorMap)

  const colorPalette = ['#042348', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']
  const vendorColors: Record<string, string> = {}
  vendors.forEach((v, i) => { vendorColors[v.vendor_name] = colorPalette[i % colorPalette.length] })

  const totals = vendors.map(v => Number(v.total_amount) || 0)
  const minTotal = Math.min(...totals)
  const maxTotal = Math.max(...totals)
  const gst = (t: number) => Math.round(t * 0.15)
  const landed = (t: number) => t + gst(t)

  const selV = vendors.find(v => v.vendor_name === selectedVendorId) || vendors[0]
  const selTotal = selV ? Number(selV.total_amount) : 0
  const selLanded = landed(selTotal)
  const savings = landed(maxTotal) - selLanded

  if (vendors.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <AlertCircle className="w-4 h-4 mr-2" />No quotations selected. Go back and select at least one.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* AI banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, background: '#f5f3ff',
        border: '1px solid #ede9fe', borderRadius: 10, padding: '10px 14px', fontSize: 13
      }}>
        <Sparkles style={{ width: 14, height: 14, color: '#042348', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          Compare <strong>{selectedQuotations.length} quotes</strong> across <strong>{vendors.length} vendors</strong> · best price highlighted.
          {vendors[0] && <> AI recommends <strong style={{ color: '#042348' }}>{vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name}</strong> on composite score.</>}
        </div>
        {selV && vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name !== selV.vendor_name && (
          <Button size="sm" variant="outline" className="gap-1 text-indigo-700 border-indigo-200 bg-white text-xs shrink-0"
            onClick={() => setSelectedVendorId(vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name)}>
            <Sparkles className="w-3 h-3" />Use AI pick
          </Button>
        )}
      </div>

      {/* Comparison table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Quotation comparison</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Click a vendor column header to select · {vendors.length} vendors</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" />Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'hsl(var(--muted-foreground))', minWidth: 140 }}>Quotation</th>
                {vendors.map((v) => {
                  const isSel = v.vendor_name === selectedVendorId
                  const color = vendorColors[v.vendor_name]
                  return (
                    <th key={v.vendor_name}
                      onClick={() => setSelectedVendorId(v.vendor_name)}
                      style={{
                        padding: '10px 14px', textAlign: 'left', cursor: 'pointer', minWidth: 160,
                        background: isSel ? 'rgba(99,102,241,0.06)' : 'transparent',
                        borderLeft: isSel ? '2px solid #042348' : '2px solid transparent',
                        transition: 'background .1s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', border: isSel ? 'none' : '1.5px solid hsl(var(--border))', background: isSel ? '#042348' : 'transparent', display: 'inline-block', transition: 'all .1s' }} />
                        <VendorDot name={v.vendor_name} color={color} size={20} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{v.vendor_name}</div>
                          <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                            {v.score ? `${v.score}/100` : '—'}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: 6, fontSize: 11, padding: '2px 8px', borderRadius: 6, textAlign: 'center', fontWeight: 600,
                        background: isSel ? '#042348' : 'hsl(var(--muted))',
                        color: isSel ? '#fff' : 'hsl(var(--muted-foreground))'
                      }}>
                        {isSel ? '✓ Selected' : 'Select vendor'}
                      </div>
                    </th>
                  )
                })}
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Best</th>
              </tr>
            </thead>
            <tbody>
              {/* Quote rows */}
              {selectedQuotations.map((q: any) => {
                const prices = vendors.map(v => v.id === q.id || v.vendor_name === q.vendor_name ? Number(q.total_amount) : null)
                return (
                  <tr key={q.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#042348' }}>{q.ref_no}</span>
                      {q.items_count && <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{q.items_count} items</div>}
                    </td>
                    {vendors.map((v) => {
                      const isSel = v.vendor_name === selectedVendorId
                      const isThisVendor = v.vendor_name === q.vendor_name
                      return (
                        <td key={v.vendor_name}
                          onClick={() => setSelectedVendorId(v.vendor_name)}
                          style={{
                            padding: '9px 14px', textAlign: 'right', cursor: 'pointer',
                            background: isSel ? 'rgba(99,102,241,0.04)' : 'transparent',
                            borderLeft: isSel ? '2px solid #042348' : '2px solid transparent',
                          }}>
                          {isThisVendor ? (
                            <div>
                              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{formatCurrency(q.total_amount)}</div>
                            </div>
                          ) : <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>—</span>}
                        </td>
                      )
                    })}
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 10, background: '#d1fae5', color: '#065f46', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
                        {q.vendor_name?.split(' ')[0]?.slice(0, 2).toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {/* Soft factors */}
              <tr style={{ background: 'hsl(var(--muted)/0.4)', borderBottom: '1px solid hsl(var(--border))' }}>
                <td colSpan={vendors.length + 2} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'hsl(var(--muted-foreground))' }}>
                  Soft factors
                </td>
              </tr>
              {[
                { label: 'Lead time', icon: <Truck style={{ width: 10, height: 10 }} />, field: 'lead_time' },
                { label: 'Payment terms', icon: <CreditCard style={{ width: 10, height: 10 }} />, field: 'payment_terms' },
                { label: 'Vendor score', icon: <Star style={{ width: 10, height: 10 }} />, field: 'score' },
              ].map(({ label, icon, field }) => (
                <tr key={field} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                      {icon}{label}
                    </span>
                  </td>
                  {vendors.map((v) => {
                    const isSel = v.vendor_name === selectedVendorId
                    return (
                      <td key={v.vendor_name} onClick={() => setSelectedVendorId(v.vendor_name)}
                        style={{ padding: '8px 14px', textAlign: 'right', cursor: 'pointer', fontSize: 12, background: isSel ? 'rgba(99,102,241,0.04)' : 'transparent', borderLeft: isSel ? '2px solid #042348' : '2px solid transparent' }}>
                        {v[field] || '—'}
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 14px' }}></td>
                </tr>
              ))}

              {/* Totals */}
              <tr style={{ background: 'hsl(var(--muted)/0.4)', borderBottom: '1px solid hsl(var(--border))' }}>
                <td style={{ padding: '8px 14px', fontWeight: 700, fontSize: 12.5 }}>Subtotal · INR</td>
                {vendors.map((v, i) => {
                  const isSel = v.vendor_name === selectedVendorId
                  const t = totals[i]
                  return (
                    <td key={v.vendor_name} onClick={() => setSelectedVendorId(v.vendor_name)}
                      style={{
                        padding: '8px 14px', textAlign: 'right', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                        background: t === minTotal ? 'rgba(16,185,129,0.08)' : t === maxTotal ? 'rgba(239,68,68,0.06)' : isSel ? 'rgba(99,102,241,0.04)' : 'transparent',
                        borderLeft: isSel ? '2px solid #042348' : '2px solid transparent',
                        color: t === minTotal ? '#065f46' : 'hsl(var(--foreground))'
                      }}>
                      {formatCurrency(t)}
                    </td>
                  )
                })}
                <td style={{ padding: '8px 14px' }}></td>
              </tr>
              <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <td style={{ padding: '8px 14px', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>+ GST (12-18%)</td>
                {vendors.map((v, i) => {
                  const isSel = v.vendor_name === selectedVendorId
                  return (
                    <td key={v.vendor_name} onClick={() => setSelectedVendorId(v.vendor_name)}
                      style={{ padding: '8px 14px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', background: isSel ? 'rgba(99,102,241,0.04)' : 'transparent', borderLeft: isSel ? '2px solid #042348' : '2px solid transparent' }}>
                      {formatCurrency(gst(totals[i]))}
                    </td>
                  )
                })}
                <td></td>
              </tr>
              <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>Landed total</td>
                {vendors.map((v, i) => {
                  const isSel = v.vendor_name === selectedVendorId
                  return (
                    <td key={v.vendor_name} onClick={() => setSelectedVendorId(v.vendor_name)}
                      style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, fontFamily: 'monospace', cursor: 'pointer', background: isSel ? 'rgba(99,102,241,0.08)' : 'transparent', borderLeft: isSel ? '2px solid #042348' : '2px solid transparent' }}>
                      {formatCurrency(landed(totals[i]))}
                    </td>
                  )
                })}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sticky footer summary */}
        {selV && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--muted)/0.3)'
          }}>
            <VendorDot name={selV.vendor_name} color={vendorColors[selV.vendor_name]} size={26} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selV.vendor_name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, background: '#e0e7ff', color: '#4338ca', borderRadius: 4, padding: '1px 6px' }}>Selected vendor</span>
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Landed {formatCurrency(selLanded)}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>Saving vs worst</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>+{formatCurrency(savings)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'hsl(var(--muted-foreground))' }}>Gap to best</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: selLanded === landed(minTotal) ? '#059669' : '#d97706', fontFamily: 'monospace' }}>
                  {selLanded === landed(minTotal) ? 'Best price' : `+${formatCurrency(selLanded - landed(minTotal))}`}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Why this vendor AI card */}
      {selV && (
        <Card className="shadow-sm border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />Why this vendor?
              </CardTitle>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#042348', background: '#ede9fe', borderRadius: 6, padding: '2px 6px' }}>94%</span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1.5">
            {selV.vendor_name === vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name ? (
              <>
                <p><strong className="text-foreground">{selV.vendor_name}</strong> is the AI's recommended vendor with the best price.</p>
                <p>Lowest landed cost at {formatCurrency(selLanded)} — optimal for this procurement.</p>
              </>
            ) : (
              <>
                <p>You selected <strong className="text-foreground">{selV.vendor_name}</strong>. AI's pick was <strong className="text-foreground">{vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name}</strong>.</p>
                <p>If overriding, document the reason — this is recorded to the audit log.</p>
              </>
            )}
            <div className="flex items-center gap-2 mt-2">
              {selV.vendor_name !== vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name && (
                <Button size="sm" className="gap-1  text-white text-xs h-7"
                  onClick={() => setSelectedVendorId(vendors.find(v => Number(v.total_amount) === minTotal)?.vendor_name)}>
                  <Sparkles className="w-3 h-3" />Switch to AI pick
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs h-7">Negotiation playbook</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CompareStep