'use client'

// Legacy route — Register Invoice is now unified at /invoices/new which handles
// both the upload + extraction flow and manual entry.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InvoiceUploadRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/invoices/new') }, [router])
  return null
}
