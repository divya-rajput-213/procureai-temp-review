
'use client'
 
import { useRouter } from 'next/navigation'
import VendorForm from '../components/Vendorform'
 
export default function NewVendorPage() {
  const router = useRouter()
 
  return (
    <VendorForm
      onSuccess={(vendorId) => router.push(`/vendors/${vendorId}`)}
    />
  )
}
 