'use client'

export default function AIAnalysisPanel({ quotation }: { quotation: any }) {
    const findings = quotation?.findings || []
    const confidence = quotation?.confidence_score ?? 96

    return (
        <div className="rounded-2xl overflow-hidden bg-orange-50 border border-orange-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#9B3B17] text-white">
                <span className="text-sm">✦</span>
                <span className="font-semibold text-sm">AI Analysis</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-[2px] rounded-full bg-white/15 text-white">
                    {confidence}% confident
                </span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-4 text-foreground">
                {/* Extraction Notes */}
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                        ✦ Extraction Notes
                    </div>

                    {findings.length > 0 ? (
                        findings.map((finding: string, idx: number) => (
                            <div key={idx} className="flex gap-2 bg-white border border-slate-200 rounded-md p-2 text-xs mb-2">
                                <span className="font-semibold">✓</span>
                                <span>{finding}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-slate-500 italic">No specific findings detected.</div>
                    )}
                </div>

                {/* Vendor Intelligence */}
                {quotation?.vendor && (
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                            ✦ Vendor Intelligence
                        </div>

                        <div className="flex gap-2 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs mb-2">
                            <span className="font-semibold">★</span>
                            <span>
                                {quotation.vendor.is_new ? 'New Vendor' : 'Existing Vendor'} · {quotation.vendor.city || 'Location unknown'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Validity Alert */}
                {quotation?.valid_until && (
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                            ✦ Validity Alert
                        </div>

                        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
                            <span>⏱</span>
                            <span>
                                Valid until <strong>{quotation.valid_until}</strong>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
