'use client'

export default function QuoteDetailsCard({ quotation }: { quotation: any }) {
    const quoteReferenceRaw =
        quotation?.vendor?.quotation_no ??
        quotation?.quotation_no ??
        quotation?.ref_no ??
        ''

    const quoteDateRaw =
        quotation?.vendor?.quotation_date ??
        quotation?.quotation_date ??
        ''

    const quoteReference = String(quoteReferenceRaw || '').trim() || '—'
    const quoteDate = String(quoteDateRaw || '').trim() || '—'

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-4 py-3 border-b font-semibold text-sm">
                Quote Details
            </div>

            <div>
                {[
                    ['Quote Reference', quoteReference],
                    ['Quote Date', quoteDate],
                    ['Warranty', '12 months'],
                    ['Advance Payment', 'Not required'],
                    ['Currency', 'INR'],
                    ['Source', 'PDF — AI Extracted'],
                ].map(([label, value]) => (
                    <div
                        key={String(label)}
                        className="flex justify-between px-4 py-2 border-b last:border-none text-sm"
                    >
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold">{String(value ?? '—')}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
