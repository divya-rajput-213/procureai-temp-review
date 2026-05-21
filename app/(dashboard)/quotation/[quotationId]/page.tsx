import { redirect } from 'next/navigation'
export default function OldQuotationDetailPage({ params }: { params: { quotationId: string } }) {
  redirect(`/quotation/detail/${params.quotationId}`)
}
