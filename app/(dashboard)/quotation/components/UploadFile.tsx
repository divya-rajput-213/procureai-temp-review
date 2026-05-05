import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import React, { useEffect } from 'react'
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

    // tags
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
    // data
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
        if (plants.length && !plantId) setPlantId(plants[0].id)
        if (departments.length && !departmentId) setDepartmentId(departments[0].id)
        if (categories.length && !categoryId) setCategoryId(categories[0].id)
        if (!financialYear) setFinancialYear('2025-26')
    }, [plants, departments, categories])

    return (
        <div className="space-y-6">
            {/* Selected File Preview (NEW) */}
            {selectedFile ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
                    <div className="w-10 h-8 rounded-md border bg-white flex items-center justify-center text-xs font-bold">
                        PDF
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatSize(selectedFile.size)} · ready to upload
                        </p>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedFile(null); handleRemoveTagState()
                        }}
                    >
                        Remove
                    </Button>
                </div>
            ) : <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors bg-white ${dragging ? 'border-primary bg-primary/5' : 'hover:border-border'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="w-14 h-14 rounded-full border bg-background flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                </div>

                <h3 className="text-lg font-semibold mb-1">
                    Drop your vendor quote here
                </h3>

                <p className="text-sm text-muted-foreground mb-5">
                    or click to browse — PDF only, up to 20MB
                </p>

                <Button
                    variant="outline"
                    onClick={() => document.getElementById('quotation-file')?.click()}
                >
                    Browse file
                </Button>

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
            }

            {/* Tag Section */}
            <div className="bg-white border rounded-xl shadow-sm w-full overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b">
                    <div className="font-semibold text-sm">Tag & Categorise This Quote</div>

                    <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                            Required Before Processing
                        </span>
                    </div>
                </div>

                {/* Tag Section */}
                <div className="space-y-4 p-6">

                    {/* Row 1 → 2 items */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* PR Link */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                Link to Purchase Request
                                <span className="font-normal text-[11px] text-gray-500"> (optional)</span>
                            </label>
                            <select
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={prLinkId}
                                onChange={e => setPrLinkId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {PRs?.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.pr_number}</option>
                                ))}
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Spend Category</label>
                            <select
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {categories?.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2 → 3 items */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Department */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Department</label>
                            <select
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={departmentId}
                                onChange={e => setDepartmentId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {departments.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Plant */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Plant / Location</label>
                            <select
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={plantId}
                                onChange={e => setPlantId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {plants.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Financial Year */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Financial Year</label>
                            <select
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={financialYear}
                                onChange={e => setFinancialYear(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 3 → Full width textarea */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            Internal Notes
                            <span className="font-normal text-[11px] text-gray-500"> (optional)</span>
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Add any notes about this quote for the approver..."
                            className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                        />
                    </div>

                </div>

                <div className="flex justify-end gap-3 m-4">
                    <Button
                        className="flex items-center gap-2"
                        disabled={!selectedFile || uploadMutation.isPending}
                        onClick={() => addFile(selectedFile)}
                    >
                        {uploadMutation.isPending ? 'Uploading…' : 'Upload & Extract with AI'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default UploadFile
