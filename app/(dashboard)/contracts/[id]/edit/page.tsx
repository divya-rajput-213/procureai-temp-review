'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Loader2, Save, Printer, AlertTriangle, Eye, FileText,
} from 'lucide-react'
import apiClient from '@/lib/api/client'

const CONTRACT_TYPES = [
  { value: 'MSA', label: 'Master Supply Agreement (MSA)' },
  { value: 'LTA', label: 'Long-Term Agreement (LTA)' },
  { value: 'SLA', label: 'Service Level Agreement (SLA)' },
  { value: 'Tooling', label: 'Tooling Agreement' },
  { value: 'NDA', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'SOW', label: 'Statement of Work (SOW)' },
]

function formatDocDate(d: string) {
  if (!d) return '___________'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function EditContractPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [previewTab, setPreviewTab] = useState<'preview' | 'edit'>('preview')

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => { const { data } = await apiClient.get(`/contracts/${id}/`); return data },
    enabled: !!id,
  })

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => { const r = await apiClient.get('/users/plants/'); return r.data.results ?? r.data },
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const r = await apiClient.get('/users/departments/'); return r.data.results ?? r.data },
  })

  const selectedType = contract?.contract_type

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm()
  const bodyContent = watch('body_content') || ''
  const formTitle = watch('title')
  const formType = watch('contract_type')
  const formValue = watch('estimated_value')
  const formCurrency = watch('currency_code')
  const formStart = watch('start_date')
  const formEnd = watch('end_date')
  const formDuration = watch('duration_months')
  const formPayment = watch('payment_terms')
  const formIncoterms = watch('incoterms')

  useEffect(() => {
    if (contract) {
      reset({
        title: contract.title,
        contract_type: contract.contract_type,
        estimated_value: contract.estimated_value,
        currency_code: contract.currency_code,
        start_date: contract.start_date,
        end_date: contract.end_date,
        duration_months: contract.duration_months,
        payment_terms: contract.payment_terms || '',
        incoterms: contract.incoterms || '',
        body_content: contract.body_content || '',
        plant: contract.plant,
        department: contract.department,
      })
    }
  }, [contract, reset])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        estimated_value: parseFloat(data.estimated_value),
        duration_months: parseInt(data.duration_months),
        plant: parseInt(data.plant),
        department: parseInt(data.department),
      }
      const { data: resp } = await apiClient.patch(`/contracts/${id}/`, payload)
      return resp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] })
      toast({ title: 'Contract saved' })
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = typeof detail === 'string' ? detail
        : detail?.detail || detail?.error || Object.values(detail || {}).flat().join(', ') || 'Failed'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${formTitle || 'Contract'} - ${contract?.contract_id || ''}</title>
    <style>@page { margin: 2cm; } body { font-family: 'Times New Roman', serif; }</style>
    </head><body>${documentHTML}</body></html>`)
    printWindow.document.close()
    printWindow.print()
  }

  const documentHTML = useMemo(() => {
    const vendorName = contract?.vendor_name || '___________'
    const plantName = contract?.plant_name || '___________'
    const deptName = contract?.department_name || '___________'
    const typeFull = CONTRACT_TYPES.find(t => t.value === formType)?.label || formType || ''

    const replacements: Record<string, string> = {
      'vendor_name': vendorName, 'vendor_company': vendorName,
      'plant_name': plantName, 'department_name': deptName,
      'contract_value': `${formCurrency || 'INR'} ${Number(formValue || 0).toLocaleString('en-IN')}`,
      'contract_type': typeFull,
      'start_date': formatDocDate(formStart), 'end_date': formatDocDate(formEnd),
      'duration': `${formDuration || '___'} months`,
      'payment_terms': formPayment || '___________', 'incoterms': formIncoterms || '___________',
    }

    let body = bodyContent
    for (const [key, val] of Object.entries(replacements)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val)
    }

    return `
      <div style="font-family: 'Times New Roman', serif; color: #1a1a1a;">
        <div style="text-align: center; border-bottom: 3px double #333; padding-bottom: 16px; margin-bottom: 24px;">
          <p style="font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; margin: 0;">Contract Agreement</p>
          <h1 style="font-size: 18px; font-weight: bold; margin: 8px 0 4px; text-transform: uppercase;">${typeFull}</h1>
          <p style="font-size: 14px; margin: 4px 0;">${formTitle || 'Untitled Contract'}</p>
          <p style="font-size: 11px; color: #666; margin: 4px 0;">Contract No: <strong>${contract?.contract_id || 'CLM-XXXX-XX-XXXXX'}</strong> &nbsp;|&nbsp; Version: v${contract?.current_version || '0.1'}</p>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 1px;">Parties</h2>
          <table style="width: 100%; font-size: 12px;"><tr>
            <td style="width: 50%; vertical-align: top; padding-right: 16px;">
              <p style="font-weight: bold; margin: 0 0 4px;">BUYER (First Party)</p>
              <p style="margin: 2px 0;">Plant: ${plantName}</p>
              <p style="margin: 2px 0;">Department: ${deptName}</p>
            </td>
            <td style="width: 50%; vertical-align: top;">
              <p style="font-weight: bold; margin: 0 0 4px;">VENDOR (Second Party)</p>
              <p style="margin: 2px 0;"><strong>${vendorName}</strong></p>
            </td>
          </tr></table>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 1px;">Key Terms</h2>
          <table style="width: 100%; font-size: 12px;">
            <tr><td style="padding: 4px 0; font-weight: bold; width: 35%;">Contract Value:</td><td>${formCurrency || 'INR'} ${Number(formValue || 0).toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Effective Date:</td><td>${formatDocDate(formStart)}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Expiry Date:</td><td>${formatDocDate(formEnd)}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Duration:</td><td>${formDuration || '___'} months</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Payment Terms:</td><td>${formPayment || 'As per agreement'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Incoterms:</td><td>${formIncoterms || 'N/A'}</td></tr>
          </table>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 1px;">Terms & Conditions</h2>
          <div style="font-size: 12px; line-height: 1.8; white-space: pre-wrap;">${body || '<em style="color: #999;">No contract body yet.</em>'}</div>
        </div>
        <div style="margin-top: 40px;">
          <h2 style="font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 20px; letter-spacing: 1px;">Signatures</h2>
          <table style="width: 100%; font-size: 12px;"><tr>
            <td style="width: 50%; padding-right: 24px; vertical-align: top;">
              <p style="font-weight: bold; margin-bottom: 40px;">For and on behalf of the BUYER</p>
              <div style="border-bottom: 1px solid #333; margin-bottom: 4px;">&nbsp;</div>
              <p style="font-size: 10px; color: #666;">Authorized Signatory &nbsp;&nbsp; Date: ___________</p>
            </td>
            <td style="width: 50%; vertical-align: top;">
              <p style="font-weight: bold; margin-bottom: 40px;">For and on behalf of ${vendorName}</p>
              <div style="border-bottom: 1px solid #333; margin-bottom: 4px;">&nbsp;</div>
              <p style="font-size: 10px; color: #666;">Authorized Signatory &nbsp;&nbsp; Date: ___________</p>
            </td>
          </tr></table>
        </div>
      </div>
    `
  }, [bodyContent, formTitle, formType, formValue, formCurrency, formStart, formEnd, formDuration, formPayment, formIncoterms, contract])

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!contract) return <div className="text-center py-12 text-muted-foreground">Contract not found.</div>
  if (contract.status !== 'draft' && contract.status !== 'internal_review') {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">This contract can only be edited in Draft or Internal Review status.</p>
        <Button variant="outline" onClick={() => router.push(`/contracts/${id}`)}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/contracts/${id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Edit — {contract.contract_id}</h1>
            <p className="text-xs text-muted-foreground">Edit fields on the right, preview updates live on the left</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5" /> Print / PDF
        </Button>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>

          {/* ──── LEFT: Document Preview ──── */}
          <div className="border rounded-lg bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Document Preview</span>
                <Badge variant="secondary" className="text-[9px]">v{contract.current_version}</Badge>
              </div>
              <div className="flex gap-1">
                <button type="button"
                  className={`px-2 py-0.5 text-[10px] rounded ${previewTab === 'preview' ? 'bg-white shadow text-primary font-medium' : 'text-muted-foreground'}`}
                  onClick={() => setPreviewTab('preview')}>
                  <Eye className="w-3 h-3 inline mr-1" />Preview
                </button>
                <button type="button"
                  className={`px-2 py-0.5 text-[10px] rounded ${previewTab === 'edit' ? 'bg-white shadow text-primary font-medium' : 'text-muted-foreground'}`}
                  onClick={() => setPreviewTab('edit')}>
                  Raw Edit
                </button>
              </div>
            </div>

            {previewTab === 'preview' ? (
              <div className="flex-1 overflow-y-auto p-8 bg-white" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                <div dangerouslySetInnerHTML={{ __html: documentHTML }} />
              </div>
            ) : (
              <textarea
                className="flex-1 p-4 text-sm font-mono leading-relaxed resize-none border-0 focus:ring-0 focus:outline-none"
                style={{ minHeight: '600px' }}
                {...register('body_content')}
                placeholder="Type contract terms here..."
              />
            )}
          </div>

          {/* ──── RIGHT: Form ──── */}
          <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>

            {/* Contract Info + Template */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Contract Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 pb-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input className="h-8 text-sm" {...register('title', { required: true })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Input className="h-8 text-sm bg-slate-50" value={CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label || contract.contract_type} disabled />
                  </div>
                  <div>
                    <Label className="text-xs">Template</Label>
                    <Input className="h-8 text-sm bg-slate-50" value={contract.template_name || 'None'} disabled />
                  </div>
                  <div>
                    <Label className="text-xs">Vendor</Label>
                    <Input className="h-8 text-sm bg-slate-50" value={contract.vendor_name} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Value & Duration */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Value & Duration</CardTitle></CardHeader>
              <CardContent className="space-y-3 pb-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Value</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" {...register('estimated_value')} /></div>
                  <div><Label className="text-xs">Currency</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('currency_code')}>
                      <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div><Label className="text-xs">Duration (months)</Label>
                    <Input type="number" className="h-8 text-sm" {...register('duration_months')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Start Date</Label><Input type="date" className="h-8 text-sm" {...register('start_date')} /></div>
                  <div><Label className="text-xs">End Date</Label><Input type="date" className="h-8 text-sm" {...register('end_date')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Plant</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('plant')}>
                      {(plants || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-xs">Department</Label>
                    <select className="w-full h-8 border rounded-md px-2 text-xs bg-background" {...register('department')}>
                      {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Payment Terms</Label>
                    <Input className="h-8 text-sm" {...register('payment_terms')} placeholder="Net 30 days" /></div>
                  <div><Label className="text-xs">Incoterms</Label>
                    <Input className="h-8 text-sm" {...register('incoterms')} placeholder="FOB, CIF" /></div>
                </div>
              </CardContent>
            </Card>

            {/* LTA Warning */}
            {selectedType === 'LTA' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">LTA requires Price Revision Clause</p>
                  <p className="text-amber-700 mt-0.5">Verify it exists in the preview.</p>
                </div>
              </div>
            )}

            {/* Version History */}
            {(contract.versions || []).length > 0 && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Version History</CardTitle></CardHeader>
                <CardContent className="space-y-2 pb-3">
                  {contract.versions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 border rounded text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${v.is_major ? 'bg-primary' : 'bg-slate-300'}`} />
                        <div>
                          <span className="font-medium">v{v.version_number}</span>
                          <span className="text-muted-foreground ml-1.5">{v.change_summary || ''}</span>
                          <p className="text-muted-foreground text-[10px]">{v.created_by_name}</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 shrink-0"
                        onClick={() => {
                          const w = window.open('', '_blank')
                          if (!w) return
                          // Replace placeholders in version body
                          let vBody = v.body_content || ''
                          const reps: Record<string, string> = {
                            'vendor_name': contract.vendor_name || '', 'plant_name': contract.plant_name || '',
                            'department_name': contract.department_name || '',
                            'contract_value': `${contract.currency_code} ${Number(contract.estimated_value || 0).toLocaleString('en-IN')}`,
                            'start_date': formatDocDate(contract.start_date), 'end_date': formatDocDate(contract.end_date),
                            'duration': `${contract.duration_months} months`,
                            'payment_terms': contract.payment_terms || '', 'incoterms': contract.incoterms || '',
                          }
                          for (const [k, val] of Object.entries(reps)) {
                            vBody = vBody.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), val)
                          }
                          w.document.write(`<!DOCTYPE html><html><head><title>${contract.contract_id} v${v.version_number}</title>
                          <style>@page{margin:2cm}body{font-family:'Times New Roman',serif;font-size:12px;line-height:1.8;max-width:800px;margin:0 auto;padding:40px}
                          h1{text-align:center;font-size:18px}h2{font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}</style>
                          </head><body>
                          <h1>${CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label || contract.contract_type}</h1>
                          <p style="text-align:center;color:#666;font-size:11px">${contract.contract_id} &mdash; Version ${v.version_number}</p>
                          <pre style="white-space:pre-wrap;font-family:'Times New Roman',serif">${vBody}</pre>
                          </body></html>`)
                          w.document.close()
                        }}>
                        Download
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sticky save bar */}
        <div className="flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur-sm py-3 px-4 -mx-4 border-t mt-4">
          <p className="text-xs text-muted-foreground">{bodyContent.length} chars &middot; v{contract.current_version}</p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.push(`/contracts/${id}`)}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending || !isDirty} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
