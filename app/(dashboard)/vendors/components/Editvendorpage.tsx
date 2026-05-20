'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import VendorForm from './Vendorform'
type EditVendorPageProps = {
    setIsEditing: React.Dispatch<React.SetStateAction<boolean>>
    vendorStatus:string
  }
  
export default function EditVendorPage({
    setIsEditing,vendorStatus
  }: EditVendorPageProps) {
  const { id } = useParams()
  const router = useRouter()

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await apiClient.get(`/vendors/${id}/`)).data,
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, fontFamily: "'DM Sans',sans-serif", color: '#9a9a96', fontSize: 13 }}>
        Loading vendor…
      </div>
    )
  }

  if (!vendor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, fontFamily: "'DM Sans',sans-serif", color: '#A32D2D', fontSize: 13 }}>
        Vendor not found.
      </div>
    )
  }

  const normalizePhone = (v: any) => {
    const raw = String(v ?? '')
    const digits = raw.replace(/\D/g, '').replace(/^91/, '').slice(0, 10)
    return `+91 ${digits}`
  }

  return (
    <VendorForm
      vendorId={vendor.hash_id ?? vendor.id}
      initialValues={{
        company_name: vendor.company_name ?? '',
        category: vendor.category ? Number(vendor.category) : undefined,
        plant: vendor.plant ? Number(vendor.plant) : undefined,
        address: vendor.address ?? '',
        city: vendor.city ?? '',
        state: vendor.state ?? '',
        country: vendor.country ?? 'India',
        pincode: String(vendor.pincode ?? ''),
        contact_name: vendor.contact_name ?? '',
        contact_email: vendor.contact_email ?? '',
        contact_phone: normalizePhone(vendor.contact_phone),
        gst_number: vendor.gst_number ?? '',
        pan_number: vendor.pan_number ?? '',
        bank_account: vendor.bank_account ?? '',
        bank_ifsc: vendor.bank_ifsc ?? '',
        bank_name: vendor.bank_name ?? '',
        is_msme: vendor.is_msme ?? false,
        msme_number: vendor.msme_number ?? '',
        is_sez: vendor.is_sez ?? false,
      }}
      onSuccess={(vendorId) => router.push(`/vendors/${vendorId}`)}
      setIsEditing={setIsEditing}
      vendorStatus={vendorStatus}
    />
  )
}