'use client'

export default function AIAnalysisPanel() {
    return (
        <div className="rounded-2xl overflow-hidden bg-orange-50 border border-orange-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#9B3B17] text-white">
                <span className="text-sm">✦</span>
                <span className="font-semibold text-sm">AI Analysis</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-[2px] rounded-full bg-white/15 text-white">
                    96% confident
                </span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-4 text-foreground">
                {/* Extraction Notes */}
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                        ✦ Extraction Notes
                    </div>

                    <div className="flex gap-2 bg-white border border-slate-200 rounded-md p-2 text-xs mb-2">
                        <span className="font-semibold">✓</span>
                        <span>
                            All line items, quantities and HSN codes extracted correctly.
                        </span>
                    </div>

                    <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
                        <span className="font-semibold">⚠</span>
                        <span>
                            Line item 3 — unit price ₹328/MT — <strong>verify</strong>
                        </span>
                    </div>
                </div>

                {/* Vendor Intelligence */}
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                        ✦ Vendor Intelligence
                    </div>

                    <div className="flex gap-2 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs mb-2">
                        <span className="font-semibold">★</span>
                        <span>
                            12 POs · OTD Rate: <strong>96.2%</strong>
                        </span>
                    </div>

                    <div className="flex gap-2 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs">
                        <span className="font-semibold">✓</span>
                        <span>IATF + ISO certifications valid</span>
                    </div>
                </div>

                {/* Price Benchmark */}
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                        ✦ Price Benchmark
                    </div>

                    <div className="flex gap-2 bg-white border border-slate-200 rounded-md p-2 text-xs mb-2">
                        <span>📊</span>
                        <span>2mm coil +2.1% vs last purchase</span>
                    </div>

                    <div className="flex gap-2 bg-white border border-slate-200 rounded-md p-2 text-xs">
                        <span>📊</span>
                        <span>Within LME range</span>
                    </div>
                </div>

                {/* Validity Alert */}
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#9B3B17] mb-2">
                        ✦ Validity Alert
                    </div>

                    <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
                        <span>⏱</span>
                        <span>
                            Valid until <strong>15 Mar 2025</strong>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
