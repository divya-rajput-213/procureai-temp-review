'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import apiClient from '@/lib/api/client'

export default function ContractDocumentPage() {
  const { id } = useParams()
  const router = useRouter()

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => { const { data } = await apiClient.get(`/contracts/${id}/`); return data },
    enabled: !!id,
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }
  if (!contract) {
    return <div className="text-center py-12 text-muted-foreground">Contract not found.</div>
  }

  const signatures = contract.signatures || []
  const internalSig = signatures.find((s: any) => s.party === 'internal')
  const vendorSig = signatures.find((s: any) => s.party === 'vendor')

  return (
    <div>
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/contracts/${id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold">Contract Document</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Document (print-friendly) */}
      <div className="max-w-[210mm] mx-auto bg-white border print:border-0 print:shadow-none shadow-lg">
        <div className="p-12 print:p-8 space-y-8 text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>

          {/* Header */}
          <div className="text-center border-b-2 border-black pb-6">
            <h1 className="text-2xl font-bold tracking-wide uppercase">
              {contract.contract_type === 'MSA' ? 'Master Supply Agreement' :
               contract.contract_type === 'LTA' ? 'Long-Term Agreement' :
               contract.contract_type === 'SLA' ? 'Service Level Agreement' :
               contract.contract_type === 'NDA' ? 'Non-Disclosure Agreement' :
               contract.contract_type === 'SOW' ? 'Statement of Work' :
               contract.contract_type === 'Tooling' ? 'Tooling Agreement' :
               contract.contract_type}
            </h1>
            <p className="text-base mt-2 font-semibold">{contract.title}</p>
            <p className="text-xs text-gray-500 mt-2">
              Contract ID: {contract.contract_id} &nbsp;|&nbsp; Version: v{contract.current_version}
              &nbsp;|&nbsp; Date: {formatDate(contract.created_at)}
            </p>
          </div>

          {/* Parties */}
          <div>
            <h2 className="text-base font-bold uppercase border-b pb-1 mb-3">Parties</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="font-semibold">BUYER (&ldquo;First Party&rdquo;)</p>
                <p className="mt-1">[BUYER_COMPANY_NAME]</p>
                <p className="text-xs text-gray-600">Plant: {contract.plant_name}</p>
                <p className="text-xs text-gray-600">Department: {contract.department_name}</p>
              </div>
              <div>
                <p className="font-semibold">VENDOR (&ldquo;Second Party&rdquo;)</p>
                <p className="mt-1">{contract.vendor_name}</p>
              </div>
            </div>
          </div>

          {/* Key Terms */}
          <div>
            <h2 className="text-base font-bold uppercase border-b pb-1 mb-3">Key Terms</h2>
            <table className="w-full text-sm">
              <tbody>
                {([
                  ['Contract Type', CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type],
                  ['Contract Value', `${contract.currency_code} ${formatCurrency(contract.estimated_value, contract.currency_code)}`],
                  ['Effective Date', formatDate(contract.start_date)],
                  ['Expiry Date', formatDate(contract.end_date)],
                  ['Duration', `${contract.duration_months} months`],
                  ['Payment Terms', contract.payment_terms || 'As per company policy'],
                  ['Incoterms', contract.incoterms || 'N/A'],
                  ['Status', contract.status.replace(/_/g, ' ').toUpperCase()],
                ] as [string, string][]).map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-200">
                    <td className="py-1.5 font-medium w-1/3">{label}</td>
                    <td className="py-1.5">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Contract Body */}
          {contract.body_content && (
            <div>
              <h2 className="text-base font-bold uppercase border-b pb-1 mb-3">Terms & Conditions</h2>
              <div className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: '13px' }}>
                {contract.body_content}
              </div>
            </div>
          )}

          {/* Milestones */}
          {(contract.milestones || []).length > 0 && (
            <div>
              <h2 className="text-base font-bold uppercase border-b pb-1 mb-3">Payment Milestones</h2>
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-3 py-2 border">#</th>
                    <th className="text-left px-3 py-2 border">Milestone</th>
                    <th className="text-left px-3 py-2 border">Due Date</th>
                    <th className="text-left px-3 py-2 border">Amount / %</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.milestones.map((m: any, idx: number) => (
                    <tr key={m.id}>
                      <td className="px-3 py-1.5 border">{idx + 1}</td>
                      <td className="px-3 py-1.5 border">{m.title}</td>
                      <td className="px-3 py-1.5 border">{formatDate(m.due_date)}</td>
                      <td className="px-3 py-1.5 border">
                        {m.amount ? formatCurrency(m.amount, contract.currency_code) : ''}
                        {m.percentage ? ` (${m.percentage}%)` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature Block */}
          <div className="mt-12 pt-8 border-t-2 border-black">
            <h2 className="text-base font-bold uppercase mb-6">Signatures</h2>
            <div className="grid grid-cols-2 gap-12">
              {/* Buyer */}
              <div className="space-y-6">
                <p className="font-semibold">For and on behalf of BUYER:</p>
                {internalSig ? (
                  <div className="border-2 border-emerald-500 rounded-lg p-4 bg-emerald-50/50">
                    <p className="text-xs text-emerald-700 font-semibold mb-1">DIGITALLY SIGNED</p>
                    <p className="font-semibold text-base">{internalSig.signatory_name}</p>
                    <p className="text-xs">{internalSig.signatory_designation}</p>
                    <p className="text-xs text-gray-500">{internalSig.signatory_email}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Signed: {formatDate(internalSig.signed_at)} &nbsp;|&nbsp; IP: {internalSig.ip_address}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <div className="border-b border-black w-full mb-1" style={{ height: '40px' }} />
                      <p className="text-xs text-gray-500">Authorized Signatory</p>
                    </div>
                    <div>
                      <div className="border-b border-black w-full mb-1" style={{ height: '20px' }} />
                      <p className="text-xs text-gray-500">Name &amp; Designation</p>
                    </div>
                    <div>
                      <div className="border-b border-black w-full mb-1" style={{ height: '20px' }} />
                      <p className="text-xs text-gray-500">Date</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Vendor */}
              <div className="space-y-6">
                <p className="font-semibold">For and on behalf of VENDOR ({contract.vendor_name}):</p>
                {vendorSig ? (
                  <div className="border-2 border-emerald-500 rounded-lg p-4 bg-emerald-50/50">
                    <p className="text-xs text-emerald-700 font-semibold mb-1">DIGITALLY SIGNED</p>
                    <p className="font-semibold text-base">{vendorSig.signatory_name}</p>
                    <p className="text-xs">{vendorSig.signatory_designation}</p>
                    <p className="text-xs text-gray-500">{vendorSig.signatory_email}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Signed: {formatDate(vendorSig.signed_at)} &nbsp;|&nbsp; IP: {vendorSig.ip_address}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <div className="border-b border-black w-full mb-1" style={{ height: '40px' }} />
                      <p className="text-xs text-gray-500">Authorized Signatory</p>
                    </div>
                    <div>
                      <div className="border-b border-black w-full mb-1" style={{ height: '20px' }} />
                      <p className="text-xs text-gray-500">Name &amp; Designation</p>
                    </div>
                    <div>
                      <div className="border-b border-black w-full mb-1" style={{ height: '20px' }} />
                      <p className="text-xs text-gray-500">Date</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pt-6 border-t mt-8">
            <p>This document was generated by ProcureAI &middot; Contract ID: {contract.contract_id} &middot; v{contract.current_version}</p>
            <p>Generated on {formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-8 { padding: 2cm !important; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>
    </div>
  )
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  MSA: 'Master Supply Agreement',
  LTA: 'Long-Term Agreement',
  SLA: 'Service Level Agreement',
  Tooling: 'Tooling Agreement',
  NDA: 'Non-Disclosure Agreement',
  SOW: 'Statement of Work',
}
