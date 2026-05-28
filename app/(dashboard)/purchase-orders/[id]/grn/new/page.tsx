'use client'

// Legacy nested route — kept so old links don't break. Redirects to the flat
// /grns/new?po={id} page which is now the single source of truth for GRN creation.

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function CreateGRNRedirect() {
  const { id: poId } = useParams()
  const router = useRouter()

  useEffect(() => {
    if (poId) router.replace(`/grns/new?po=${poId}`)
  }, [poId, router])

  return null
}
