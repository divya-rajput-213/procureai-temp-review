'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Circle,
  GitFork, FileText, Package, X, Send, Eye, ListChecks, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// PR-first PO creation. The user picks an approved PR + quotation;
// /purchase-orders/create-from-pr/ builds the PO from the quotation's
// line items in one shot. Read-only "extracted" fields are shown for
// confirmation; user-editable inputs map to backend payload fields.

const GST_RATE = 18

type LinkedQuotation = {
  id: number
  ref_no: string
  quotation_no?: string
  vendor_id: number
  vendor_name: string
  status: string
  is_selected: boolean
  items_count: number
  total_amount: number
  items: Array<{
    id: number
    item_name: string
    item_code: string
    hsn_code: string | null
    quantity: number
    unit_of_measure: string
    item_price: number
    line_total: number
  }>
}

type PrDetail = {
  id: number
  hash_id: string
  pr_number: string
  description?: string
  plant_name: string
  department_name: string
  purchase_type: string
  selected_vendor_name?: string
  tracking_code?: string
  tracking_id?: number
  linked_quotations: LinkedQuotation[]
  budget_info: {
    tracking_code: string
    priority?: 'low' | 'medium' | 'high'
    approved_amount: string
    consumed_amount: string
    remaining_amount: string
  } | null
}

type PrSummary = {
  id: number
  hash_id: string
  pr_number: string
  plant_name: string
  status: string
  total_amount: number
}

// ── Small inline helpers ────────────────────────────────────────────────────

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b last:border-0 text-xs">
      {done
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}

