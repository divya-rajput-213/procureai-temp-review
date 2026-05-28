'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Upload, FileText, Package, GitCompare,
  CheckCircle2, Circle, X, Send, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

// Register Invoice — single unified page (replaces the old separate
// /invoices/new manual form + /invoices/upload AI page).
//
// Flow:
//   Step 1: Upload a vendor PDF/image (optional). Backend creates a draft +
//           extracts header + line items. We then PATCH on submit.
//           If the user skips upload, we POST a fresh invoice on submit.
//   Step 2: Editable header fields, pre-filled from extraction.
//           Picking a PO auto-fills GRN ref, vendor, line items (with po_line
//           AND grn_line FKs) so the 3-way matcher works out of the box.
//   Step 3: Line items table (editable).
//
// Submit calls POST or PATCH then POST /invoices/{id}/submit/ which auto-runs
// 3-way matching when a PO is linked.

const GST_RATE = 18

type LineItem = {
  description: string
  hsn_code: string
  quantity: number
  unit_of_measure: string  // display only — read from linked PO line; not persisted on InvoiceLineItem
  unit_rate: number
  tax_rate: number
  po_line: number | null
  grn_line: number | null
}

const blankLine = (): LineItem => ({
  description: '', hsn_code: '', quantity: 1, unit_of_measure: '', unit_rate: 0,
  tax_rate: GST_RATE, po_line: null, grn_line: null,
})

// Backend monetary fields are DecimalField(max_digits=15, decimal_places=2).
// JS floating-point math can produce 2.5260000000000002-style values that
// blow the digit budget; round before sending.
const money2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

function ExtractedField({
  label, extracted, children,
}: { label: React.ReactNode; extracted?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
        <span className={extracted ? 'text-teal-700' : 'text-muted-foreground'}>{label}</span>
        {extracted && (
          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 text-[9px] py-0 px-1.5 h-4">EXTRACTED</Badge>
        )}
      </div>
      {children}
    </div>
  )
}

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

const EXTRACTION_STEPS = [
  'Loading document…',
  'Detecting invoice layout…',
  'Extracting header: invoice no., vendor, date…',
  'Extracting GSTIN and place of supply…',
  'Parsing line items, quantities, prices…',
  'Calculating totals and GST…',
]

