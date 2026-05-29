'use client'

import { useParams } from 'next/navigation'
import POForm from '../../components/POForm'

export default function EditPurchaseOrderPage() {
  const { id } = useParams()
  return <POForm mode="edit" poId={String(id)} />
}
