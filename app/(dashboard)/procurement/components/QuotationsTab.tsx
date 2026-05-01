import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import React from 'react'

// ── Quotations Tab — shows each linked quotation individually ───────────────

const QuotationsTab = ({ linkedQuotations }: { linkedQuotations: any[] })  => {
    const router = useRouter()
  
    if (!linkedQuotations || linkedQuotations.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No quotations linked to this PR yet.
          </CardContent>
        </Card>
      )
    }
  
    return (
      <div className="space-y-4">
        {linkedQuotations.map((q: any) => (
          <Card key={q.id} className="overflow-hidden">
            <CardHeader className="border-b bg-slate-50/40 py-3 px-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground truncate">{q.vendor_name ?? '—'}</p>
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="font-mono">{q.quotation_no}</span>
                    {q.quotation_date && <span>· {q.quotation_date}</span>}
                    <span>· {q.items_count} item{q.items_count === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Total</p>
                    <p className="text-base font-bold tabular-nums">{formatCurrency(q.total_amount)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/quotation/${q.id}`)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            </CardHeader>
  
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Item</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">HSN</th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Qty</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">UOM</th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Rate</th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {q.items.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-xs text-muted-foreground">No line items.</td></tr>
                  ) : q.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3">
                        <p className="font-medium truncate" title={it.item_name}>{it.item_name}</p>
                        {it.item_code && <p className="text-[10px] font-mono text-muted-foreground">{it.item_code}</p>}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground font-mono text-xs">{it.hsn_code || '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{it.quantity}</td>
                      <td className="py-2 px-3 text-muted-foreground">{it.unit_of_measure}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(it.item_price)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{formatCurrency(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

export default QuotationsTab