function ChainStep({
  letter, color, title, sub, dim,
}: { letter: string; color: string; title: string; sub: string; dim?: boolean }) {
  return (
    <div className="flex gap-2 items-start py-1">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
        {letter}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-medium truncate ${dim ? 'text-muted-foreground' : ''}`}>{title}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function StepHeader({
  icon, iconBg, iconColor, n, title, sub,
}: { icon: any; iconBg: string; iconColor: string; n: number; title: string; sub: string }) {
  const Icon = icon
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <CardTitle className="text-sm">Step {n} — {title}</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const initialPrId = (() => {
    const raw = searchParams.get('pr_id')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  })()

  const [selectedPrId, setSelectedPrId] = useState<number | null>(initialPrId)
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null)

  // Editable header fields (everything sent to backend on submit)
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState('')
  // Priority defaults from PR.tracking_id.priority (low|medium|high) once
  // budget_info is loaded. User can change.
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days')
  // Billing address auto-fills from the selected vendor.
  const [billingAddress, setBillingAddress] = useState('')
  const [terms, setTerms] = useState(
    '1. All items per agreed specifications.\n'
    + '2. Vendor to provide packing list and delivery challan.\n'
    + '3. Invoice only after delivery confirmation.\n'
    + '4. Rejected goods returned at vendor cost.',
  )

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: eligiblePrs } = useQuery<PrSummary[]>({
    queryKey: ['prs-eligible-for-po'],
    queryFn: async () => {
      const [approved, vendorSelected] = await Promise.all([
        apiClient.get('/procurement/?status=approved'),
        apiClient.get('/procurement/?status=vendor_selected'),
      ])
      const a = approved.data.results ?? approved.data
      const b = vendorSelected.data.results ?? vendorSelected.data
      return [...(a || []), ...(b || [])]
    },
  })

  const { data: prDetail } = useQuery<PrDetail | null>({
    queryKey: ['pr-detail', selectedPrId],
    queryFn: async () => {
      if (!selectedPrId) return null
      const pr = (eligiblePrs || []).find((p) => p.id === selectedPrId)
      if (!pr) return null
      const { data } = await apiClient.get(`/procurement/${pr.hash_id ?? pr.id}/`)
      return data
    },
    enabled: !!selectedPrId && !!eligiblePrs,
  })

  // When PR detail loads, pre-pick the previously-selected quotation if any,
  // else the first eligible one.
  useEffect(() => {
    if (!prDetail) { setSelectedQuotationId(null); return }
    const quotes = prDetail.linked_quotations || []
    const selected = quotes.find(q => q.is_selected)
      || quotes.find(q => q.status !== 'po_raised' && q.status !== 'rejected')
    setSelectedQuotationId(selected?.id ?? null)
  }, [prDetail])

  // Pull vendor payment terms when quotation/vendor changes
  const selectedQuotation = (prDetail?.linked_quotations || []).find(
    q => q.id === selectedQuotationId,
  )

  const { data: vendor } = useQuery({
    queryKey: ['vendor', selectedQuotation?.vendor_id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendors/${selectedQuotation!.vendor_id}/`)
      return data
    },
    enabled: !!selectedQuotation?.vendor_id,
  })

  useEffect(() => {
    if (!vendor) return
    if (vendor.payment_terms) {
      const code = vendor.payment_terms as string
      const labels: Record<string, string> = {
        net15: 'Net 15 Days', net30: 'Net 30 Days', net45: 'Net 45 Days',
        net60: 'Net 60 Days', advance: 'Advance Payment',
      }
      setPaymentTerms(labels[code] || code || 'Net 30 Days')
    }
    // Compose vendor's billing address from its address fields
    const parts = [
      vendor.company_name,
      vendor.address,
      [vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', '),
      vendor.country,
    ].filter(Boolean)
    if (parts.length > 0) setBillingAddress(parts.join('\n'))
  }, [vendor])

  // Priority follows the PR's tracking_id (budget) priority. User can override.
  useEffect(() => {
    const p = prDetail?.budget_info?.priority
    if (p === 'low' || p === 'medium' || p === 'high') setPriority(p)
  }, [prDetail])

  // ── Submit ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPrId) throw new Error('No PR selected')
      const body: Record<string, any> = {
        pr_id: selectedPrId,
        payment_terms: paymentTerms,
        // Billing address is the vendor's; use it as the PO's delivery_address
        // header (the only address field on PurchaseOrder).
        delivery_address: billingAddress,
        notes: terms,
      }
      if (selectedQuotationId) body.quotation_id = selectedQuotationId
      const { data } = await apiClient.post('/purchase-orders/create-from-pr/', body)
      return data
    },
    onSuccess: (resp) => {
      toast({ title: `PO ${resp.po_number} created — review & issue` })
      router.push(`/purchase-orders/${resp.hash_id ?? resp.id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string'
        ? detail
        : detail?.error || detail?.detail || 'Failed to create PO from PR'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // ── Derived ───────────────────────────────────────────────────────────────
  const eligibleQuotes = (prDetail?.linked_quotations || []).filter(
    q => q.status !== 'po_raised' && q.status !== 'rejected',
  )

  const budgetInfo = prDetail?.budget_info
  const remainingBudget = budgetInfo ? Number(budgetInfo.remaining_amount) : null
  const subTotal = selectedQuotation ? Number(selectedQuotation.total_amount || 0) : 0
  const gstAmount = useMemo(() => subTotal * (GST_RATE / 100), [subTotal])
  const grandTotal = subTotal + gstAmount
  const budgetWillExceed = remainingBudget !== null && grandTotal > remainingBudget
  const budgetAfterPO = remainingBudget !== null && selectedQuotation
    ? remainingBudget - grandTotal
    : null

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Create Purchase Order</h1>
          <p className="text-sm text-muted-foreground">
            PR-first flow: select PR → pick approved QT → auto-fill all fields → issue PO
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/purchase-orders')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Main ── */}
        <div className="space-y-6 min-w-0">

          {/* Step 1 — Select PR (with quotation + vendor nested) */}
          <Card>
            <CardHeader>
              <StepHeader
                icon={GitFork} iconBg="bg-purple-100" iconColor="text-purple-700"
                n={1} title="Select Purchase Request"
                sub="Vendor, quotation, budget, plant and department all come from the PR"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Purchase Request <span className="text-red-500">*</span></Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={selectedPrId ?? ''}
                  onChange={(e) => setSelectedPrId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Select a PR —</option>
                  {(eligiblePrs || []).map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.pr_number} — {pr.plant_name ?? '—'} · {formatCurrency(pr.total_amount)} · {pr.status === 'vendor_selected' ? 'Vendor Selected' : 'Approved'}
                    </option>
                  ))}
                </select>
                {(eligiblePrs?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No approved PRs available. Approve a PR before raising a PO.
                  </p>
                )}
              </div>

              {prDetail && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4 space-y-3">
                  {prDetail.description && (
                    <p className="text-sm text-purple-900">{prDetail.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* PR Code — clickable */}
                    <div className="bg-background rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">PR Code</p>
                      <Link
                        href={`/procurement/${prDetail.hash_id ?? prDetail.id}`}
                        className="text-xs font-bold font-mono text-purple-700 hover:underline"
                      >
                        {prDetail.pr_number}
                      </Link>
                    </div>

                    {/* Tracking ID — clickable when ID known */}
                    <div className="bg-background rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tracking ID</p>
                      {prDetail.tracking_id ? (
                        <Link
                          href={`/budget/${prDetail.tracking_id}`}
                          className="text-xs font-medium font-mono text-blue-700 hover:underline"
                        >
                          {prDetail.tracking_code || '—'}
                        </Link>
                      ) : (
                        <p className="text-xs font-medium font-mono">{prDetail.tracking_code || '—'}</p>
                      )}
                    </div>

                    {/* Budget Remaining */}
                    <div className="bg-background rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget Remaining</p>
                      <p className={`text-xs font-bold ${budgetWillExceed ? 'text-red-700' : 'text-teal-700'}`}>
                        {budgetInfo ? formatCurrency(budgetInfo.remaining_amount) : '—'}
                      </p>
                    </div>

                    {/* Vendor — clickable */}
                    <div className="bg-background rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendor</p>
                      {selectedQuotation ? (
                        <Link
                          href={`/vendors/${selectedQuotation.vendor_id}`}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          {selectedQuotation.vendor_name}
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">No quotation on PR</p>
                      )}
                    </div>

                    {/* Quotation — clickable, no dropdown */}
                    <div className="bg-background rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Quotation</p>
                      {selectedQuotation ? (
                        <Link
                          href={`/quotation/${selectedQuotation.id}`}
                          className="text-xs font-mono font-semibold text-purple-700 hover:underline"
                        >
                          {selectedQuotation.quotation_no || selectedQuotation.ref_no}
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* QT Total */}
                    <div className="bg-background rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">QT Total</p>
                      <p className="text-xs font-bold text-teal-700">
                        {selectedQuotation ? formatCurrency(selectedQuotation.total_amount) : '—'}
                      </p>
                    </div>
                  </div>

                  {!selectedQuotation && eligibleQuotes.length === 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                      No eligible quotation on this PR. PO will be created from PR estimates.
                    </div>
                  )}

                  {selectedQuotation && budgetWillExceed && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      Quotation total exceeds remaining budget by {formatCurrency(grandTotal - (remainingBudget ?? 0))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — PO Header */}
          {prDetail && (
            <Card>
              <CardHeader>
                <StepHeader
                  icon={FileText} iconBg="bg-blue-100" iconColor="text-blue-700"
                  n={2} title="PO Header"
                  sub="Dates, priority, billing address and terms"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>PO Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Delivery Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <select
                      className="w-full h-10 border rounded-md px-3 text-sm bg-background capitalize"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label>Billing Address</Label>
                  <textarea
                    className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-background resize-y"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Selects vendor address once a quotation is picked"
                  />
                </div>

                <div>
                  <Label>Terms &amp; Conditions</Label>
                  <textarea
                    className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-background resize-y"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3 — Line items */}
          {selectedQuotation && (
            <Card>
              <CardHeader>
                <StepHeader
                  icon={Package} iconBg="bg-green-100" iconColor="text-green-700"
                  n={3} title="Line Items"
                  sub={`Pulled from quotation ${selectedQuotation.quotation_no || selectedQuotation.ref_no}`}
                />
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-t">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase w-12">#</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase">Item</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase">HSN</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs uppercase">Qty</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase">UOM</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs uppercase">Unit Price</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs uppercase">Total</th>
                        <th className="text-center px-4 py-2 font-medium text-muted-foreground text-xs uppercase">GST%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuotation.items.map((it, i) => (
                        <tr key={it.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{it.item_name}</p>
                            {it.item_code && <p className="text-xs text-muted-foreground font-mono">{it.item_code}</p>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{it.hsn_code || '—'}</td>
                          <td className="px-4 py-2.5 text-right">{it.quantity}</td>
                          <td className="px-4 py-2.5">{it.unit_of_measure}</td>
                          <td className="px-4 py-2.5 text-right">{formatCurrency(it.item_price)}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(it.line_total)}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{GST_RATE}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t">
                        <td colSpan={6} className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Sub Total</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(subTotal)}</td>
                        <td />
                      </tr>
                      <tr className="bg-slate-50 border-t">
                        <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground">IGST @ {GST_RATE}%</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(gstAmount)}</td>
                        <td />
                      </tr>
                      <tr className="bg-slate-100 border-t">
                        <td colSpan={6} className="px-4 py-2.5 text-right text-sm font-bold uppercase">Grand Total</td>
                        <td className="px-4 py-2.5 text-right text-base font-bold text-teal-700">{formatCurrency(grandTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-3 lg:sticky lg:top-4 h-fit">
          {/* PO Summary */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-xs uppercase tracking-wide">PO Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {!selectedQuotation && (
                <p className="text-xs text-muted-foreground">Select PR then quotation.</p>
              )}
              {selectedQuotation && (
                <>
                  <p className="text-xs text-muted-foreground">{selectedQuotation.vendor_name}</p>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Grand Total</p>
                    <p className="text-lg font-bold text-teal-700">{formatCurrency(grandTotal)}</p>
                  </div>
                  {budgetAfterPO !== null && (
                    <div className={`rounded-md px-3 py-2 ${budgetAfterPO < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget After PO</p>
                      <p className={`text-sm font-bold ${budgetAfterPO < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {formatCurrency(budgetAfterPO)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-xs uppercase tracking-wide">Checklist</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ChecklistRow done={!!selectedPrId} label="PR selected" />
              <ChecklistRow done={!!selectedQuotation} label="Quotation selected" />
              <ChecklistRow done={!!deliveryDate} label="Delivery date set" />
              <ChecklistRow done={!!selectedQuotation && !budgetWillExceed} label="Within budget" />
            </CardContent>
          </Card>

          {/* Document Chain */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <GitFork className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-xs uppercase tracking-wide">Document Chain</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <ChainStep
                letter="PR" color="bg-purple-100 text-purple-700"
                title={prDetail?.pr_number || '—'} sub="Purchase Request"
                dim={!prDetail}
              />
              <div className="w-px h-3 bg-border ml-3" />
              <ChainStep
                letter="QT" color="bg-slate-100 text-slate-700"
                title={selectedQuotation?.quotation_no || selectedQuotation?.ref_no || '—'}
                sub={selectedQuotation ? selectedQuotation.vendor_name : 'Quotation'}
                dim={!selectedQuotation}
              />
              <div className="w-px h-3 bg-border ml-3" />
              <ChainStep
                letter="PO" color="bg-slate-900 text-white"
                title="This Purchase Order" sub="Being created"
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Sticky bottom bar — sticks inside the main scroll container so it
          stays within the content area and never spans under the left nav. */}
      <div className="sticky bottom-0 -mx-4 md:-mx-3 px-4 md:px-3 py-3 bg-background border-t shadow-sm z-20 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/purchase-orders')}>
            <X className="w-4 h-4" /> Discard
          </Button>
          <Button
            variant="outline" size="sm" className="gap-2"
            disabled={createMutation.isPending || !selectedPrId}
            onClick={() => createMutation.mutate()}
          >
            <Save className="w-4 h-4" /> Save Draft
          </Button>
        </div>
        <Button
          size="sm" className="gap-2"
          disabled={createMutation.isPending || !selectedPrId}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Issue Purchase Order
        </Button>
      </div>
    </div>
  )
}