export default function NewInvoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Upload state ────────────────────────────────────────────────────────
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractionStep, setExtractionStep] = useState(0)
  const [draftInvoiceId, setDraftInvoiceId] = useState<string | null>(null)
  const [hadExtraction, setHadExtraction] = useState(false)

  // ── Form state ──────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [poId, setPoId] = useState<number | null>(null)
  const [grnId, setGrnId] = useState<number | null>(null)
  const [grnNumber, setGrnNumber] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [vendorGstin, setVendorGstin] = useState('')
  const [placeOfSupply, setPlaceOfSupply] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<LineItem[]>([blankLine()])

  // ── Eligible POs for the dropdown ───────────────────────────────────────
  const { data: pos } = useQuery({
    queryKey: ['pos-invoice-eligible'],
    queryFn: async () => {
      const { data } = await apiClient.get('/purchase-orders/')
      const list: any[] = data.results ?? data
      return list.filter(p => !['draft', 'cancelled', 'pending_approval', 'rejected'].includes(p.status))
    },
  })

  // ── Upload ──────────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await apiClient.post('/invoices/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setHadExtraction(true)
      setDraftInvoiceId(data.hash_id ?? String(data.id))
      // Pre-fill form from extracted data (ignore placeholders)
      if (data.invoice_number && data.invoice_number !== 'PENDING-EXTRACTION') {
        setInvoiceNumber(data.invoice_number)
      }
      if (data.vendor) setVendorId(data.vendor)
      if (data.vendor_name) setVendorName(data.vendor_name)
      if (data.invoice_date) setInvoiceDate(data.invoice_date)
      if (data.due_date) setDueDate(data.due_date)
      if (data.vendor_gstin) setVendorGstin(data.vendor_gstin)
      if (data.place_of_supply) setPlaceOfSupply(data.place_of_supply)
      if (data.notes) setRemarks(data.notes)
      const extractedLines = data.line_items || []
      if (extractedLines.length > 0) {
        setLines(extractedLines.map((li: any) => ({
          description: li.description || '',
          hsn_code: li.hsn_code || '',
          quantity: Number(li.quantity) || 0,
          unit_of_measure: li.unit_of_measure || '',
          unit_rate: Number(li.unit_rate) || 0,
          tax_rate: Number(li.tax_rate) || GST_RATE,
          po_line: li.po_line ?? null,
          grn_line: li.grn_line ?? null,
        })))
      }
      toast({ title: 'Extracted successfully' })
    },
    onError: (err: any) => {
      setUploadedFile(null)
      toast({ title: err?.response?.data?.error ?? 'Upload failed', variant: 'destructive' })
    },
  })

  // Animate the extraction progress steps while the upload mutation is running
  useEffect(() => {
    if (!uploadMutation.isPending) { setExtractionStep(0); return }
    setExtractionStep(0)
    const interval = setInterval(() => {
      setExtractionStep(s => (s < EXTRACTION_STEPS.length - 1 ? s + 1 : s))
    }, 350)
    return () => clearInterval(interval)
  }, [uploadMutation.isPending])

  const handleFile = (file: File) => {
    setUploadedFile(file)
    uploadMutation.mutate(file)
  }

  // ── PO selection — auto-fill vendor + GRN + line items ──────────────────
  const selectPO = async (id: number | null) => {
    setPoId(id)
    if (!id) {
      setGrnId(null); setGrnNumber(''); setPoNumber('')
      return
    }
    const po = (pos || []).find((p: any) => p.id === id)
    if (!po) return
    setPoNumber(po.po_number)
    setVendorId(po.vendor)
    setVendorName(po.vendor_name)

    try {
      const { data: poDetail } = await apiClient.get(`/purchase-orders/${po.hash_id ?? po.id}/`)
      if (poDetail.vendor_gstin) setVendorGstin(poDetail.vendor_gstin)

      // Fetch GRNs first so we can map po_line → grn_line
      const { data: grns } = await apiClient.get(`/purchase-orders/${po.hash_id ?? po.id}/grns/`)
      const grnList: any[] = grns.results ?? grns
      const poLineToGrnLine: Record<number, number> = {}
      for (const g of grnList) {
        for (const gl of (g.line_items || [])) {
          if (gl.po_line && Number(gl.accepted_qty) > 0) {
            poLineToGrnLine[gl.po_line] = gl.id
          }
        }
      }
      if (grnList.length > 0) {
        setGrnId(grnList[0].id)
        setGrnNumber(grnList[0].grn_number)
      } else {
        setGrnId(null); setGrnNumber('')
        toast({
          title: `PO ${po.po_number} linked — but no GRN yet`,
          description: '3-way matching will be blocked until goods are received.',
          variant: 'destructive',
        })
      }

      // Auto-fill line items from PO (with grn_line where available).
      // Same shape/columns the PO uses → invoice ↔ PO items stay in sync.
      const poLines = poDetail.line_items || []
      if (poLines.length > 0) {
        setLines(poLines.map((li: any) => ({
          description: `${li.item_code_detail?.code || ''} — ${li.description}`.replace(/^ — /, ''),
          hsn_code: li.hsn_code || '',
          quantity: Number(li.quantity) || 0,
          unit_of_measure: li.unit_of_measure || '',
          unit_rate: Number(li.unit_rate) || 0,
          tax_rate: Number(li.tax_rate) || GST_RATE,
          po_line: li.id,
          grn_line: poLineToGrnLine[li.id] ?? null,
        })))
      }
    } catch {
      toast({ title: 'Failed to load PO details', variant: 'destructive' })
    }
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_rate) || 0), 0),
    [lines],
  )
  const taxTotal = useMemo(
    () => lines.reduce((s, l) => {
      const amt = (Number(l.quantity) || 0) * (Number(l.unit_rate) || 0)
      return s + amt * ((Number(l.tax_rate) || 0) / 100)
    }, 0),
    [lines],
  )
  const grandTotal = subtotal + taxTotal

  // ── Submit ──────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceNumber.trim()) throw new Error('Invoice number is required')
      if (!vendorId) throw new Error('Vendor is required (upload a document or pick a PO)')

      const lineItemsPayload = lines
        .filter(l => l.description && (l.quantity > 0 || l.unit_rate > 0))
        .map((l, idx) => ({
          line_number: idx + 1,
          description: l.description,
          hsn_code: l.hsn_code,
          quantity: money2(l.quantity),
          unit_rate: money2(l.unit_rate),
          tax_rate: money2(l.tax_rate),
          po_line: l.po_line,
          grn_line: l.grn_line,
        }))

      const headerPayload: Record<string, any> = {
        invoice_number: invoiceNumber,
        vendor: vendorId,
        po: poId,
        grn: grnId,
        invoice_date: invoiceDate || new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        subtotal: money2(subtotal),
        igst_amount: money2(taxTotal),
        tax_amount: money2(taxTotal),
        total_amount: money2(grandTotal),
        // Vendor GSTIN is max 20 chars on the backend
        vendor_gstin: vendorGstin.slice(0, 20),
        place_of_supply: placeOfSupply,
        notes: remarks,
      }

      let invoiceId: string
      if (draftInvoiceId) {
        // Update the draft created by /upload/
        await apiClient.patch(`/invoices/${draftInvoiceId}/`, headerPayload)
        // Replace line items by deleting existing + creating new
        const { data: detail } = await apiClient.get(`/invoices/${draftInvoiceId}/`)
        for (const li of (detail.line_items || [])) {
          await apiClient.delete(`/invoices/line-items/${li.id}/`).catch(() => null)
        }
        for (const li of lineItemsPayload) {
          await apiClient.post('/invoices/line-items/', { ...li, invoice: detail.id }).catch(() => null)
        }
        invoiceId = draftInvoiceId
      } else {
        const { data: created } = await apiClient.post('/invoices/', {
          ...headerPayload,
          line_items_data: lineItemsPayload,
        })
        invoiceId = created.hash_id ?? String(created.id)
      }

      // Submit (auto-runs 3-way match when PO is linked)
      const { data: submitted } = await apiClient.post(`/invoices/${invoiceId}/submit/`).catch((e: any) => {
        // If submit fails (e.g. no GRN), keep as draft and surface error
        throw new Error(e?.response?.data?.error || 'Invoice saved as draft but submit failed.')
      })
      return submitted
    },
    onSuccess: (resp) => {
      toast({ title: `Invoice ${resp.internal_ref ?? ''} registered` })
      router.push(`/invoices/${resp.hash_id ?? resp.id}`)
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      const msg = err.message
        || (typeof detail === 'string' ? detail
          : detail?.detail || detail?.error || 'Failed to register invoice')
      toast({ title: String(msg), variant: 'destructive' })
    },
  })

  // ── Drag & drop handlers ────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true) }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false) }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ── Derived flags for checklist ─────────────────────────────────────────
  const checks = {
    uploaded: !!uploadedFile || hadExtraction,
    invNumber: !!invoiceNumber.trim(),
    poLinked: !!poId,
    grnLinked: !!grnId,
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Register Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Upload vendor invoice PDF → auto-extract → verify against PO &amp; GRN
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Main column ── */}
        <div className="space-y-6 min-w-0">
          {/* Step 1 — Upload */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Step 1 — Upload Invoice Document</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PDF or image · vendor details, invoice number and line items extracted automatically
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  uploadedFile
                    ? 'border-green-400 bg-green-50/60'
                    : dragActive
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-300 bg-slate-50/40 hover:bg-slate-100/60'
                }`}
              >
                {uploadedFile ? (
                  <>
                    <FileText className="w-7 h-7 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {hadExtraction
                        ? `Extracted successfully · ${EXTRACTION_STEPS.length} fields captured`
                        : `${(uploadedFile.size / 1024).toFixed(0)} KB · ready to upload`}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Click to upload or drag &amp; drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, JPG, PNG · Max 20 MB</p>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file" className="hidden"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />

              {uploadMutation.isPending && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Extracting invoice data…</p>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${((extractionStep + 1) / EXTRACTION_STEPS.length) * 100}%` }}
                    />
                  </div>
                  <ul className="space-y-1">
                    {EXTRACTION_STEPS.map((step, i) => (
                      <li
                        key={step}
                        className={`flex items-center gap-2 text-xs ${
                          i <= extractionStep ? 'text-green-700' : 'text-muted-foreground'
                        }`}
                      >
                        {i < extractionStep
                          ? <CheckCircle2 className="w-3 h-3" />
                          : i === extractionStep
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Circle className="w-3 h-3" />}
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — Invoice Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Step 2 — Invoice Header</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hadExtraction
                      ? 'Auto-extracted fields shown in green · edit if needed'
                      : 'Fill these in or upload a document above to auto-fill'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ExtractedField label={<><Sparkles className="w-2.5 h-2.5 inline mr-1" />Invoice Number *</>} extracted={hadExtraction}>
                  <Input
                    className={hadExtraction ? 'border-teal-300 bg-teal-50/60' : ''}
                    value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Vendor's invoice number"
                  />
                </ExtractedField>

                <ExtractedField label="Vendor *" extracted={hadExtraction}>
                  <Input
                    className={hadExtraction ? 'border-teal-300 bg-teal-50/60' : ''}
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Vendor name"
                  />
                </ExtractedField>

                <ExtractedField label="Invoice Date *" extracted={hadExtraction}>
                  <Input
                    type="date"
                    className={hadExtraction ? 'border-teal-300 bg-teal-50/60' : ''}
                    value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </ExtractedField>

                <div>
                  <Label>PO Reference <span className="text-red-500">*</span></Label>
                  <select
                    className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                    value={poId ?? ''}
                    onChange={(e) => selectPO(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— Link to a PO —</option>
                    {(pos || []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.po_number} — {p.vendor_name} · {formatCurrency(p.total_amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <ExtractedField label="GRN Reference" extracted={!!grnNumber}>
                  <Input
                    value={grnNumber} disabled
                    className={grnNumber ? 'border-teal-300 bg-teal-50/60' : ''}
                    placeholder={poId ? 'No GRN found for this PO' : 'Pick a PO first'}
                  />
                </ExtractedField>

                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>

                <ExtractedField label="Vendor GSTIN" extracted={hadExtraction && !!vendorGstin}>
                  <Input
                    maxLength={20}
                    className={`font-mono text-xs ${hadExtraction && vendorGstin ? 'border-teal-300 bg-teal-50/60' : ''}`}
                    value={vendorGstin} onChange={(e) => setVendorGstin(e.target.value.slice(0, 20))}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </ExtractedField>

                <div>
                  <Label>Place of Supply</Label>
                  <Input
                    value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}
                    placeholder="e.g. Gujarat (24)"
                  />
                </div>
              </div>

              <div>
                <Label>Remarks</Label>
                <textarea
                  className="w-full min-h-[70px] border rounded-md p-3 text-sm bg-background resize-y"
                  value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Partial delivery notes, disputes, payment split instructions…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Step 3 — Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm">Step 3 — Line Items</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hadExtraction
                      ? 'Auto-extracted from invoice document · edit if needed'
                      : poId ? 'Pulled from PO · edit if invoice differs' : 'Add lines manually or link a PO'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-t">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-12">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase">Description</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-24">HSN</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-20">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-20">UOM</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-28">Unit Price</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-28">Amount</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs uppercase w-16">GST%</th>
                      <th className="px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const amount = (Number(line.quantity) || 0) * (Number(line.unit_rate) || 0)
                      return (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 text-sm"
                              value={line.description}
                              onChange={(e) => setLines(l => l.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                              placeholder="Item description"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 text-xs font-mono"
                              value={line.hsn_code}
                              onChange={(e) => setLines(l => l.map((x, i) => i === idx ? { ...x, hsn_code: e.target.value } : x))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" step="0.01" min="0"
                              className="h-8 text-right text-sm"
                              value={line.quantity || ''}
                              onChange={(e) => setLines(l => l.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 text-xs"
                              value={line.unit_of_measure}
                              placeholder="Nos"
                              onChange={(e) => setLines(l => l.map((x, i) => i === idx ? { ...x, unit_of_measure: e.target.value } : x))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" step="0.01" min="0"
                              className="h-8 text-right text-sm"
                              value={line.unit_rate || ''}
                              onChange={(e) => setLines(l => l.map((x, i) => i === idx ? { ...x, unit_rate: Number(e.target.value) } : x))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium">{formatCurrency(amount)}</td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">{line.tax_rate || GST_RATE}%</td>
                          <td className="px-2 text-center">
                            {lines.length > 1 && (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setLines(l => l.filter((_, i) => i !== idx))}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t">
                      <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Sub Total</td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(subtotal)}</td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-3 py-2 text-right text-xs text-muted-foreground">IGST @ {GST_RATE}%</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(taxTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="bg-slate-100 border-t">
                      <td colSpan={6} className="px-3 py-2.5 text-right text-sm font-bold uppercase">Invoice Total (incl. GST)</td>
                      <td className="px-3 py-2.5 text-right text-base font-bold text-teal-700">{formatCurrency(grandTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-3 py-2 border-t">
                <Button
                  variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
                  onClick={() => setLines(l => [...l, blankLine()])}
                >
                  + Add line
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-3 lg:sticky lg:top-4 h-fit">
          {/* Checklist */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-xs uppercase tracking-wide">Checklist</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ChecklistRow done={checks.uploaded} label="Document uploaded" />
              <ChecklistRow done={checks.invNumber} label="Invoice number filled" />
              <ChecklistRow done={checks.poLinked} label="PO linked" />
              <ChecklistRow done={checks.grnLinked} label="GRN linked" />
            </CardContent>
          </Card>

          {/* 3-Way Match Explained */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <GitCompare className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-xs uppercase tracking-wide">3-Way Match</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-50">
                <div className="text-[10px] font-bold text-blue-700">PO</div>
                <p className="text-[11px] text-blue-700">What was ordered</p>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-green-50">
                <div className="text-[10px] font-bold text-green-700">GRN</div>
                <p className="text-[11px] text-green-700">What was received</p>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-purple-50">
                <div className="text-[10px] font-bold text-purple-700">INV</div>
                <p className="text-[11px] text-purple-700">What vendor billed</p>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                All three must match on <strong>quantity</strong>, <strong>price</strong>, and <strong>vendor</strong> before payment is released.
              </p>
            </CardContent>
          </Card>

          {/* What Happens Next */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-xs uppercase tracking-wide">What Happens Next</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-1.5 text-xs text-muted-foreground">
              <p>1. Invoice gets INV reference number</p>
              <p>2. 3-Way match score calculated</p>
              <p>3. Discrepancies flagged for review</p>
              <p>4. Finance approves for payment</p>
              <p>5. Payment released &amp; marked Paid</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 -mx-4 md:-mx-3 px-4 md:px-3 py-3 bg-background border-t shadow-sm z-20 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/invoices')}>
          <X className="w-4 h-4" /> Discard
        </Button>
        <Button
          size="sm" className="gap-2"
          disabled={submitMutation.isPending || !checks.invNumber || !vendorId}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Register &amp; Run 3-Way Match
        </Button>
      </div>
    </div>
  )
}
