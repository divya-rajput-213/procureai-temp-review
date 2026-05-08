'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, Package, Truck, CheckCircle, Loader2, Send,
  Shield, Clock, AlertTriangle, X,
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

const TABS = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'line_items', label: 'Line Items', icon: Package },
  { key: 'approval', label: 'Approval', icon: Shield },
  { key: 'grn', label: 'GRN', icon: Truck },
]

export default function PurchaseOrderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

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

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (error || !po) return <div className="text-center py-12 text-muted-foreground">Purchase order not found.</div>

  const lineItems: any[] = po.line_items || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/purchase-orders')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{po.po_number}</h1>
              <Badge variant="secondary">{PO_TYPE_MAP[po.po_type] ?? po.po_type}</Badge>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{po.vendor_name}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {po.status === 'draft' && (
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => router.push(`/purchase-orders/${id}/edit`)}>Edit</Button>
          )}
          {po.status === 'approved' && (
            <Button size="sm" className="gap-1.5" onClick={() => { setSendEmail(po.vendor_email || ''); setShowSendModal(true) }}>
              <Send className="w-3.5 h-3.5" /> Send to Vendor
            </Button>
          )}
          {po.status === 'sent_to_vendor' && (
            <Button size="sm" className="gap-1.5 bg-cyan-600 hover:bg-cyan-700" onClick={() => setShowAckModal(true)}>
              <CheckCircle className="w-3.5 h-3.5" /> Acknowledge PO
            </Button>
          )}
          {['acknowledged', 'partially_received', 'fully_received'].includes(po.status) && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCloseModal(true)}>
              Close PO
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Amount</p>
          <p className="text-lg font-bold">{formatCurrency(po.total_amount, po.currency_code)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Tax</p>
          <p className="text-lg font-bold">{formatCurrency(po.tax_amount ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Line Items</p>
          <p className="text-lg font-bold">{lineItems.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">GRN</p>
          <p className="text-lg font-bold">{(po.goods_receipts || []).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Trigger</p>
          <p className="text-sm font-medium">{po.trigger_source === 'pr_linked' ? `PR: ${po.pr_number || '—'}` : po.trigger_source}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && <OverviewTab po={po} />}
      {activeTab === 'line_items' && <LineItemsTab po={po} />}
      {activeTab === 'approval' && <ApprovalTab po={po} poId={id as string} onUpdate={invalidate} />}
      {activeTab === 'grn' && <GRNTab po={po} poId={id as string} onUpdate={invalidate} />}

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
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ po }: { po: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">PO Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {([
              ['PO Type', PO_TYPE_MAP[po.po_type] ?? po.po_type],
              ['Vendor', po.vendor_name],
              ['Plant', po.plant_name],
              ['Department', po.department_name],
              ['PR Number', po.pr_number || '—'],
              ['Contract', po.contract_id_display || '—'],
              ['Budget (Tracking ID)', po.tracking_code || '—'],
              ['Trigger', po.trigger_source],
              ['Payment Terms', po.payment_terms || '—'],
              ['Incoterms', po.incoterms || '—'],
              ['Currency', po.currency_code],
              ['Created By', po.created_by_name],
              ['Created', formatDate(po.created_at)],
              ['Sent to Vendor', po.sent_to_vendor_at ? formatDate(po.sent_to_vendor_at) : '—'],
              ['Approved', po.approved_at ? formatDate(po.approved_at) : '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Amount Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Amount</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium">{formatCurrency(po.subtotal_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatCurrency(po.tax_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Freight</dt><dd>{formatCurrency(po.freight_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>-{formatCurrency(po.discount_amount)}</dd></div>
              <div className="flex justify-between border-t pt-2"><dt className="font-semibold">Total</dt><dd className="font-bold text-primary">{formatCurrency(po.total_amount)}</dd></div>
            </dl>
          </CardContent>
        </Card>

        {/* Acknowledgements */}
        <Card>
          <CardHeader><CardTitle className="text-base">Vendor Acknowledgement</CardTitle></CardHeader>
          <CardContent>
            {(po.acknowledgements || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {po.status === 'sent_to_vendor' ? 'Waiting for vendor to acknowledge (48h)...' : 'Not yet sent to vendor.'}
              </p>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {po.notes && (
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{po.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── Line Items Tab ──────────────────────────────────────────────────────────

function LineItemsTab({ po }: { po: any }) {
  const items: any[] = po.line_items || []
  if (!items.length) {
    return <p className="text-sm text-muted-foreground italic">No line items.</p>
  }

  const subtotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_rate) || 0), 0)
  const totalTax = items.reduce((s: number, i: any) => s + (Number(i.tax_amount) || 0), 0)
  const taxRate = items[0]?.tax_rate ? Number(items[0].tax_rate) : 0
  const grandTotal = subtotal + totalTax

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr className="text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium w-8">#</th>
            <th className="text-left px-3 py-2 font-medium">Item / Description</th>
            <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
            <th className="text-left px-3 py-2 font-medium w-20">UOM</th>
            <th className="text-right px-3 py-2 font-medium w-32">Unit Rate</th>
            <th className="text-right px-3 py-2 font-medium w-32">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item: any, idx: number) => {
            const amount = (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0)
            return (
              <tr key={item.id ?? idx} className="hover:bg-slate-50/50">
                <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium">
                    {item.item_code_detail?.code ?? item.item_code_detail?.description ?? '—'}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.unit_of_measure}</td>
                <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_rate)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(amount)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(subtotal)}</td>
          </tr>
          <tr className="bg-slate-50">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Tax ({taxRate}%)</td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(totalTax)}</td>
          </tr>
          <tr className="bg-slate-100 border-t-2">
            <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold">Total</td>
            <td className="px-3 py-2.5 text-right font-bold text-base">{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Approval Tab (same pattern as contracts) ────────────────────────────────

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

  // Draft: matrix selector
  if (isDraft) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Submit for Approval</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    )
  }

  // Submitted: approval progress table
  const reqStatus = approvalData?.status
  let headerBg = 'bg-amber-50', headerText = 'text-amber-800'
  if (reqStatus === 'approved') { headerBg = 'bg-green-50'; headerText = 'text-green-800' }
  else if (reqStatus === 'rejected') { headerBg = 'bg-red-50'; headerText = 'text-red-800' }

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
        {!isLoading && !approvalData && po.status !== 'approved' && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Not yet submitted.</div>}

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
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] ${
                            act === 'approved' ? 'bg-green-100 text-green-700' : act === 'rejected' ? 'bg-red-100 text-red-700'
                              : isCurrent ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}>{a.level_number}</span>
                        </td>
                        <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                          {a.approver_name ?? '—'}
                          {isCurrent && <span className="ml-1.5 text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">awaiting</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                            act === 'approved' ? 'bg-green-50 border-green-200 text-green-700'
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

// ── GRN Tab ─────────────────────────────────────────────────────────────────

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
      {po.status === 'sent_to_vendor' || po.status === 'acknowledged' || po.status === 'partially_received' ? (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">Record goods receipt when materials arrive at the plant.</p>
          <Button size="sm" className="gap-1.5" onClick={() => window.location.href = `/purchase-orders/${poId}/grn/new`}>
            <Truck className="w-3.5 h-3.5" /> Create GRN
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Goods Receipts ({displayGrns.length})</CardTitle></CardHeader>
        <CardContent>
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
                    <Badge variant="secondary" className="text-[10px]">
                      {(grn.line_items || []).length} items
                    </Badge>
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
