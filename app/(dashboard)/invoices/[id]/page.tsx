'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, Package, Upload, GitCompare, CreditCard,
  Loader2, Send, CheckCircle2, XCircle, DollarSign,
  Download, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const TABS = [
  { key: 'details', label: 'Details', icon: FileText },
  { key: 'line_items', label: 'Line Items', icon: Package },
  { key: 'documents', label: 'Documents', icon: Upload },
  { key: 'match_result', label: 'Match Result', icon: GitCompare },
  { key: 'payments', label: 'Payments', icon: CreditCard },
]

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  proforma: 'Proforma',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
  advance: 'Advance',
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentDate, setPaymentDate] = useState('')

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/invoices/${id}/`)
      return data
    },
    enabled: !!id,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invoice', id] })

  const submitMutation = useMutation({
    mutationFn: async () => { const { data } = await apiClient.post(`/invoices/${id}/submit/`); return data },
    onSuccess: () => { invalidate(); toast({ title: 'Invoice submitted' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed to submit', variant: 'destructive' }),
  })

  const matchMutation = useMutation({
    mutationFn: async () => { const { data } = await apiClient.post(`/invoices/${id}/match/`); return data },
    onSuccess: () => { invalidate(); toast({ title: '3-way matching triggered' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Matching failed', variant: 'destructive' }),
  })

  const approveMutation = useMutation({
    mutationFn: async () => { const { data } = await apiClient.post(`/invoices/${id}/approve/`); return data },
    onSuccess: () => { invalidate(); toast({ title: 'Invoice approved' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed to approve', variant: 'destructive' }),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => { const { data } = await apiClient.post(`/invoices/${id}/reject/`, { reason: rejectReason }); return data },
    onSuccess: () => { invalidate(); setShowRejectModal(false); setRejectReason(''); toast({ title: 'Invoice rejected' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed to reject', variant: 'destructive' }),
  })

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/invoices/${id}/record-payment/`, {
        amount: paymentAmount,
        reference: paymentRef,
        payment_date: paymentDate,
      })
      return data
    },
    onSuccess: () => { invalidate(); setShowPaymentModal(false); setPaymentAmount(''); setPaymentRef(''); setPaymentDate(''); toast({ title: 'Payment recorded' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed to record payment', variant: 'destructive' }),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  if (!invoice) {
    return <div className="text-center py-12 text-muted-foreground">Invoice not found.</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{invoice.internal_ref}</h1>
              {invoice.invoice_number && (
                <span className="text-sm text-muted-foreground">({invoice.invoice_number})</span>
              )}
              <Badge variant="secondary">{TYPE_LABELS[invoice.invoice_type] || invoice.invoice_type}</Badge>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{invoice.vendor_name}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {invoice.status === 'draft' && (
            <Button size="sm" className="gap-1.5" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit
            </Button>
          )}
          {invoice.status === 'submitted' && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}>
                {matchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                3-Way Match
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowRejectModal(true)}>
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          {invoice.status === 'matched' && (
            <>
              <Button size="sm" className="gap-1.5" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowRejectModal(true)}>
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          {invoice.status === 'approved' && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowPaymentModal(true)}>
              <DollarSign className="w-3.5 h-3.5" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tax Amount</p>
            <p className="text-lg font-bold">{formatCurrency(invoice.tax_amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="text-lg font-bold">{invoice.due_date ? formatDate(invoice.due_date) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Match Status</p>
            <div className="flex items-center gap-1.5 mt-1">
              {invoice.match_status === 'matched' ? (
                <><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="text-sm font-medium text-green-700">Matched</span></>
              ) : invoice.match_status === 'mismatched' ? (
                <><XCircle className="w-5 h-5 text-red-500" /><span className="text-sm font-medium text-red-700">Mismatched</span></>
              ) : (
                <span className="text-sm text-muted-foreground">Not matched</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'details' && <DetailsTab invoice={invoice} />}
      {activeTab === 'line_items' && <LineItemsTab invoice={invoice} />}
      {activeTab === 'documents' && <DocumentsTab invoice={invoice} />}
      {activeTab === 'match_result' && <MatchResultTab invoice={invoice} />}
      {activeTab === 'payments' && <PaymentsTab invoice={invoice} />}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Reject Invoice</h2>
            <div className="space-y-2">
              <Label className="text-sm">Reason for rejection</Label>
              <textarea
                className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-none"
                placeholder="Enter reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason('') }}>Cancel</Button>
              <Button variant="destructive" disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()} className="gap-2">
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Record Payment</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Amount</Label>
                <Input type="number" placeholder="Payment amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Reference / UTR</Label>
                <Input placeholder="Payment reference" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowPaymentModal(false); setPaymentAmount(''); setPaymentRef(''); setPaymentDate('') }}>Cancel</Button>
              <Button disabled={!paymentAmount || paymentMutation.isPending}
                onClick={() => paymentMutation.mutate()} className="gap-2">
                {paymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Tab Components ─── */

function DetailsTab({ invoice }: { invoice: any }) {
  const confidence = invoice.ai_extraction?.confidence_score ?? invoice.ai_extraction?.confidence

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6">
            {([
              ['Internal Ref', invoice.internal_ref],
              ['Invoice Number', invoice.invoice_number],
              ['Invoice Type', TYPE_LABELS[invoice.invoice_type] || invoice.invoice_type],
              ['Vendor', invoice.vendor_name],
              ['Invoice Date', invoice.invoice_date ? formatDate(invoice.invoice_date) : '—'],
              ['Due Date', invoice.due_date ? formatDate(invoice.due_date) : '—'],
              ['Subtotal', formatCurrency(invoice.subtotal)],
              ['Tax Amount', formatCurrency(invoice.tax_amount)],
              ['Total Amount', formatCurrency(invoice.total_amount)],
              ['PO Number', invoice.po_number || '—'],
              ['GRN Number', invoice.grn_number || '—'],
              ['Created By', invoice.created_by_name || '—'],
              ['Created At', invoice.created_at ? formatDate(invoice.created_at) : '—'],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* GST Breakdown */}
      {invoice.gst_breakdown && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">GST Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">CGST</p>
                <p className="text-sm font-medium">{formatCurrency(invoice.gst_breakdown.cgst ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SGST</p>
                <p className="text-sm font-medium">{formatCurrency(invoice.gst_breakdown.sgst ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IGST</p>
                <p className="text-sm font-medium">{formatCurrency(invoice.gst_breakdown.igst ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Extraction data */}
      {invoice.ai_extraction && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              AI Extraction Data
              {confidence != null && (
                <Badge variant={confidence >= 0.8 ? 'default' : confidence >= 0.5 ? 'secondary' : 'destructive'}>
                  {Math.round(confidence * 100)}% confidence
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-slate-50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(invoice.ai_extraction, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Rejection reason */}
      {invoice.status === 'rejected' && invoice.rejection_reason && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800">{invoice.rejection_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function LineItemsTab({ invoice }: { invoice: any }) {
  const items: any[] = invoice.line_items || []

  if (items.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">No line items.</div>
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">HSN</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Tax</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3">{item.description || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.hsn_code || '—'}</td>
                  <td className="px-4 py-3 text-right">{item.quantity ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{item.rate != null ? formatCurrency(item.rate) : '—'}</td>
                  <td className="px-4 py-3 text-right">{item.tax != null ? formatCurrency(item.tax) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{item.amount != null ? formatCurrency(item.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function DocumentsTab({ invoice }: { invoice: any }) {
  const docs: any[] = invoice.documents || []

  if (docs.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">No documents attached.</div>
  }

  return (
    <div className="space-y-3">
      {docs.map((doc: any, idx: number) => (
        <Card key={doc.id || idx}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{doc.file_name || doc.name || `Document ${idx + 1}`}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.file_type || doc.content_type || '—'} {doc.uploaded_at ? ` \u00b7 ${formatDate(doc.uploaded_at)}` : ''}
                </p>
              </div>
            </div>
            {doc.file_url && (
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MatchResultTab({ invoice }: { invoice: any }) {
  const match = invoice.match_result

  if (!match) {
    return <div className="text-center py-12 text-muted-foreground text-sm">No match result available. Trigger 3-way matching first.</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">3-Way Match Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PO Match */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Purchase Order</p>
                {match.po_matched ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">PO: {match.po_number || '—'}</p>
              {match.po_variance != null && (
                <p className="text-xs">
                  Variance: <span className={match.po_variance === 0 ? 'text-green-600' : 'text-amber-600'}>{formatCurrency(match.po_variance)}</span>
                </p>
              )}
            </div>
            {/* GRN Match */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Goods Receipt</p>
                {match.grn_matched ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">GRN: {match.grn_number || '—'}</p>
              {match.grn_variance != null && (
                <p className="text-xs">
                  Variance: <span className={match.grn_variance === 0 ? 'text-green-600' : 'text-amber-600'}>{formatCurrency(match.grn_variance)}</span>
                </p>
              )}
            </div>
            {/* Tolerance */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Within Tolerance</p>
                {match.within_tolerance ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Yes</Badge>
                ) : (
                  <Badge variant="destructive">No</Badge>
                )}
              </div>
              {match.tolerance_percentage != null && (
                <p className="text-xs text-muted-foreground">Tolerance: {match.tolerance_percentage}%</p>
              )}
              {match.total_variance != null && (
                <p className="text-xs">
                  Total variance: <span className="font-medium">{formatCurrency(match.total_variance)}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match details / notes */}
      {match.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{match.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PaymentsTab({ invoice }: { invoice: any }) {
  const payments: any[] = invoice.payments || []

  if (payments.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">No payments recorded yet.</div>
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Reference</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Recorded By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p: any, idx: number) => (
                <tr key={p.id || idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{p.payment_date ? formatDate(p.payment_date) : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.reference || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.recorded_by_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.created_at ? formatDate(p.created_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
