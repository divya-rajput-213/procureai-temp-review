'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Loader2, Save, Package, AlertTriangle } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { formatCurrency } from '@/lib/utils'

type LineEntry = {
  po_line: number
  received_qty: string
  accepted_qty: string
  rejected_qty: string
  rejection_reason: string
  batch_number: string
  inspection_notes: string
}

export default function CreateGRNPage() {
  const { id: poId } = useParams()
  const router = useRouter()
  const { toast } = useToast()

  // Fetch PO detail to get line items
  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: async () => { const { data } = await apiClient.get(`/purchase-orders/${poId}/`); return data },
    enabled: !!poId,
  })

  // Form state — header fields
  const [warehouse, setWarehouse] = useState('')
  const [gateEntry, setGateEntry] = useState('')
  const [challanNumber, setChallanNumber] = useState('')
  const [challanDate, setChallanDate] = useState('')
  const [notes, setNotes] = useState('')

  // Line items state — initialized when PO loads
  const [lines, setLines] = useState<LineEntry[]>([])
  const [initialized, setInitialized] = useState(false)

  // Initialize line entries from PO line items
  if (po && !initialized) {
    const poLines: any[] = po.line_items || []
    setLines(
      poLines.map((li: any) => ({
        po_line: li.id,
        received_qty: '',
        accepted_qty: '',
        rejected_qty: '0',
        rejection_reason: '',
        batch_number: '',
        inspection_notes: '',
      }))
    )
    setInitialized(true)
  }

  const updateLine = (idx: number, field: keyof LineEntry, value: string) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: value }
      // Auto-calculate: accepted = received - rejected
      if (field === 'received_qty' || field === 'rejected_qty') {
        const recv = parseFloat(updated.received_qty) || 0
        const rej = parseFloat(updated.rejected_qty) || 0
        updated.accepted_qty = String(Math.max(0, recv - rej))
      }
      return updated
    }))
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      // Filter lines with received_qty > 0
      const activeLines = lines
        .filter(l => parseFloat(l.received_qty) > 0)
        .map(l => ({
          po_line: l.po_line,
          received_qty: parseFloat(l.received_qty) || 0,
          accepted_qty: parseFloat(l.accepted_qty) || 0,
          rejected_qty: parseFloat(l.rejected_qty) || 0,
          rejection_reason: l.rejection_reason,
          batch_number: l.batch_number,
          inspection_notes: l.inspection_notes,
        }))

      if (activeLines.length === 0) throw new Error('Enter received quantity for at least one line item.')

      const payload = {
        warehouse,
        gate_entry_number: gateEntry,
        challan_number: challanNumber,
        challan_date: challanDate || null,
        notes,
        line_items_data: activeLines,
      }

      const { data } = await apiClient.post(`/purchase-orders/${poId}/grns/`, payload)
      return data
    },
    onSuccess: (data) => {
      toast({ title: `GRN ${data.grn_number} created successfully` })
      router.push(`/purchase-orders/${poId}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = err.message || (typeof detail === 'string' ? detail
        : detail?.detail || detail?.error || detail?.line_items_data
        || Object.values(detail || {}).flat().join(', ')
        || 'Failed to create GRN')
      toast({ title: String(msg), variant: 'destructive' })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!po) {
    return <div className="text-center py-12 text-muted-foreground">Purchase order not found.</div>
  }

  const poLines: any[] = po.line_items || []
  const canCreate = ['sent_to_vendor', 'acknowledged', 'partially_received', 'issued'].includes(po.status)

  if (!canCreate) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">GRN can only be created for POs that are sent to vendor / acknowledged / partially received.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/purchase-orders/${poId}`)}>
          Back to PO
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Create Goods Receipt</h1>
          <p className="text-sm text-muted-foreground">
            {po.po_number} &middot; {po.vendor_name}
          </p>
        </div>
      </div>

      {/* Receipt Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Receipt Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Warehouse / Storage Location</Label>
              <Input placeholder="e.g. Main Warehouse, Bay 3"
                value={warehouse} onChange={e => setWarehouse(e.target.value)} />
            </div>
            <div>
              <Label>Gate Entry Number</Label>
              <Input placeholder="Gate entry reference"
                value={gateEntry} onChange={e => setGateEntry(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Challan / Delivery Note Number</Label>
              <Input placeholder="Vendor's delivery challan number"
                value={challanNumber} onChange={e => setChallanNumber(e.target.value)} />
            </div>
            <div>
              <Label>Challan Date</Label>
              <Input type="date" value={challanDate} onChange={e => setChallanDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea className="w-full min-h-[60px] border rounded-md p-3 text-sm bg-background resize-y"
              placeholder="Any remarks about this delivery..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items — Receive Quantities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Line Items — Enter Received Quantities</CardTitle>
            <Badge variant="secondary">{poLines.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Item</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Ordered</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Already Received</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Pending</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-24">Received *</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-24">Rejected</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-24">Accepted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {poLines.map((li: any, idx: number) => {
                  const line = lines[idx]
                  if (!line) return null
                  const ordered = Number(li.quantity)
                  const alreadyReceived = Number(li.received_quantity || 0)
                  const pending = Number(li.pending_quantity || (ordered - alreadyReceived))
                  const receivedVal = parseFloat(line.received_qty) || 0
                  const overDelivery = receivedVal > pending

                  return (
                    <tr key={li.id} className={overDelivery ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2.5 text-muted-foreground">{li.line_number}</td>
                      <td className="px-3 py-2.5">
                        <div>
                          <span className="font-mono text-xs text-primary">{li.item_code_detail?.code || ''}</span>
                          <span className="ml-2">{li.description}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {li.unit_of_measure} &middot; {formatCurrency(li.unit_rate)}/unit
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{ordered}</td>
                      <td className="px-3 py-2.5 text-right">{alreadyReceived}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {pending}
                      </td>
                      <td className="px-3 py-2.5">
                        <Input type="number" step="0.01" min="0"
                          className="h-8 text-right text-sm w-24 ml-auto"
                          placeholder="0"
                          value={line.received_qty}
                          onChange={e => updateLine(idx, 'received_qty', e.target.value)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input type="number" step="0.01" min="0"
                          className="h-8 text-right text-sm w-24 ml-auto"
                          placeholder="0"
                          value={line.rejected_qty}
                          onChange={e => updateLine(idx, 'rejected_qty', e.target.value)} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-emerald-700">
                        {line.accepted_qty || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Over-delivery warning */}
          {lines.some((l, i) => {
            const pending = Number(poLines[i]?.pending_quantity || 0)
            return (parseFloat(l.received_qty) || 0) > pending
          }) && (
            <div className="flex items-center gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                One or more items have received quantity exceeding the pending amount. The system allows up to 2% over-delivery tolerance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Details — collapsible per line */}
      <Card>
        <CardHeader><CardTitle className="text-base">Additional Details (Optional)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {poLines.map((li: any, idx: number) => {
            const line = lines[idx]
            if (!line) return null
            const receivedVal = parseFloat(line.received_qty) || 0
            if (receivedVal <= 0) return null

            return (
              <div key={li.id} className="border rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs text-primary">{li.item_code_detail?.code}</span>
                  <span className="ml-2">{li.description}</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Batch Number</Label>
                    <Input className="h-8" placeholder="Batch / lot number"
                      value={line.batch_number}
                      onChange={e => updateLine(idx, 'batch_number', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Inspection Notes</Label>
                    <Input className="h-8" placeholder="Quality inspection remarks"
                      value={line.inspection_notes}
                      onChange={e => updateLine(idx, 'inspection_notes', e.target.value)} />
                  </div>
                  {parseFloat(line.rejected_qty) > 0 && (
                    <div>
                      <Label className="text-xs">Rejection Reason *</Label>
                      <Input className="h-8" placeholder="Reason for rejection"
                        value={line.rejection_reason}
                        onChange={e => updateLine(idx, 'rejection_reason', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {lines.every(l => (parseFloat(l.received_qty) || 0) <= 0) && (
            <p className="text-sm text-muted-foreground">Enter received quantities above to see additional detail fields.</p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {lines.some(l => (parseFloat(l.received_qty) || 0) > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Items receiving: <span className="font-medium text-foreground">{lines.filter(l => (parseFloat(l.received_qty) || 0) > 0).length} / {poLines.length}</span>
                </span>
                <span className="text-muted-foreground">
                  Total received: <span className="font-medium text-foreground">{lines.reduce((s, l) => s + (parseFloat(l.received_qty) || 0), 0)}</span>
                </span>
                <span className="text-muted-foreground">
                  Total accepted: <span className="font-medium text-emerald-700">{lines.reduce((s, l) => s + (parseFloat(l.accepted_qty) || 0), 0)}</span>
                </span>
                <span className="text-muted-foreground">
                  Total rejected: <span className="font-medium text-red-600">{lines.reduce((s, l) => s + (parseFloat(l.rejected_qty) || 0), 0)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/purchase-orders/${poId}`)}>Cancel</Button>
        <Button
          disabled={createMutation.isPending || lines.every(l => (parseFloat(l.received_qty) || 0) <= 0)}
          className="gap-2"
          onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
          Create GRN
        </Button>
      </div>
    </div>
  )
}
