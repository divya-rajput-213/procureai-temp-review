'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

type ExtractedLineItem = {
  line_no: number
  item_name: string
  item_code: string
  hsn_sac: string
  quantity: number
  unit: string
  price_per_unit: number
  amount: number
}

type Quotation = {
  id: number | string
  hash_id: string
  quotation_number: string
  vendor_name: string
  vendor_address: string
  reference_person: string
  contact_no: string
  state: string
  place_of_supply: string
  customer_handling_by: string
  pr_number: string
  status: string
  uploaded_by: string
  created_at: string
  pdf_url?: string
  ref_no: string

}

type QuotationDetails = {
  quotation: Quotation | null
  items: ExtractedLineItem[]
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapLineItem(raw: any, index: number): ExtractedLineItem {
  const quantity = toNumber(raw.quantity, 0)
  const pricePerUnit = toNumber(
    raw.item_price ?? raw.price_per_unit ?? raw.unit_price,
    0
  )
  const amount = toNumber(
    raw.total_price ?? raw.amount ?? raw.line_total,
    quantity * pricePerUnit
  )

  return {
    line_no: index + 1,
    item_name: raw.item_name ?? '—',
    item_code: raw.item_code ?? '—',
    hsn_sac: raw.hsn_code ?? '—',
    quantity,
    unit: raw.unit_of_measure ?? '—',
    price_per_unit: pricePerUnit,
    amount,
  }
}

function extractLineItems(raw: any): ExtractedLineItem[] {
  return Array.isArray(raw?.items) ? raw.items.map(mapLineItem) : []
}

function mapQuotation(raw: any): Quotation {
  return {
    id: raw.id,
    hash_id: String(raw.id),
    quotation_number: raw.ref_no ?? '—',
    vendor_name: raw.vendor_name ?? '—',
    vendor_address: raw.vendor_address ?? '—',
    reference_person: raw.reference_person ?? '—',
    contact_no: raw.contact_no ?? '—',
    state: raw.state ?? '—',
    place_of_supply: raw.place_of_supply ?? '—',
    customer_handling_by: raw.customer_handling_by ?? '—',
    pr_number: raw.pr_no ?? '—',
    status: raw.status ?? 'draft',
    uploaded_by: raw.uploaded_by ?? '—',
    created_at: raw.created_at ?? raw.uploaded_at ?? '',
    pdf_url: raw.pdf_url ?? raw.file_url ?? raw.document_url,
    ref_no: raw?.ref_no
  }
}

export default function QuotationDetailsPage({ params }: { params: { quotationId: string } }) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery<QuotationDetails>({
    queryKey: ['quotation', params.quotationId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/quotations/${params.quotationId}/`)

      return {
        quotation: data ? mapQuotation(data) : null,
        items: extractLineItems(data),
      }
    },
  })

  const quotation = data?.quotation ?? null
  const items = useMemo(() => data?.items ?? [], [data?.items])

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading quotation details...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Failed to load quotation details and vendor items.
        </CardContent>
      </Card>
    )
  }

  if (!quotation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quotation not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No quotation exists for id <span className="font-mono">{params.quotationId}</span>.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col">
          {/* Top row: quotation number + status */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold leading-none">
              Quotation {quotation.quotation_number}
            </h1>
            <StatusBadge status={quotation.status} />
          </div>

          {/* Bottom row: vendor info */}
          <p className="text-sm text-muted-foreground mt-1">
            {quotation.vendor_name} · {quotation.pr_number} · {formatDate(quotation.created_at)}
          </p>
        </div>

        {/* Back button */}
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>


      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{quotation.vendor_name}</p>
                <p className="mt-1 max-w-2xl text-muted-foreground">{quotation.vendor_address}</p>
              </div>
              <p>
                <span className="font-medium">Ref:</span> {quotation.ref_no}
              </p>
              <p>
                <span className="font-medium">Contact No.:</span> {quotation.contact_no}
              </p>
              <p>
                <span className="font-medium">State:</span> {quotation.state}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-4 text-sm md:text-right">
              <p>
                <span className="font-medium">Date:</span> {formatDate(quotation.created_at)}
              </p>
              <p>
                <span className="font-medium">Place of supply:</span> {quotation.place_of_supply}
              </p>
              <p>
                <span className="font-medium">Customer Handling By:</span> {quotation.customer_handling_by}
              </p>
              <p>
                <span className="font-medium">Uploaded By:</span> {quotation.uploaded_by}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No vendor items were returned for this quotation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs w-12">#</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Item name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Item code</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">HSN/SAC</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Qty</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Unit</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Price / Unit</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr
                        key={`${quotation.hash_id}-${item.line_no}`}
                        className="hover:bg-slate-50 transition-colors select-none"
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.line_no}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{item.item_name}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.item_code}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.hsn_sac}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatINR(item.price_per_unit)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatINR(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 font-semibold" colSpan={6}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatINR(totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
