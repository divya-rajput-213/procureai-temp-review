import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Send } from 'lucide-react'

import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api/client'


type ApprovalMatrixProps = {
    prId: string | string[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onClose: () => void
    onSuccess?: () => void
    showFooter?: boolean
    selectedVendor?: any
    setStep:any
    step:any
}

const ApprovalMatrix = ({
    prId,
    open,
    onOpenChange,
    onClose,
    onSuccess,
    showFooter = true,
    selectedVendor,
    setStep,
    step
}: ApprovalMatrixProps) => {
    const { toast } = useToast()

    const [selectedMatrix, setSelectedMatrix] = useState<number | null>(null)
    const [expandedMatrix, setExpandedMatrix] = useState<number | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const { data: matrices, isLoading: loadingMatrices } = useQuery({
        queryKey: ['approval-matrices-pr'],
        queryFn: async () => {
            const response = await apiClient.get('/approvals/matrices/', {
                params: {
                    matrix_type: 'purchase_requisition',
                    is_active: 'true',
                },
            })

            return response.data.results ?? response.data
        },
    })

    const submit = async () => {
        if (!prId) {
            toast({
                title: 'Submission failed',
                description: 'PR ID is missing.',
                variant: 'destructive',
            })
            return
        }
        if(!selectedVendor){
            toast({ title: 'Submission failed', description: 'No quotation selected.', variant: 'destructive' })
            setSubmitting(false)
            return
          }
        setSubmitting(true)

        try {
            const body = selectedMatrix
                ? { matrix_id: selectedMatrix, selected_quotation_id:selectedVendor}
                : {selected_quotation:selectedVendor }

            await apiClient.post(`/procurement/${prId}/submit/`, body)
            onSuccess?.()
            onClose()
        } catch (err: any) {
            toast({
                title: 'Submission failed',
                description: err?.response?.data?.error,
                variant: 'destructive',
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: '#1a1a18' }}>
    
          <div style={{ padding: '16px' }}>
            {matrices === undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9a9a96', padding: '4px 0' }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading matrices…
              </div>
            )}

            {!loadingMatrices && (matrices ?? []).length === 0 && (
              <p style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>
                No active PR approval matrices configured. The system will use the default matrix.
              </p>
            )}

            {!loadingMatrices && (matrices ?? []).length > 0 && (
              <MatrixSelectorTable
                matrices={matrices}
                selectedMatrix={selectedMatrix}
                expandedMatrix={expandedMatrix}
                onSelect={(id) => {
                  setSelectedMatrix(id)
                  setExpandedMatrix(id)
                }}
                onToggleExpand={(id) => {
                  setExpandedMatrix((prev) => (prev === id ? null : id))
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderTop: '0.5px solid rgba(0,0,0,0.08)', background: '#fff' }}>
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || (matrices && matrices.length > 0 && selectedMatrix === null) || !selectedVendor}
              className="gap-2 min-w-[160px]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit for Approval
            </Button>
          </div>
        </div>
    )
}

export default ApprovalMatrix