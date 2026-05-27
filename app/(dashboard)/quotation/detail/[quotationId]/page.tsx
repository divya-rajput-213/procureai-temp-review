'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, History, LayoutDashboard, List, Loader2, ScrollText } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { CommonConfirmModal } from '@/components/shared/CommonModal'


type ExtractedLineItem = {
  id?: number | string
  line_no: number
  item_name: string
  item_sub_name?: string
  hsn_sac: string
  quantity: number
  unit: string
  price_per_unit: number
  amount: number
  master_item_id?: number | null
  master_item_code?: string
  master_item_name?: string
  master_item_matched?: boolean
  item_code?: string
  item_status?: string
}

type Vendor = {
  id:number,
  company_name: string
  address: string
  city: string
  state: string
  pincode: string
  country: string
  contact_name: string
  contact_email: string
  contact_phone: string
  gst_number: string
  pan_number: string
  bank_name: string
  bank_account: string
  bank_ifsc: string
  vendor_code: string
}

type BillTo = {
  name: string
  address: string
  ref: string
  contact_no: string
  state: string
  email: string
  gst_number?: string
  pan_number?: string
  plant_name?: string
  plant_code?: string
}

type Quotation = {
  id: number | string
  quotation_no: string
  quotation_date: string
  valid_until: string | null
  ref_no: string
  status: string
  uploaded_by: string
  created_at: string
  pdf_url?: string
  place_of_supply: string
  customer_handling_by: string
  subtotal: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  igst_amount: number | null
  cgst_rate: number | null
  sgst_rate: number | null
  igst_rate: number | null
  grand_total: number | null
  amount_in_words: string
  terms: string[]
  internal_notes: string | null
  delivery_lead_time_days: number | null
  delivery_terms: string | null
  freight_charges: number | null
  warranty: string | null
  plant_id: number | null
  plant_name: string
  department_id: number | null
  department_name: string
  category_id: number | null
  category_name: string
  confidence_score?: number | null
  pr_no?: string
  pr_hash_id?: string | null
  buyer_details?: any
  category?: any
}

