'use client'

import React, { useState } from 'react'
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
  Star,
  TrendingDown,
  TrendingUp,
  Activity,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type VendorId = 'mahindra' | 'tata' | 'sail'
type HighlightVariant = 'best' | 'worst' | 'warn' | 'neutral' | 'none'

interface Vendor {
  id: VendorId
  name: string
  recommended: boolean
  risk: boolean
  totalCost: number
  vendorScore: string | null
  paymentTerms: string
  deliveryLeadTime: string
  quoteValidUntil: string
  deliveryTerms: string
  deliveryTermsSub: string
  materialCost: number
  freightCharges: number | null
  totalQuoteValue: number
  steelGrade: string
  qualityPPM: string
  qualityPPMSub: string
  testCertificate: string
  onTimeDelivery: string
  rateContract: string
  rateContractSub: string
  overallLabel: string
  overallDesc: string
  overallIcon: React.ReactNode
  badge: { label: string; color: 'blue' | 'amber' } | null
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

const inr = (n: number) => '\u20b9' + n.toLocaleString('en-IN')

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const VENDORS: Vendor[] = [
  {
    id: 'mahindra',
    name: 'Mahindra Steel Ltd',
    recommended: true,
    risk: false,
    totalCost: 452000,
    vendorScore: '94 / 100',
    paymentTerms: 'Net 30 days',
    deliveryLeadTime: '12 working days',
    quoteValidUntil: '15 Mar 2025',
    deliveryTerms: 'FOR Manesar',
    deliveryTermsSub: 'Freight Included',
    materialCost: 436000,
    freightCharges: 14160,
    totalQuoteValue: 452000,
    steelGrade: 'HR Steel 3mm',
    qualityPPM: '0 PPM',
    qualityPPMSub: 'Zero Rejections',
    testCertificate: 'Available',
    onTimeDelivery: '96.2% OTD',
    rateContract: 'Active (2025)',
    rateContractSub: 'Price Protected',
    overallLabel: 'Best Overall',
    overallDesc: 'High score across all key parameters.\nStrong balance of price, quality & delivery.',
    overallIcon: <Trophy className="h-5 w-5 text-blue-600" />,
    badge: { label: '\u2605 Recommended', color: 'blue' },
  },
  {
    id: 'tata',
    name: 'Tata Metaliks',
    recommended: false,
    risk: false,
    totalCost: 489000,
    vendorScore: '78 / 100',
    paymentTerms: 'Net 45 days',
    deliveryLeadTime: '18 working days',
    quoteValidUntil: '20 Mar 2025',
    deliveryTerms: 'FOR Manesar',
    deliveryTermsSub: 'Freight Included',
    materialCost: 473000,
    freightCharges: 12500,
    totalQuoteValue: 489000,
    steelGrade: 'HR Steel 3mm',
    qualityPPM: '180 PPM',
    qualityPPMSub: 'Within Limit (\u2264250 PPM)',
    testCertificate: 'Available',
    onTimeDelivery: '82.5% OTD',
    rateContract: 'No Contract',
    rateContractSub: '',
    overallLabel: 'Balanced Option',
    overallDesc: 'Good performance with\nmoderate terms.',
    overallIcon: <Scale className="h-5 w-5 text-slate-600" />,
    badge: null,
  },
  {
    id: 'sail',
    name: 'SAIL Distributors',
    recommended: false,
    risk: true,
    totalCost: 398000,
    vendorScore: null,
    paymentTerms: '50% Advance',
    deliveryLeadTime: '21 working days',
    quoteValidUntil: '10 Mar 2025',
    deliveryTerms: 'Ex-Works Kanpur',
    deliveryTermsSub: 'Buyer Pays Freight',
    materialCost: 385000,
    freightCharges: null,
    totalQuoteValue: 398000,
    steelGrade: 'HR Steel 3mm',
    qualityPPM: '\u2014',
    qualityPPMSub: '',
    testCertificate: 'On Request',
    onTimeDelivery: 'No Data',
    rateContract: 'No Contract',
    rateContractSub: '',
    overallLabel: 'Low Cost Option',
    overallDesc: 'Lower price but higher\ncommercial risk.',
    overallIcon: <DollarSign className="h-5 w-5 text-amber-600" />,
    badge: { label: '\u26a0 Risk', color: 'amber' },
  },
]

const BUDGET = 500000

const SECTIONS: SectionDef[] = [
  {
    id: 'commercial',
    icon: <Tag className="h-3 w-3" />,
    label: 'Commercial Terms',
    rows: [
      {
        label: 'Payment Terms',
        cells: [
          { value: 'Net 30 days', sub: 'Standard terms', highlight: 'best' },
          { value: 'Net 45 days', sub: 'Best cash flow', highlight: 'best' },
          { value: '50% Advance', sub: '\u20b91,99,000 upfront', highlight: 'worst' },
        ],
      },
      {
        label: 'Delivery Lead Time',
        cells: [
          { value: '12 working days', sub: 'Fastest option', highlight: 'best' },
          { value: '18 working days', sub: '+6 days vs Mahindra' },
          { value: '21 working days', sub: '+9 days vs Mahindra', highlight: 'worst' },
        ],
      },
      {
        label: 'Quote Valid Until',
        cells: [
          { value: '15 Mar 2025', sub: '62 days remaining' },
          { value: '20 Mar 2025', sub: '67 days remaining' },
          { value: '10 Mar 2025', sub: '57 days \u2014 earliest', highlight: 'worst' },
        ],
      },
      {
        label: 'Delivery Terms',
        cells: [
          { value: 'FOR Manesar', sub: 'Freight Included', highlight: 'best' },
          { value: 'FOR Manesar', sub: 'Freight Included', highlight: 'best' },
          { value: 'Ex-Works Kanpur', sub: 'Buyer Pays Freight', highlight: 'worst' },
        ],
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
        cells: [{ value: inr(436000) }, { value: inr(473000) }, { value: inr(385000) }],
      },
      {
        label: 'Freight Charges',
        cells: [
          { value: inr(14160), sub: 'Included in quote', highlight: 'best' },
          { value: inr(12500), sub: 'Included in quote', highlight: 'best' },
          { value: 'Buyer to Arrange', sub: 'Est. +\u20b922,000\u201335,000', highlight: 'worst' },
        ],
      },
      {
        label: 'Total Quote Value',
        cells: [
          { value: <span className="text-base font-extrabold">{inr(452000)}</span> },
          { value: <span className="text-base font-extrabold">{inr(489000)}</span> },
          { value: <span className="text-base font-extrabold text-emerald-700">{inr(398000)}</span> },
        ],
      },
    ],
  },
  {
    id: 'quality',
    icon: <Wrench className="h-3 w-3" />,
    label: 'Material & Quality',
    rows: [
      {
        label: 'Steel Grade',
        cells: [
          { value: 'HR Steel 3mm', sub: 'IS 2062 Gr. E250' },
          { value: 'HR Steel 3mm', sub: 'IS 2062 Gr. E250' },
          { value: 'HR Steel 3mm', sub: 'IS 2062 Gr. E250' },
        ],
      },
      {
        label: 'Quality (PPM)',
        cells: [
          { value: '0 PPM', sub: 'Zero Rejections', highlight: 'best' },
          { value: '180 PPM', sub: 'Within Limit (\u2264250 PPM)' },
          { value: '\u2014' },
        ],
      },
      {
        label: 'Test Certificate',
        cells: [
          { value: 'Available', highlight: 'best' },
          { value: 'Available', highlight: 'best' },
          { value: 'On Request', highlight: 'warn' },
        ],
      },
    ],
  },
  {
    id: 'performance',
    icon: <Activity className="h-3 w-3" />,
    label: 'Reliability & Performance',
    rows: [
      {
        label: 'On-Time Delivery',
        cells: [
          { value: '96.2% OTD', sub: 'Best in category', highlight: 'best' },
          { value: '82.5% OTD', sub: 'Above average' },
          { value: 'No Data', sub: 'First transaction' },
        ],
      },
      {
        label: 'Rate Contract',
        cells: [
          { value: 'Active (2025)', sub: 'Price Protected', highlight: 'best' },
          { value: 'No Contract' },
          { value: 'No Contract' },
        ],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────

function colBg(v: Vendor) {
  if (v.recommended) return 'bg-blue-50/40'
  if (v.risk) return 'bg-amber-50/20'
  return 'bg-white'
}

function colBorder(v: Vendor) {
  if (v.recommended) return 'border-l-2 border-l-blue-300'
  if (v.risk) return 'border-l-2 border-l-amber-300'
  return 'border-l border-l-slate-100'
}

function highlightClass(h?: HighlightVariant) {
  switch (h) {
    case 'best': return 'text-emerald-700'
    case 'worst': return 'text-red-600'
    case 'warn': return 'text-amber-700'
    default: return 'text-slate-800'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table rows
// ─────────────────────────────────────────────────────────────────────────────

function SectionRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <tr>
      <td colSpan={VENDORS.length + 1} className="bg-slate-50 px-4 py-2 border-b border-slate-100">
        <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
          {icon}{label}
        </span>
      </td>
    </tr>
  )
}

function DataRow({ label, cells }: RowDef) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-2.5 align-top w-44">
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </td>
      {VENDORS.map((v, i) => {
        const cell = cells[i]
        return (
          <td key={v.id} className={cn('px-4 py-2.5 align-top text-sm', colBg(v), colBorder(v))}>
            <p className={cn('font-semibold leading-snug', highlightClass(cell?.highlight))}>
              {cell?.value ?? '\u2014'}
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
}: {
  vendor: Vendor
  vendorIndex: number
  selected: VendorId | null
  onSelect: (id: VendorId) => void
}) {
  const [expanded, setExpanded] = useState(vendorIndex === 0)
  const isSelected = selected === vendor.id

  return (
    <Card className={cn(
      'overflow-hidden',
      vendor.recommended && 'border-blue-300',
      vendor.risk && 'border-amber-300',
      !vendor.recommended && !vendor.risk && 'border-slate-200',
    )}>
      {/* Always-visible header — tap to expand */}
      <button
        className={cn('w-full text-left px-4 py-3 flex items-start justify-between gap-3', colBg(vendor))}
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-bold text-slate-800 text-sm">{vendor.name}</span>
            {vendor.badge && (
              <Badge className={cn(
                'text-[9px] px-1.5 py-0 font-bold',
                vendor.badge.color === 'blue' && 'bg-blue-600 text-white hover:bg-blue-600',
                vendor.badge.color === 'amber' && 'bg-amber-100 text-amber-700 border border-amber-400 hover:bg-amber-100',
              )}>
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
              <p className="text-[10px] text-slate-400">Vendor Score</p>
              <p className={cn(
                'text-sm font-bold',
                vendor.vendorScore === '94 / 100' && 'text-emerald-600',
                vendor.vendorScore === '78 / 100' && 'text-blue-600',
                !vendor.vendorScore && 'text-slate-300',
              )}>
                {vendor.vendorScore ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <span className="text-slate-400 mt-1 flex-shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expandable detail rows */}
      {expanded && (
        <div className="border-t border-slate-100">
          {SECTIONS.map((section) => (
            <div key={section.id}>
              <div className="bg-slate-50 px-4 py-1.5 flex items-center gap-2 border-b border-slate-100">
                <span className="text-slate-400">{section.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{section.label}</span>
              </div>
              {section.rows.map((row) => {
                const cell = row.cells[vendorIndex]
                return (
                  <div key={row.label} className="flex justify-between items-start px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500 flex-shrink-0 mr-4 pt-0.5 w-32">{row.label}</p>
                    <div className="text-right flex-1">
                      <p className={cn('text-xs font-semibold', highlightClass(cell?.highlight))}>
                        {cell?.value ?? '\u2014'}
                      </p>
                      {cell?.sub && <p className="text-[10.5px] text-slate-400 mt-0.5">{cell.sub}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Overall evaluation */}
          <div className={cn('px-4 py-3 border-t-2 border-slate-200 flex items-start gap-2.5', colBg(vendor))}>
            <div className="flex-shrink-0 mt-0.5">{vendor.overallIcon}</div>
            <div>
              <p className={cn(
                'font-bold text-sm',
                vendor.recommended && 'text-blue-700',
                vendor.risk && 'text-amber-700',
                !vendor.recommended && !vendor.risk && 'text-slate-700',
              )}>
                {vendor.overallLabel}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 whitespace-pre-line">{vendor.overallDesc}</p>
            </div>
          </div>

          {/* Select button */}
          <div className={cn('px-4 py-3 border-t border-slate-200', colBg(vendor))}>
            {isSelected ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Selected \u2014 {vendor.name.split(' ')[0]}
              </div>
            ) : (
              <Button
                onClick={() => onSelect(vendor.id)}
                className={cn(
                  'w-full font-bold',
                  vendor.recommended && 'bg-blue-600 hover:bg-blue-700',
                  vendor.risk && 'bg-amber-500 hover:bg-amber-600',
                  !vendor.recommended && !vendor.risk && 'bg-slate-600 hover:bg-slate-700',
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
    <div className={cn(
      'flex gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed text-slate-700',
      variant === 'default' && 'bg-white border-slate-200',
      variant === 'success' && 'bg-emerald-50 border-emerald-200',
      variant === 'warn' && 'bg-amber-50 border-amber-300',
      variant === 'danger' && 'bg-red-50 border-red-200',
    )}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sidebar panels
// ─────────────────────────────────────────────────────────────────────────────

function AIInsightsPanel() {
  return (
    <Card className="border-amber-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
        <Flame className="h-4 w-4 text-amber-300" />
        <span className="text-sm font-bold text-white">AI Insights</span>
        {/* <Badge className="ml-auto text-[9px] bg-white/20 text-white/80 hover:bg-white/20 border-0">Live</Badge> */}
      </div>
      <CardContent className="p-4 space-y-4 bg-amber-50/30">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Recommendation
          </p>
          <InsightItem icon={<span className="text-base">🏆</span>} variant="success">
            <strong>Mahindra Steel Ltd</strong> offers the best overall value with the highest score,{' '}
            <strong>competitive pricing</strong>, better delivery performance, and{' '}
            <strong>zero quality defects</strong> in the last 12 months.
          </InsightItem>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2 flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" /> Key Takeaways
          </p>
          <ul className="space-y-1.5 text-[12px] text-slate-600 leading-relaxed">
            {[
              <><strong>SAIL Distributors</strong> has the lowest price but requires advance payment and longer lead time.</>,
              <><strong>Mahindra Steel Ltd</strong> ensures faster delivery and better quality consistency.</>,
              <><strong>Tata Metaliks</strong> is a balanced option with moderate pricing and acceptable terms.</>,
            ].map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-300 mt-0.5 flex-shrink-0">&bull;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3" /> Risk Indicators
          </p>
          <div className="space-y-1.5">
            <InsightItem icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} variant="warn">
              <strong>SAIL requires 50% advance</strong> and has the highest commercial risk.
            </InsightItem>
            <InsightItem icon={<BarChart2 className="h-3.5 w-3.5 text-slate-400" />} variant="warn">
              <strong>No on-time delivery data</strong> available for SAIL Distributors.
            </InsightItem>
          </div>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
            <Target className="h-3 w-3" /> Decision Support
          </p>
          <InsightItem icon={<Lightbulb className="h-3.5 w-3.5 text-slate-400" />}>
            Consider total cost of ownership including delivery reliability, quality, and payment terms before finalizing.
          </InsightItem>
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetCard({ selectedVendor }: { selectedVendor: Vendor | null }) {
  const budgetPct = selectedVendor ? Math.round((selectedVendor.totalCost / BUDGET) * 100) : 0
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-[12.5px] font-bold text-slate-700">Budget Impact</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-slate-400">PR Budget</span>
            <span className="font-bold text-slate-700">{inr(BUDGET)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Selected Quote</span>
            <span className={cn('font-semibold', selectedVendor ? 'text-slate-700' : 'text-slate-300')}>
              {selectedVendor ? inr(selectedVendor.totalCost) : 'None selected'}
            </span>
          </div>
        </div>
        <Progress
          value={budgetPct}
          className={cn('h-2', budgetPct > 100 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500')}
        />
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">
            {selectedVendor ? `${budgetPct}% of budget` : 'Select a quote'}
          </span>
          {selectedVendor && budgetPct <= 100 && (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Within by {inr(BUDGET - selectedVendor.totalCost)}
            </span>
          )}
          {selectedVendor && budgetPct > 100 && (
            <span className="text-red-500 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Over by {inr(selectedVendor.totalCost - BUDGET)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const ComparisonTab = ({ prId }: { prId?: number | string | null }) => {
  const [selected, setSelected] = useState<VendorId | null>(null)
  const selectedVendor = VENDORS.find((v) => v.id === selected) ?? null

  return (
    <div className="bg-slate-50 min-h-screen space-y-5">


      {/* ── MOBILE layout: stacked accordion cards ── hidden on xl+ ─────── */}
      <div className="xl:hidden space-y-3">
        {VENDORS.map((v, i) => (
          <MobileVendorCard
            key={v.id}
            vendor={v}
            vendorIndex={i}
            selected={selected}
            onSelect={setSelected}
          />
        ))}

        {/* Selected banner */}
        {selectedVendor && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-800 truncate">Quote Selected: {selectedVendor.name}</p>
              <p className="text-xs text-emerald-600 mt-0.5 truncate">
                {inr(selectedVendor.totalCost)} &middot; {selectedVendor.deliveryLeadTime}
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

        <AIInsightsPanel />
        <BudgetCard selectedVendor={selectedVendor} />

        {/* <p className="text-[10.5px] text-slate-400 text-center pb-2">
          Last updated: 12 Feb 2025 &middot; 10:30 AM
        </p> */}
      </div>

      {/* ── DESKTOP layout: table + sidebar ── hidden below xl ───────────── */}
      <div className="hidden xl:flex gap-5 items-start">

        {/* Left: comparison table */}
        <div className="flex-1 min-w-0 space-y-5">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <ScrollArea className="w-full">
              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col style={{ width: 200 }} />
                  {VENDORS.map((v) => <col key={v.id} style={{ width: 210 }} />)}
                </colgroup>

                {/* Header */}
                <thead>
                  <tr>
                    <th className="bg-slate-50 border-b border-slate-200 px-4 py-3 text-left">
                      <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
                        Evaluation Criteria
                      </span>
                    </th>
                    {VENDORS.map((v) => (
                      <th
                        key={v.id}
                        className={cn(
                          'border-b border-slate-200 px-4 py-0 text-left align-top',
                          colBg(v), colBorder(v),
                          v.recommended && 'border-b-blue-200',
                          v.risk && 'border-b-amber-200',
                        )}
                      >
                        <div className="py-3.5">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-slate-800 text-[13.5px] leading-snug">{v.name}</span>
                            {v.badge && (
                              <Badge className={cn(
                                'text-[9.5px] px-1.5 py-0 font-bold',
                                v.badge.color === 'blue' && 'bg-blue-600 text-white hover:bg-blue-600',
                                v.badge.color === 'amber' && 'bg-amber-100 text-amber-700 border border-amber-400 hover:bg-amber-100',
                              )}>
                                {v.badge.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] text-slate-400 mb-0.5">Total Cost (\u20b9)</p>
                              <p className="text-xl font-extrabold text-slate-800 tracking-tight">{inr(v.totalCost)}</p>
                            </div>
                            <div>
                              <p className="text-[10.5px] text-slate-400">Vendor Score</p>
                              <p className={cn(
                                'text-sm font-bold',
                                v.vendorScore === '94 / 100' && 'text-emerald-600',
                                v.vendorScore === '78 / 100' && 'text-blue-600',
                                !v.vendorScore && 'text-slate-300',
                              )}>
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
                  {SECTIONS.map((section) => (
                    <React.Fragment key={section.id}>
                      <SectionRow icon={section.icon} label={section.label} />
                      {section.rows.map((row) => (
                        <DataRow key={row.label} {...row} />
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
                    {VENDORS.map((v) => (
                      <td key={v.id} className={cn('px-4 py-4 align-top', colBg(v), colBorder(v))}>
                        <div className="flex gap-2">
                          <div className="flex-shrink-0">{v.overallIcon}</div>
                          <div>
                            <p className={cn(
                              'font-bold text-sm',
                              v.recommended && 'text-blue-700',
                              v.risk && 'text-amber-700',
                              !v.recommended && !v.risk && 'text-slate-700',
                            )}>
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
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-4 bg-slate-50">
                      <p className="font-bold text-slate-700 text-[12.5px]">Select Quote</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Choose a vendor to proceed</p>
                    </td>
                    {VENDORS.map((v) => (
                      <td key={v.id} className={cn('px-4 py-4', colBg(v), colBorder(v))}>
                        {selected === v.id ? (
                          <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Selected &mdash; {v.name.split(' ')[0]}
                          </div>
                        ) : (
                          <Button
                            onClick={() => setSelected(v.id)}
                            className={cn(
                              'w-full font-bold transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                              v.recommended && 'bg-blue-600 hover:bg-blue-700',
                              v.risk && 'bg-amber-500 hover:bg-amber-600',
                              !v.recommended && !v.risk && 'bg-slate-600 hover:bg-slate-700',
                            )}
                          >
                            Select {v.name.split(' ')[0]}
                          </Button>
                        )}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>

          {/* Selected vendor banner */}
          {selectedVendor && (
            <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Quote Selected: {selectedVendor.name}</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {inr(selectedVendor.totalCost)} &middot; {selectedVendor.deliveryLeadTime} &middot; {selectedVendor.paymentTerms}
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
            All prices are exclusive of applicable taxes. Evaluation is based on provided quotations and historical performance.
          </p>
        </div>

        {/* Right: sidebar */}
        <div className="w-64 flex-shrink-0 space-y-4 sticky top-5">
          <AIInsightsPanel />
          <BudgetCard selectedVendor={selectedVendor} />
          {/* <p className="text-[10.5px] text-slate-400 text-center">
            Last updated: 12 Feb 2025 &middot; 10:30 AM
          </p> */}
        </div>
      </div>
    </div>
  )
}

export default ComparisonTab