import { Button } from '@/components/ui/button'
import {
    CheckCircle2,
    Clock3,
    FileText,
    Mail,
    Sparkles,
    Upload,
    Webhook,
} from 'lucide-react'
import React, { useEffect } from 'react'

const financialYears = [
    {
        label: 'FY 2024–25',
        value: '2024-25',
    },
    {
        label: 'FY 2025–26',
        value: '2025-26',
    },
    {
        label: 'FY 2026–27',
        value: '2026-27',
    },
]

type UploadFileProps = {
    selectedFile: File | null
    setSelectedFile: (file: File | null) => void
    addFile: (files: File | null) => void
    handleRemoveTagState: () => void

    dragging: boolean
    handleDragOver: (e: React.DragEvent) => void
    handleDragLeave: (e: React.DragEvent) => void
    handleDrop: (e: React.DragEvent) => void

    uploadMutation: any

    plantId: string
    setPlantId: (v: string) => void
    departmentId: string
    setDepartmentId: (v: string) => void
    categoryId: string
    setCategoryId: (v: string) => void
    prLinkId: string
    setPrLinkId: (v: string) => void
    financialYear: string
    setFinancialYear: (v: string) => void

    plants: any[]
    departments: any[]
    categories: any[]
    PRs: any[]

    formatSize: (size: number) => string
}

