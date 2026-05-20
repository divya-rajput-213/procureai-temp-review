/* ProcureAI design primitives — ported from /Procurement AI/ mockup.
   Maps the mockup's CSS variables onto Tailwind tokens:
     --violet → violet-600   --violet-soft → violet-50  --violet-line → violet-200
     --indigo → blue-600     --indigo-soft → blue-50    --indigo-line → blue-200
     --amber  → amber-700    --amber-soft  → amber-50   --amber-line  → amber-200
     --emerald→ emerald-600  --emerald-soft→ emerald-50 --emerald-line→ emerald-200
     --coral  → red-600      --coral-soft  → red-50     --coral-line  → red-200
     --ink    → slate-900    --ink-2 → slate-700  --ink-3 → slate-500  --ink-4 → slate-400
*/
'use client'

import React from 'react'
import { Sparkle, Check, AlertTriangle } from 'lucide-react'

// ── AI stripe banner ─────────────────────────────────────────────────────────
export function AIStripe({ children, action }: Readonly<{ children: React.ReactNode; action?: React.ReactNode }>) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-xs text-slate-700 bg-gradient-to-r from-violet-50 to-transparent border-l-2 border-violet-600 rounded">
      <Sparkle className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
      <div className="flex-1 leading-relaxed">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ── AI Card (violet gradient with ✦ glyph) ───────────────────────────────────
export function AICard({
  title, confidence, footer, children,
}: Readonly<{ title?: string; confidence?: number; footer?: React.ReactNode; children: React.ReactNode }>) {
  return (
    <div className="rounded-lg border border-violet-200 bg-gradient-to-b from-violet-50 to-white">
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-800">
        <span className="text-violet-600 italic font-serif text-base leading-none">✦</span>
        <span>{title || 'AI Insight'}</span>
        {confidence !== undefined && (
          <span className="ml-auto"><Confidence value={confidence} /></span>
        )}
      </div>
      <div className="px-3.5 pb-3.5 text-xs text-slate-700 leading-relaxed space-y-2">{children}</div>
      {footer && (
        <div className="px-3.5 pt-2.5 pb-3.5 border-t border-violet-200 mt-1 text-xs">{footer}</div>
      )}
    </div>
  )
}

// ── Confidence bar (with %) ──────────────────────────────────────────────────
export function Confidence({ value, label = true }: Readonly<{ value: number; label?: boolean }>) {
  const v = Math.max(0, Math.min(100, value))
  const fill = v >= 90 ? 'bg-emerald-500' : v >= 75 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-slate-700">
      <span className="w-9 h-1 bg-slate-200 rounded-full overflow-hidden">
        <span className={`block h-full rounded-full ${fill}`} style={{ width: `${v}%` }} />
      </span>
      {label && <span className="tabular-nums">{v}%</span>}
    </span>
  )
}

