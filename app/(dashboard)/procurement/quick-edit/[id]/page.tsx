'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { QuickPRForm, type QuickPRInitial } from '../../components/QuickPRForm'

// Quick-edit entry point. Fetches the PR + its linked tracking + selected
// vendor, hands the seed data to the shared QuickPRForm component which then
// PATCHes /procurement/{id}/quick-update/ on save.

export default function QuickEditPRPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: pr, isLoading: prLoading, error } = useQuery({
    queryKey: ['pr', id],
    queryFn: async () => (await apiClient.get(`/procurement/${id}/`)).data,
    enabled: !!id,
  })

  // Only draft PRs are editable via Quick edit. Redirect to detail if not.
  useEffect(() => {
    if (pr && pr.status !== 'draft') {
      router.replace(`/procurement/${id}`)
    }
  }, [pr, id, router])

  // The PR detail serializer returns tracking_id as the numeric FK. Fetch the
  // full tracking object so the form's "selected tracking" card has plant_name,
  // department_name, remaining_amount, etc.
  const { data: tracking } = useQuery({
    queryKey: ['tracking-id', pr?.tracking_id],
    queryFn: async () => (await apiClient.get(`/budget/tracking-ids/${pr.tracking_id}/`)).data,
    enabled: !!pr?.tracking_id,
  })

  const { data: vendor } = useQuery({
    queryKey: ['vendor', pr?.selected_vendor],
    queryFn: async () => (await apiClient.get(`/vendors/${pr.selected_vendor}/`)).data,
    enabled: !!pr?.selected_vendor,
  })

  if (prLoading || !pr) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return <div className="text-center py-12 text-muted-foreground">Could not load PR.</div>
  }
  // Wait for related lookups before mounting the form so initial state is complete
  if (pr.tracking_id && !tracking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (pr.selected_vendor && !vendor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Build the initial form state from the loaded PR
  const initial: QuickPRInitial = {
    trackingId: pr.tracking_id ?? null,
    selectedTracking: tracking ?? null,
    vendorId: pr.selected_vendor ?? null,
    selectedVendor: vendor ?? null,
    description: pr.description ?? '',
    lines: ((pr.line_items as any[]) || []).map((li: any) => ({
      item_code: li.item_code,
      item_label: li.item_code_detail
        ? `${li.item_code_detail.code} — ${li.item_code_detail.description || ''}`
        : (li.description || ''),
      quantity: Number(li.quantity) || 0,
      unit_of_measure: li.unit_of_measure || 'NOS',
      unit_rate: Number(li.unit_rate) || 0,
    })),
  }

  return <QuickPRForm mode={{ kind: 'edit', prId: id, prNumber: pr.pr_number }} initial={initial} />
}