const UploadFile = ({
    selectedFile,
    setSelectedFile,
    addFile,
    handleRemoveTagState,
    dragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    uploadMutation,
    plantId,
    setPlantId,
    departmentId,
    setDepartmentId,
    categoryId,
    setCategoryId,
    prLinkId,
    setPrLinkId,
    financialYear,
    setFinancialYear,
    plants,
    departments,
    categories,
    PRs,
    formatSize,
}: UploadFileProps) => {
    useEffect(() => {
        if (plants?.length > 0 && !plantId) {
            setPlantId(plants[0]?.id)
        }

        if (departments?.length > 0 && !departmentId) {
            setDepartmentId(departments[0]?.id)
        }

        if (categories?.length > 0 && !categoryId) {
            setCategoryId(categories[0]?.id)
        }

        if (!financialYear) {
            setFinancialYear('2025-26')
        }
    }, [
        plants,
        departments,
        categories,
        plantId,
        departmentId,
        categoryId,
        financialYear,
    ])

    return (
        <div className="space-y-4 pb-4">
            {/* Stepper */}
            {/* Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">

                {/* LEFT SIDE */}
                <div className="space-y-4">

                    {/* Upload Card */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-lg font-semibold">
                                Upload quotation
                            </h2>
                        </div>

                        <div className="p-4">

                            {selectedFile ? (
                                <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/30">
                                    <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center">
                                        <FileText className="w-5 h-5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">
                                            {selectedFile.name}
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            {formatSize(selectedFile.size)} · Ready for AI extraction
                                        </p>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedFile(null)
                                            handleRemoveTagState()
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    className={`
                    border border-dashed rounded-xl
                    py-10 px-6 text-center bg-slate-50 transition-all
                    ${dragging
                                            ? 'border-primary bg-primary/5'
                                            : 'hover:border-primary hover:bg-slate-100'}
                  `}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <div className="w-16 h-16 rounded-full border bg-white flex items-center justify-center mx-auto mb-5 shadow-sm">
                                        <Upload className="w-7 h-7 text-muted-foreground" />
                                    </div>

                                    <h3 className="text-xl font-semibold mb-2">
                                        Drop quotation PDF here
                                    </h3>

                                    <p className="text-sm text-muted-foreground mb-5">
                                        or click to browse files — supports PDF uploads up to 20MB
                                    </p>

                                    <div className="flex justify-center">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                document.getElementById('quotation-file')?.click()
                                            }
                                        >
                                            Browse files
                                        </Button>
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                                        <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                                            AI OCR Enabled
                                        </span>

                                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                            Bulk Upload Supported
                                        </span>
                                    </div>

                                    <input
                                        id="quotation-file"
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null
                                            setSelectedFile(f)
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tag Section */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="flex justify-between items-center px-4 py-3 border-b">
                            <div className="font-semibold text-sm">
                                Tag & Categorise This Quote
                            </div>

                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                                Required
                            </span>
                        </div>

                        <div className="space-y-3 p-4">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                <div>
                                    <label className="text-sm font-medium mb-1 block">
                                        Link to Purchase Request
                                    </label>

                                    <select
                                        className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                        value={prLinkId}
                                        onChange={e => setPrLinkId(e.target.value)}
                                    >
                                        <option value="">— Not specified —</option>

                                        {PRs?.map((d: any) => (
                                            <option key={d.id} value={d.id}>
                                                {d.pr_number}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-1 block">
                                        Spend Category
                                    </label>

                                    <select
                                        className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                    >
                                        <option value="">— Not specified —</option>

                                        {categories?.map((d: any) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                <div>
                                    <label className="text-sm font-medium mb-1 block">
                                        Department
                                    </label>

                                    <select
                                        className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                        value={departmentId}
                                        onChange={e => setDepartmentId(e.target.value)}
                                    >
                                        <option value="">— Not specified —</option>

                                        {departments.map((d: any) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-1 block">
                                        Plant / Location
                                    </label>

                                    <select
                                        className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                        value={plantId}
                                        onChange={e => setPlantId(e.target.value)}
                                    >
                                        <option value="">— Not specified —</option>

                                        {plants.map((p: any) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-1 block">
                                        Financial Year
                                    </label>

                                    <select
                                        className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                        value={financialYear}
                                        onChange={e => setFinancialYear(e.target.value)}
                                    >
                                        <option value="">— Not specified —</option>

                                        {financialYears.map(year => (
                                            <option key={year.value} value={year.value}>
                                                {year.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">
                                    Internal Notes
                                </label>

                                <textarea
                                    rows={3}
                                    placeholder="Add any notes about this quote..."
                                    className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="space-y-4 sticky top-4">

                    {/* AI Next */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b bg-primary/5">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="font-semibold text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    AI suggestions for this quote
                                </h2>
                                <span className="px-2 py-0.5 text-[11px] rounded-md bg-primary/10 text-primary font-semibold">
                                    91%
                                </span>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <p className="text-sm text-muted-foreground leading-6">
                                Based on historical spend patterns, upload this quotation and let AI auto-extract vendor and line-item details for faster verification.
                            </p>

                            {[
                                'OCR the uploaded quotation',
                                'Identify vendor from GSTIN/PAN/email',
                                'Extract line items with tax & quantity',
                                'Match SKUs to master catalog',
                                'Surface anomalies for review',
                            ].map((step, index) => (
                                <div
                                    key={step}
                                    className="flex gap-3"
                                >
                                    <div className="mt-0.5">
                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                    </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Step {index + 1}
                                        </p>

                                        <p className="text-sm font-medium leading-5">
                                            {step}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            <div className="pt-1 flex items-center gap-2">
                            </div>
                        </div>
                    </div>

                    {/* Recent Uploads
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b">
                            <h2 className="font-semibold text-sm">
                                Recent uploads
                            </h2>
                        </div>

                        <div className="divide-y">

                            {[
                                {
                                    name: 'Patel_handwritten.jpg',
                                    status: 'Draft',
                                },
                                {
                                    name: 'Sunrise_QTN_0190.pdf',
                                    status: 'Verified',
                                },
                                {
                                    name: 'Rasoi_RTF_quote.pdf',
                                    status: 'Pending',
                                },
                            ].map((item) => (
                                <div
                                    key={item.name}
                                    className="px-4 py-3 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg border bg-muted/30 flex items-center justify-center">
                                            <FileText className="w-4 h-4" />
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium">
                                                {item.name}
                                            </p>

                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock3 className="w-3 h-3" />
                                                Uploaded recently
                                            </div>
                                        </div>
                                    </div>

                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium
                      ${item.status === 'Verified'
                                                ? 'bg-green-100 text-green-700'
                                                : item.status === 'Pending'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-slate-100 text-slate-700'
                                            }
                    `}
                                    >
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div> */}
                </div>
            </div>
        </div>
    )
}

export default UploadFile
