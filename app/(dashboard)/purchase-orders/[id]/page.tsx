'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Truck, CheckCircle, Loader2, Send,
  Clock, AlertTriangle, X, Receipt, Files, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const PO_TYPE_MAP: Record<string, string> = {
  NB: 'Standard', FO: 'Blanket/Framework', RO: 'Release Order',
  SV: 'Service', ZT: 'Tooling/Capex', IM: 'Import', SC: 'Subcontract',
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'details' | 'approval' | 'grn' | 'invoices' | 'documents'>('details')

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => { const { data } = await apiClient.get(`/purchase-orders/${id}/`); return data },
    enabled: !!id,
    retry: 1,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })

  // Acknowledge PO
  const [showAckModal, setShowAckModal] = useState(false)
  const [ackName, setAckName] = useState('')
  const [ackDelivery, setAckDelivery] = useState('')
  const [ackNotes, setAckNotes] = useState('')
  const ackMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/purchase-orders/${id}/acknowledge/`, {
        acknowledged_by: ackName,
        expected_delivery: ackDelivery || null,
        notes: ackNotes,
      })
      return data
    },
    onSuccess: () => {
      invalidate(); setShowAckModal(false)
      toast({ title: 'PO acknowledged successfully' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  // Send to vendor
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const sendToVendorMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/purchase-orders/${id}/send-to-vendor/`, { vendor_email: sendEmail })
      return data
    },
    onSuccess: (data) => {
      invalidate(); setShowSendModal(false)
      if (data.vendor_email_sent) {
        toast({ title: `PO sent to vendor via email (${data.vendor_email})` })
      } else {
        toast({
          title: 'PO issued but email not sent',
          description: data.email_error || 'Check vendor email and SMTP settings.',
          variant: 'destructive',
        })
      }
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  // Close PO
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReason, setCloseReason] = useState('')
  const closeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/purchase-orders/${id}/close/`, { reason: closeReason })
      return data
    },
    onSuccess: () => { invalidate(); setShowCloseModal(false); toast({ title: 'PO closed' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading…
    </div>
  )
  if (error || !po) return (
    <div className="p-8 text-center text-muted-foreground">Purchase order not found.</div>
  )

  const TABS = [
    { key: 'details' as const, label: 'Details' },
    { key: 'approval' as const, label: 'Approval' },
    { key: 'grn' as const, label: 'GRN' },
    { key: 'invoices' as const, label: 'Invoices' },
    { key: 'documents' as const, label: 'Documents' },
  ]

  return (
    <>
      <style>{`
        .pod-lbl{font-size:10px;font-weight:600;color:var(--tx3,#9a9a96);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
        .pod-val{font-size:13px;font-weight:500;color:#1a1a18}
        .pod-cell{padding:0 14px}
        .pod-cell:first-child{padding-left:0}
        .pod-cell:last-child{padding-right:0}
        .match-tbl{width:100%;border-collapse:collapse;font-size:14px}
        .match-tbl thead th{padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:var(--tx3,#9a9a96);text-transform:uppercase;letter-spacing:.4px;background:var(--bg-s,#f8f8f6);border-bottom:0.5px solid var(--bd,rgba(0,0,0,0.08));white-space:nowrap}
        .match-tbl tbody tr{border-bottom:0.5px solid var(--bd,rgba(0,0,0,0.08));transition:background .1s}
        .match-tbl tbody tr:last-child{border-bottom:none}
        .match-tbl tbody tr:hover{background:#fafaf8}
        .match-tbl td{padding:11px 12px;vertical-align:top}
        td.match-tfoot{padding:10px 12px;font-size:13px;background:var(--bg-s,#f8f8f6);border-top:0.5px solid var(--bd,rgba(0,0,0,0.08))}
        @media(max-width:900px){
          .pod-hero-meta{grid-template-columns:repeat(2,1fr)!important;gap:12px!important;padding-top:12px!important}
          .pod-hero-meta .pod-cell{border-left:none!important;padding:0!important;border-bottom:0.5px solid rgba(0,0,0,0.07);padding-bottom:10px!important}
        }
        @media(max-width:768px){
          .pod-hero-row1{flex-wrap:wrap;gap:10px!important}
          .pod-hero-actions{width:100%!important}
          .pod-tabs-bar{overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}
          .pod-tabs-bar::-webkit-scrollbar{display:none}
        }
      `}</style>
      <div className="space-y-3 w-full min-w-0 overflow-x-hidden">

        {/* ── Hero card ── */}
        <div style={{ background: 'var(--bg,#fff)', border: '0.5px solid var(--bd,rgba(0,0,0,0.08))', borderRadius: 'var(--rl,12px)', padding: 22, marginBottom: 4 }}>

          {/* Row 1 — icon + PO number + status + action buttons */}
          <div className="pod-hero-row1" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ede9fe', color: '#7c3aed', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-shopping-cart" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.4px' }}>{po.po_number}</span>
                <Badge variant="secondary">{PO_TYPE_MAP[po.po_type] ?? po.po_type}</Badge>
                <StatusBadge status={po.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--tx2,#6b6b69)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                <span>Created At {formatDate(po.created_at)}</span>
              </div>
            </div>
            <div className="pod-hero-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {po.status === 'draft' && (
                <Button size="sm" variant="outline" className="text-[12px] h-8 gap-1.5" onClick={() => router.push(`/purchase-orders/${id}/edit`)}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
              {po.status === 'approved' && (
                <Button size="sm" className="text-[12px] h-8 gap-1.5" onClick={() => { setSendEmail(po.vendor_email || ''); setShowSendModal(true) }}>
                  <Send className="w-3.5 h-3.5" /> Send to Vendor
                </Button>
              )}
              {po.status === 'sent_to_vendor' && (
                <Button size="sm" className="text-[12px] h-8 gap-1.5 bg-cyan-600 hover:bg-cyan-700" onClick={() => setShowAckModal(true)}>
                  <CheckCircle className="w-3.5 h-3.5" /> Acknowledge PO
                </Button>
              )}
              {['acknowledged', 'partially_received', 'fully_received'].includes(po.status) && (
                <Button size="sm" variant="outline" className="text-[12px] h-8 gap-1.5" onClick={() => setShowCloseModal(true)}>
                  Close PO
                </Button>
              )}
            </div>
          </div>

          {/* Row 2 — PO Type + Delivery Date + Billing Address */}
          <div className="pod-hero-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', borderTop: '0.5px solid var(--bd,rgba(0,0,0,0.08))', paddingTop: 14, marginBottom: 14 }}>
            <div className="pod-cell" style={{ paddingLeft: 0 }}>
              <div className="pod-lbl">PO Type</div>
              <div className="pod-val">{PO_TYPE_MAP[po.po_type] ?? po.po_type}</div>
            </div>
            <div className="pod-cell" style={{ borderLeft: '0.5px solid var(--bd,rgba(0,0,0,0.08))' }}>
              <div className="pod-lbl">Delivery Date</div>
              <div className="pod-val">{po.delivery_date ? formatDate(po.delivery_date) : '—'}</div>
            </div>
            <div className="pod-cell" style={{ borderLeft: '0.5px solid var(--bd,rgba(0,0,0,0.08))' }}>
              <div className="pod-lbl">Billing / Delivery Address</div>
              <div className="pod-val" style={{ fontSize: 12, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{po.delivery_address || '—'}</div>
            </div>
          </div>

          {/* Row 3 — Vendor details */}
          <div className="pod-hero-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '0.5px solid var(--bd,rgba(0,0,0,0.08))', paddingTop: 14 }}>
            {/* Vendor — clickable */}
            <div className="pod-cell">
              <button
                type="button"
                onClick={() => window.open(`/vendors/${po.vendor_hash_id ?? po.vendor}`, '_blank')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <div className="pod-lbl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Vendor <i className="ti ti-arrow-up-right" style={{ fontSize: 9, opacity: 0.7 }} />
                </div>
                <div className="pod-val" style={{ color: 'var(--blu-tx,#0C447C)' }}>
                  {po.vendor_name || '—'}
                </div>
              </button>
            </div>

            {/* Rest — plain cells */}
            {[
              { label: 'Plant', value: po.plant_name },
              { label: 'Department', value: po.department_name },
              { label: 'Created By', value: po.created_by_name },
            ].map(({ label, value }) => (
              <div key={label} className="pod-cell" style={{ borderLeft: '0.5px solid var(--bd,rgba(0,0,0,0.08))' }}>
                <div className="pod-lbl">{label}</div>
                <div className="pod-val">{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="pod-tabs-bar flex items-center w-full border border-[rgba(0,0,0,0.08)] rounded-t-xl overflow-hidden bg-white mb-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center justify-center gap-1.5
                px-5 py-[11px]
                text-[13px] font-medium
                transition-colors
                border-b-[2.5px]
                whitespace-nowrap
                ${activeTab === tab.key
                  ? 'text-[#042348] border-[#042348] bg-white'
                  : 'text-[#9a9a96] border-transparent hover:bg-[#f8f8f6] hover:text-[#042348]'
                }
              `}
            >
              {tab.key === 'details' && <i className="ti ti-layout-list" style={{ fontSize: 14 }} />}
              {tab.key === 'approval' && <i className="ti ti-shield-check" style={{ fontSize: 14 }} />}
              {tab.key === 'grn' && <i className="ti ti-truck" style={{ fontSize: 14 }} />}
              {tab.key === 'invoices' && <i className="ti ti-receipt" style={{ fontSize: 14 }} />}
              {tab.key === 'documents' && <i className="ti ti-files" style={{ fontSize: 14 }} />}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'details' && <OverviewTab po={po} />}
        {activeTab === 'approval' && <ApprovalTab po={po} poId={id as string} onUpdate={invalidate} />}
        {activeTab === 'grn' && <GRNTab po={po} poId={id as string} onUpdate={invalidate} />}
        {activeTab === 'invoices' && <InvoicesTab po={po} />}
        {activeTab === 'documents' && <DocumentsTab po={po} />}

        {/* Send to Vendor Modal */}
        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Send PO to Vendor</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground">
                PO will be emailed to the vendor. They must acknowledge within 48 hours.
              </p>
              <div>
                <Label className="text-xs">Vendor Email</Label>
                <Input value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="vendor@company.com" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
                <Button disabled={!sendEmail || sendToVendorMutation.isPending}
                  onClick={() => sendToVendorMutation.mutate()} className="gap-1.5">
                  {sendToVendorMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Send className="w-3.5 h-3.5" /> Send
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Close PO Modal */}
        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
              <h2 className="text-base font-semibold">Close Purchase Order</h2>
              <p className="text-sm text-muted-foreground">This will close {po.po_number} and release any remaining budget.</p>
              <div>
                <Label className="text-xs">Reason</Label>
                <textarea className="w-full min-h-[60px] border rounded-md p-2 text-sm resize-y"
                  value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder="Reason for closing..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCloseModal(false)}>Cancel</Button>
                <Button variant="destructive" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()}>
                  {closeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Close PO
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Acknowledge PO Modal */}
        {showAckModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Acknowledge Purchase Order</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowAckModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Confirm receipt of {po.po_number} and provide expected delivery information.
              </p>
              <div>
                <Label className="text-xs">Acknowledged By *</Label>
                <Input value={ackName} onChange={e => setAckName(e.target.value)}
                  placeholder="Your name / vendor contact name" />
              </div>
              <div>
                <Label className="text-xs">Expected Delivery Date</Label>
                <Input type="date" value={ackDelivery} onChange={e => setAckDelivery(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <textarea className="w-full min-h-[60px] border rounded-md p-2 text-sm resize-y"
                  value={ackNotes} onChange={e => setAckNotes(e.target.value)}
                  placeholder="Any comments, alternate delivery dates, or conditions..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAckModal(false)}>Cancel</Button>
                <Button disabled={!ackName.trim() || ackMutation.isPending}
                  className="gap-1.5 bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => ackMutation.mutate()}>
                  {ackMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Overview Tab (PO details + line items) ────────────────────────────────────

function OverviewTab({ po }: { po: any }) {
  const items: any[] = po.line_items || []
  const subtotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_rate) || 0), 0)
  const cgstTotal = items.reduce((s: number, i: any) => s + (Number(i.cgst_amount) || 0), 0)
  const sgstTotal = items.reduce((s: number, i: any) => s + (Number(i.sgst_amount) || 0), 0)
  const igstTotal = items.reduce((s: number, i: any) => s + (Number(i.igst_amount) || 0), 0)
  const taxTotal = items.reduce((s: number, i: any) => s + (Number(i.tax_amount) || 0), 0)
  const cgstRate = items[0]?.cgst_rate != null ? Number(items[0].cgst_rate) : null
  const sgstRate = items[0]?.sgst_rate != null ? Number(items[0].sgst_rate) : null
  const igstRate = items[0]?.igst_rate != null ? Number(items[0].igst_rate) : null
  const grandTotal = subtotal + (cgstTotal || sgstTotal || igstTotal || taxTotal)

  return (
    <div className="space-y-4">
      {po.notes && (
        <Card className="overflow-hidden rounded-xl shadow-sm">
          <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
            <div className="flex h-full items-center">
              <CardTitle className="text-sm font-semibold">Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Acknowledgements */}
      {(po.acknowledgements || []).length > 0 && (
        <Card className="overflow-hidden rounded-xl shadow-sm">
          <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
            <div className="flex h-full items-center">
              <CardTitle className="text-sm font-semibold">Vendor Acknowledgement</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {po.acknowledgements.map((ack: any) => (
                <div key={ack.id} className="p-3 border rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium">Acknowledged by {ack.acknowledged_by}</span>
                  </div>
                  {ack.expected_delivery && <p className="text-xs text-muted-foreground mt-1">Expected: {formatDate(ack.expected_delivery)}</p>}
                  {ack.notes && <p className="text-xs text-muted-foreground mt-1">{ack.notes}</p>}
                  <p className="text-[10px] text-muted-foreground">{formatDate(ack.acknowledged_at)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card className="overflow-hidden rounded-xl shadow-sm">
        <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
          <div className="flex h-full items-center">
            <CardTitle className="text-sm font-semibold">Line Items ({items.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground italic">No line items.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="match-tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item / Description</th>
                    <th>HSN</th>
                    <th>Qty</th>
                    <th>UOM</th>
                    <th>Unit Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => {
                    const amount = (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0)
                    const hsnCode = item.item_code_detail?.hsn_code || item.hsn_code || '—'
                    return (
                      <tr key={item.id ?? idx}>
                        <td style={{ fontFamily: 'var(--mono,monospace)', fontSize: 12, color: 'var(--tx3,#9a9a96)' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td style={{ fontWeight: 500, maxWidth: 240 }}>
                          <div style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.item_code_detail?.code ?? item.item_code_detail?.description ?? '—'}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 12, color: 'var(--tx3,#9a9a96)', marginTop: 2, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--mono,monospace)', fontSize: 12, color: 'var(--tx3,#9a9a96)', whiteSpace: 'nowrap' }}>
                          {hsnCode}
                        </td>
                        <td>{item.quantity}</td>
                        <td style={{ color: 'var(--tx3,#9a9a96)' }}>{item.unit_of_measure || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{formatCurrency(item.unit_rate)}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="match-tfoot" style={{ fontWeight: 600, textAlign: 'right', color: 'var(--tx2,#6b6b69)' }}>Sub Total</td>
                    <td className="match-tfoot" style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(subtotal)}</td>
                  </tr>

                  {/* Always show CGST if rate exists */}
                  {cgstRate != null ? (
                    <tr>
                      <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3,#9a9a96)' }}>
                        CGST @ {cgstRate}%
                      </td>
                      <td className="match-tfoot" style={{ textAlign: 'right' }}>{formatCurrency(cgstTotal)}</td>
                    </tr>
                  ) : null}

                  {/* Always show SGST if rate exists */}
                  {sgstRate != null ? (
                    <tr>
                      <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3,#9a9a96)' }}>
                        SGST @ {sgstRate}%
                      </td>
                      <td className="match-tfoot" style={{ textAlign: 'right' }}>{formatCurrency(sgstTotal)}</td>
                    </tr>
                  ) : null}

                  {/* Always show IGST if rate exists */}
                  {igstRate != null ? (
                    <tr>
                      <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3,#9a9a96)' }}>
                        IGST @ {igstRate}%
                      </td>
                      <td className="match-tfoot" style={{ textAlign: 'right' }}>{formatCurrency(igstTotal)}</td>
                    </tr>
                  ) : null}

                  {/* Fallback: show generic GST row using tax_rate from first line item */}
                  {cgstRate == null && sgstRate == null && igstRate == null && (
                    <tr>
                      <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3,#9a9a96)' }}>
                        GST{items[0]?.tax_rate != null ? ` @ ${items[0].tax_rate}%` : ''}
                      </td>
                      <td className="match-tfoot" style={{ textAlign: 'right' }}>{formatCurrency(taxTotal)}</td>
                    </tr>
                  )}

                  <tr style={{ background: 'var(--bg-t,#f0f0ee)' }}>
                    <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', borderTop: '0.5px solid var(--bd,rgba(0,0,0,0.08))' }}>
                      Grand Total (incl. GST)
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, borderTop: '0.5px solid var(--bd,rgba(0,0,0,0.08))' }}>
                      {formatCurrency(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Approval Tab ──────────────────────────────────────────────────────────────

function ApprovalTab({ po, poId, onUpdate }: { po: any; poId: string; onUpdate: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isDraft = po.status === 'draft'
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [actionComments, setActionComments] = useState('')

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', 'purchase_order'],
    queryFn: async () => {
      const { data } = await apiClient.get('/approvals/matrices/', { params: { matrix_type: 'purchase_order' } })
      return data.results ?? data
    },
    enabled: isDraft,
  })

  const { data: approvalData, isLoading } = useQuery({
    queryKey: ['po-approval', poId],
    queryFn: async () => {
      const { data } = await apiClient.get('/approvals/requests/', {
        params: { entity_type: 'purchaseorder', object_id: po.id },
      })
      const list: any[] = data.results ?? data
      return list.find((r: any) => ['pending', 'in_progress'].includes(r.status)) ?? list[0] ?? null
    },
    enabled: !isDraft && !!po.id,
  })

  const { data: myPendingAction } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    select: (data: any[]) =>
      data.find(a => a.entity_type === 'purchaseorder' && String(a.object_id) === String(po.id)),
    enabled: !isDraft,
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body: any = {}
      if (selectedMatrix) body.matrix_id = selectedMatrix
      const { data } = await apiClient.post(`/purchase-orders/${poId}/submit/`, body)
      return data
    },
    onSuccess: (data) => {
      onUpdate()
      queryClient.invalidateQueries({ queryKey: ['po-approval', poId] })
      if (data.auto_approved) {
        toast({ title: 'Auto-approved: within contracted rate and available budget' })
      } else {
        toast({ title: 'Submitted for approval' })
      }
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const processAction = async (action: string, comments: string) => {
    if (!myPendingAction) return
    try {
      await apiClient.patch(`/approvals/actions/${myPendingAction.action_id}/`, { action, comments })
      toast({ title: action === 'approved' ? 'Approved' : action === 'rejected' ? 'Rejected' : 'Held' })
      onUpdate()
      queryClient.invalidateQueries({ queryKey: ['po-approval', poId] })
      queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    } catch (err: any) {
      toast({ title: 'Action failed', variant: 'destructive' })
    }
  }

  if (isDraft) {
    return (

      <div >
        {!matrices || matrices.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            No purchase order approval matrix configured. Create one in Settings.
          </p>
        ) : (
          <MatrixSelectorTable
            matrices={matrices}
            selectedMatrix={selectedMatrix}
            expandedMatrix={expandedMatrix}
            onSelect={(id) => { setSelectedMatrix(id); setExpandedMatrix(id) }}
            onToggleExpand={(id) => setExpandedMatrix(prev => prev === id ? null : id)}
          />
        )}
        <div className="flex justify-end">
          <Button disabled={!selectedMatrix || submitMutation.isPending}
            onClick={() => submitMutation.mutate()} className="gap-1.5">
            {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit for Approval
          </Button>
        </div>
      </div>
    )
  }

  const reqStatus = approvalData?.status
  const headerBg = reqStatus === 'approved' ? 'bg-green-50' : reqStatus === 'rejected' ? 'bg-red-50' : 'bg-amber-50'
  const headerText = reqStatus === 'approved' ? 'text-green-800' : reqStatus === 'rejected' ? 'text-red-800' : 'text-amber-800'

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <div className={`px-4 py-3 border-b flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-2">
            {reqStatus === 'approved' ? <CheckCircle className="w-4 h-4 text-green-600" />
              : reqStatus === 'rejected' ? <AlertTriangle className="w-4 h-4 text-red-600" />
                : <Clock className="w-4 h-4 text-amber-600" />}
            <span className={`text-sm font-medium ${headerText}`}>
              {reqStatus === 'approved' ? 'Approved' : reqStatus === 'rejected' ? 'Rejected'
                : approvalData ? `In Progress — Level ${approvalData.current_level}` : 'Pending'}
            </span>
            {approvalData && <span className="text-xs text-muted-foreground">via {approvalData.matrix_name}</span>}
          </div>
        </div>

        {isLoading && <div className="px-4 py-3 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>}

        {!isLoading && !approvalData && po.status === 'approved' && (
          <div className="px-4 py-3 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left px-3 py-2 font-medium w-12">Level</th>
                    <th className="text-left px-3 py-2 font-medium">Approver</th>
                    <th className="text-left px-3 py-2 font-medium w-28">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] bg-green-100 text-green-700">1</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">System (Auto)</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-green-50 border-green-200 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Approved
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{po.approved_at ? formatDate(po.approved_at) : '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground italic">Auto-approved: within contracted rate and available budget</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoading && !approvalData && po.status !== 'approved' && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Not yet submitted.</div>
        )}

        {!isLoading && approvalData && (
          <div className="px-4 py-3 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left px-3 py-2 font-medium w-12">Level</th>
                    <th className="text-left px-3 py-2 font-medium">Approver</th>
                    <th className="text-left px-3 py-2 font-medium w-28">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Due</th>
                    <th className="text-left px-3 py-2 font-medium">Acted</th>
                    <th className="text-left px-3 py-2 font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {(approvalData.actions || []).map((a: any) => {
                    const isPending = !a.action || a.action === 'pending'
                    const isCurrent = isPending && a.level_number === approvalData.current_level
                    const act = a.action ?? 'pending'
                    return (
                      <tr key={a.id} className={`border-t ${isCurrent ? 'bg-amber-50' : ''}`}>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] ${act === 'approved' ? 'bg-green-100 text-green-700' : act === 'rejected' ? 'bg-red-100 text-red-700'
                            : isCurrent ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'
                            }`}>{a.level_number}</span>
                        </td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                          {a.approver_name ?? '—'}
                          {isCurrent && <span className="ml-1.5 text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">awaiting</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${act === 'approved' ? 'bg-green-50 border-green-200 text-green-700'
                            : act === 'rejected' ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}>{act === 'approved' ? 'Approved' : act === 'rejected' ? 'Rejected' : act === 'held' ? 'Held' : 'Pending'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{a.sla_deadline ? formatDate(a.sla_deadline) : '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{a.acted_at ? formatDate(a.acted_at) : '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground italic truncate max-w-[200px]">{a.comments || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {myPendingAction && (
          <div className="px-4 py-3 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Your action required — Level {myPendingAction.level_number}</p>
            <textarea className="w-full border rounded-md p-2 text-sm resize-none h-16"
              placeholder="Add comments..." value={actionComments} onChange={e => setActionComments(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={() => processAction('approved', actionComments)} disabled={!actionComments.trim()}>
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="gap-1"
                onClick={() => processAction('rejected', actionComments)} disabled={!actionComments.trim()}>Reject</Button>
              <Button size="sm" variant="outline" className="gap-1 text-amber-600"
                onClick={() => processAction('held', actionComments)} disabled={!actionComments.trim()}>
                <Clock className="w-3.5 h-3.5" /> Hold
              </Button>
              <Button size="sm" variant="outline" className="gap-1"
                onClick={() => processAction('returned', actionComments)} disabled={!actionComments.trim()}>
                <ArrowLeft className="w-3.5 h-3.5" /> Return for Revision
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── GRN Tab ───────────────────────────────────────────────────────────────────

function GRNTab({ po, poId, onUpdate }: { po: any; poId: string; onUpdate: () => void }) {
  const { toast } = useToast()
  const grns = po.goods_receipts || []

  const { data: grnList } = useQuery({
    queryKey: ['po-grns', poId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/purchase-orders/${poId}/grns/`)
      return data.results ?? data
    },
  })

  const displayGrns = grnList || grns

  return (
    <div className="space-y-4">
      {['sent_to_vendor', 'acknowledged', 'partially_received'].includes(po.status) && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">Record goods receipt when materials arrive at the plant.</p>
          <Button size="sm" className="gap-1.5" onClick={() => window.location.href = `/grns/new?po=${poId}`}>
            <Truck className="w-3.5 h-3.5" /> Create GRN
          </Button>
        </div>
      )}

      <Card className="overflow-hidden rounded-xl shadow-sm">
        <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0">
          <div className="flex h-full items-center">
            <CardTitle className="text-sm font-semibold">Goods Receipts ({displayGrns.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {displayGrns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goods receipts recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {displayGrns.map((grn: any) => (
                <div key={grn.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{grn.grn_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {grn.warehouse && `Warehouse: ${grn.warehouse} · `}
                        {grn.challan_number && `Challan: ${grn.challan_number} · `}
                        {formatDate(grn.received_at || grn.created_at)}
                      </p>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {(grn.line_items || []).length} items
                    </span>
                  </div>
                  {(grn.line_items || []).length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-muted-foreground border-b">
                          <th className="text-left px-2 py-1">Item</th>
                          <th className="text-right px-2 py-1">Received</th>
                          <th className="text-right px-2 py-1">Accepted</th>
                          <th className="text-right px-2 py-1">Rejected</th>
                        </tr></thead>
                        <tbody>
                          {grn.line_items.map((gli: any) => (
                            <tr key={gli.id} className="border-t">
                              <td className="px-2 py-1">{gli.po_line_description || `Line ${gli.po_line}`}</td>
                              <td className="px-2 py-1 text-right">{gli.received_qty}</td>
                              <td className="px-2 py-1 text-right text-emerald-600">{gli.accepted_qty}</td>
                              <td className="px-2 py-1 text-right text-red-600">{gli.rejected_qty > 0 ? gli.rejected_qty : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────

function InvoicesTab({ po }: { po: any }) {
  const invoices: any[] = po.invoices || []

  if (invoices.length === 0) {
    return (
      <Card className="overflow-hidden rounded-xl shadow-sm">
        <CardContent className="py-12 text-center">
          <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No invoices billed against this PO yet.</p>
          <Link href={`/invoices/new?po=${po.hash_id ?? po.id}`}>
            <Button size="sm" className="gap-2">
              <Receipt className="w-4 h-4" /> Register Invoice
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const totalInvoiced = invoices
    .filter(inv => !['rejected', 'draft'].includes(inv.status))
    .reduce((s, inv) => s + Number(inv.total_amount || 0), 0)
  const poTotal = Number(po.total_amount || 0)
  const invoicedPct = poTotal > 0 ? Math.min(100, (totalInvoiced / poTotal) * 100) : 0

  return (
    <Card className="overflow-hidden rounded-xl shadow-sm">
      <CardHeader className="h-11 border-b bg-muted/20 px-4 py-0 flex flex-row items-center justify-between">
        <div className="flex h-full items-center gap-3">
          <CardTitle className="text-sm font-semibold">Invoices</CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatCurrency(totalInvoiced)} of {formatCurrency(poTotal)} ({invoicedPct.toFixed(0)}%)
          </span>
        </div>
        <Link href={`/invoices/new?po=${po.hash_id ?? po.id}`}>
          <Button size="sm" variant="outline" className="text-[12px] h-7 gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> New Invoice
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 py-2">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${invoicedPct >= 100 ? 'bg-green-500' : invoicedPct >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${invoicedPct}%` }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                {['Invoice', 'Vendor No.', 'Invoice Date', 'Due Date', 'Amount', 'Status'].map(head => (
                  <th key={head} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold whitespace-nowrap">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr
                  key={inv.id}
                  onClick={() => window.location.assign(`/invoices/${inv.hash_id ?? inv.id}`)}
                  className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-purple-700 font-semibold">{inv.internal_ref}</td>
                  <td className="px-4 py-2.5">{inv.invoice_number || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{inv.invoice_date ? formatDate(inv.invoice_date) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                  <td className="px-4 py-2.5 font-medium">{formatCurrency(inv.total_amount)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ po }: { po: any }) {
  type DocItem = { label: string; sub: string; href?: string }
  const docs: DocItem[] = []

  for (const ack of (po.acknowledgements || [])) {
    if (ack.document) {
      docs.push({
        label: `Vendor Acknowledgement — ${ack.acknowledged_by}`,
        sub: ack.acknowledged_at ? formatDate(ack.acknowledged_at) : 'Date unknown',
        href: ack.document,
      })
    }
  }
  for (const grn of (po.goods_receipts || [])) {
    if (grn.challan_number) {
      docs.push({
        label: `Delivery Challan — ${grn.grn_number}`,
        sub: `Challan #${grn.challan_number}${grn.challan_date ? ' · ' + formatDate(grn.challan_date) : ''}`,
      })
    }
  }

  if (docs.length === 0) {
    return (
      <Card className="overflow-hidden rounded-xl shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Files className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          No documents attached yet. Vendor acknowledgements and delivery challans appear here once recorded.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-xl shadow-sm">
      <CardContent className="p-0">
        <ul className="divide-y">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.sub}</p>
                </div>
              </div>
              {d.href && (
                <a href={d.href} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">Open</Button>
                </a>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
