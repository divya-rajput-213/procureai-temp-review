'use client'

import { Clock, MapPin, Pencil, ShieldCheck, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function VendorHeaderCard({
    vendors,
    category,
    onChangeVendor,
}: {
    vendors: any
    category: any
    onChangeVendor: () => void
}) {
    return (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            {/* Banner */}
            <div className="bg-gradient-to-br from-[#000000] to-[#0A1E30] text-white p-5 flex items-center gap-4">
                {/* Monogram */}
                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-bold text-sm">
                    {vendors.company_name
                        ? vendors.company_name.split(' ').map((w: any) => w[0]).slice(0, 2).join('')
                        : 'MS'}
                </div>

                {/* Info */}
                <div>
                    <div className="text-base font-bold">
                        {vendors.company_name || '-'}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-white/70 mt-1">
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {vendors.address}, {vendors.pincode}, {vendors.city}, {vendors.state}, {vendors.country}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-white/70 mt-1">
                        <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {vendors.is_new === false ? 'Existing vendor' : 'New vendor'}
                        </span>

                        <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Score {vendors.vendor_score || '94'}/100
                        </span>

                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {vendors.transaction_count || '12'} past transactions
                        </span>

                        <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            {vendors.certification || 'IATF 16949 Certified'}
                        </span>
                    </div>
                </div>

                {/* Action */}
                <div className="ml-auto flex items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-black"
                        onClick={onChangeVendor}
                    >
                        <Pencil className="w-3 h-3" />
                        Change vendor
                    </Button>
                </div>
            </div>

            {/*  Scrollable Section */}
            <div className="overflow-auto max-h-[300px]">
                {/* Chips */}
                <div className="flex flex-wrap gap-2 px-4 py-3 border-b min-w-[700px]">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-semibold">
                        {vendors.tier || 'Tier-1 Vendor'}
                    </span>

                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                        {vendors.vendor_code || 'SAP VND-00423'}
                    </span>

                    <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-semibold">
                        {vendors.contract_status || 'Rate Contract Active'}
                    </span>

                    {category?.name && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 font-semibold">
                            {category?.name}
                        </span>
                    )}

                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                        {vendors.gst_number ? 'GST Verified' : 'GST Pending'}
                    </span>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 min-w-[700px]">
                    {[
                        ['Legal Name', vendors.company_name || '-'],
                        ['GSTIN', vendors.gst_number || '-'],
                        ['PAN', vendors.pan_number || '-'],
                        [
                            'Contact Person',
                            vendors.contact_name
                                ? `${vendors.contact_name} — ${vendors.contact_phone || '-'}`
                                : vendors.contact_phone || '-',
                        ],
                        ['Payment Terms', vendors.payment_terms || 'Net 30 days'],
                        [
                            'Bank Details',
                            vendors.bank_name || vendors.bank_ifsc
                                ? `${vendors.bank_name || '-'}${vendors.bank_ifsc ? ` — IFSC: ${vendors.bank_ifsc}` : ''}`
                                : '-',
                        ],
                        [
                            'Bank A/C',
                            vendors.bank_account || '-',
                        ],
                        [
                            'Delivery Terms',
                            vendors.delivery_terms || 'FOR Destination — Manesar',
                        ],
                        [
                            'Quote Valid Until',
                            vendors.valid_until || '-',
                        ],
                        [
                            'Lead Time',
                            vendors.lead_time || '12 working days from PO',
                        ],
                    ].map(([label, value], i) => (
                        <div
                            key={i}
                            className="p-3 border-b border-r last:border-r-0 text-sm"
                        >
                            <div className="text-gray-400 text-[11px] uppercase font-semibold">
                                {label}
                            </div>

                            <div
                                className={`font-semibold ${label === 'Quote Valid Until'
                                    ? 'text-yellow-600'
                                    : 'text-gray-900'
                                    }`}
                            >
                                {value as any}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
