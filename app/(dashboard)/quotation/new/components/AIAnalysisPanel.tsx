'use client'

export default function AIAnalysisPanel() {
    return (
        <div className="rounded-xl overflow-hidden bg-gradient-to-br from-[#000000] via-[#14202b] to-[#1a2127] text-white">

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <span className="text-sm">✦</span>
                <span className="font-semibold text-sm">AI Analysis</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-[2px] rounded-full bg-white/10 text-white/70">
                    96% confident
                </span>
            </div>

            {/* Section */}
            <div className="px-4 py-3 border-b border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-2">
                    ✦ Extraction
                </div>

                <div className="flex gap-2 bg-white/5 border border-white/10 rounded-md p-2 text-xs mb-2">
                    <span>✓</span>
                    <span>
                        All line items, quantities, and HSN codes extracted correctly.
                    </span>
                </div>

                <div className="flex gap-2 bg-amber-500/10 border border-amber-400/30 rounded-md p-2 text-xs">
                    <span>⚠</span>
                    <span>
                        Line item 3 — unit price extracted as ₹328/MT —{' '}
                        <strong>verify.</strong>
                    </span>
                </div>
            </div>

            {/* Section */}
            <div className="px-4 py-3 border-b border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-2">
                    ✦ Vendor Intel
                </div>

                <div className="flex gap-2 bg-green-500/20 border border-green-400/20 rounded-md p-2 text-xs mb-2">
                    <span>★</span>
                    <span>12 POs · OTD Rate: <strong>96.2%</strong></span>
                </div>

                <div className="flex gap-2 bg-green-500/20 border border-green-400/20 rounded-md p-2 text-xs">
                    <span>✓</span>
                    <span>IATF + ISO certifications valid</span>
                </div>
            </div>

            {/* Section */}
            <div className="px-4 py-3 border-b border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-2">
                    ✦ Price Benchmark
                </div>

                <div className="flex gap-2 bg-white/5 border border-white/10 rounded-md p-2 text-xs mb-2">
                    <span>📊</span>
                    <span>2mm coil +2.1% vs last purchase</span>
                </div>

                <div className="flex gap-2 bg-white/5 border border-white/10 rounded-md p-2 text-xs">
                    <span>📊</span>
                    <span>Within LME range</span>
                </div>
            </div>

            {/* Section */}
            <div className="px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-2">
                    ✦ Validity Alert
                </div>

                <div className="flex gap-2 bg-amber-500/10 border border-amber-400/30 rounded-md p-2 text-xs">
                    <span>⏱</span>
                    <span>
                        Valid until <strong>15 Mar 2025</strong>
                    </span>
                </div>
            </div>
        </div>
    )
}


