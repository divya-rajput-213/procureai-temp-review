'use client'

import { Sparkles, CheckCircle2, Star, Clock } from 'lucide-react'

export default function AIAnalysisPanel({ quotation }: { quotation: any }) {
    const findings = quotation?.findings || []
    const confidence = quotation?.confidence_score ?? 96

    return (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">AI Analysis</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-[2px] rounded-full bg-primary/10 text-primary border border-primary/10">
                    {confidence}% match
                </span>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-5 text-foreground">
                {/* Extraction Notes */}
                <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Extraction Findings
                    </div>

                    {findings.length > 0 ? (
                        <div className="space-y-2">
                            {findings.map((finding: string, idx: number) => (
                                <div key={idx} className="flex gap-2.5 bg-slate-50/50 border border-slate-100 rounded-lg p-2.5 text-xs transition-colors hover:border-slate-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className="text-slate-600 leading-relaxed">{finding}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 italic bg-slate-50 rounded-lg p-3 text-center border border-dashed border-slate-200">
                            No specific findings detected.
                        </div>
                    )}
                </div>

                {/* Vendor Intelligence */}
                {quotation?.vendor && (
                    <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                            Vendor Intelligence
                        </div>

                        <div className="flex gap-2.5 bg-indigo-50/30 border border-indigo-100/50 rounded-lg p-2.5 text-xs">
                            <Star className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            <span className="text-indigo-900/70 font-medium">
                                {quotation.vendor.is_new ? 'New Vendor' : 'Existing Vendor'} · {quotation.vendor.city || 'Location unknown'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Validity Alert */}
                {quotation?.valid_until && (
                    <div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                            Validity Status
                        </div>

                        <div className="flex gap-2.5 bg-amber-50/40 border border-amber-100 rounded-lg p-2.5 text-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="text-amber-900/70 font-medium">
                                Valid until <span className="text-amber-900 font-bold">{quotation.valid_until}</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
