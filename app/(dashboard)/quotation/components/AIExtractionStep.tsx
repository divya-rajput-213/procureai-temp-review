import React, { useEffect, useState } from 'react'
import {
    CheckCircle2,
    Circle,
    Clock3,
    FileText,
    Sparkles,
} from 'lucide-react'

const AIExtractionStep = ({ selectedFile, quotation }: { selectedFile: File | null; quotation: any }) => {
    const [progress, setProgress] = useState(42)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    // Dynamic data from backend
    const pipelineSteps = quotation?.pipeline_steps || []

    const findings = quotation?.findings || []

    const highlights = quotation?.highlights || []

    useEffect(() => {
        if (quotation?.pdf_url || quotation?.file_url) {
            setPreviewUrl(quotation.pdf_url || quotation.file_url)
            return
        }

        if (!selectedFile) {
            setPreviewUrl(null)
            return
        }

        const url = URL.createObjectURL(selectedFile)
        setPreviewUrl(url)

        return () => {
            URL.revokeObjectURL(url)
        }
    }, [selectedFile, quotation])

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    return 100
                }

                return prev + 4
            })
        }, 1200)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
            {/* Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-stretch flex-1 min-h-0 overflow-hidden">

                {/* LEFT SIDE */}
                <div className="bg-white border rounded-xl overflow-hidden flex flex-col h-full shadow-sm">

                    {/* Header */}
                    <div className="px-4 py-3 border-b flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-sm">Document</h2>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {selectedFile?.name || quotation?.filename || 'Quotation.pdf'}
                            </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Highlights show AI-extracted regions
                        </span>
                    </div>

                    {/* Preview Area */}
                    <div className="p-4 bg-slate-50/50 flex-1 min-h-0 flex flex-col">
                        <div className="border rounded-lg overflow-hidden bg-white h-full flex flex-col shadow-inner relative">
                            {previewUrl ? (
                                <div className="relative w-full h-full bg-white flex items-center justify-center overflow-hidden">
                                    {selectedFile?.type === 'application/pdf' || previewUrl.toLowerCase().endsWith('.pdf') ? (
                                        <iframe
                                            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                            className="w-full h-full border-0"
                                            title="Quotation Preview"
                                        />
                                    ) : (
                                        <img
                                            src={previewUrl}
                                            alt="Quotation Preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}

                                    {/* Highlights container */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {highlights.map((h: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="absolute group pointer-events-auto"
                                                style={{
                                                    top: `${h.top}%`,
                                                    left: `${h.left}%`,
                                                    width: `${h.width}%`,
                                                    height: `${h.height}%`,
                                                }}
                                            >
                                                <div className="w-full h-full bg-yellow-400/20 border-2 border-yellow-400/50 rounded-sm hover:bg-yellow-400/40 transition-all duration-300 shadow-[0_0_10px_rgba(250,204,21,0.2)]" />

                                                {/* Pulsing indicator loop */}
                                                <div className="absolute inset-0 border-2 border-yellow-400 rounded-sm animate-ping opacity-20 pointer-events-none" />

                                                <div className="absolute -top-6 left-0 flex items-center gap-1.5 bg-yellow-400 text-yellow-950 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10 transition-transform group-hover:scale-105 origin-left">
                                                    <Sparkles className="w-3 h-3" />
                                                    {h.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                                    <FileText className="w-10 h-10 opacity-20" />
                                    <p className="text-sm font-medium">No preview available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="flex flex-col gap-4 h-full overflow-hidden">

                    {/* AI Progress */}
                    <div className="bg-white border rounded-xl overflow-hidden shrink-0 shadow-sm">
                        <div className="px-4 py-3 border-b bg-violet-50/30">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-violet-600" />
                                    <h2 className="text-sm font-semibold">
                                        {quotation ? 'AI Analysis Complete' : 'AI processing in progress'}
                                    </h2>
                                </div>
                                <span className="text-sm font-bold text-violet-600">
                                    {quotation ? 100 : progress}%
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-violet-600 transition-all duration-500 shadow-[0_0_8px_rgba(124,58,237,0.3)]"
                                    style={{ width: `${quotation ? 100 : progress}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                                {quotation ? 'Processing successful' : 'model: haiku-pro · est. 4s remaining'}
                            </p>
                        </div>
                    </div>

                    {/* Content Scrollable Area */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                        {/* Pipeline */}
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <div className="px-4 py-2.5 border-b bg-slate-50/50">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Pipeline Status</h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {(pipelineSteps.length > 0 ? pipelineSteps : [
                                    { label: 'Document OCR', status: progress > 30 ? 'done' : 'running' },
                                    { label: 'Vendor Identification', status: progress > 60 ? 'done' : 'running' },
                                    { label: 'Line Item Extraction', status: 'running' },
                                    { label: 'Master SKU Mapping', status: 'pending' }
                                ]).map((item: any) => (
                                    <div key={item.label} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {item.status === 'done' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : item.status === 'running' ? (
                                                <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-violet-500 animate-spin" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-slate-300" />
                                            )}
                                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-tight ${item.status === 'done' ? 'text-emerald-600' : item.status === 'running' ? 'text-violet-600 animate-pulse' : 'text-slate-400'}`}>
                                            {item.status === 'done' ? 'Completed' : item.status === 'running' ? 'Running...' : 'Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Findings */}
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <div className="px-4 py-2.5 border-b bg-slate-50/50">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Findings</h2>
                            </div>
                            <div className="p-4 bg-slate-50/30">
                                <ul className="space-y-3">
                                    {findings.length > 0 ? (
                                        findings.map((item: any, idx: number) => (
                                            <li key={idx} className="flex gap-2.5 text-sm text-slate-600">
                                                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400" />
                                                <span className="leading-tight">{item}</span>
                                            </li>
                                        ))
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse" />
                                            <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
                                        </div>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Summary Note */}
                        <div className="bg-violet-600 rounded-xl p-4 text-white shadow-md shadow-violet-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-sm font-bold">Deep Extraction Mode</span>
                            </div>
                            <p className="text-xs text-violet-100 leading-relaxed">
                                We are performing multi-layer validation of vendor details, matching line items against master SKUs and scanning for price anomalies.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AIExtractionStep