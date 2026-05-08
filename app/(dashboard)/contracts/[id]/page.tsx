'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, Users, CheckCircle, Clock, Shield, Loader2,
  Send, Link2, Plus, Upload, PenTool, Download, Trash2, AlertTriangle,
  Pencil, Search, X, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { SignaturePad } from '@/components/shared/SignaturePad'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const TABS = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'documents', label: 'Documents', icon: Upload },
  { key: 'review', label: 'Review', icon: Users },
  { key: 'negotiations', label: 'Negotiations', icon: Link2 },
  { key: 'history', label: 'History', icon: Clock },
]

export default function ContractDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')


  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/contracts/${id}/`)
      return data
    },
    enabled: !!id,
    retry: 1,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contract', id] })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  if (error) {
    const errMsg = (error as any)?.response?.data?.detail || (error as any)?.message || 'Failed to load contract'
    return (
      <div className="text-center py-12 space-y-3">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
        <p className="text-sm font-medium text-destructive">Unable to Load Contract</p>
        <p className="text-xs text-muted-foreground">{errMsg}</p>
        <p className="text-xs text-muted-foreground">Make sure you are logged in as a user with a company assigned.</p>
        <Button variant="outline" onClick={() => router.push('/contracts')}>Back to Contracts</Button>
      </div>
    )
  }

  if (!contract) {
    return <div className="text-center py-12 text-muted-foreground">Contract not found.</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/contracts')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{contract.contract_id}</h1>
              <Badge variant="secondary">{contract.contract_type}</Badge>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{contract.title}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {/* DRAFT — Edit only, submit is in Approval tab */}
          {contract.status === 'draft' && (
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => router.push(`/contracts/${id}/edit`)}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          )}

          {/* Status labels */}
          {contract.status === 'internal_review' && (
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-medium">Under Review</span>
          )}
          {contract.status === 'approved' && (
            <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full font-medium">Approved — Send to Vendor & Sign</span>
          )}
          {contract.status === 'pending_approval' && (
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-medium">Pending Final Approval</span>
          )}
          {contract.status === 'active' && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">Active</span>
          )}

        </div>
      </div>

      {/* Workflow Steps Indicator */}
      <WorkflowSteps currentStatus={contract.status} />


      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Estimated Value</p>
            <p className="text-lg font-bold">{formatCurrency(contract.estimated_value, contract.currency_code)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Spend</p>
            <p className="text-lg font-bold">{formatCurrency(contract.total_spend, contract.currency_code)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-lg font-bold">{contract.duration_months} months</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-lg font-bold">v{contract.current_version}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && <OverviewTab contract={contract} />}
      {activeTab === 'documents' && <DocumentsTab contract={contract} contractId={id as string} onUpdate={invalidate} />}

      {activeTab === 'negotiations' && <NegotiationsTab contract={contract} contractId={id as string} onUpdate={invalidate} />}
      {activeTab === 'history' && <HistoryTab contract={contract} />}
      {activeTab === 'review' && <ApprovalStepTab contract={contract} contractId={id as string} onUpdate={invalidate}
        matrixType="contract_review" submitEndpoint="submit-for-review" label="Review"
        description="Internal review by Legal, Finance, and Technical teams."
        allowedStatuses={['draft']} entityType="contract" />}
    </div>
  )
}

// ── Workflow Steps Indicator ─────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: 'draft', label: '1. Draft', description: 'Create & edit contract' },
  { key: 'internal_review', label: '2. Review', description: 'Internal review' },
  { key: 'approved', label: '3. Sign', description: 'Vendor & buyer sign' },
  { key: 'pending_approval', label: '4. Approval', description: 'Final approval' },
  { key: 'active', label: '5. Active', description: 'Fully executed' },
  { key: 'closed', label: '6. Closed', description: 'Completed' },
]

function WorkflowSteps({ currentStatus }: { currentStatus: string }) {
  const currentIndex = WORKFLOW_STEPS.findIndex(s => s.key === currentStatus)
  const isTerminal = ['closed', 'terminated'].includes(currentStatus)

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {WORKFLOW_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex
        const isCurrent = step.key === currentStatus
        const isTerminated = currentStatus === 'terminated' && step.key === 'closed'

        return (
          <div key={step.key} className="flex items-center min-w-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap ${
              isCurrent
                ? 'bg-primary text-primary-foreground font-semibold'
                : isCompleted
                ? 'bg-emerald-100 text-emerald-700'
                : isTerminated
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-100 text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isCurrent
                  ? 'bg-white text-primary'
                  : isCompleted
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-300 text-white'
              }`}>
                {isCompleted ? '\u2713' : idx + 1}
              </span>
              <span>{step.label.split('. ')[1]}</span>
            </div>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div className={`w-6 h-0.5 shrink-0 ${isCompleted ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function formatDocDate(d: string) {
  if (!d) return '___________'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  MSA: 'Master Supply Agreement', LTA: 'Long-Term Agreement', SLA: 'Service Level Agreement',
  Tooling: 'Tooling Agreement', NDA: 'Non-Disclosure Agreement', SOW: 'Statement of Work',
}

function stripTemplateSignatureBlock(text: string): string {
  // Remove the text-based signature block from templates since we have digital signatures
  return text
    .replace(/IN WITNESS WHEREOF[\s\S]*$/i, '')
    .replace(/FOR AND ON BEHALF OF THE BUYER[\s\S]*$/i, '')
    .replace(/Signature:\s*_+[\s\S]*$/i, '')
    .trim()
}

function resolveBody(contract: any) {
  const replacements: Record<string, string> = {
    'vendor_name': contract.vendor_name || '', 'vendor_company': contract.vendor_name || '',
    'plant_name': contract.plant_name || '', 'department_name': contract.department_name || '',
    'contract_value': `${contract.currency_code || 'INR'} ${Number(contract.estimated_value || 0).toLocaleString('en-IN')}`,
    'contract_type': CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type || '',
    'start_date': formatDocDate(contract.start_date), 'end_date': formatDocDate(contract.end_date),
    'duration': `${contract.duration_months || '___'} months`,
    'payment_terms': contract.payment_terms || '___________', 'incoterms': contract.incoterms || '___________',
  }
  let body = contract.body_content || ''
  for (const [key, val] of Object.entries(replacements)) {
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val)
  }
  return body
}

function OverviewTab({ contract }: { contract: any }) {
  const resolvedBody = stripTemplateSignatureBlock(resolveBody(contract))
  const typeFull = CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type

  const handlePrint = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>${contract.contract_id}</title>
    <style>@page{margin:2cm}body{font-family:'Times New Roman',serif;font-size:12px;line-height:1.8;max-width:800px;margin:0 auto;padding:40px}
    h1{text-align:center;font-size:18px}h2{font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}
    table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}</style>
    </head><body>
    <div style="text-align:center;border-bottom:3px double #333;padding-bottom:16px;margin-bottom:24px">
      <p style="font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase">Contract Agreement</p>
      <h1 style="margin:8px 0 4px">${typeFull}</h1>
      <p style="font-size:14px">${contract.title}</p>
      <p style="font-size:11px;color:#666">${contract.contract_id} &mdash; v${contract.current_version}</p>
    </div>
    <h2>Parties</h2>
    <table><tr><td style="width:50%"><strong>BUYER</strong><br/>Plant: ${contract.plant_name}<br/>Dept: ${contract.department_name}</td>
    <td><strong>VENDOR</strong><br/>${contract.vendor_name}</td></tr></table>
    <h2>Key Terms</h2>
    <table>
      <tr><td style="font-weight:bold;width:35%">Contract Value:</td><td>${contract.currency_code} ${Number(contract.estimated_value).toLocaleString('en-IN')}</td></tr>
      <tr><td style="font-weight:bold">Effective:</td><td>${formatDocDate(contract.start_date)}</td></tr>
      <tr><td style="font-weight:bold">Expiry:</td><td>${formatDocDate(contract.end_date)}</td></tr>
      <tr><td style="font-weight:bold">Duration:</td><td>${contract.duration_months} months</td></tr>
      <tr><td style="font-weight:bold">Payment:</td><td>${contract.payment_terms || 'As per agreement'}</td></tr>
      <tr><td style="font-weight:bold">Incoterms:</td><td>${contract.incoterms || 'N/A'}</td></tr>
    </table>
    <h2>Terms & Conditions</h2>
    <pre style="white-space:pre-wrap;font-family:'Times New Roman',serif">${resolvedBody}</pre>
    <div style="margin-top:60px;page-break-inside:avoid"><h2>Digital Signatures</h2>
    <table><tr>
    <td style="width:50%;padding:16px;border:1px solid #ddd;border-radius:8px;vertical-align:top">
      <p style="font-weight:bold;margin-bottom:8px">For and on behalf of the BUYER</p>
      ${(() => {
        const s = (contract.signatures || []).find((s: any) => s.party === 'internal')
        if (s) return `${s.signature_image ? `<img src="${s.signature_image}" style="height:60px;margin-bottom:8px;border:1px solid #eee;border-radius:4px;padding:4px"/>` : ''}
        <p style="font-size:11px;font-weight:bold;margin:2px 0">${s.signatory_name}</p>
        <p style="font-size:10px;color:#666;margin:2px 0">${s.signatory_email}</p>
        <p style="font-size:10px;color:#666;margin:2px 0">Signed: ${formatDate(s.signed_at)}</p>`
        return '<div style="height:60px;border-bottom:1px solid #333;margin-bottom:4px"></div><p style="font-size:10px;color:#999">Awaiting signature</p>'
      })()}
    </td>
    <td style="width:50%;padding:16px;border:1px solid #ddd;border-radius:8px;vertical-align:top">
      <p style="font-weight:bold;margin-bottom:8px">For and on behalf of ${contract.vendor_name}</p>
      ${(() => {
        const s = (contract.signatures || []).find((s: any) => s.party === 'vendor')
        if (s) return `${s.signature_image ? `<img src="${s.signature_image}" style="height:60px;margin-bottom:8px;border:1px solid #eee;border-radius:4px;padding:4px"/>` : ''}
        <p style="font-size:11px;font-weight:bold;margin:2px 0">${s.signatory_name}</p>
        <p style="font-size:10px;color:#666;margin:2px 0">${s.signatory_email}</p>
        <p style="font-size:10px;color:#666;margin:2px 0">Signed: ${formatDate(s.signed_at)}</p>`
        return '<div style="height:60px;border-bottom:1px solid #333;margin-bottom:4px"></div><p style="font-size:10px;color:#999">Awaiting signature</p>'
      })()}
    </td>
    </tr></table></div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-6">
      {/* Document view */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contract Document</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg bg-white p-8 max-h-[70vh] overflow-y-auto" style={{ fontFamily: "'Times New Roman', serif" }}>
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '3px double #333', paddingBottom: 16, marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: '#666', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Contract Agreement</p>
              <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: '8px 0 4px', textTransform: 'uppercase' }}>{typeFull}</h1>
              <p style={{ fontSize: 14, margin: '4px 0' }}>{contract.title}</p>
              <p style={{ fontSize: 11, color: '#666', margin: '4px 0' }}>
                Contract No: <strong>{contract.contract_id}</strong> &nbsp;|&nbsp; Version: v{contract.current_version}
              </p>
            </div>

            {/* Parties */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 12, letterSpacing: 1 }}>Parties</h2>
              <div style={{ display: 'flex', fontSize: 12 }}>
                <div style={{ width: '50%' }}>
                  <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>BUYER (First Party)</p>
                  <p style={{ margin: '2px 0' }}>Plant: {contract.plant_name}</p>
                  <p style={{ margin: '2px 0' }}>Department: {contract.department_name}</p>
                </div>
                <div style={{ width: '50%' }}>
                  <p style={{ fontWeight: 'bold', margin: '0 0 4px' }}>VENDOR (Second Party)</p>
                  <p style={{ margin: '2px 0' }}><strong>{contract.vendor_name}</strong></p>
                </div>
              </div>
            </div>

            {/* Key Terms */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 12, letterSpacing: 1 }}>Key Terms</h2>
              <table style={{ width: '100%', fontSize: 12 }}>
                <tbody>
                  {[
                    ['Contract Value', `${contract.currency_code} ${Number(contract.estimated_value).toLocaleString('en-IN')}`],
                    ['Effective Date', formatDocDate(contract.start_date)],
                    ['Expiry Date', formatDocDate(contract.end_date)],
                    ['Duration', `${contract.duration_months} months`],
                    ['Payment Terms', contract.payment_terms || 'As per agreement'],
                    ['Incoterms', contract.incoterms || 'N/A'],
                  ].map(([k, v]) => (
                    <tr key={k}><td style={{ padding: '4px 0', fontWeight: 'bold', width: '35%' }}>{k}:</td><td style={{ padding: '4px 0' }}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 12, letterSpacing: 1 }}>Terms & Conditions</h2>
              <div style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {resolvedBody || <em style={{ color: '#999' }}>No contract body.</em>}
              </div>
            </div>

            {/* Signatures */}
            {(() => {
              const sigs = contract.signatures || []
              const intSig = sigs.find((s: any) => s.party === 'internal')
              const venSig = sigs.find((s: any) => s.party === 'vendor')
              return (
                <div style={{ marginTop: 40, pageBreakInside: 'avoid' }}>
                  <h2 style={{ fontSize: 13, textTransform: 'uppercase', borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 20, letterSpacing: 1 }}>Digital Signatures</h2>
                  <div style={{ display: 'flex', fontSize: 12, gap: 24 }}>
                    {/* Buyer */}
                    <div style={{ width: '50%', border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
                      <p style={{ fontWeight: 'bold', marginBottom: 8 }}>For and on behalf of the BUYER</p>
                      {intSig ? (
                        <div>
                          {intSig.signature_image && (
                            <img src={intSig.signature_image} alt="Buyer signature" style={{ height: 60, marginBottom: 8, border: '1px solid #eee', borderRadius: 4, padding: 4, background: '#fff' }} />
                          )}
                          <p style={{ fontSize: 11, fontWeight: 'bold', margin: '2px 0' }}>{intSig.signatory_name}</p>
                          <p style={{ fontSize: 10, color: '#666', margin: '2px 0' }}>{intSig.signatory_email}</p>
                          {intSig.signatory_designation && <p style={{ fontSize: 10, color: '#666', margin: '2px 0' }}>{intSig.signatory_designation}</p>}
                          <p style={{ fontSize: 10, color: '#666', margin: '2px 0' }}>Signed: {formatDate(intSig.signed_at)}</p>
                          <p style={{ fontSize: 9, color: '#999', margin: '2px 0' }}>IP: {intSig.ip_address}</p>
                        </div>
                      ) : (
                        <div>
                          <div style={{ height: 60, borderBottom: '1px solid #333', marginBottom: 4 }} />
                          <p style={{ fontSize: 10, color: '#999' }}>Awaiting buyer signature</p>
                        </div>
                      )}
                    </div>
                    {/* Vendor */}
                    <div style={{ width: '50%', border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
                      <p style={{ fontWeight: 'bold', marginBottom: 8 }}>For and on behalf of {contract.vendor_name}</p>
                      {venSig ? (
                        <div>
                          {venSig.signature_image && (
                            <img src={venSig.signature_image} alt="Vendor signature" style={{ height: 60, marginBottom: 8, border: '1px solid #eee', borderRadius: 4, padding: 4, background: '#fff' }} />
                          )}
                          <p style={{ fontSize: 11, fontWeight: 'bold', margin: '2px 0' }}>{venSig.signatory_name}</p>
                          <p style={{ fontSize: 10, color: '#666', margin: '2px 0' }}>{venSig.signatory_email}</p>
                          {venSig.signatory_designation && <p style={{ fontSize: 10, color: '#666', margin: '2px 0' }}>{venSig.signatory_designation}</p>}
                          <p style={{ fontSize: 10, color: '#666', margin: '2px 0' }}>Signed: {formatDate(venSig.signed_at)}</p>
                          <p style={{ fontSize: 9, color: '#999', margin: '2px 0' }}>IP: {venSig.ip_address}</p>
                        </div>
                      ) : (
                        <div>
                          <div style={{ height: 60, borderBottom: '1px solid #333', marginBottom: 4 }} />
                          <p style={{ fontSize: 10, color: '#999' }}>Awaiting vendor signature</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {intSig && venSig && (
                    <div style={{ marginTop: 16, padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 11, color: '#065f46', textAlign: 'center' }}>
                      Contract Fully Executed — Both parties have digitally signed this agreement.
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Documents Tab (with Upload + Signing) ───────────────────────────────────

function DocumentsTab({ contract, contractId, onUpdate }: { contract: any; contractId: string; onUpdate: () => void }) {
  const { toast } = useToast()
  const [showUpload, setShowUpload] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDocType, setUploadDocType] = useState('supporting')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const docs = contract.documents || []

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) return
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle)
      formData.append('doc_type', uploadDocType)
      await apiClient.post(`/contracts/${contractId}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => { onUpdate(); setShowUpload(false); setUploadTitle(''); setUploadFile(null); toast({ title: 'Uploaded' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Upload failed', variant: 'destructive' }),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documents ({docs.length})</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="w-3.5 h-3.5" /> Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUpload && (
          <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Title</Label>
                <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Document title" /></div>
              <div><Label className="text-xs">Type</Label>
                <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={uploadDocType} onChange={e => setUploadDocType(e.target.value)}>
                  <option value="draft">Draft</option><option value="amendment">Amendment</option><option value="supporting">Supporting</option>
                </select></div>
            </div>
            <div><Label className="text-xs">File</Label>
              <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button size="sm" disabled={!uploadFile || !uploadTitle || uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()} className="gap-1.5">
                {uploadMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Upload
              </Button>
            </div>
          </div>
        )}
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="divide-y">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] mr-1">{doc.doc_type}</Badge>
                      {doc.uploaded_by_name} &middot; {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                </div>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> Download</Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Negotiations Tab (Send to Vendor + Signing + Deviations) ────────────────


// ── Negotiations Tab (with Add Deviation) ───────────────────────────────────

function NegotiationsTab({ contract, contractId, onUpdate }: { contract: any; contractId: string; onUpdate: () => void }) {
  const { toast } = useToast()
  const rounds = contract.negotiation_rounds || []
  const deviations = contract.clause_deviations || []
  const [showAddDeviation, setShowAddDeviation] = useState(false)
  const [devOriginal, setDevOriginal] = useState('')
  const [devProposed, setDevProposed] = useState('')
  const [devJustification, setDevJustification] = useState('')
  const [devRisk, setDevRisk] = useState('medium')

  // Signing
  const signatures = contract.signatures || []
  const internalSig = signatures.find((s: any) => s.party === 'internal')
  const vendorSig = signatures.find((s: any) => s.party === 'vendor')
  const isActive = ['active', 'extended', 'approved'].includes(contract.status)
  const [showSignPanel, setShowSignPanel] = useState(false)
  const [signComments, setSignComments] = useState('')
  const [signatureImage, setSignatureImage] = useState('')
  const [vendorLink, setVendorLink] = useState('')
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState(contract.vendor_detail?.contact_email || '')

  const signMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/contracts/${contractId}/sign/`, {
        comments: signComments,
        signature_image: signatureImage,
      })
      return data
    },
    onSuccess: (data) => {
      onUpdate(); setShowSignPanel(false); setSignComments(''); setSignatureImage('')
      if (data.submitted_for_approval) {
        toast({ title: 'Signed & submitted for final approval' })
      } else {
        toast({ title: 'Contract signed successfully' })
      }
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const sendToVendorMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/contracts/${contractId}/send-to-vendor/`, {
        vendor_email: sendEmail,
      })
      return data
    },
    onSuccess: (data) => {
      onUpdate()
      const fullUrl = data.full_url || `${window.location.origin}${data.vendor_link}`
      setVendorLink(fullUrl)
      navigator.clipboard.writeText(fullUrl).catch(() => {})
      toast({ title: data.vendor_email_sent ? `Link sent to vendor via email (Round ${data.round_number})` : `Link generated (Round ${data.round_number})` })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/contracts/${contractId}/generate-vendor-link/`)
      return data
    },
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.vendor_link}`
      setVendorLink(fullUrl)
      navigator.clipboard.writeText(fullUrl).catch(() => {})
      toast({ title: 'Vendor link generated and copied' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const addDeviationMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/contracts/${contractId}/deviations/`, {
        original_text: devOriginal,
        proposed_text: devProposed,
        vendor_justification: devJustification,
        risk_level: devRisk,
      })
      return data
    },
    onSuccess: () => {
      onUpdate()
      setShowAddDeviation(false)
      setDevOriginal(''); setDevProposed(''); setDevJustification('')
      toast({ title: 'Clause deviation recorded' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const updateDeviationMutation = useMutation({
    mutationFn: async ({ devId, status, response }: { devId: number; status: string; response?: string }) => {
      const { data } = await apiClient.patch(`/contracts/${contractId}/deviations/${devId}/`, {
        status,
        buyer_response: response || '',
      })
      return data
    },
    onSuccess: () => { onUpdate(); toast({ title: 'Deviation updated' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  return (
    <div className="space-y-6">
      {/* Send to Vendor + Signing */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Vendor Communication & Signing</CardTitle>
            {!vendorSig && (isActive || ['approved', 'pending_vendor_negotiation'].includes(contract.status)) && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowSendModal(true)}>
                <Send className="w-3.5 h-3.5" /> Send to Vendor
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Send to Vendor modal */}
          {showSendModal && (
            <div className="p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
              <h3 className="text-sm font-semibold">Send Contract to Vendor</h3>
              <p className="text-xs text-muted-foreground">
                A secure link will be generated for the vendor to review and sign the contract. No login required — the vendor opens the link in their browser.
              </p>
              <div className="p-3 bg-white rounded-lg border space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Vendor Contact (from Vendor Master)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px]">Contact Person</Label>
                    <Input className="h-8 text-sm bg-slate-50" value={contract.vendor_name} disabled />
                  </div>
                  <div>
                    <Label className="text-[10px]">Email (link will be sent here)</Label>
                    <Input className="h-8 text-sm" value={sendEmail}
                      onChange={e => setSendEmail(e.target.value)}
                      placeholder="vendor@company.com" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowSendModal(false)}>Cancel</Button>
                <Button size="sm" disabled={!sendEmail || sendToVendorMutation.isPending}
                  onClick={() => {
                    sendToVendorMutation.mutate()
                    setShowSendModal(false)
                  }} className="gap-1.5">
                  {sendToVendorMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Generate & Send Link
                </Button>
              </div>
            </div>
          )}

          {/* Vendor link (shown after generating) */}
          {vendorLink && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <p className="text-xs font-medium text-blue-800">Vendor Portal Link (expires in 7 days)</p>
              <div className="flex gap-2">
                <Input value={vendorLink} readOnly className="h-8 text-xs font-mono bg-white" />
                <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs"
                  onClick={() => { navigator.clipboard.writeText(vendorLink); toast({ title: 'Copied' }) }}>Copy</Button>
              </div>
              <p className="text-[10px] text-blue-600">Share this link with the vendor. They can review the full contract and sign — no login needed.</p>
            </div>
          )}

          {/* Signature status */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 border rounded-lg ${internalSig ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
              <div className="flex items-center gap-3">
                {internalSig ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <PenTool className="w-5 h-5 text-slate-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Internal Signature</p>
                  {internalSig ? (
                    <p className="text-[10px] text-muted-foreground truncate">{internalSig.signatory_name} &middot; {formatDate(internalSig.signed_at)}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Not signed</p>
                  )}
                </div>
                {isActive && !internalSig && (
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setShowSignPanel(true)}>Sign</Button>
                )}
              </div>
              {internalSig?.signature_image && (
                <img src={internalSig.signature_image} alt="Internal signature" className="mt-2 h-12 border rounded bg-white p-1" />
              )}
            </div>
            <div className={`p-3 border rounded-lg ${vendorSig ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
              <div className="flex items-center gap-3">
                {vendorSig ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <PenTool className="w-5 h-5 text-slate-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Vendor Signature</p>
                  {vendorSig ? (
                    <p className="text-[10px] text-muted-foreground truncate">{vendorSig.signatory_name} &middot; {formatDate(vendorSig.signed_at)}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Awaiting vendor</p>
                  )}
                </div>
              </div>
              {vendorSig?.signature_image && (
                <img src={vendorSig.signature_image} alt="Vendor signature" className="mt-2 h-12 border rounded bg-white p-1" />
              )}
            </div>
          </div>

          {/* Sign panel with signature pad */}
          {showSignPanel && (
            <div className="p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
              <p className="text-xs text-muted-foreground">
                By signing you confirm that you have reviewed the contract and have authority to sign on behalf of your organization.
                Your name, signature, IP address, and timestamp will be permanently recorded.
              </p>
              <div>
                <Label className="text-xs font-medium">Draw Your Signature</Label>
                <SignaturePad onSignatureChange={setSignatureImage} />
              </div>
              <textarea className="w-full min-h-[40px] border rounded-md p-2 text-sm resize-y"
                placeholder="Comments (optional)..." value={signComments} onChange={e => setSignComments(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowSignPanel(false)}>Cancel</Button>
                <Button size="sm" disabled={signMutation.isPending || !signatureImage}
                  onClick={() => signMutation.mutate()} className="gap-1.5">
                  {signMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenTool className="w-3.5 h-3.5" />}
                  I Agree & Sign
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Negotiation Rounds */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Negotiation Rounds</CardTitle>
            <span className="text-xs text-muted-foreground">{rounds.length} round(s)</span>
          </div>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No negotiation rounds yet. Click &quot;Send to Vendor&quot; to start.</p>
          ) : (
            <div className="space-y-4">
              {rounds.map((r: any) => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Round {r.round_number}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  {r.vendor_response && (
                    <div className="mt-2 p-3 bg-slate-50 rounded text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Vendor Response</p>
                      {r.vendor_response}
                    </div>
                  )}
                  {r.vendor_document_url && (
                    <a href={r.vendor_document_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Download className="w-3 h-3" /> Vendor Document
                      </Button>
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Sent by {r.created_by_name} &middot; Version: v{r.sent_version}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

// ── Removed: Milestones Tab, Clause Deviation Register ──────────────────────

function MilestonesTab({ contract, contractId, onUpdate }: { contract: any; contractId: string; onUpdate: () => void }) {
  const { toast } = useToast()
  const milestones = contract.milestones || []
  const obligations = contract.obligations || []
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [showAddObligation, setShowAddObligation] = useState(false)

  // Milestone form
  const [msTitle, setMsTitle] = useState('')
  const [msType, setMsType] = useState('payment')
  const [msDueDate, setMsDueDate] = useState('')
  const [msAmount, setMsAmount] = useState('')
  const [msPercentage, setMsPercentage] = useState('')

  // Obligation form
  const [obParty, setObParty] = useState('vendor')
  const [obDescription, setObDescription] = useState('')
  const [obDueDate, setObDueDate] = useState('')
  const [obRecurring, setObRecurring] = useState(false)
  const [obRecurrence, setObRecurrence] = useState('')

  const addMilestoneMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/contracts/${contractId}/milestones/`, {
        title: msTitle,
        milestone_type: msType,
        due_date: msDueDate,
        amount: msAmount ? parseFloat(msAmount) : null,
        percentage: msPercentage ? parseFloat(msPercentage) : null,
      })
      return data
    },
    onSuccess: () => {
      onUpdate()
      setShowAddMilestone(false)
      setMsTitle(''); setMsDueDate(''); setMsAmount(''); setMsPercentage('')
      toast({ title: 'Milestone added' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const completeMilestoneMutation = useMutation({
    mutationFn: async (msId: number) => {
      const { data } = await apiClient.patch(`/contracts/${contractId}/milestones/${msId}/`, {
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      return data
    },
    onSuccess: () => { onUpdate(); toast({ title: 'Milestone marked complete' }) },
  })

  const addObligationMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/contracts/${contractId}/obligations/`, {
        party: obParty,
        description: obDescription,
        due_date: obDueDate || null,
        is_recurring: obRecurring,
        recurrence_rule: obRecurrence,
      })
      return data
    },
    onSuccess: () => {
      onUpdate()
      setShowAddObligation(false)
      setObDescription(''); setObDueDate(''); setObRecurring(false); setObRecurrence('')
      toast({ title: 'Obligation added' })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const fulfillObligationMutation = useMutation({
    mutationFn: async (obId: number) => {
      const { data } = await apiClient.patch(`/contracts/${contractId}/obligations/${obId}/`, {
        is_fulfilled: true,
        fulfilled_at: new Date().toISOString(),
      })
      return data
    },
    onSuccess: () => { onUpdate(); toast({ title: 'Obligation marked fulfilled' }) },
  })

  return (
    <div className="space-y-6">
      {/* Milestones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Milestones ({milestones.filter((m: any) => m.is_completed).length}/{milestones.length} completed)
            </CardTitle>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAddMilestone(!showAddMilestone)}>
              <Plus className="w-3.5 h-3.5" /> Add Milestone
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddMilestone && (
            <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Title</Label>
                  <Input value={msTitle} onChange={e => setMsTitle(e.target.value)}
                    placeholder="e.g. 30% Advance Payment" />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                    value={msType} onChange={e => setMsType(e.target.value)}>
                    <option value="payment">Payment</option>
                    <option value="delivery">Delivery</option>
                    <option value="performance">Performance Review</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={msDueDate} onChange={e => setMsDueDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Amount (optional)</Label>
                  <Input type="number" step="0.01" value={msAmount} onChange={e => setMsAmount(e.target.value)}
                    placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-xs">Percentage (optional)</Label>
                  <Input type="number" step="0.01" value={msPercentage} onChange={e => setMsPercentage(e.target.value)}
                    placeholder="e.g. 30" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddMilestone(false)}>Cancel</Button>
                <Button size="sm" disabled={!msTitle || !msDueDate || addMilestoneMutation.isPending}
                  onClick={() => addMilestoneMutation.mutate()} className="gap-1.5">
                  {addMilestoneMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {milestones.length === 0 && !showAddMilestone ? (
            <p className="text-sm text-muted-foreground">No milestones defined yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <button
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                      ${m.is_completed
                        ? 'bg-emerald-500 border-emerald-500 cursor-default'
                        : 'border-slate-300 hover:border-emerald-400 cursor-pointer'}`}
                    onClick={() => !m.is_completed && completeMilestoneMutation.mutate(m.id)}
                    disabled={m.is_completed}
                  >
                    {m.is_completed && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${m.is_completed ? 'line-through text-muted-foreground' : ''}`}>{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(m.due_date)}
                      {m.amount && ` \u00B7 ${formatCurrency(m.amount)}`}
                      {m.percentage && ` (${m.percentage}%)`}
                      {m.is_completed && m.completed_at && ` \u00B7 Completed ${formatDate(m.completed_at)}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{m.milestone_type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Obligations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Obligations ({obligations.filter((o: any) => o.is_fulfilled).length}/{obligations.length} fulfilled)
            </CardTitle>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAddObligation(!showAddObligation)}>
              <Plus className="w-3.5 h-3.5" /> Add Obligation
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddObligation && (
            <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Party</Label>
                  <select className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                    value={obParty} onChange={e => setObParty(e.target.value)}>
                    <option value="buyer">Buyer</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Due Date (optional)</Label>
                  <Input type="date" value={obDueDate} onChange={e => setObDueDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <textarea className="w-full min-h-[60px] border rounded-md p-2 text-sm bg-background resize-y"
                  placeholder="Describe the obligation..."
                  value={obDescription} onChange={e => setObDescription(e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={obRecurring} onChange={e => setObRecurring(e.target.checked)}
                    className="rounded border-slate-300" />
                  Recurring
                </label>
                {obRecurring && (
                  <select className="h-8 border rounded-md px-2 text-sm bg-background"
                    value={obRecurrence} onChange={e => setObRecurrence(e.target.value)}>
                    <option value="">Frequency</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddObligation(false)}>Cancel</Button>
                <Button size="sm" disabled={!obDescription || addObligationMutation.isPending}
                  onClick={() => addObligationMutation.mutate()} className="gap-1.5">
                  {addObligationMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {obligations.length === 0 && !showAddObligation ? (
            <p className="text-sm text-muted-foreground">No obligations defined yet.</p>
          ) : (
            <div className="space-y-2">
              {obligations.map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant={o.party === 'buyer' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {o.party}
                  </Badge>
                  <div className="flex-1">
                    <p className={`text-sm ${o.is_fulfilled ? 'line-through text-muted-foreground' : ''}`}>{o.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.due_date && `Due ${formatDate(o.due_date)}`}
                      {o.is_recurring && ` \u00B7 ${o.recurrence_rule}`}
                      {o.is_fulfilled && o.fulfilled_at && ` \u00B7 Fulfilled ${formatDate(o.fulfilled_at)}`}
                    </p>
                  </div>
                  {o.is_fulfilled ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Button variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => fulfillObligationMutation.mutate(o.id)}>
                      Mark Done
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── History Tab (Versions, Amendments, Deviations) ──────────────────────────

function HistoryTab({ contract }: { contract: any }) {
  const versions = contract.versions || []
  const amendments = contract.amendment_records || []
  const deviations = contract.clause_deviations || []

  return (
    <div className="space-y-6">
      {/* Version History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Version History</CardTitle>
            <span className="text-xs text-muted-foreground">{versions.length} version(s)</span>
          </div>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      v.is_major ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {v.version_number}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{v.change_summary || 'No summary'}</p>
                      <p className="text-xs text-muted-foreground">{v.created_by_name} &middot; {formatDate(v.created_at)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0"
                    onClick={() => {
                      const w = window.open('', '_blank')
                      if (!w) return
                      w.document.write(`<!DOCTYPE html><html><head><title>v${v.version_number}</title>
                      <style>@page{margin:2cm}body{font-family:'Times New Roman',serif;font-size:12px;line-height:1.8;max-width:800px;margin:0 auto;padding:40px}</style>
                      </head><body><h1 style="text-align:center;font-size:16px">${contract.contract_id} — Version ${v.version_number}</h1>
                      <p style="text-align:center;color:#666;font-size:11px">${v.created_by_name} &mdash; ${v.created_at}</p><hr/>
                      <pre style="white-space:pre-wrap;font-family:'Times New Roman',serif">${v.body_content}</pre></body></html>`)
                      w.document.close()
                    }}>
                    <Download className="w-3 h-3" /> View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Amendments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Amendments</CardTitle>
            <span className="text-xs text-muted-foreground">{amendments.length} amendment(s)</span>
          </div>
        </CardHeader>
        <CardContent>
          {amendments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No amendments.</p>
          ) : (
            <div className="space-y-3">
              {amendments.map((a: any) => (
                <div key={a.id} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{a.amendment_type}</Badge>
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1">{a.description}</p>
                  {a.new_end_date && <p className="text-xs text-muted-foreground mt-1">New end date: {formatDate(a.new_end_date)}</p>}
                  {a.new_value && <p className="text-xs text-muted-foreground">New value: {formatCurrency(a.new_value)}</p>}
                  <p className="text-xs text-muted-foreground">{a.created_by_name}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clause Deviations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Clause Deviations</CardTitle>
            <span className="text-xs text-muted-foreground">{deviations.length} deviation(s)</span>
          </div>
        </CardHeader>
        <CardContent>
          {deviations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clause deviations.</p>
          ) : (
            <div className="space-y-3">
              {deviations.map((d: any) => (
                <div key={d.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={d.risk_level === 'high' ? 'destructive' : d.risk_level === 'medium' ? 'default' : 'secondary'}
                      className="text-[10px]">{d.risk_level} risk</Badge>
                    <StatusBadge status={d.status} />
                    {d.original_clause_title && <span className="text-xs text-muted-foreground">{d.original_clause_title}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-red-50 rounded">
                      <p className="text-[10px] font-medium text-red-600 mb-1">Original</p>
                      <p>{d.original_text}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <p className="text-[10px] font-medium text-green-600 mb-1">Proposed</p>
                      <p>{d.proposed_text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Reusable Approval/Review Step Tab ────────────────────────────────────────

function ApprovalStepTab({ contract, contractId, onUpdate, matrixType, submitEndpoint, label, description, allowedStatuses, entityType }: {
  contract: any; contractId: string; onUpdate: () => void
  matrixType: string; submitEndpoint: string; label: string; description: string
  allowedStatuses: string[]; entityType: string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canSubmit = allowedStatuses.includes(contract.status)
  const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
  const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
  const [actionComments, setActionComments] = useState('')

  const { data: matrices } = useQuery({
    queryKey: ['approval-matrices', matrixType],
    queryFn: async () => {
      const { data } = await apiClient.get('/approvals/matrices/', { params: { matrix_type: matrixType } })
      return data.results ?? data
    },
    enabled: canSubmit,
  })

  const { data: approvalData, isLoading } = useQuery({
    queryKey: [`contract-${matrixType}`, contractId],
    queryFn: async () => {
      const { data } = await apiClient.get('/approvals/requests/', {
        params: { entity_type: entityType, object_id: contract.id },
      })
      const list: any[] = data.results ?? data
      // Filter by matrix type if possible
      return list.find((r: any) => r.matrix_type === matrixType && ['pending', 'in_progress'].includes(r.status))
        ?? list.find((r: any) => r.matrix_type === matrixType)
        ?? list[0] ?? null
    },
    enabled: !canSubmit && !!contract.id,
  })

  const { data: myPendingAction } = useQuery({
    queryKey: ['pending-mine'],
    queryFn: async () => (await apiClient.get('/approvals/requests/pending-mine/')).data,
    select: (data: any[]) =>
      data.find(a => a.entity_type === entityType && String(a.object_id) === String(contract.id)),
    enabled: !canSubmit,
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body: any = {}
      if (selectedMatrix) body.matrix_id = selectedMatrix
      const { data } = await apiClient.post(`/contracts/${contractId}/${submitEndpoint}/`, body)
      return data
    },
    onSuccess: () => {
      onUpdate()
      queryClient.invalidateQueries({ queryKey: [`contract-${matrixType}`, contractId] })
      toast({ title: `Submitted for ${label.toLowerCase()}` })
    },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  })

  const processAction = async (action: string, comments: string) => {
    if (!myPendingAction) return
    try {
      await apiClient.patch(`/approvals/actions/${myPendingAction.action_id}/`, { action, comments })
      toast({ title: action === 'approved' ? 'Approved' : action === 'rejected' ? 'Rejected' : 'Held' })
      onUpdate()
      queryClient.invalidateQueries({ queryKey: [`contract-${matrixType}`, contractId] })
      queryClient.invalidateQueries({ queryKey: ['pending-mine'] })
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.response?.data?.error, variant: 'destructive' })
    }
  }

  // Can submit: show matrix selector
  if (canSubmit) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit for {label}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!matrices || matrices.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No {label.toLowerCase()} matrix configured. Create one in Settings &rarr; Matrix Config with type &quot;{matrixType.replaceAll('_', ' ')}&quot;.
              </p>
            ) : (
              <MatrixSelectorTable
                matrices={matrices}
                selectedMatrix={selectedMatrix}
                expandedMatrix={expandedMatrix}
                onSelect={(id) => { setSelectedMatrix(id); setExpandedMatrix(id) }}
                onToggleExpand={(id) => setExpandedMatrix(prev => prev === id ? null : id)}
              />
            )}

            <div className="flex justify-end">
              <Button disabled={!selectedMatrix || submitMutation.isPending}
                onClick={() => submitMutation.mutate()} className="gap-1.5">
                {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit for {label}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already submitted: show progress table (same as Budget/PR)
  const reqStatus = approvalData?.status
  let headerBg = 'bg-amber-50', headerText = 'text-amber-800'
  if (reqStatus === 'approved') { headerBg = 'bg-green-50'; headerText = 'text-green-800' }
  else if (reqStatus === 'rejected') { headerBg = 'bg-red-50'; headerText = 'text-red-800' }

  let levelLabel = `${label} Pending`
  if (isLoading) levelLabel = 'Loading\u2026'
  else if (reqStatus === 'approved') levelLabel = `${label} Complete`
  else if (reqStatus === 'rejected') levelLabel = `${label} Rejected`
  else if (approvalData) levelLabel = `${label} In Progress \u2014 Level ${approvalData.current_level}`

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${headerBg}`}>
        <div className="flex items-center gap-2">
          {reqStatus === 'approved' ? <CheckCircle className="w-4 h-4 text-green-600" />
            : reqStatus === 'rejected' ? <AlertTriangle className="w-4 h-4 text-red-600" />
            : <Clock className="w-4 h-4 text-amber-600" />}
          <span className={`text-sm font-medium ${headerText}`}>{levelLabel}</span>
          {approvalData && <span className="text-xs text-muted-foreground">via {approvalData.matrix_name}</span>}
        </div>
      </div>

      {isLoading && (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading\u2026
        </div>
      )}

      {!isLoading && !approvalData && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          Not yet submitted for {label.toLowerCase()}.
        </div>
      )}

      {/* Approval timeline table */}
      {!isLoading && approvalData && (
        <div className="px-4 py-3 bg-white border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label} Timeline</p>
          {approvalData.created_at && (
            <p className="text-[11px] text-muted-foreground mb-2">
              Submitted: <span className="font-medium text-slate-700">{formatDate(approvalData.created_at)}</span>
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 640 }}>
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left px-3 py-2 font-medium w-12">Level</th>
                  <th className="text-left px-3 py-2 font-medium">Approver</th>
                  <th className="text-left px-3 py-2 font-medium w-28">Status</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Due Date</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Acted At</th>
                  <th className="text-left px-3 py-2 font-medium">Comments</th>
                </tr>
              </thead>
              <tbody>
                {(approvalData.actions || []).map((a: any) => {
                  const isPending = !a.action || a.action === 'pending'
                  const isCurrent = isPending && a.level_number === approvalData.current_level
                  const effectiveAction = a.action ?? 'pending'
                  const actionLabel2 = effectiveAction === 'approved' ? 'Approved'
                    : effectiveAction === 'rejected' ? 'Rejected'
                    : effectiveAction === 'held' ? 'On Hold' : 'Pending'
                  const bubbleCls = effectiveAction === 'approved' ? 'bg-green-100 text-green-700'
                    : effectiveAction === 'rejected' ? 'bg-red-100 text-red-700'
                    : effectiveAction === 'held' ? 'bg-amber-100 text-amber-700'
                    : isCurrent ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'
                  const badgeCls = effectiveAction === 'approved' ? 'bg-green-50 border-green-200 text-green-700'
                    : effectiveAction === 'rejected' ? 'bg-red-50 border-red-200 text-red-700'
                    : effectiveAction === 'held' ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                  return (
                    <tr key={a.id} className={`border-t ${isCurrent ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] ${bubbleCls}`}>
                          {a.level_number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                        {a.approver_name ?? '\u2014'}
                        {a.role_name && <span className="ml-1 text-muted-foreground font-normal">({a.role_name})</span>}
                        {isCurrent && <span className="ml-1.5 text-xs font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">awaiting</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${badgeCls}`}>
                          {effectiveAction === 'approved' ? <CheckCircle className="w-3 h-3" />
                            : effectiveAction === 'rejected' ? <AlertTriangle className="w-3 h-3" />
                            : <Clock className="w-3 h-3" />}
                          {actionLabel2}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {a.sla_deadline ? formatDate(a.sla_deadline) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {a.acted_at ? formatDate(a.acted_at) : '\u2014'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground italic max-w-[200px] truncate" title={a.comments || undefined}>
                        {a.comments ? `"${a.comments}"` : '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My action panel */}
      {myPendingAction && (
        <div className="px-4 py-3 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your action required \u2014 Level {myPendingAction.level_number}</p>
          <div>
            <label className="text-xs font-medium">Comments <span className="text-red-500">*</span></label>
            <textarea className="mt-1 w-full border rounded-md p-2 text-sm resize-none h-16"
              placeholder="Add your comments\u2026"
              value={actionComments} onChange={e => setActionComments(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
              onClick={() => processAction('approved', actionComments)}
              disabled={!actionComments.trim()}>
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-1"
              onClick={() => processAction('rejected', actionComments)}
              disabled={!actionComments.trim()}>
              Reject
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300"
              onClick={() => processAction('held', actionComments)}
              disabled={!actionComments.trim()}>
              <Clock className="w-3.5 h-3.5" /> Hold
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