type QuotationDetails = {
  quotation: Quotation | null
  vendor: Vendor | null
  bill_to: BillTo | null
  items: ExtractedLineItem[]
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapLineItem(raw: any, index: number): ExtractedLineItem {
  const quantity = toNumber(raw.quantity, 0)
  const pricePerUnit = toNumber(raw.item_price ?? raw.price_per_unit ?? raw.unit_price, 0)
  const amount = toNumber(raw.total_price ?? raw.amount ?? raw.line_total, quantity * pricePerUnit)
  return {
    id: raw.id,
    line_no: index + 1,
    item_name: raw.item_name ?? '—',
    item_sub_name: raw.item_sub_name ?? raw.description ?? raw.item_description ?? undefined,
    hsn_sac: raw.hsn_code ?? raw.hsn_sac ?? '—',
    quantity,
    unit: raw.unit_of_measure ?? raw.unit ?? '—',
    price_per_unit: pricePerUnit,
    amount,
    master_item_id: raw.master_item_id ?? null,
    master_item_code: raw.master_item_code ?? '',
    master_item_name: raw.master_item_name ?? '',
    master_item_matched: raw.master_item_matched ?? false,
    item_code: raw.item_code ?? '',
    item_status: raw.status ?? '',
  }
}

function extractLineItems(raw: any): ExtractedLineItem[] {
  return Array.isArray(raw?.items) ? raw.items.map(mapLineItem) : []
}

function mapVendor(raw: any): Vendor | null {
  const v = raw?.vendor ?? raw
  if (!v) return null
  return {
    id:v.id,
    company_name: v.company_name ?? raw?.vendor_name ?? '—',
    address: v.address ?? raw?.vendor_address ?? '',
    city: v.city ?? '',
    state: v.state ?? '',
    pincode: v.pincode ?? '',
    country: v.country ?? '',
    contact_name: v.contact_name ?? raw?.reference_person ?? '',
    contact_email: v.contact_email ?? raw?.contact_email ?? '',
    contact_phone: v.contact_phone ?? raw?.contact_no ?? '',
    gst_number: v.gst_number ?? raw?.gst_number ?? '',
    pan_number: v.pan_number ?? raw?.pan_number ?? '',
    bank_name: v.bank_name ?? '',
    bank_account: v.bank_account ?? '',
    bank_ifsc: v.bank_ifsc ?? '',
    vendor_code: v.vendor_code ?? ""
  }
}

function mapBillTo(raw: any): BillTo | null {
  const b = raw?.bill_to ?? raw?.customer ?? raw?.buyer_details ?? raw
  if (!b) return null
  const addressParts = [b.address || b.plant_address, b.city || b.plant_city, b.state || b.plant_state, b.country].filter(Boolean)
  return {
    name: b.company_name ?? b.name ?? '—',
    email: b.contact_email ?? '',
    address: addressParts.join(', '),
    ref: b.contact_name ?? '',
    contact_no: b.contact_phone ?? '',
    state: b.state ?? b.plant_state ?? '',
    gst_number: b.gst_number ?? '',
    pan_number: b.pan_number ?? '',
    plant_name: b.plant_name ?? '',
    plant_code: b.plant_code ?? '',
  }
}

function mapQuotation(raw: any): Quotation {
  const v = raw?.vendor ?? {}
  const taxes = raw?.taxes ?? raw?.totals ?? {}
  return {
    id: raw.id,
    quotation_no: v.quotation_no ?? raw.quotation_no ?? raw.ref_no ?? '—',
    quotation_date: v.quotation_date ?? raw.quotation_date ?? '—',
    ref_no: raw.ref_no ?? '—',
    status: raw.status ?? 'draft',
    uploaded_by: raw.uploaded_by ?? '—',
    created_at: raw.created_at ?? raw.uploaded_at ?? '',
    pdf_url: raw.pdf_url ?? raw.file_url ?? raw.document_url,
    place_of_supply: raw.place_of_supply ?? '—',
    customer_handling_by: raw.customer_handling_by ?? '—',
    subtotal: nullableNumber(taxes.subtotal ?? raw.subtotal),
    cgst_amount: nullableNumber(taxes.cgst_amount ?? raw.cgst_amount ?? raw.cgst),
    sgst_amount: nullableNumber(taxes.sgst_amount ?? raw.sgst_amount ?? raw.sgst),
    igst_amount: nullableNumber(taxes.igst_amount ?? raw.igst_amount ?? raw.igst),
    cgst_rate: nullableNumber(taxes.cgst_rate ?? raw.cgst_rate),
    sgst_rate: nullableNumber(taxes.sgst_rate ?? raw.sgst_rate),
    igst_rate: nullableNumber(taxes.igst_rate ?? raw.igst_rate),
    grand_total: nullableNumber(taxes.grand_total ?? raw.grand_total ?? raw.total),
    amount_in_words: raw.amount_in_words ?? '',
    terms: Array.isArray(raw.terms_and_conditions)
      ? raw.terms_and_conditions
      : typeof raw.terms_and_conditions === 'string'
        ? raw.terms_and_conditions.split(/\r?\n/).filter(Boolean)
        : [],
    internal_notes: raw.internal_notes ?? null,
    valid_until: raw.valid_until ?? null,
    delivery_lead_time_days: nullableNumber(raw.delivery_lead_time_days),
    delivery_terms: raw.delivery_terms || null,
    freight_charges: nullableNumber(raw.freight_charges),
    warranty: raw.warranty || null,
    plant_id: raw.plant ?? null,
    plant_name: raw.plant_name ?? '',
    department_id: raw.department ?? null,
    department_name: raw.department_name ?? '',
    category_id: raw.category ?? null,
    pr_no: raw.pr_no ?? '',
    pr_hash_id: raw.pr_hash_id ?? raw.pr_id ?? null,
    category_name: raw.category_name ?? '',
    buyer_details: raw.buyer_details ?? null,
    confidence_score: nullableNumber(raw.confidence_score ?? raw.ai_confidence ?? raw.confidence),
    category: raw.category ?? null

  }
}


// ── Styles ──────────────────────────────────────────────────────────────────

const QD_CSS = `
  *,*::before,*::after{box-sizing:border-box}
  :root{
    --bg:#fff;--bg-s:#f8f8f6;--bg-t:#f2f1ee;
    --tx:#1a1a18;--tx2:#5a5a57;--tx3:#9a9a96;
    --bd:rgba(0,0,0,0.08);--bdm:rgba(0,0,0,0.14);
    --r:8px;--rl:12px;
    --mono:'DM Mono',monospace;
    --blu-bg:#E6F1FB;--blu-tx:#0C447C;--blu-bd:#185FA5;
    --amb-bg:#FAEEDA;--amb-tx:#854F0B;--amb-bd:#BA7517;
    --red-bg:#FCEBEB;--red-tx:#A32D2D;--red-bd:#E24B4A;
    --grn-bg:#EAF3DE;--grn-tx:#3B6D11;--grn-bd:#639922;
    --tel-bg:#E1F5EE;--tel-tx:#0F6E56;--tel-bd:#1D9E75;
    --gry-bg:#F1EFE8;--gry-tx:#5F5E5A;--gry-bd:#888780;
    --pur-bg:#EEEDFE;--pur-tx:#3C3489;--pur-bd:#7F77DD;
  }
  .qd-btn{padding:8px 16px;border-radius:var(--r);border:0.5px solid var(--bdm);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:var(--tx);transition:background .15s}
  .qd-btn:hover{background:var(--bg-t)}
  .qd-btn:disabled{opacity:.5;cursor:not-allowed}
  .rhm-lbl{font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
  .stat-mini{background:var(--bg-s);border-radius:var(--r);padding:12px 14px}
  .sm-lbl{font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
  .sm-val{font-size:24px;font-weight:600;letter-spacing:-.6px;line-height:1}
  .pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px}
  .pill .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .p-draft{background:var(--gry-bg);color:var(--gry-tx)}.p-draft .dot{background:var(--gry-bd)}
  .p-review{background:var(--blu-bg);color:var(--blu-tx)}.p-review .dot{background:var(--blu-bd)}
  .p-pending{background:var(--amb-bg);color:var(--amb-tx)}.p-pending .dot{background:var(--amb-bd)}
  .p-approved{background:var(--grn-bg);color:var(--grn-tx)}.p-approved .dot{background:var(--grn-bd)}
  .p-rejected{background:var(--red-bg);color:var(--red-tx)}.p-rejected .dot{background:var(--red-bd)}
  .p-eval{background:#EFF6FF;color:#1D4ED8}.p-eval .dot{background:#3B82F6}
  .p-shortlist{background:var(--tel-bg);color:var(--tel-tx)}.p-shortlist .dot{background:var(--tel-bd)}
  .p-po{background:#F5F3FF;color:#6D28D9}.p-po .dot{background:#7C3AED}
  .tag{font-size:12px;font-weight:600;padding:3px 9px;border-radius:20px;display:inline-block;white-space:nowrap}
  .t-new{background:var(--grn-bg);color:var(--grn-tx)}
  .t-match{background:var(--blu-bg);color:var(--blu-tx)}
  .t-replace{background:var(--amb-bg);color:var(--amb-tx)}
  .t-skip{background:var(--gry-bg);color:var(--gry-tx)}
  .vendor-link-cell{all:unset;display:block;cursor:pointer;text-align:left;border-right:0.5px solid var(--bd);padding:0 14px;transition:background .15s}
  .vendor-link-cell:hover{background:var(--bg-s)}
  .match-tbl{width:100%;border-collapse:collapse;font-size:14px}
  .match-tbl thead th{padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.4px;background:var(--bg-s);border-bottom:0.5px solid var(--bd);white-space:nowrap}
  .match-tbl tbody tr{border-bottom:0.5px solid var(--bd);transition:background .1s}
  .match-tbl tbody tr:last-child{border-bottom:none}
  .match-tbl tbody tr:hover{background:#fafaf8}
  .match-tbl td{padding:11px 12px;vertical-align:top}
  td.match-tfoot{padding:10px 12px;font-size:13px;background:var(--bg-s);border-top:0.5px solid var(--bdm)}
  @media(max-width:900px){
    .hero-grid{grid-template-columns:1fr 1fr!important}
    .qd-action-bar{flex-direction:column;align-items:flex-start!important;gap:10px}
    .qd-action-bar>div{flex-wrap:wrap}
  }
  @media(max-width:600px){
    .hero-grid{grid-template-columns:1fr!important}
    .vendor-link-cell{border-right:none;border-bottom:0.5px solid var(--bd);padding-bottom:12px;margin-bottom:2px}
    .qd-info-cell{border-right:none!important;border-bottom:0.5px solid var(--bd);padding-bottom:12px;margin-bottom:2px}
    .qd-info-cell:last-child{border-bottom:none}
    .qd-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch}
  }
`

// ── Presentation helpers ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#EEEDFE', tx: '#3C3489' },
  { bg: '#E6F1FB', tx: '#0C447C' },
  { bg: '#E1F5EE', tx: '#0F6E56' },
  { bg: '#FAEEDA', tx: '#854F0B' },
  { bg: '#EAF3DE', tx: '#3B6D11' },
  { bg: '#E4F3F1', tx: '#0D6E68' },
  { bg: '#F1EFE8', tx: '#5F5E5A' },
]

