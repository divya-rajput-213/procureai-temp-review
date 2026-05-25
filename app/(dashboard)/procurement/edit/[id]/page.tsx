'use client'

import { useParams, useSearchParams } from 'next/navigation'
import ProcurementForm from '../../components/ProcurementForm'

export default function EditPRPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const initialStep = Number(searchParams.get('step') || '1')
  return <ProcurementForm mode="edit" procurementId={id} initialStep={initialStep} />
}
