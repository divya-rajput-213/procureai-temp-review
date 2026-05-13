'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  Trophy,
  Scale,
  DollarSign,
  Tag,
  Wrench,
  BarChart2,
  ShieldAlert,
  Lightbulb,
  Target,
  CheckCircle2,
  AlertTriangle,
  Info,
  Flame,
  TrendingDown,
  TrendingUp,
  Activity,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/lib/api/client'
import { useQuery } from '@tanstack/react-query'

// ─────────────────────────────────────────────────────────────────────────────
// Types (API)
// ─────────────────────────────────────────────────────────────────────────────

interface VsPriceDiff {
  amount_diff: number
  pct_diff: number
}

interface VendorPriceEntry {
  unit_price: number
  quantity: number
  total: number
  quotation_id: number
  is_lowest: boolean
  vs_best: VsPriceDiff
}

interface MatrixItem {
  master_item_id: number
  item_code: string
  item_name: string
  unit_of_measure: string
  hsn_code: string
  total_quantity: number
  vendor_prices: Record<string, VendorPriceEntry>
}

interface VsBestTotal {
  amount_diff: number
  pct_diff: number
  is_lowest: boolean
}

interface ApiVendor {
  vendor_id: number
  vendor_name: string
  quotation_id: number
  quotation_no: string | null
  total_amount: number
  material_cost: number
  freight_charges: number
  items_quoted: number
  cgst_rate: number
  sgst_rate: number
  igst_rate: number
  payment_terms: string
  payment_terms_display: string | null
  delivery_lead_time_days: number | null
  delivery_terms: string
  valid_until: string | null
  incoterms: string
  performance_score: number | null
  risk_score: number | null
  is_msme: boolean
  is_msme_certified: boolean
  vendor_status: string
  previous_po_count: number
  gst_number: string | null
  pan_number: string
  city: string
  state: string
  vs_best_total: VsBestTotal
}

interface AiRankingEntry {
  vendor_id: number
  vendor_name: string
  quotation_id: number
  overall_score: number
  overall_tag: string
  key_factors: Record<string, string>
  rationale: string
}

interface AiRecommended {
  vendor_id: number
  vendor_name: string
  quotation_id: number
  summary: string
}

interface AiRecommendation {
  ranking: AiRankingEntry[]
  recommended: AiRecommended
  key_takeaways: string[]
  risk_indicators: string[]
}

interface CompareApiResponse {
  matrix: {
    items: MatrixItem[]
    vendors: ApiVendor[]
  }
  ai_recommendation: AiRecommendation
}

// ─────────────────────────────────────────────────────────────────────────────
// Types (UI)
// ─────────────────────────────────────────────────────────────────────────────

type HighlightVariant = 'best' | 'worst' | 'warn' | 'neutral' | 'none'

interface DerivedVendor {
  key: string // `${vendor_id}-${quotation_id}`
  vendor_id: number
  quotation_id: number
  name: string
  recommended: boolean
  isHighRisk: boolean
  totalCost: number
  materialCost: number
  freightCharges: number
  vendorScore: string | null
  paymentTerms: string
  deliveryLeadTimeDays: number | null
  validUntil: string | null
  deliveryTerms: string
  incoterms: string
  cgstRate: number
  sgstRate: number
  igstRate: number
  isMsme: boolean
  vendorStatus: string
  previousPoCount: number
  city: string
  state: string
  overallScore: number
  overallTag: string
  rationale: string
  badge: { label: string; color: 'blue' | 'amber' | 'slate' } | null
  overallLabel: string
  overallDesc: string
  overallIcon: React.ReactNode
}

interface CellData {
  value: React.ReactNode
  sub?: React.ReactNode
  highlight?: HighlightVariant
}

interface RowDef {
  label: string
  cells: CellData[]
}

