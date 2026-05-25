'use client'

import { useParams } from 'next/navigation'
import ProcurementForm from '../../components/ProcurementForm'

export default function EditPRPage() {
  const { id } = useParams<{ id: string }>()
  return <ProcurementForm mode="edit" procurementId={id} />
}
