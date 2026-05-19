import React, { useEffect, useState } from 'react'
import {
    CheckCircle2,
    Circle,
    Clock3,
    FileText,
    Sparkles,
    ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const AIExtractionStep = ({ selectedFile, quotation, onNext ,errorMessage}: { selectedFile: File | null; quotation: any; onNext?: () => void,errorMessage:any }) => {
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
                const maxBeforeCompletion = quotation ? 100 : 95
                if (prev >= maxBeforeCompletion) {
                    clearInterval(interval)
                    return maxBeforeCompletion
                }
                return Math.min(prev + 4, maxBeforeCompletion)
            })
        }, 1200)

        return () => clearInterval(interval)
    }, [quotation])

    return (
        <div className="flex flex-col gap-4">
            {/* Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start  min-h-[72vh]">

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
                                    <div className="relative w-[92%] h-[92%] max-w-[1080px] rounded-md border border-border bg-white shadow-sm overflow-hidden">
                                        {selectedFile?.type === 'application/pdf' || previewUrl.toLowerCase().endsWith('.pdf') ? (
                                            <iframe
                                                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=85`}
                                                className="w-full h-full border-0"
                                                title="Quotation Preview"
                                            />
                                        ) : (
                                            <img
                                                src={previewUrl}
                                                alt="Quotation Preview"
                                                className="w-full h-full object-contain"
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
                                                    <div className="w-full h-full bg-primary/15 border-2 border-primary/60 rounded-sm hover:bg-primary/25 transition-all duration-300 shadow-sm" />

                                                    {/* Pulsing indicator loop */}
                                                    <div className="absolute inset-0 border-2 border-primary rounded-sm animate-ping opacity-20 pointer-events-none" />

                                                    <div className="absolute -top-6 left-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10 transition-transform group-hover:scale-105 origin-left">
                                                        <Sparkles className="w-3 h-3" />
                                                        {h.label}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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
              {!errorMessage &&  <div className="flex flex-col gap-4">

                    {/* AI Progress */}
                    <div className="bg-white border rounded-xl overflow-hidden shrink-0 shadow-sm">
                        <div className="px-4 py-3 border-b bg-primary/5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <h2 className="text-sm font-semibold">
                                        {quotation ? 'AI Analysis Complete' : 'AI processing in progress'}
                                    </h2>
                                </div>
                                <span className="text-sm font-bold text-primary">
                                    {quotation ? 100 : progress}%
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: `${quotation ? 100 : progress}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                                {quotation ? 'Processing successful' : 'AI is extracting data and insights from the document. This may take a moment.'}
                            </p>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="space-y-4">
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
                                                <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-primary animate-spin" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-slate-300" />
                                            )}
                                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-tight ${item.status === 'done' ? 'text-emerald-600' : item.status === 'running' ? 'text-primary animate-pulse' : 'text-slate-400'}`}>
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
                                                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary/70" />
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
                        <div className="bg-primary rounded-xl p-4 text-primary-foreground shadow-md shadow-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-sm font-bold">Deep Extraction Mode</span>
                            </div>
                            <p className="text-xs text-primary-foreground/80 leading-relaxed">
                                We are performing multi-layer validation of vendor details, matching line items against master SKUs and scanning for price anomalies.
                            </p>
                        </div>
                    </div>
                </div>}
            </div>
        </div>
    )
}

export default AIExtractionStep
