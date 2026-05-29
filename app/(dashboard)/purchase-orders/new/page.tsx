'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import POForm from '../components/POForm'

function NewPOContent() {
  const searchParams = useSearchParams()
  const initialPrId = (() => {
    const raw = searchParams.get('pr_id')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  })()
  return <POForm mode="create" initialPrId={initialPrId} />
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense>
      <NewPOContent />
    </Suspense>
  )
}
