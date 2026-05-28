'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Loader2, Package, AlertTriangle, X } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { useAuthStore } from '@/lib/stores/auth.store'

// Flat GRN create page. Two modes:
// - With ?po=<hash_id>  → PO is locked (came from PO list/detail)
// - Without              → user picks a PO from the dropdown
// Submit goes to the nested endpoint /purchase-orders/{po_hash_id}/grns/

const GRN_ELIGIBLE_STATUSES = ['sent_to_vendor', 'acknowledged', 'partially_received', 'issued']

const HEADER_CONDITIONS = [
  { value: 'good', label: 'Good — All items accepted' },
  { value: 'partial', label: 'Partial — Some items rejected' },
  { value: 'damaged', label: 'Damaged — Goods rejected' },
]

type LineCondition = 'good' | 'damaged' | 'rejected'

type LineEntry = {
  po_line: number
  received_qty: string
  condition: LineCondition
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function CreateGRNFlatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const currentUser = useAuthStore(s => s.user)

  const poFromUrl = searchParams.get('po')
  const poLocked = !!poFromUrl
  const [selectedPoId, setSelectedPoId] = useState<string | null>(poFromUrl)

  // ── Eligible POs (only fetched when user needs to pick) ─────────────────
  const { data: eligiblePos } = useQuery({
    queryKey: ['pos-eligible-for-grn'],
    queryFn: async () => {
      const results = await Promise.all(
        GRN_ELIGIBLE_STATUSES.map(s => apiClient.get(`/purchase-orders/?status=${s}`)),
      )
      return results.flatMap(r => r.data.results ?? r.data ?? []) as any[]
    },
    enabled: !poLocked,
  })

  // ── PO detail for the picked PO ─────────────────────────────────────────
  const { data: po } = useQuery({
    queryKey: ['purchase-order', selectedPoId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/purchase-orders/${selectedPoId}/`)
      return data
    },
    enabled: !!selectedPoId,
  })

  // ── Form header state ───────────────────────────────────────────────────
  const [grnDate, setGrnDate] = useState(todayIso())
  const [challanNumber, setChallanNumber] = useState('')
  const [storageLocation, setStorageLocation] = useState('')
  const [headerCondition, setHeaderCondition] = useState<'good' | 'partial' | 'damaged'>('good')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<LineEntry[]>([])

  // (Re)initialize line entries whenever a new PO is loaded
  useEffect(() => {
    if (!po) { setLines([]); return }
    const poLines: any[] = po.line_items || []
    setLines(poLines.map((li: any) => {
      const pending = Number(li.pending_quantity ?? (Number(li.quantity) - Number(li.received_quantity || 0)))
      return {
        po_line: li.id,
        received_qty: pending > 0 ? String(pending) : '',
        condition: 'good',
      }
    }))
  }, [po])

  // Header condition is a default — when user changes it, propagate to each row
  const applyHeaderCondition = (cond: 'good' | 'partial' | 'damaged') => {
    setHeaderCondition(cond)
    setLines(prev => prev.map(l => ({
      ...l,
      condition: cond === 'good' ? 'good' : cond === 'damaged' ? 'damaged' : l.condition,
    })))
  }

  const updateLine = (idx: number, patch: Partial<LineEntry>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  // Derived accepted/rejected from per-row condition + received
  const computed = useMemo(() => lines.map(l => {
    const received = parseFloat(l.received_qty) || 0
    const accepted = l.condition === 'good' ? received : 0
    const rejected = received - accepted
    return { received, accepted, rejected }
  }), [lines])

  const poLines: any[] = po?.line_items || []
  const canCreate = !!po && GRN_ELIGIBLE_STATUSES.includes(po.status)
  const hasAnyReceived = computed.some(c => c.received > 0)

  // ── Submit ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPoId) throw new Error('Select a PO first.')
      if (!challanNumber.trim()) throw new Error('Enter the delivery challan number.')

      const activeLines = lines
        .map((l, i) => ({ line: l, c: computed[i] }))
        .filter(({ c }) => c.received > 0)
        .map(({ line, c }) => ({
          po_line: line.po_line,
          received_qty: c.received,
          accepted_qty: c.accepted,
          rejected_qty: c.rejected,
          rejection_reason: c.rejected > 0 ? `Marked ${line.condition} on receipt` : '',
        }))

      if (activeLines.length === 0) throw new Error('Enter received quantity for at least one line item.')

      const payload = {
        warehouse: storageLocation,
        challan_number: challanNumber,
        challan_date: grnDate || null,
        notes: remarks,
        line_items_data: activeLines,
      }
      const { data } = await apiClient.post(`/purchase-orders/${selectedPoId}/grns/`, payload)
      return data
    },
    onSuccess: (data) => {
      toast({ title: `GRN ${data.grn_number} created successfully` })
      router.push('/grns')
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

  const receivedByName = currentUser
    ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim() || currentUser.email || ''
    : ''

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/grns')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Record Goods Receipt</h1>
          <p className="text-sm text-muted-foreground">Confirm items physically received from vendor</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Header fields — 2-col grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PO Reference */}
            <div>
              <Label>PO Reference <span className="text-red-500">*</span></Label>
              {poLocked ? (
                po ? (
                  <div className="h-10 flex items-center px-3 border rounded-md bg-blue-50 text-sm">
                    <span className="font-mono font-semibold text-blue-700">{po.po_number}</span>
                    <span className="text-blue-700/80 ml-2">— {po.vendor_name}</span>
                    <Badge variant="secondary" className="ml-auto">From PO</Badge>
                  </div>
                ) : (
                  <div className="h-10 flex items-center px-3 border rounded-md text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading PO…
                  </div>
                )
              ) : (
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={selectedPoId ?? ''}
                  onChange={(e) => setSelectedPoId(e.target.value || null)}
                >
                  <option value="">— Select a PO —</option>
                  {(eligiblePos || []).map((p: any) => (
                    <option key={p.id} value={p.hash_id ?? p.id}>
                      {p.po_number} — {p.vendor_name} · {String(p.status).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* GRN Date */}
            <div>
              <Label>GRN Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} />
            </div>

            {/* Delivery Challan No. */}
            <div>
              <Label>Delivery Challan No. <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. DC-2026-0089"
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Received By — auto-filled from current user, read-only */}
            <div>
              <Label>Received By</Label>
              <Input value={receivedByName} disabled />
            </div>

            {/* Condition (header) */}
            <div>
              <Label>Condition</Label>
              <select
                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                value={headerCondition}
                onChange={(e) => applyHeaderCondition(e.target.value as 'good' | 'partial' | 'damaged')}
              >
                {HEADER_CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Storage Location */}
            <div>
              <Label>Storage Location</Label>
              <Input
                placeholder="e.g. Warehouse-3, Rack-B4"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
              />
            </div>
          </div>

          {/* Ineligible-PO warning */}
          {po && !canCreate && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              GRN can only be recorded against POs that are issued / sent / acknowledged / partially received.
              This PO is <strong className="font-semibold">{String(po.status).replace(/_/g, ' ')}</strong>.
            </div>
          )}

          {/* Items Received */}
          {canCreate && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items Received</p>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-xs font-medium text-muted-foreground uppercase">
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2 w-24">PO Qty</th>
                      <th className="text-right px-3 py-2 w-28">Received</th>
                      <th className="text-right px-3 py-2 w-24">Accepted</th>
                      <th className="text-left px-3 py-2 w-32">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {poLines.map((li: any, idx: number) => {
                      const line = lines[idx]
                      const c = computed[idx]
                      if (!line || !c) return null
                      const pending = Number(li.pending_quantity ?? (Number(li.quantity) - Number(li.received_quantity || 0)))
                      const overDelivery = c.received > pending && pending > 0
                      return (
                        <tr key={li.id} className={overDelivery ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{li.description}</p>
                            <p className="text-xs text-muted-foreground font-mono">{li.item_code_detail?.code || ''}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {li.quantity} {li.unit_of_measure}
                          </td>
                          <td className="px-3 py-2.5">
                            <Input
                              type="number" step="0.01" min="0"
                              className="h-8 text-right text-sm w-24 ml-auto"
                              value={line.received_qty}
                              onChange={(e) => updateLine(idx, { received_qty: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{c.accepted || '—'}</td>
                          <td className="px-3 py-2.5">
                            <select
                              className="h-8 border rounded-md px-2 text-xs bg-background w-full"
                              value={line.condition}
                              onChange={(e) => updateLine(idx, { condition: e.target.value as LineCondition })}
                            >
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Over-delivery hint */}
              {computed.some((c, i) => {
                const pending = Number(poLines[i]?.pending_quantity ?? 0)
                return pending > 0 && c.received > pending
              }) && (
                <div className="flex items-center gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">
                    One or more lines exceed the pending PO quantity. System allows up to 2% over-delivery.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Remarks */}
          {canCreate && (
            <div>
              <Label>Remarks</Label>
              <textarea
                className="w-full min-h-[80px] border rounded-md p-3 text-sm bg-background resize-y"
                placeholder="Condition notes, damaged items, partial receipt reason…"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          )}

          {/* Actions */}
          {canCreate && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm" className="gap-2"
                disabled={createMutation.isPending || !hasAnyReceived}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Confirm Receipt &amp; Create GRN
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/grns')}>
                <X className="w-4 h-4" /> Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
