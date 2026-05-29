'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import apiClient from '@/lib/api/client'
import ProcurementForm from '../../components/ProcurementForm'

// Edit-page router. PRs raised through the Quick PR flow have no
// linked_quotations, so the bid-comparison ProcurementForm doesn't fit. We
// route those to /procurement/quick-edit/{id} instead. Everything else still
// gets the existing ProcurementForm.

export default function EditPRPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const initialStep = Number(searchParams.get('step') || '1')
  const router = useRouter()

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr-edit-router', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/`)).data,
    enabled: !!id,
    staleTime: 0,
  })

  // Send Quick PRs (no quotations linked) to the dedicated quick-edit page
  useEffect(() => {
    if (!pr) return
    const hasQuotations = ((pr.linked_quotations as any[]) || []).length > 0
    if (!hasQuotations) {
      router.replace(`/procurement/quick-edit/${id}`)
    }
  }, [pr, id, router])

  if (isLoading || !pr) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Redirect in flight for Quick PRs — render nothing until the navigation lands
  if (((pr.linked_quotations as any[]) || []).length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <ProcurementForm mode="edit" procurementId={id} initialStep={initialStep} />
}