function getVendorAvatar(name: string) {
  const words = (name || '?').split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const hash = Array.from(name || '').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0)
  return { initials, ...AVATAR_COLORS[hash % AVATAR_COLORS.length] }
}

const STATUS_PILL: Record<string, { cls: string; label: string }> = {
  draft:            { cls: 'p-draft',     label: 'Draft' },
  approved:         { cls: 'p-approved',  label: 'Approved' },
  under_evaluation: { cls: 'p-eval',      label: 'Under Evaluation' },
  shortlisted:      { cls: 'p-shortlist', label: 'Shortlisted' },
  po_raised:        { cls: 'p-po',        label: 'PO Raised' },
  rejected:         { cls: 'p-rejected',  label: 'Rejected' },
  not_selected:     { cls: 'p-rejected',  label: 'Rejected' },
  // legacy
  under_review:     { cls: 'p-review',    label: 'Under Review' },
  'under review':   { cls: 'p-review',    label: 'Under Review' },
  pending_approval: { cls: 'p-pending',   label: 'Pending Approval' },
  'pending approval':{ cls: 'p-pending',  label: 'Pending Approval' },
  pending:          { cls: 'p-pending',   label: 'Pending Approval' },
}

function getStatusPill(status: string) {
  return STATUS_PILL[status?.toLowerCase()] ?? { cls: 'p-draft', label: status ?? 'Draft' }
}

