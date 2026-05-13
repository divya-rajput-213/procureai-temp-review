import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'

import { MatrixSelectorTable } from '@/components/shared/MatrixSelectorTable'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api/client'

import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog'

type ApprovalMatrixProps = {
    prId: string | string[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onClose: () => void
    onSuccess?: () => void
    showFooter?: boolean
}

const ApprovalMatrix = ({
    prId,
    open,
    onOpenChange,
    onClose,
    onSuccess,
    showFooter = true,
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
        setSubmitting(true)

        try {
            const body = selectedMatrix
                ? { matrix_id: selectedMatrix }
                : {}

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Select Approval Matrix
                    </h2>

                    <p className="text-xs text-muted-foreground mt-1">
                        Choose the approval workflow for this budget request.
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
                    {loadingMatrices && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading matrices…
                        </div>
                    )}

                    {!loadingMatrices && (matrices ?? []).length === 0 && (
                        <p className="text-xs text-amber-600 font-medium">
                            No active PR approval matrices configured. The system will use
                            the default matrix.
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
                                setExpandedMatrix((prev) =>
                                    prev === id ? null : id
                                )
                            }}
                        />
                    )}
                </div>

                {/* Footer */}
                {showFooter && (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={submit}
                            disabled={submitting}
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
                )}
            </DialogContent>
        </Dialog>
    )
}

export default ApprovalMatrix