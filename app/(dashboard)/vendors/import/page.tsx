'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, Upload, CheckCircle, XCircle, Loader2, FileSpreadsheet, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import apiClient from '@/lib/api/client'

type ImportResult = {
  total_rows: number
  valid_rows: number
  skipped: number
  created: number
  errors: Array<{ row: number; field: string; value?: string; reason: string }>
  dry_run: boolean
}

export default function VendorImportPage() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (f) {
      setFile(f)
      setDryRunResult(null)
      setImportResult(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
  })

  const downloadTemplate = async () => {
    const resp = await apiClient.get('/vendors/excel-template/', { responseType: 'blob' })
    const url = window.URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vendor_import_template.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await apiClient.post<ImportResult>('/vendors/import-excel/?dry_run=true', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => setDryRunResult(data),
    onError: () => toast({ title: 'Validation failed', variant: 'destructive' }),
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await apiClient.post<ImportResult>('/vendors/import-excel/?dry_run=false', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setImportResult(data)
      toast({ title: `${data.created} vendors imported successfully!` })
    },
    onError: () => toast({ title: 'Import failed', variant: 'destructive' }),
  })

  if (importResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-green-800">Import Complete</h2>
            <p className="text-green-700 mt-1">
              {importResult.created} vendors imported successfully.
              {importResult.skipped > 0 && ` ${importResult.skipped} rows skipped due to errors.`}
            </p>
            <Link href="/vendors">
              <Button className="mt-4">View Imported Vendors</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/vendors">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Import Vendors from Excel</h1>
      </div>

      {/* Step 1 — Download Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Step 1 — Download Template</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
            <Download className="w-4 h-4" />
            Download Excel Template
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Fill in the template with vendor data. Columns marked * are required.
          </p>
        </CardContent>
      </Card>

      {/* Step 2 — Upload File */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Step 2 — Upload Filled File</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            {file ? (
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm">Drag & drop your .xlsx file here, or click to select</p>
                <p className="text-xs text-muted-foreground mt-1">Only .xlsx files accepted</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3 — Validate */}
      {file && !dryRunResult && (
        <Card>
          <CardContent className="p-4">
            <Button
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              className="gap-2"
            >
              {validateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Validate File
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {dryRunResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Validation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm">{dryRunResult.valid_rows} rows valid</span>
              </div>
              {dryRunResult.skipped > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm">{dryRunResult.skipped} rows with errors</span>
                </div>
              )}
            </div>

            {dryRunResult.errors.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2">Row</th>
                      <th className="text-left px-3 py-2">Field</th>
                      <th className="text-left px-3 py-2">Value</th>
                      <th className="text-left px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dryRunResult.errors.map((e, i) => (
                      <tr key={i} className="bg-red-50/50">
                        <td className="px-3 py-2 font-medium">{e.row}</td>
                        <td className="px-3 py-2">{e.field}</td>
                        <td className="px-3 py-2 font-mono">{e.value || '—'}</td>
                        <td className="px-3 py-2 text-red-700">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              {dryRunResult.errors.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null)
                    setDryRunResult(null)
                  }}
                >
                  Fix & Re-upload
                </Button>
              )}
              {dryRunResult.valid_rows > 0 && (
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                  className="gap-2"
                >
                  {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import {dryRunResult.valid_rows} Vendors
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
