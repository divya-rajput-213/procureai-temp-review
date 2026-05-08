'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, Upload, Loader2, FileText, CheckCircle2, Pencil, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

export default function InvoiceUploadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [editingLineItem, setEditingLineItem] = useState<{ row: number; col: string } | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post('/invoices/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setExtractedData(data)
      setEditValues({
        invoice_number: data.invoice_number || '',
        invoice_date: data.invoice_date || '',
        due_date: data.due_date || '',
        vendor_name: data.vendor_name || data.vendor?.name || '',
        vendor_id: data.vendor_id || data.vendor?.id || '',
        subtotal: data.subtotal ?? '',
        tax_amount: data.tax_amount ?? '',
        total_amount: data.total_amount ?? '',
        cgst: data.gst_breakdown?.cgst ?? '',
        sgst: data.gst_breakdown?.sgst ?? '',
        igst: data.gst_breakdown?.igst ?? '',
        line_items: data.line_items || [],
      })
    },
    onError: (err: any) => {
      toast({ title: err?.response?.data?.error ?? 'Upload failed', variant: 'destructive' })
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...extractedData,
        invoice_number: editValues.invoice_number,
        invoice_date: editValues.invoice_date,
        due_date: editValues.due_date,
        vendor_id: editValues.vendor_id,
        subtotal: editValues.subtotal,
        tax_amount: editValues.tax_amount,
        total_amount: editValues.total_amount,
        gst_breakdown: {
          cgst: editValues.cgst,
          sgst: editValues.sgst,
          igst: editValues.igst,
        },
        line_items: editValues.line_items,
      }
      const { data } = await apiClient.post('/invoices/', payload)
      return data
    },
    onSuccess: (data) => {
      toast({ title: 'Invoice created as draft' })
      router.push(`/invoices/${data.hash_id || data.id}`)
    },
    onError: (err: any) => {
      toast({ title: err?.response?.data?.error ?? 'Failed to create invoice', variant: 'destructive' })
    },
  })

  const handleFile = useCallback((file: File) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast({ title: 'Please upload a PDF or image file', variant: 'destructive' })
      return
    }
    uploadMutation.mutate(file)
  }, [uploadMutation, toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }, [])

  const updateField = (field: string, value: any) => {
    setEditValues(prev => ({ ...prev, [field]: value }))
  }

  const updateLineItem = (index: number, field: string, value: any) => {
    setEditValues(prev => {
      const items = [...prev.line_items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, line_items: items }
    })
  }

  const confidence = extractedData?.confidence_score ?? extractedData?.confidence

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Upload Invoice</h1>
          <p className="text-sm text-muted-foreground">Upload a PDF or image and let AI extract invoice data</p>
        </div>
      </div>

      {/* Upload zone (before extraction) */}
      {!extractedData && !uploadMutation.isPending && (
        <Card>
          <CardContent className="p-0">
            <div
              onDrop={handleDrop}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
            >
              <Upload className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Drag and drop your invoice here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse (PDF, PNG, JPG)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {uploadMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">AI is extracting invoice data...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
          </CardContent>
        </Card>
      )}

      {/* Extracted data review */}
      {extractedData && (
        <div className="space-y-4">
          {/* Confidence badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Data extracted successfully</span>
              {confidence != null && (
                <Badge variant={confidence >= 0.8 ? 'default' : confidence >= 0.5 ? 'secondary' : 'destructive'}>
                  {Math.round(confidence * 100)}% confidence
                </Badge>
              )}
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => { setExtractedData(null); setEditValues({}) }}
            >
              <X className="w-3.5 h-3.5 mr-1" /> Start Over
            </Button>
          </div>

          {/* Invoice header fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  { key: 'invoice_number', label: 'Invoice Number', type: 'text' },
                  { key: 'invoice_date', label: 'Invoice Date', type: 'date' },
                  { key: 'due_date', label: 'Due Date', type: 'date' },
                  { key: 'vendor_name', label: 'Vendor (auto-matched)', type: 'text' },
                  { key: 'subtotal', label: 'Subtotal', type: 'number' },
                  { key: 'tax_amount', label: 'Tax Amount', type: 'number' },
                  { key: 'total_amount', label: 'Total Amount', type: 'number' },
                ] as const).map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center justify-between">
                      {field.label}
                      {editingField !== field.key && (
                        <button className="text-primary hover:text-primary/80" onClick={() => setEditingField(field.key)}>
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </Label>
                    {editingField === field.key ? (
                      <div className="flex gap-1">
                        <Input
                          type={field.type}
                          value={editValues[field.key] ?? ''}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingField(null)}>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium">{editValues[field.key] || '—'}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GST Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">GST Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {(['cgst', 'sgst', 'igst'] as const).map(key => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center justify-between">
                      {key.toUpperCase()}
                      {editingField !== key && (
                        <button className="text-primary hover:text-primary/80" onClick={() => setEditingField(key)}>
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </Label>
                    {editingField === key ? (
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={editValues[key] ?? ''}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingField(null)}>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium">{editValues[key] ? formatCurrency(editValues[key]) : '—'}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          {editValues.line_items?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">#</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Description</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Qty</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Rate</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Amount</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">HSN</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {editValues.line_items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                          {(['description', 'quantity', 'rate', 'amount', 'hsn_code', 'tax'] as const).map(col => (
                            <td key={col} className="px-4 py-2">
                              {editingLineItem?.row === idx && editingLineItem?.col === col ? (
                                <div className="flex gap-1">
                                  <Input
                                    type={col === 'description' || col === 'hsn_code' ? 'text' : 'number'}
                                    value={item[col] ?? ''}
                                    onChange={(e) => updateLineItem(idx, col, e.target.value)}
                                    className="h-7 text-xs min-w-[60px]"
                                    autoFocus
                                  />
                                  <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => setEditingLineItem(null)}>
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-primary"
                                  onClick={() => setEditingLineItem({ row: idx, col })}
                                >
                                  {item[col] ?? '—'}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push('/invoices')}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <FileText className="w-4 h-4" />
              Confirm &amp; Create
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