// ── Status pill (dotted) ─────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; tone: 'emerald' | 'amber' | 'gray' | 'red' | 'blue' | 'violet' }> = {
  verified: { label: 'Verified', tone: 'emerald' },
  approved: { label: 'Approved', tone: 'emerald' },
  awarded: { label: 'Awarded', tone: 'emerald' },
  paid: { label: 'Paid', tone: 'emerald' },
  received: { label: 'Received', tone: 'emerald' },
  'pending-verification': { label: 'Pending verify', tone: 'amber' },
  'pending-approval': { label: 'Pending approval', tone: 'amber' },
  pending_approval: { label: 'Pending approval', tone: 'amber' },
  pending: { label: 'Pending', tone: 'amber' },
  'in-comparison': { label: 'In comparison', tone: 'amber' },
  'in-transit': { label: 'In transit', tone: 'amber' },
  scheduled: { label: 'Scheduled', tone: 'amber' },
  draft: { label: 'Draft', tone: 'gray' },
  open: { label: 'Open', tone: 'gray' },
  rejected: { label: 'Rejected', tone: 'red' },
  dispute: { label: 'Dispute', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  in_progress: { label: 'In progress', tone: 'blue' },
  vendor_selected: { label: 'Vendor selected', tone: 'blue' },
  synced_to_sap: { label: 'Synced to SAP', tone: 'blue' },
  po_created: { label: 'PO created', tone: 'violet' },
}
export function StatusPill({ status, label }: Readonly<{ status: string; label?: string }>) {
  const entry = STATUS_MAP[status] || { label: status, tone: 'gray' as const }
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
  } as const
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${toneMap[entry.tone]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label || entry.label}
    </span>
  )
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
export function KPI({
  label, value, unit, delta, deltaLabel, icon,
}: Readonly<{
  label: string
  value: string | number
  unit?: string
  delta?: number
  deltaLabel?: string
  icon?: React.ReactNode
}>) {
  return (
    <div className="bg-white border rounded-lg p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5 text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
        {unit && <span className="text-xs text-slate-500 font-medium">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={`mt-1 flex items-center gap-1 text-[11.5px] ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          <span>{delta >= 0 ? '▲' : '▼'}</span>
          <span className="tabular-nums">{Math.abs(delta).toFixed(1)}%</span>
          {deltaLabel && <span className="text-slate-500">{deltaLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ── Filter chip (toolbar style) ──────────────────────────────────────────────
export function FilterChip({
  active, onClick, children, count,
}: Readonly<{ active?: boolean; onClick?: () => void; children: React.ReactNode; count?: number }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded border text-[11.5px] font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`tabular-nums text-[10.5px] ${active ? 'text-white/80' : 'text-slate-500'}`}>{count}</span>
      )}
    </button>
  )
}

// ── Vendor dot (initials with deterministic color) ───────────────────────────
function hashHue(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}
export function VDot({ name, size = 22 }: Readonly<{ name: string; size?: number }>) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('')
  const hue = hashHue(name || 'V')
  return (
    <span
      className="inline-flex items-center justify-center rounded font-bold font-mono text-white tracking-tight shrink-0"
      style={{
        background: `hsl(${hue} 55% 45%)`,
        width: size,
        height: size,
        fontSize: size <= 22 ? 10 : 12,
      }}
    >
      {initials || 'V'}
    </span>
  )
}

// ── Field key/value (used in cards) ─────────────────────────────────────────
export function FieldKV({ label, value, mono }: Readonly<{ label: string; value: React.ReactNode; mono?: boolean }>) {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xs text-slate-900 font-medium mt-0.5 ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </div>
    </div>
  )
}

// ── AI button (violet) ───────────────────────────────────────────────────────
export function AIButton({
  size = 'sm', icon = true, children, onClick, disabled,
}: Readonly<{ size?: 'sm' | 'md'; icon?: boolean; children: React.ReactNode; onClick?: () => void; disabled?: boolean }>) {
  const sizeCls = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 ${sizeCls} rounded-md font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
    >
      {icon && <span className="italic font-serif text-sm leading-none">✦</span>}
      {children}
    </button>
  )
}

// ── AI tile (used inside AICard for stats) ──────────────────────────────────
export function AITile({
  header, value, detail, tone = 'violet',
}: Readonly<{ header: React.ReactNode; value: React.ReactNode; detail?: React.ReactNode; tone?: 'violet' | 'emerald' | 'amber' | 'red' }>) {
  const toneMap = {
    violet: 'border-violet-200 from-violet-50 text-violet-700',
    emerald: 'border-emerald-200 from-emerald-50 text-emerald-700',
    amber: 'border-amber-200 from-amber-50 text-amber-700',
    red: 'border-red-200 from-red-50 text-red-700',
  } as const
  return (
    <div className={`rounded-lg border bg-gradient-to-b to-white p-3 ${toneMap[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">{header}</div>
      <div className="text-base font-semibold tracking-tight mt-1 text-slate-900">{value}</div>
      {detail && <div className="text-[11.5px] text-slate-600 mt-1">{detail}</div>}
    </div>
  )
}

// ── Validity meter ──────────────────────────────────────────────────────────
export function daysBetween(a: string | Date, b: string | Date) {
  if (!a || !b) return 0
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (Number.isNaN(ms)) return 0
  return Math.round(ms / 86400000)
}

// ── Generic verification check row ──────────────────────────────────────────
export function CheckRow({
  ok, label, hint,
}: Readonly<{ ok: boolean; label: string; hint?: string }>) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-dashed border-slate-200 last:border-0">
      {ok
        ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      }
      <span className="text-xs font-medium text-slate-800 flex-1">{label}</span>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  )
}
