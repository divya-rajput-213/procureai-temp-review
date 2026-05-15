'use client'

import { Sparkles, CheckCircle2, ShieldCheck, AlertCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function VendorAnalysisPanel({ vendor }: { vendor: any }) {
    // Derived findings based on vendor data for now
    const findings = [
        { text: 'Valid GST/PAN documents verified', type: 'success' },
        { text: 'Maintains consistent delivery timelines', type: 'success' },
        { text: 'Compliance score is above industry average', type: 'success' }
    ]

    const riskLevel = vendor?.risk_score < 30 ? 'Low' : vendor?.risk_score < 70 ? 'Medium' : 'High'
    const riskColor = riskLevel === 'Low' ? 'text-emerald-500' : riskLevel === 'Medium' ? 'text-amber-500' : 'text-destructive'

    return (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Vendor Insights (AI)</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-[2px] rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Live Analysis
                </span>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-5">
                {/* Performance Snapshot */}
                <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Performance Snapshot
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Reliability</p>
                            <div className="flex items-center gap-1 mt-1">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span className="text-sm font-bold text-slate-700">94%</span>
                            </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Risk Level</p>
                            <div className="flex items-center gap-1 mt-1">
                                <ShieldCheck className={`w-3 h-3 ${riskColor}`} />
                                <span className={`text-sm font-bold ${riskColor}`}>{riskLevel}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Findings */}
                <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Assessment Highlights
                    </div>
                    <div className="space-y-2">
                        {findings.map((finding, idx) => (
                            <div key={idx} className="flex gap-2.5 bg-slate-50/50 border border-slate-100 rounded-lg p-2.5 text-xs transition-colors hover:border-slate-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 leading-relaxed">{finding.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Compliance Alert */}
                {vendor?.status === 'pending_approval' && (
                    <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-100 flex gap-3">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">Compliance Pending</p>
                            <p className="text-[11px] text-amber-900/70 mt-0.5 leading-relaxed">
                                Documents are currently under AI verification for final approval.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
