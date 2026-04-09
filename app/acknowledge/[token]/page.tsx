'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Loader2, FileText, AlertTriangle } from 'lucide-react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export default function AcknowledgePOPage() {
  const { token } = useParams()
  const [ackName, setAckName] = useState('')
  const [ackDelivery, setAckDelivery] = useState('')
  const [ackNotes, setAckNotes] = useState('')
  const [done, setDone] = useState(false)

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['public-po', token],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/purchase-orders/public/acknowledge/${token}/`)
      return data
    },
    enabled: !!token,
    retry: 1,
  })

  const ackMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${API}/purchase-orders/public/acknowledge/${token}/confirm/`, {
        acknowledged_by: ackName,
        expected_delivery: ackDelivery || null,
        notes: ackNotes,
      })
      return data
    },
    onSuccess: () => setDone(true),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !po) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h1>
          <p className="text-gray-500">This acknowledgement link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acknowledged!</h1>
          <p className="text-gray-600 mb-1">
            PO <span className="font-semibold">{po.po_number}</span> has been acknowledged successfully.
          </p>
          {ackDelivery && (
            <p className="text-sm text-gray-500">Expected delivery: {ackDelivery}</p>
          )}
          <p className="text-xs text-gray-400 mt-4">You may close this window.</p>
        </div>
      </div>
    )
  }

  if (po.already_acknowledged) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Already Acknowledged</h1>
          <p className="text-gray-500">
            PO <span className="font-semibold">{po.po_number}</span> has already been acknowledged.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-slate-800 px-6 py-5">
            <h1 className="text-xl font-bold text-white">Acknowledge Purchase Order</h1>
            <p className="text-slate-300 text-sm mt-1">Please review and confirm receipt of this PO</p>
          </div>

          {/* PO Summary */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">PO Number</p>
                <p className="text-lg font-bold text-gray-800">{po.po_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</p>
                <p className="text-lg font-bold text-green-700">{po.currency_code} {Number(po.total_amount).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">PO Type</p>
                <p className="text-sm font-medium text-gray-700">{po.po_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Vendor</p>
                <p className="text-sm font-medium text-gray-700">{po.vendor_name}</p>
              </div>
              {po.payment_terms && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Terms</p>
                  <p className="text-sm font-medium text-gray-700">{po.payment_terms}</p>
                </div>
              )}
              {po.delivery_address && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery Address</p>
                  <p className="text-sm font-medium text-gray-700">{po.delivery_address}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" /> Line Items
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Description</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">UOM</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Rate</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(po.line_items || []).map((li: any) => (
                  <tr key={li.line_number} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-500">{li.line_number}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-800">{li.item_code}</span>
                      <span className="block text-xs text-gray-500">{li.description}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{li.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-500">{li.unit_of_measure}</td>
                    <td className="px-4 py-2.5 text-right">{Number(li.unit_rate).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{Number(li.total_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t">
                  <td colSpan={5} className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Subtotal</td>
                  <td className="px-4 py-2 text-right font-bold">{po.currency_code} {Number(po.subtotal_amount).toLocaleString()}</td>
                </tr>
                {Number(po.tax_amount) > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Tax</td>
                    <td className="px-4 py-2 text-right font-bold">{po.currency_code} {Number(po.tax_amount).toLocaleString()}</td>
                  </tr>
                )}
                <tr className="bg-green-50 border-t-2">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-800">Total</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-green-700">{po.currency_code} {Number(po.total_amount).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Acknowledge Form */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b bg-cyan-50">
            <h2 className="text-sm font-semibold text-cyan-800 uppercase tracking-wide">Confirm Acknowledgement</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <Label>Your Name / Contact Person *</Label>
              <Input value={ackName} onChange={e => setAckName(e.target.value)}
                placeholder="Enter your name" />
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={ackDelivery} onChange={e => setAckDelivery(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">
                If you cannot meet the requested date, enter your proposed date here.
              </p>
            </div>
            <div>
              <Label>Notes / Comments</Label>
              <textarea className="w-full min-h-[80px] border rounded-md p-3 text-sm resize-y"
                value={ackNotes} onChange={e => setAckNotes(e.target.value)}
                placeholder="Any conditions, alternate dates, or remarks..." />
            </div>

            {ackMutation.isError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-xs text-red-700">
                  {(ackMutation.error as any)?.response?.data?.error || 'Failed to acknowledge. Please try again.'}
                </p>
              </div>
            )}

            <Button
              className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-white py-3"
              disabled={!ackName.trim() || ackMutation.isPending}
              onClick={() => ackMutation.mutate()}>
              {ackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Acknowledge Purchase Order
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Powered by ProcureAI
        </p>
      </div>
    </div>
  )
}