interface SectionDef {
  id: string
  icon: React.ReactNode
  label: string
  rows: RowDef[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const inr = (n: number) => '₹' + n.toLocaleString('en-IN')

function formatLeadTime(days: number | null): string {
  if (days == null) return 'Not specified'
  return `${days} working day${days !== 1 ? 's' : ''}`
}

function formatValidUntil(dateStr: string | null): string {
  if (!dateStr) return 'Not specified'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTaxRate(cgst: number, sgst: number, igst: number): string {
  if (igst > 0) return `IGST ${igst}%`
  if (cgst > 0 || sgst > 0) return `CGST ${cgst}% + SGST ${sgst}%`
  return 'No tax info'
}

// ─────────────────────────────────────────────────────────────────────────────
// Data transformation: API → UI
// ─────────────────────────────────────────────────────────────────────────────

function deriveVendors(data: CompareApiResponse): DerivedVendor[] {
  const { vendors } = data.matrix
  const { ranking, recommended } = data.ai_recommendation

  const lowestTotal = Math.min(...vendors.map((v) => v.total_amount))
  const highestTotal = Math.max(...vendors.map((v) => v.total_amount))

  return vendors.map((v, idx): DerivedVendor => {
    const rankEntry = ranking.find((r) => r.quotation_id === v.quotation_id)
    const isRecommended = v.quotation_id === recommended.quotation_id
    const isHighRisk = rankEntry?.overall_tag?.toLowerCase().includes('high risk') ?? false
    const overallScore = rankEntry?.overall_score ?? null
    const overallTag = rankEntry?.overall_tag ?? ''
    const rationale = rankEntry?.rationale ?? ''

    // Badge logic
    let badge: DerivedVendor['badge'] = null
    if (isRecommended) badge = { label: '★ Recommended', color: 'blue' }
    else if (isHighRisk) badge = { label: '⚠ Risk', color: 'amber' }

    // Overall evaluation label/desc/icon
    let overallLabel = 'Standard Option'
    let overallDesc = rationale
    let overallIcon: React.ReactNode = <Scale className="h-5 w-5 text-slate-600" />

    if (isRecommended) {
      overallLabel = 'Best Overall'
      overallIcon = <Trophy className="h-5 w-5 text-blue-600" />
    } else if (v.total_amount === lowestTotal) {
      overallLabel = 'Low Cost Option'
      overallDesc = 'Lower price but consider reliability.'
      overallIcon = <DollarSign className="h-5 w-5 text-amber-600" />
    } else if (isHighRisk) {
      overallLabel = 'High Risk'
      overallIcon = <AlertTriangle className="h-5 w-5 text-amber-600" />
    }

    return {
      key: `${v.vendor_id}-${v.quotation_id}`,
      vendor_id: v.vendor_id,
      quotation_id: v.quotation_id,
      name: v.vendor_name,
      recommended: isRecommended,
      isHighRisk,
      totalCost: v.total_amount,
      materialCost: v.material_cost,
      freightCharges: v.freight_charges,
      vendorScore: overallScore != null ? `${overallScore} / 100` : null,
      paymentTerms: v.payment_terms_display || v.payment_terms || 'Not specified',
      deliveryLeadTimeDays: v.delivery_lead_time_days,
      validUntil: v.valid_until,
      deliveryTerms: v.delivery_terms || 'Not specified',
      incoterms: v.incoterms || '',
      cgstRate: v.cgst_rate,
      sgstRate: v.sgst_rate,
      igstRate: v.igst_rate,
      isMsme: v.is_msme,
      vendorStatus: v.vendor_status,
      previousPoCount: v.previous_po_count,
      city: v.city,
      state: v.state,
      overallScore: overallScore ?? 0,
      overallTag,
      rationale,
      badge,
      overallLabel,
      overallDesc,
      overallIcon,
    }
  })
}

function deriveSections(vendors: DerivedVendor[], items: MatrixItem[]): SectionDef[] {
  const lowestLeadTime = Math.min(
    ...vendors.map((v) => v.deliveryLeadTimeDays ?? Infinity)
  )
  const lowestTotal = Math.min(...vendors.map((v) => v.totalCost))
  const highestTotal = Math.max(...vendors.map((v) => v.totalCost))

  return [
    {
      id: 'commercial',
      icon: <Tag className="h-3 w-3" />,
      label: 'Commercial Terms',
      rows: [
        {
          label: 'Vendor Status',
          cells: vendors.map((v) => ({
            value: v.vendorStatus.charAt(0).toUpperCase() + v.vendorStatus.slice(1),
            sub: `${v.previousPoCount} previous PO${v.previousPoCount !== 1 ? 's' : ''}`,
            highlight: (v.vendorStatus === 'active' ? 'best' : v.vendorStatus === 'new' ? 'warn' : 'neutral') as HighlightVariant,
          })),
        },
        {
          label: 'Payment Terms',
          cells: vendors.map((v) => ({
            value: v.paymentTerms || 'Not specified',
            highlight: (!v.paymentTerms || v.paymentTerms === 'Not specified' ? 'warn' : 'neutral') as HighlightVariant,
          })),
        },
        {
          label: 'Delivery Lead Time',
          cells: vendors.map((v) => ({
            value: formatLeadTime(v.deliveryLeadTimeDays),
            highlight: (
              v.deliveryLeadTimeDays == null
                ? 'warn'
                : v.deliveryLeadTimeDays === lowestLeadTime
                  ? 'best'
                  : 'neutral'
            ) as HighlightVariant,
          })),
        },
        {
          label: 'Quote Valid Until',
          cells: vendors.map((v) => ({
            value: formatValidUntil(v.validUntil),
            highlight: (!v.validUntil ? 'warn' : 'neutral') as HighlightVariant,
          })),
        },
        {
          label: 'Delivery Terms',
          cells: vendors.map((v) => ({
            value: v.deliveryTerms,
            sub: v.incoterms || undefined,
            highlight: (!v.deliveryTerms || v.deliveryTerms === 'Not specified' ? 'warn' : 'neutral') as HighlightVariant,
          })),
        },
        {
          label: 'Tax Structure',
          cells: vendors.map((v) => ({
            value: formatTaxRate(v.cgstRate, v.sgstRate, v.igstRate),
          })),
        },
      ],
    },
    {
      id: 'pricing',
      icon: <DollarSign className="h-3 w-3" />,
      label: 'Pricing Summary',
      rows: [
        {
          label: 'Material Cost',
          cells: vendors.map((v) => ({
            value: inr(v.materialCost),
            highlight: (
              v.materialCost === Math.min(...vendors.map((x) => x.materialCost)) ? 'best' : 'neutral'
            ) as HighlightVariant,
          })),
        },
        {
          label: 'Freight Charges',
          cells: vendors.map((v) => ({
            value: v.freightCharges > 0 ? inr(v.freightCharges) : '—',
            sub: v.freightCharges === 0 ? 'No freight listed' : undefined,
          })),
        },
        {
          label: 'Total Quote Value',
          cells: vendors.map((v) => ({
            value: (
              <span className={cn('text-base font-extrabold', v.totalCost === lowestTotal && 'text-emerald-700')}>
                {inr(v.totalCost)}
              </span>
            ),
            highlight: (
              v.totalCost === lowestTotal ? 'best' : v.totalCost === highestTotal ? 'worst' : 'neutral'
            ) as HighlightVariant,
          })),
        },
        {
          label: 'Items Quoted',
          cells: vendors.map((v) => {
            // Count how many items this vendor has a price for
            const quotedCount = items.filter(
              (item) => item.vendor_prices[String(v.vendor_id)] != null
            ).length
            return {
              value: `${quotedCount} / ${items.length}`,
              highlight: (quotedCount === items.length ? 'best' : quotedCount === 0 ? 'worst' : 'warn') as HighlightVariant,
            }
          }),
        },
      ],
    },
    ...(items.length > 0
      ? [
        {
          id: 'items',
          icon: <Wrench className="h-3 w-3" />,
          label: 'Item Prices',
          rows: items.map((item) => {
            const prices = vendors.map((v) => item.vendor_prices[String(v.vendor_id)])
            const validPrices = prices.filter(Boolean).map((p) => p!.unit_price)
            const minPrice = validPrices.length ? Math.min(...validPrices) : null
            const maxPrice = validPrices.length ? Math.max(...validPrices) : null

            return {
              label: item.item_name,
              cells: vendors.map((v) => {
                const entry = item.vendor_prices[String(v.vendor_id)]
                if (!entry) return { value: '—' }
                return {
                  value: inr(entry.unit_price),
                  sub: `Qty: ${entry.quantity} ${item.unit_of_measure}`,
                  highlight: (
                    entry.unit_price === minPrice && validPrices.length > 1
                      ? 'best'
                      : entry.unit_price === maxPrice && validPrices.length > 1
                        ? 'worst'
                        : 'neutral'
                  ) as HighlightVariant,
                }
              }),
            }
          }),
        },
      ]
      : []),
    {
      id: 'compliance',
      icon: <Activity className="h-3 w-3" />,
      label: 'Compliance & Credentials',
      rows: [
        {
          label: 'MSME Status',
          cells: vendors.map((v) => ({
            value: v.isMsme ? 'MSME Registered' : 'Not MSME',
            highlight: (v.isMsme ? 'best' : 'neutral') as HighlightVariant,
          })),
        },
        {
          label: 'Location',
          cells: vendors.map((v) => ({
            value: v.city && v.city !== 'N/A' ? `${v.city}, ${v.state}` : v.state || '—',
          })),
        },
      ],
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────

function colBg(v: DerivedVendor) {
  if (v.recommended) return 'bg-blue-50/40'
  if (v.isHighRisk) return 'bg-amber-50/20'
  return 'bg-white'
}

function colBorder(v: DerivedVendor) {
  if (v.recommended) return 'border-l-2 border-l-blue-300'
  if (v.isHighRisk) return 'border-l-2 border-l-amber-300'
  return 'border-l border-l-slate-100'
}

function highlightClass(h?: HighlightVariant) {
  switch (h) {
    case 'best':
      return 'text-emerald-700'
    case 'worst':
      return 'text-red-600'
    case 'warn':
      return 'text-amber-700'
    default:
      return 'text-slate-800'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table rows
// ─────────────────────────────────────────────────────────────────────────────

function SectionRow({ icon, label, colCount }: { icon: React.ReactNode; label: string; colCount: number }) {
  return (
    <tr>
      <td colSpan={colCount + 1} className="bg-slate-50 px-4 py-2 border-b border-slate-100">
        <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
          {icon}
          {label}
        </span>
      </td>
    </tr>
  )
}

function DataRow({ label, cells, vendors }: RowDef & { vendors: DerivedVendor[] }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-2.5 align-top w-44">
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </td>
      {vendors.map((v, i) => {
        const cell = cells[i]
        return (
          <td key={v.key} className={cn('px-4 py-2.5 align-top text-sm', colBg(v), colBorder(v))}>
            <p className={cn('font-semibold leading-snug', highlightClass(cell?.highlight))}>
              {cell?.value ?? '—'}
            </p>
            {cell?.sub && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{cell.sub}</p>}
          </td>
        )
      })}
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile vendor accordion card
// ─────────────────────────────────────────────────────────────────────────────

function MobileVendorCard({
  vendor,
  vendorIndex,
  selected,
  onSelect,
  sections,
}: {
  vendor: DerivedVendor
  vendorIndex: number
  selected: string | null
  onSelect: (key: string) => void
  sections: SectionDef[]
}) {
  const [expanded, setExpanded] = useState(vendorIndex === 0)
  const isSelected = selected === vendor.key

  return (
    <Card
      className={cn(
        'overflow-hidden',
        vendor.recommended && 'border-blue-300',
        vendor.isHighRisk && !vendor.recommended && 'border-amber-300',
        !vendor.recommended && !vendor.isHighRisk && 'border-slate-200',
      )}
    >
      <button
        className={cn('w-full text-left px-4 py-3 flex items-start justify-between gap-3', colBg(vendor))}
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-bold text-slate-800 text-sm">{vendor.name}</span>
            {vendor.badge && (
              <Badge
                className={cn(
                  'text-[9px] px-1.5 py-0 font-bold',
                  vendor.badge.color === 'blue' && 'bg-blue-600 text-white hover:bg-blue-600',
                  vendor.badge.color === 'amber' &&
                  'bg-amber-100 text-amber-700 border border-amber-400 hover:bg-amber-100',
                )}
              >
                {vendor.badge.label}
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-5">
            <div>
              <p className="text-[10px] text-slate-400">Total Cost</p>
              <p className="text-lg font-extrabold text-slate-800 tracking-tight">{inr(vendor.totalCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Score</p>
              <p
                className={cn(
                  'text-sm font-bold',
                  vendor.overallScore >= 80 && 'text-emerald-600',
                  vendor.overallScore >= 60 && vendor.overallScore < 80 && 'text-amber-600',
                  vendor.overallScore < 60 && 'text-red-600',
                  !vendor.vendorScore && 'text-slate-300',
                )}
              >
                {vendor.vendorScore ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <span className="text-slate-400 mt-1 flex-shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="bg-slate-50 px-4 py-1.5 flex items-center gap-2 border-b border-slate-100">
                <span className="text-slate-400">{section.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {section.label}
                </span>
              </div>
              {section.rows.map((row) => {
                const cell = row.cells[vendorIndex]
                return (
                  <div
                    key={row.label}
                    className="flex justify-between items-start px-4 py-2.5 border-b border-slate-100"
                  >
                    <p className="text-xs font-medium text-slate-500 flex-shrink-0 mr-4 pt-0.5 w-32">
                      {row.label}
                    </p>
                    <div className="text-right flex-1">
                      <p className={cn('text-xs font-semibold', highlightClass(cell?.highlight))}>
                        {cell?.value ?? '—'}
                      </p>
                      {cell?.sub && <p className="text-[10.5px] text-slate-400 mt-0.5">{cell.sub}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div className={cn('px-4 py-3 border-t-2 border-slate-200 flex items-start gap-2.5', colBg(vendor))}>
            <div className="flex-shrink-0 mt-0.5">{vendor.overallIcon}</div>
            <div>
              <p
                className={cn(
                  'font-bold text-sm',
                  vendor.recommended && 'text-blue-700',
                  vendor.isHighRisk && !vendor.recommended && 'text-amber-700',
                  !vendor.recommended && !vendor.isHighRisk && 'text-slate-700',
                )}
              >
                {vendor.overallLabel}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 whitespace-pre-line">
                {vendor.overallDesc}
              </p>
            </div>
          </div>

          <div className={cn('px-4 py-3 border-t border-slate-200', colBg(vendor))}>
            {isSelected ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Selected — {vendor.name.split(' ')[0]}
              </div>
            ) : (
              <Button
                onClick={() => onSelect(vendor.key)}
                className={cn(
                  'w-full font-bold',
                  vendor.recommended && 'bg-blue-600 hover:bg-blue-700',
                  vendor.isHighRisk && !vendor.recommended && 'bg-amber-500 hover:bg-amber-600',
                  !vendor.recommended && !vendor.isHighRisk && 'bg-slate-600 hover:bg-slate-700',
                )}
              >
                Select {vendor.name.split(' ')[0]}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Insight item
// ─────────────────────────────────────────────────────────────────────────────

function InsightItem({
  icon,
  children,
  variant = 'default',
}: {
  icon: React.ReactNode
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warn' | 'danger'
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed text-slate-700',
        variant === 'default' && 'bg-white border-slate-200',
        variant === 'success' && 'bg-emerald-50 border-emerald-200',
        variant === 'warn' && 'bg-amber-50 border-amber-300',
        variant === 'danger' && 'bg-red-50 border-red-200',
      )}
    >
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Insights panel — driven by API data
// ─────────────────────────────────────────────────────────────────────────────

function AIInsightsPanel({ aiRec }: { aiRec: AiRecommendation }) {
  return (
    <Card className="border-amber-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
        <Flame className="h-4 w-4 text-amber-300" />
        <span className="text-sm font-bold text-white">AI Insights</span>
      </div>
      <CardContent className="p-4 space-y-4 bg-amber-50/30">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Recommendation
          </p>
          <InsightItem icon={<span className="text-base">🏆</span>} variant="success">
            <strong>{aiRec.recommended.vendor_name}</strong> — {aiRec.recommended.summary}
          </InsightItem>
        </div>
        {aiRec.key_takeaways.length > 0 && (
          <>
            <Separator className="bg-amber-200" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2 flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" /> Key Takeaways
              </p>
              <ul className="space-y-1.5 text-[12px] text-slate-600 leading-relaxed">
                {aiRec.key_takeaways.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-300 mt-0.5 flex-shrink-0">&bull;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {aiRec.risk_indicators.length > 0 && (
          <>
            <Separator className="bg-amber-200" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3" /> Risk Indicators
              </p>
              <div className="space-y-1.5">
                {aiRec.risk_indicators.map((risk, i) => (
                  <InsightItem key={i} icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} variant="warn">
                    {risk}
                  </InsightItem>
                ))}
              </div>
            </div>
          </>
        )}
        <Separator className="bg-amber-200" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
            <Target className="h-3 w-3" /> Decision Support
          </p>
          <InsightItem icon={<Lightbulb className="h-3.5 w-3.5 text-slate-400" />}>
            Consider total cost of ownership including delivery reliability, quality, and payment terms before
            finalizing.
          </InsightItem>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget card
// ─────────────────────────────────────────────────────────────────────────────

function BudgetCard({
  selectedVendor,
  budget,
}: {
  selectedVendor: DerivedVendor | null
  budget: number
}) {
  const budgetPct = selectedVendor ? Math.round((selectedVendor.totalCost / budget) * 100) : 0
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-[12.5px] font-bold text-slate-700">Budget Impact</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-slate-400">PR Budget</span>
            <span className="font-bold text-slate-700">{inr(budget)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Selected Quote</span>
            <span className={cn('font-semibold', selectedVendor ? 'text-slate-700' : 'text-slate-300')}>
              {selectedVendor ? inr(selectedVendor.totalCost) : 'None selected'}
            </span>
          </div>
        </div>
        <Progress
          value={Math.min(budgetPct, 100)}
          className={cn('h-2', budgetPct > 100 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500')}
        />
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">
            {selectedVendor ? `${budgetPct}% of budget` : 'Select a quote'}
          </span>
          {selectedVendor && budgetPct <= 100 && (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Within by {inr(budget - selectedVendor.totalCost)}
            </span>
          )}
          {selectedVendor && budgetPct > 100 && (
            <span className="text-red-500 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Over by {inr(selectedVendor.totalCost - budget)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Error states
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      <p className="text-sm">Loading comparison data…</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <p className="text-sm font-medium">Failed to load comparison data.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
      <BarChart2 className="h-8 w-8" />
      <p className="text-sm">No quotation data available for comparison.</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const ComparisonTab = ({
  selectedQuotationIds,
  selected,
  setSelected,
  budget = 500000,
  showFooter = true,
}: {
  selectedQuotationIds: number[]
  selected: string | null
  setSelected: React.Dispatch<React.SetStateAction<string | null>>
  budget?: number
  showFooter?: boolean
}) => {
  const { data, isLoading, isError, refetch } = useQuery<CompareApiResponse>({
    queryKey: ['quotation-comparison', selectedQuotationIds],
    queryFn: async () => {
      const response = await apiClient.post('/quotations/compare/', {
        quotation_ids: selectedQuotationIds,
      })
      return response.data
    },
    enabled: selectedQuotationIds.length > 0,
  })

  const { vendors, sections } = useMemo(() => {
    if (!data) return { vendors: [], sections: [] }
    const v = deriveVendors(data)
    const s = deriveSections(v, data.matrix.items)
    return { vendors: v, sections: s }
  }, [data])

  useEffect(() => {
    if (vendors.length === 1 && !selected) {
      setSelected(vendors[0].key)
    }
  }, [vendors, selected, setSelected])

  const selectedVendor = vendors.find((v) => v.key === selected) ?? null

  // ── States ─────────────────────────────────────────────────────────────────

  if (!selectedQuotationIds.length) return <EmptyState />
  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!data || vendors.length === 0) return <EmptyState />

  const aiRec = data.ai_recommendation
  const isSingleQuotation = vendors?.length === 1
  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-50 min-h-screen space-y-5">
      {/* ── MOBILE layout ── */}
      <div className="xl:hidden space-y-3">
        {vendors.map((v, i) => (
          <MobileVendorCard
            key={v.key}
            vendor={v}
            vendorIndex={i}
            selected={selected}
            onSelect={setSelected}
            sections={sections}
          />
        ))}

        {selectedVendor && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-800 truncate">
                Quote Selected: {selectedVendor.name}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5 truncate">
                {inr(selectedVendor.totalCost)} &middot;{' '}
                {formatLeadTime(selectedVendor.deliveryLeadTimeDays)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100"
              onClick={() => setSelected(null)}
            >
              Change
            </Button>
          </div>
        )}
        <AIInsightsPanel aiRec={aiRec} />
        {/* <BudgetCard selectedVendor={selectedVendor} budget={budget} /> */}
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden xl:flex gap-5 items-start">
        {/* Left: comparison table */}
        <div className="flex-1 min-w-0 space-y-5">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <ScrollArea className="w-full">
              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col style={{ width: 200 }} />
                  {vendors.map((v) => (
                    <col key={v.key} style={{ width: 210 }} />
                  ))}
                </colgroup>

                {/* Header */}
                <thead>
                  <tr>
                    <th className="bg-slate-50 border-b border-slate-200 px-4 py-3 text-left">
                      <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
                        Evaluation Criteria
                      </span>
                    </th>
                    {vendors.map((v) => (
                      <th
                        key={v.key}
                        className={cn(
                          'border-b border-slate-200 px-4 py-0 text-left align-top',
                          colBg(v),
                          colBorder(v),
                          v.recommended && 'border-b-blue-200',
                          v.isHighRisk && !v.recommended && 'border-b-amber-200',
                        )}
                      >
                        <div className="py-3.5">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-slate-800 text-[13.5px] leading-snug">
                              {v.name}
                            </span>
                            {v.badge && (
                              <Badge
                                className={cn(
                                  'text-[9.5px] px-1.5 py-0 font-bold',
                                  v.badge.color === 'blue' && 'bg-blue-600 text-white hover:bg-blue-600',
                                  v.badge.color === 'amber' &&
                                  'bg-amber-100 text-amber-700 border border-amber-400 hover:bg-amber-100',
                                )}
                              >
                                {v.badge.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] text-slate-400 mb-0.5">Total Cost (₹)</p>
                              <p className="text-xl font-extrabold text-slate-800 tracking-tight">
                                {inr(v.totalCost)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10.5px] text-slate-400">Score</p>
                              <p
                                className={cn(
                                  'text-sm font-bold',
                                  v.overallScore >= 80 && 'text-emerald-600',
                                  v.overallScore >= 60 && v.overallScore < 80 && 'text-amber-600',
                                  v.overallScore < 60 && v.vendorScore && 'text-red-600',
                                  !v.vendorScore && 'text-slate-300',
                                )}
                              >
                                {v.vendorScore ?? 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {sections.map((section) => (
                    <React.Fragment key={section.id}>
                      <SectionRow icon={section.icon} label={section.label} colCount={vendors.length} />
                      {section.rows.map((row) => (
                        <DataRow key={row.label} {...row} vendors={vendors} />
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>

                <tfoot>
                  {/* Overall evaluation */}
                  <tr className="border-t-2 border-slate-200">
                    <td className="px-4 py-4 bg-slate-50 align-top">
                      <p className="font-bold text-slate-700 text-sm">Overall Evaluation</p>
                    </td>
                    {vendors.map((v) => (
                      <td key={v.key} className={cn('px-4 py-4 align-top', colBg(v), colBorder(v))}>
                        <div className="flex gap-2">
                          <div className="flex-shrink-0">{v.overallIcon}</div>
                          <div>
                            <p
                              className={cn(
                                'font-bold text-sm',
                                v.recommended && 'text-blue-700',
                                v.isHighRisk && !v.recommended && 'text-amber-700',
                                !v.recommended && !v.isHighRisk && 'text-slate-700',
                              )}
                            >
                              {v.overallLabel}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 whitespace-pre-line">
                              {v.overallDesc}
                            </p>
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Select quote */}
                  {showFooter && <tr className="border-t border-slate-200">
                    <td className="px-4 py-4 bg-slate-50">
                      <p className="font-bold text-slate-700 text-[12.5px]">Select Quote</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Choose a vendor to proceed</p>
                    </td>
                    {vendors.map((v) => (
                      <td key={v.key} className={cn('px-4 py-4', colBg(v), colBorder(v))}>
                        {selected === v.key ? (
                          <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Selected &mdash; {v.name.split(' ')[0]}
                          </div>
                        ) : (
                          <Button
                            onClick={() => setSelected(v.key)}
                            className={cn(
                              'w-full font-bold transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                              v.recommended && 'bg-blue-600 hover:bg-blue-700',
                              v.isHighRisk && !v.recommended && 'bg-amber-500 hover:bg-amber-600',
                              !v.recommended && !v.isHighRisk && 'bg-slate-600 hover:bg-slate-700',
                            )}
                          >
                            Select {v.name.split(' ')[0]}
                          </Button>
                        )}
                      </td>
                    ))}
                  </tr>}
                </tfoot>
              </table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>

          {selectedVendor && (
            <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">
                  Quote Selected: {selectedVendor.name}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {inr(selectedVendor.totalCost)} &middot;{' '}
                  {formatLeadTime(selectedVendor.deliveryLeadTimeDays)} &middot;{' '}
                  {selectedVendor.paymentTerms}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100"
                onClick={() => setSelected(null)}
              >
                Change
              </Button>
            </div>
          )}

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            All prices are exclusive of applicable taxes. Evaluation is based on provided quotations and
            historical performance.
          </p>
        </div>

        {/* Right: sidebar */}
        <div className="w-64 flex-shrink-0 space-y-4 sticky top-5">
          <AIInsightsPanel aiRec={aiRec} />
          {/* <BudgetCard selectedVendor={selectedVendor} budget={budget} /> */}
        </div>
      </div>
    </div>
  )
}

export default ComparisonTab