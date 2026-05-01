import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api/client'
import { formatCurrency } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import React, { useState } from 'react'

const ComparisonTab = ({ prId }: { prId: number | string | null }) => {
    const { toast } = useToast()
    const [exporting, setExporting] = useState(false)
    const { data, isLoading, isError, error, refetch } = useQuery({
      queryKey: ['pr-comparison', prId],
      queryFn: async () => {
        const { data } = await apiClient.post('/quotations/compare/', { pr_id: prId })
        return data
      },
      retry: false,
    })
  
    const matrix = data?.matrix
    const ai     = data?.ai_recommendation
    const rubric = data?.rubric
  
    const handleExport = async () => {
      if (!matrix?.vendors?.length) return
      setExporting(true)
      try {
        const ids = matrix.vendors
          .map((v: any) => v.quotation_id)
          .filter((x: any) => Number.isFinite(Number(x)))
          .join(',')
        if (!ids) {
          toast({ title: 'Export failed', description: 'No quotation IDs available in the matrix.', variant: 'destructive' })
          return
        }
        const resp = await apiClient.get(`/quotations/compare-export/`, {
          params: { quotation_ids: ids, format: 'xlsx' },
          responseType: 'blob',
        })
        const url = window.URL.createObjectURL(new Blob([resp.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = `pcs-${prId}.xlsx`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } catch (err: any) {
        // axios returns the error body as a Blob when responseType=blob; read it as text/JSON
        let message = 'Could not download PCS'
        const blob = err?.response?.data
        if (blob instanceof Blob) {
          try {
            const text = await blob.text()
            const json = JSON.parse(text)
            message = json?.error ?? json?.detail ?? text.slice(0, 200)
          } catch {
            // not JSON — keep default
          }
        } else if (err?.response?.data?.error) {
          message = err.response.data.error
        }
        toast({ title: 'Export failed', description: message, variant: 'destructive' })
      } finally {
        setExporting(false)
      }
    }
  
    if (isLoading) {
      return (
        <Card>
          <CardContent className="p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Building comparison matrix…
          </CardContent>
        </Card>
      )
    }
  
    if (isError) {
      const msg = (error as any)?.response?.data?.error ?? 'Could not run comparison.'
      return (
        <Card>
          <CardContent className="p-8 text-center text-sm space-y-3">
            <p className="text-muted-foreground">{msg}</p>
            <p className="text-xs text-muted-foreground">Comparison needs at least 2 approved quotations linked to this PR.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )
    }
  
    if (!matrix?.vendors?.length) {
      return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No data to compare.</CardContent></Card>
    }
  
    const recommendedVendorId = ai?.recommended?.vendor_id
  
    return (
      <div className="space-y-4">
        {/* AI Recommendation card */}
        {ai?.recommended && (
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">AI Recommendation</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">{ai.recommended.vendor_name}</p>
                </div>
                <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm" className="gap-1.5">
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download Excel
                </Button>
              </div>
              {ai.recommended.summary && (
                <p className="text-sm text-foreground">{ai.recommended.summary}</p>
              )}
              {Array.isArray(ai.ranking) && ai.ranking.length > 0 && rubric && (
                <div className="border rounded-md bg-white overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Rank</th>
                        <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Price ({rubric.price})</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Coverage ({rubric.coverage})</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Perf. ({rubric.performance})</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Risk ({rubric.risk})</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">MSME ({rubric.msme})</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Comm. ({rubric.commercial})</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ai.ranking.map((r: any, i: number) => (
                        <tr key={r.vendor_id} className={r.vendor_id === recommendedVendorId ? 'bg-emerald-50/50' : ''}>
                          <td className="py-2 px-3 font-mono">{i + 1}</td>
                          <td className="py-2 px-3 font-medium">{r.vendor_name}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.scores?.price?.toFixed(0) ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.scores?.coverage?.toFixed(0) ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.scores?.performance?.toFixed(0) ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.scores?.risk?.toFixed(0) ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.scores?.msme?.toFixed(0) ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{r.scores?.commercial?.toFixed(0) ?? '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold">{r.total_score?.toFixed(1) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
  
        {/* Comparison matrix */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm font-semibold">Price Comparison Matrix</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground sticky left-0 bg-slate-50">Item</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Qty</th>
                  {matrix.vendors.map((v: any) => (
                    <th key={v.vendor_id} className={`text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-semibold ${v.vendor_id === recommendedVendorId ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      {v.vendor_name}
                      <span className="block text-[9px] font-mono mt-0.5">{v.quotation_no}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {matrix.items.map((it: any) => (
                  <tr key={it.master_item_id}>
                    <td className="py-2 px-3 sticky left-0 bg-white">
                      <p className="font-medium">{it.item_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{it.item_code}</p>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{it.total_quantity} {it.unit_of_measure}</td>
                    {matrix.vendors.map((v: any) => {
                      const price = it.vendor_prices?.[v.vendor_id]
                      return (
                        <td key={v.vendor_id} className={`py-2 px-3 text-right tabular-nums ${v.vendor_id === recommendedVendorId ? 'bg-emerald-50/30' : ''}`}>
                          {price ? (
                            <>
                              <span className="font-medium">{formatCurrency(price.total)}</span>
                              <span className="block text-[10px] text-muted-foreground">@ {formatCurrency(price.unit_price)}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 font-bold">
                  <td className="py-2.5 px-3 sticky left-0 bg-slate-50">Total</td>
                  <td />
                  {matrix.vendors.map((v: any) => (
                    <td key={v.vendor_id} className={`py-2.5 px-3 text-right tabular-nums ${v.vendor_id === recommendedVendorId ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                      {formatCurrency(v.total_amount)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    )
  }

export default ComparisonTab
