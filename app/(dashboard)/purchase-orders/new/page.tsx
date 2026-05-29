'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import POForm from '../components/POForm'

function NewPOContent() {
  const searchParams = useSearchParams()
  const [formKey] = useState(() => Date.now())
  const initialPrId = (() => {
    const raw = searchParams.get('pr_id')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  })()
  return <POForm key={formKey} mode="create" initialPrId={initialPrId} />
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense>
      <NewPOContent />
    </Suspense>
  )
}
