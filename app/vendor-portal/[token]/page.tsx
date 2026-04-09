'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  PenTool, CheckCircle, Loader2, AlertTriangle, FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignaturePad } from '@/components/shared/SignaturePad'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export default function VendorSignPage() {
  const { token } = useParams()
  const [contract, setContract] = useState<any>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [signed, setSigned] = useState(false)
  const [error, setError] = useState('')
  const [showFullBody, setShowFullBody] = useState(false)

  // Load contract details by token
  useEffect(() => {
    async function loadContract() {
      try {
        const res = await fetch(`${API_URL}/contracts/vendor-preview/?token=${token}`)
        if (!res.ok) {
          const data = await res.json()
          setLoadError(data.error || 'Failed to load contract')
          return
        }
        const data = await res.json()
        setContract(data)
        if (data.vendor_signed) setSigned(true)
      } catch {
        setLoadError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }
    if (token) loadContract()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-lg font-semibold">Unable to Load Contract</h1>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-emerald-200">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold text-emerald-800">Contract Signed Successfully</h1>
            <p className="text-sm text-muted-foreground">
              Your digital signature has been recorded for contract <strong>{contract?.contract_id}</strong>.
            </p>
            <div className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-700 text-left">
              <p><strong>Contract:</strong> {contract?.contract_id}</p>
              <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Contract Review & Signing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please review the contract below and sign at the bottom.
          </p>
        </div>

        {/* Contract Document */}
        <Card>
          <div className="p-8 space-y-6" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {/* Title */}
            <div className="text-center border-b-2 border-black pb-4">
              <h2 className="text-xl font-bold uppercase">{contract.contract_type}</h2>
              <p className="text-base font-semibold mt-1">{contract.title}</p>
              <p className="text-xs text-gray-500 mt-2">
                Contract ID: {contract.contract_id} &nbsp;|&nbsp; Version: v{contract.current_version}
              </p>
            </div>

            {/* Parties */}
            <div>
              <h3 className="font-bold uppercase border-b pb-1 mb-3 text-sm">Parties to this Agreement</h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-semibold">BUYER (First Party)</p>
                  <p className="text-xs text-gray-600">Plant: {contract.plant_name}</p>
                  <p className="text-xs text-gray-600">Department: {contract.department_name}</p>
                </div>
                <div>
                  <p className="font-semibold">VENDOR (Second Party)</p>
                  <p className="font-medium">{contract.vendor_name}</p>
                  {contract.vendor_address && <p className="text-xs text-gray-600">{contract.vendor_address}</p>}
                  {contract.vendor_gstin && <p className="text-xs text-gray-600">GSTIN: {contract.vendor_gstin}</p>}
                  {contract.vendor_contact && <p className="text-xs text-gray-600">Contact: {contract.vendor_contact}</p>}
                  {contract.vendor_email && <p className="text-xs text-gray-600">Email: {contract.vendor_email}</p>}
                </div>
              </div>
            </div>

            {/* Key Terms */}
            <div>
              <h3 className="font-bold uppercase border-b pb-1 mb-3 text-sm">Key Terms</h3>
              <table className="w-full text-sm">
                <tbody>
                  {([
                    ['Contract Value', `${contract.currency_code} ${Number(contract.estimated_value).toLocaleString()}`],
                    ['Start Date', contract.start_date],
                    ['End Date', contract.end_date],
                    ['Duration', `${contract.duration_months} months`],
                    ['Payment Terms', contract.payment_terms || 'As per agreement'],
                    ['Incoterms', contract.incoterms || 'N/A'],
                  ] as [string, string][]).map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-200">
                      <td className="py-1.5 font-medium w-1/3 text-gray-700">{k}</td>
                      <td className="py-1.5">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Contract Body */}
            {contract.body_content && (
              <div>
                <h3 className="font-bold uppercase border-b pb-1 mb-3 text-sm">Terms & Conditions</h3>
                <div className={`whitespace-pre-wrap text-sm leading-relaxed ${!showFullBody ? 'max-h-[400px] overflow-hidden relative' : ''}`}>
                  {contract.body_content}
                  {!showFullBody && contract.body_content.length > 1500 && (
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
                  )}
                </div>
                {contract.body_content.length > 1500 && (
                  <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs w-full"
                    onClick={() => setShowFullBody(!showFullBody)}>
                    {showFullBody ? <><ChevronUp className="w-3.5 h-3.5" /> Show Less</> : <><ChevronDown className="w-3.5 h-3.5" /> Read Full Contract</>}
                  </Button>
                )}
              </div>
            )}

            {/* Milestones */}
            {contract.milestones?.length > 0 && (
              <div>
                <h3 className="font-bold uppercase border-b pb-1 mb-3 text-sm">Payment Milestones</h3>
                <table className="w-full text-sm border">
                  <thead><tr className="bg-gray-100">
                    <th className="text-left px-3 py-1.5 border text-xs">#</th>
                    <th className="text-left px-3 py-1.5 border text-xs">Milestone</th>
                    <th className="text-left px-3 py-1.5 border text-xs">Due Date</th>
                    <th className="text-left px-3 py-1.5 border text-xs">Amount</th>
                  </tr></thead>
                  <tbody>
                    {contract.milestones.map((m: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-1 border text-xs">{i + 1}</td>
                        <td className="px-3 py-1 border text-xs">{m.title}</td>
                        <td className="px-3 py-1 border text-xs">{m.due_date}</td>
                        <td className="px-3 py-1 border text-xs">
                          {m.amount ? `${contract.currency_code} ${Number(m.amount).toLocaleString()}` : ''}
                          {m.percentage ? ` (${m.percentage}%)` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Signature Block */}
            <div>
              <h3 className="font-bold uppercase border-b pb-1 mb-3 text-sm">Digital Signatures</h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="border rounded p-3">
                  <p className="font-semibold text-xs mb-2">BUYER (Internal Signatory)</p>
                  {contract.internal_signed && contract.internal_signature ? (
                    <div className="space-y-1">
                      <p className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Signed
                      </p>
                      <p className="text-xs text-gray-600">{contract.internal_signature.name}</p>
                      <p className="text-xs text-gray-600">Date: {contract.internal_signature.date}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Not yet signed</p>
                  )}
                </div>
                <div className="border rounded p-3">
                  <p className="font-semibold text-xs mb-2">VENDOR (Your Signature)</p>
                  {contract.vendor_signed && contract.vendor_signature ? (
                    <div className="space-y-1">
                      <p className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Signed
                      </p>
                      <p className="text-xs text-gray-600">{contract.vendor_signature.name}</p>
                      <p className="text-xs text-gray-600">Date: {contract.vendor_signature.date}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 italic">Awaiting your signature below</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Vendor Response Section */}
        <VendorResponseSection
          contract={contract}
          token={token as string}
          error={error}
          setError={setError}
          onSigned={() => setSigned(true)}
        />
      </div>
    </div>
  )
}

// ── Vendor Response Section (Accept / Propose Changes / Decline / Sign) ─────

function VendorResponseSection({ contract, token, error, setError, onSigned }: {
  contract: any; token: string; error: string; setError: (e: string) => void; onSigned: () => void
}) {
  const [mode, setMode] = useState<'choose' | 'accept_sign' | 'propose' | 'decline'>('choose')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [designation, setDesignation] = useState('')
  const [comments, setComments] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [proposedChanges, setProposedChanges] = useState('')
  const [signatureImage, setSignatureImage] = useState('')
  const [responded, setResponded] = useState(false)

  const isActive = ['approved', 'active', 'extended'].includes(contract.status)
  const isNegotiation = contract.status === 'pending_vendor_negotiation'

  // Vendor respond (accept/propose/decline during negotiation)
  const respondMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/contracts/vendor-respond/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      return res.json()
    },
    onSuccess: () => setResponded(true),
    onError: (err: any) => setError(err.message),
  })

  // Vendor sign (for active contracts)
  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/contracts/vendor-sign/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, signatory_name: name, signatory_email: email,
          signatory_designation: designation, comments, signature_image: signatureImage,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Signing failed') }
      return res.json()
    },
    onSuccess: () => onSigned(),
    onError: (err: any) => setError(err.message),
  })

  if (responded) {
    return (
      <Card className="border-2 border-emerald-300">
        <CardContent className="p-8 text-center space-y-3">
          <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-semibold">Response Submitted</h3>
          <p className="text-sm text-muted-foreground">
            {mode === 'propose' ? 'Your proposed changes have been submitted. The buyer will review and respond.'
              : mode === 'decline' ? 'You have declined this contract. The buyer will be notified.'
              : 'Your acceptance has been recorded.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="border-b bg-primary/5">
        <CardTitle className="text-base flex items-center gap-2">
          <PenTool className="w-5 h-5 text-primary" />
          {isActive ? 'Sign This Contract' : 'Your Response'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step 1: Choose action (negotiation phase) */}
        {isNegotiation && mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Please review the contract above and choose your response:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button type="button" onClick={() => setMode('accept_sign')}
                className="p-4 border-2 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left">
                <CheckCircle className="w-6 h-6 text-emerald-600 mb-2" />
                <p className="font-semibold text-sm">Accept As-Is</p>
                <p className="text-xs text-muted-foreground mt-1">I agree to all terms. Proceed to signing.</p>
              </button>
              <button type="button" onClick={() => setMode('propose')}
                className="p-4 border-2 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors text-left">
                <PenTool className="w-6 h-6 text-amber-600 mb-2" />
                <p className="font-semibold text-sm">Propose Changes</p>
                <p className="text-xs text-muted-foreground mt-1">I want to suggest modifications to some terms.</p>
              </button>
              <button type="button" onClick={() => setMode('decline')}
                className="p-4 border-2 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-left">
                <AlertTriangle className="w-6 h-6 text-red-600 mb-2" />
                <p className="font-semibold text-sm">Decline</p>
                <p className="text-xs text-muted-foreground mt-1">I do not wish to proceed with this contract.</p>
              </button>
            </div>
          </div>
        )}

        {/* Accept & Sign form (both negotiation accept and active contract signing) */}
        {(mode === 'accept_sign' || isActive) && (
          <div className="space-y-4">
            {isNegotiation && (
              <button type="button" onClick={() => setMode('choose')} className="text-xs text-primary hover:underline">&larr; Back to options</button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Full Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full legal name" /></div>
              <div><Label>Email *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your.email@company.com" /></div>
              <div><Label>Designation</Label>
                <Input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Director of Sales" /></div>
              <div><Label>Comments (optional)</Label>
                <Input value={comments} onChange={e => setComments(e.target.value)} placeholder="Any notes..." /></div>
            </div>
            {/* Signature Pad */}
            <div>
              <Label className="text-xs font-medium">Draw Your Signature *</Label>
              <SignaturePad onSignatureChange={setSignatureImage} />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <p className="font-medium mb-1">Legal Declaration</p>
              <p>By signing below, I confirm that I am an authorized signatory of
                <strong> {contract.vendor_name}</strong>, I have read and agree to all terms of contract
                <strong> {contract.contract_id}</strong>, and my name, signature, email, IP address, and timestamp
                will be permanently recorded as my digital signature.</p>
            </div>
            {isNegotiation ? (
              <Button className="w-full gap-2" size="lg" disabled={!name || !email || !signatureImage || respondMutation.isPending}
                onClick={() => { setError(''); respondMutation.mutate({ action: 'accept', comments }) }}>
                {respondMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Accept Contract
              </Button>
            ) : (
              <Button className="w-full gap-2" size="lg" disabled={!name || !email || !signatureImage || signMutation.isPending}
                onClick={() => { setError(''); signMutation.mutate() }}>
                {signMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PenTool className="w-5 h-5" />}
                I Agree &amp; Sign This Contract
              </Button>
            )}
          </div>
        )}

        {/* Propose Changes form */}
        {mode === 'propose' && (
          <div className="space-y-4">
            <button type="button" onClick={() => setMode('choose')} className="text-xs text-primary hover:underline">&larr; Back to options</button>
            <div>
              <Label>Describe your proposed changes *</Label>
              <textarea className="w-full min-h-[120px] border rounded-md p-3 text-sm resize-y"
                placeholder="Describe the changes you want to make to the contract terms. Be specific about which clauses or sections you want modified..."
                value={proposedChanges} onChange={e => setProposedChanges(e.target.value)} />
            </div>
            <Button className="w-full gap-2" size="lg" disabled={!proposedChanges.trim() || respondMutation.isPending}
              onClick={() => { setError(''); respondMutation.mutate({
                action: 'propose_changes', comments: proposedChanges,
                deviations: [{ original_text: 'See vendor comments', proposed_text: proposedChanges, justification: 'Vendor request' }],
              }) }}>
              {respondMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PenTool className="w-5 h-5" />}
              Submit Proposed Changes
            </Button>
          </div>
        )}

        {/* Decline form */}
        {mode === 'decline' && (
          <div className="space-y-4">
            <button type="button" onClick={() => setMode('choose')} className="text-xs text-primary hover:underline">&larr; Back to options</button>
            <div>
              <Label>Reason for declining *</Label>
              <textarea className="w-full min-h-[80px] border rounded-md p-3 text-sm resize-y"
                placeholder="Please explain why you are declining this contract..."
                value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-full gap-2" size="lg"
              disabled={!declineReason.trim() || respondMutation.isPending}
              onClick={() => { setError(''); respondMutation.mutate({ action: 'decline', reason: declineReason }) }}>
              {respondMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
              Decline Contract
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