function fmtDate(raw: string | undefined | null): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// ── Component ───────────────────────────────────────────────────────────────

export default function QuotationDetailsPage({ params }: Readonly<{ params: { quotationId: string } }>) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('items')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading, isError } = useQuery<QuotationDetails>({
    queryKey: ['quotation', params.quotationId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/quotations/${params.quotationId}/`)
      return {
        quotation: data ? mapQuotation(data) : null,
        vendor: mapVendor(data),
        bill_to: mapBillTo(data?.buyer_details),
        items: extractLineItems(data),
      }
    },
  })

  const quotation = data?.quotation ?? null
  const vendor = data?.vendor ?? null
  const items = useMemo(() => data?.items ?? [], [data?.items])

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const response = await apiClient.post(
        '/quotations/export-new-items/',
        {
          items: items.map((item: any) => ({
            item_code: item.item_code ?? '',
            item_name: item.item_name ?? '',
            item_price: item.price_per_unit ?? 0,
            quantity: item.quantity ?? 1,
            unit_of_measure: item.unit ?? '',
            hsn_code: item.hsn_sac ?? '',
            suggestions: [],
            is_new: false,
            is_duplicate: false,
          })),
          format: 'excel',
        },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `quotation-items-${params.quotationId}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setShowExportModal(false)
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadGeneratedPdf = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get(`quotations/${quotation?.id}/generate-pdf/`)
      if (data?.pdf_url) window.open(data.pdf_url, '_blank')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  const displaySubtotal = useMemo(() => items.reduce((sum, it) => sum + Number(it.amount || 0), 0), [items])

  const displayCgstRate = quotation?.cgst_rate ?? null
  const displaySgstRate = quotation?.sgst_rate ?? null
  const displayCgstAmount = displayCgstRate != null
    ? (quotation?.cgst_amount ?? displaySubtotal * (displayCgstRate / 100))
    : null
  const displaySgstAmount = displaySgstRate != null
    ? (quotation?.sgst_amount ?? displaySubtotal * (displaySgstRate / 100))
    : null
  const backendIgstAmount = quotation?.igst_amount ?? null
  const backendIgstRate = quotation?.igst_rate ?? null
  const displayIgstAmount = backendIgstAmount ?? 0
  const displayGrandTotal = quotation?.grand_total
    ?? displaySubtotal + (displayCgstAmount ?? 0) + (displaySgstAmount ?? 0) + (backendIgstAmount ?? 0)

  const displayTerms = useMemo(() => {
    const raw = quotation?.terms ?? []
    return raw
      .map(t => String(t ?? '').replace(/^\d+[).]\s*/, '').trim())
      .filter(Boolean)
  }, [quotation?.terms])


  // ── Loading / error / not-found states ──────────────────────────────────

  if (isLoading) {
    return (
      <div className="qd-root" style={{ padding: 32, textAlign: 'center', color: 'var(--tx3,#9a9a96)', fontSize: 14 }}>
        <style>{QD_CSS}</style>
        Loading quotation…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="qd-root" style={{ padding: 32, textAlign: 'center', color: 'var(--red-tx,#A32D2D)', fontSize: 14 }}>
        <style>{QD_CSS}</style>
        Failed to load quotation details.
      </div>
    )
  }

  if (!quotation) {
    return (
      <div className="qd-root">
        <style>{QD_CSS}</style>
        <button className="qd-btn" onClick={() => router.push('/quotation')}>
          <i className="ti ti-arrow-left" /> All Quotations
        </button>
        <div style={{ marginTop: 24, padding: 32, textAlign: 'center', color: 'var(--tx3)', fontSize: 13, background: 'var(--bg)', border: '0.5px solid var(--bd)', borderRadius: 'var(--rl)' }}>
          No quotation found for id <span style={{ fontFamily: 'var(--mono)' }}>{params.quotationId}</span>.
        </div>
      </div>
    )
  }

  const avatar = getVendorAvatar(vendor?.company_name ?? '')
  const { cls: statusCls, label: statusLabel } = getStatusPill(quotation.status)

  return (
    <div className="qd-root">
      <style>{QD_CSS}</style>

      {/* Action bar */}
      <div
        className="qd-action-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <button
            className="qd-btn"
            onClick={() => {
              if (!quotation.pr_no)
                router.push(`/quotation/edit/${params.quotationId}`)
            }}
            disabled={!!quotation.pr_no}
            title={
              quotation.pr_no
                ? `Linked to PR ${quotation.pr_no} — cannot edit`
                : 'Edit quotation'
            }
          >
            <i className="ti ti-pencil" /> Edit
          </button>

          <button
            className="qd-btn"
            onClick={handleDownloadGeneratedPdf}
            disabled={loading}
          >
            {loading ? (
              <Loader2
                className="w-3 h-3 animate-spin"
                style={{ display: 'inline' }}
              />
            ) : (
              <i className="ti ti-download" />
            )}
            {' '}Download PDF
          </button>

          <button
            className="qd-btn"
            onClick={() =>
              quotation.pdf_url && window.open(quotation.pdf_url, '_blank')
            }
          >
            <i className="ti ti-eye" /> Preview PDF
          </button>

        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--bg)', border: '0.5px solid var(--bd)', borderRadius: 'var(--rl)', padding: 22, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: avatar.bg, color: avatar.tx, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {avatar.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.4px' }}>
                Quotation — {quotation.ref_no}
              </div>
              <span className={`pill ${statusCls}`}>
                <span className="dot" />
                {statusLabel}
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--tx2)' }}>
               Submitted {fmtDate(quotation.created_at)}
            </div>
          </div>
        </div>

        {/* Row 1: Vendor / Vendor Contact / Plant-Dept-Category */}
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '0.5px solid var(--bd)', paddingTop: 14 }}>
          <button
            type="button"
            className="vendor-link-cell"
            onClick={() => window.open(`/vendors/${vendor?.id}`, '_blank')}
            title="Open vendor in new tab"
          >
            <div className="rhm-lbl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Vendor <i className="ti ti-arrow-up-right" style={{ fontSize: 9, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blu-tx)' }}>
              {vendor?.company_name || '—'}
              {(vendor?.city || vendor?.state) && (
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--tx3)', marginLeft: 6 }}>
                  {[vendor?.city, vendor?.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </button>
          <div className="qd-info-cell" style={{ padding: '0 14px', borderLeft: '0.5px solid var(--bd)' }}>
            <div className="rhm-lbl">Vendor Contact</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{vendor?.contact_name || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 1 }}>
              {[vendor?.contact_email, vendor?.contact_phone ? `+${vendor.contact_phone}` : null].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="qd-info-cell" style={{ padding: '0 14px', borderLeft: '0.5px solid var(--bd)' }}>
            <div className="rhm-lbl">Plant / Department / Category</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {[quotation?.plant_name, quotation?.department_name, quotation?.category_name || (quotation?.category ? String(quotation.category) : null)].filter(Boolean).join(' / ') || '—'}
            </div>
          </div>
        </div>

        {/* Row 2: Quote Date / Valid Until / Grand Total / PR Linked */}
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '0.5px solid var(--bd)', paddingTop: 14, marginTop: 14 }}>
          <div className="qd-info-cell" style={{ padding: '0 14px', borderRight: '0.5px solid var(--bd)' }}>
            <div className="rhm-lbl">Quote Date</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtDate(quotation.quotation_date)}</div>
          </div>
          <div className="qd-info-cell" style={{ padding: '0 14px', borderRight: '0.5px solid var(--bd)' }}>
            <div className="rhm-lbl">Valid Until</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtDate(quotation.valid_until)}</div>
          </div>
          <div className="qd-info-cell" style={{ padding: '0 14px', borderRight: '0.5px solid var(--bd)' }}>
            <div className="rhm-lbl">Grand Total</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tel-tx)' }}>{formatINR(displayGrandTotal)}</div>
          </div>
          <div style={{ padding: '0 14px' }}>
            <div className="rhm-lbl">PR Linked</div>
            {quotation.pr_hash_id
              ? <Link href={`/procurement/${quotation.pr_hash_id}`} style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--primary))', textDecoration: 'none' }}>{quotation.pr_no || quotation.pr_hash_id}</Link>
              : <div style={{ fontSize: 14, fontWeight: 500 }}>{quotation.pr_no || '—'}</div>
            }
          </div>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="qd-tabs flex w-full border border-[rgba(0,0,0,0.08)] rounded-t-xl overflow-hidden bg-white">
        {([
          { id: 'items', label: 'Line Items', icon: <List className="w-[14px] h-[14px]" />, badge: items.length },
          { id: 'terms', label: 'Terms & Conditions', icon: <ScrollText className="w-[14px] h-[14px]" /> },
        ] as { id: string; label: string; icon: React.ReactNode; badge?: number }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center justify-center gap-1.5
              px-5 py-[11px]
              text-[13px] font-medium
              transition-colors
              border-b-[2.5px]
              whitespace-nowrap
              ${activeTab === tab.id
                ? 'text-[#042348] border-[#042348] bg-white'
                : 'text-[#9a9a96] border-transparent hover:bg-[#f8f8f6] hover:text-[#042348]'}
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-[#042348] text-white' : 'bg-[#f2f1ee] text-[#9a9a96]'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab pane container */}
      <div className="border border-[rgba(0,0,0,0.08)] border-t-0 rounded-b-xl bg-white mb-4 overflow-hidden">

        {/* ── Line Items ── */}
        {activeTab === 'items' && (
          <div style={{ overflowX: 'auto' }}>
          <table className="match-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>HSN</th>
                <th>Master Item</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id ?? idx}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx3)' }}>{String(idx + 1).padStart(2, '0')}</td>
                  <td style={{ fontWeight: 500 }}>
                    {item.item_name}
                    {item.item_sub_name && (
                      <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{item.item_sub_name}</div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx3)' }}>{item.hsn_sac}</td>
                  <td>
                    {item.master_item_name
                      ? <><div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--blu-tx)' }}>{item.master_item_code || '—'}</div><div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 1 }}>{item.master_item_name}</div></>
                      : <span style={{ color: 'var(--tx3)', fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ color: 'var(--tx3)' }}>{item.unit}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatINR(item.price_per_unit)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="match-tfoot" style={{ fontWeight: 600, textAlign: 'right', color: 'var(--tx2)' }}>Sub Total</td>
                <td className="match-tfoot" style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(displaySubtotal)}</td>
              </tr>
              <tr>
                <td colSpan={7} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>
                  CGST{displayCgstRate != null ? ` @ ${displayCgstRate}%` : ''}
                </td>
                <td className="match-tfoot" style={{ textAlign: 'right', color: displayCgstAmount != null ? 'var(--tx2)' : 'var(--tx3)' }}>
                  {displayCgstAmount != null ? formatINR(displayCgstAmount) : '—'}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>
                  SGST {displaySgstRate != null ? ` @ ${displaySgstRate}%` : ''}
                </td>
                <td className="match-tfoot" style={{ textAlign: 'right', color: displaySgstAmount != null ? 'var(--tx2)' : 'var(--tx3)' }}>
                  {displaySgstAmount != null ? formatINR(displaySgstAmount) : '—'}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>
                  IGST{backendIgstRate != null ? ` @ ${backendIgstRate}%` : ''}
                </td>
                <td className="match-tfoot" style={{ textAlign: 'right', color: backendIgstAmount != null ? 'var(--tx2)' : 'var(--tx3)' }}>
                  {backendIgstAmount != null ? formatINR(backendIgstAmount) : '—'}
                </td>
              </tr>
              <tr style={{ background: 'var(--bg-t)' }}>
                <td colSpan={7} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', borderTop: '0.5px solid var(--bdm)' }}>
                  Grand Total (incl. GST)
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)' }}>
                  {formatINR(displayGrandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        )}

        {/* ── Terms & Conditions ── */}
        {activeTab === 'terms' && (() => {
          const tcLbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }
          const tcVal: React.CSSProperties = { fontSize: 14, fontWeight: 500 }
          const tcCard: React.CSSProperties = { background: 'var(--bg-s)', borderRadius: 'var(--r)', padding: '13px 14px' }
          return (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Structured API fields */}
              {/* <div style={tcCard}>
                <div style={tcLbl}>Quote Validity</div>
                <div style={tcVal}>{fmtDate(quotation.valid_until) || '—'}</div>
              </div>
              <div style={tcCard}>
                <div style={tcLbl}>Delivery Lead Time</div>
                <div style={tcVal}>{quotation.delivery_lead_time_days != null ? `${quotation.delivery_lead_time_days} days` : '—'}</div>
              </div>
              <div style={tcCard}>
                <div style={tcLbl}>Delivery Terms</div>
                <div style={tcVal}>{quotation.delivery_terms || '—'}</div>
              </div>
              <div style={tcCard}>
                <div style={tcLbl}>Freight Charges</div>
                <div style={tcVal}>{quotation.freight_charges != null ? formatINR(quotation.freight_charges) : '—'}</div>
              </div>
              <div style={tcCard}>
                <div style={tcLbl}>Warranty</div>
                <div style={tcVal}>{quotation.warranty || '—'}</div>
              </div> */}

              {/* Plain terms — numbered bullet list in a single full-width card */}
              {displayTerms.length > 0 && (
                <div style={{ ...tcCard, gridColumn: '1 / -1' }}>
                  {/* <div style={tcLbl}>Terms &amp; Conditions</div> */}
                  <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {displayTerms.map((term, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 }}>
                        <span style={{ flexShrink: 0, minWidth: 18, fontWeight: 600, color: 'var(--tx3)', fontSize: 13 }}>{idx + 1}.</span>
                        <span>{term}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Additional Terms & Notes — always full-width, shows — if empty */}
              <div style={{ ...tcCard, gridColumn: '1 / -1' }}>
                <div style={tcLbl}>Additional Notes</div>
                <div style={{ fontSize: 14, color: 'var(--tx2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {quotation.internal_notes || '—'}
                </div>
              </div>
            </div>
          )
        })()}

      </div>

    </div>
  )
}

