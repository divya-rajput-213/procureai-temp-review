import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import React from 'react'
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
    plants,
    departments,
    categories,
    PRs,
    formatSize,
}: UploadFileProps) => {

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
                    Drop the quotation file here
                </h3>

                <p className="text-sm text-muted-foreground mb-5">
                    PDF — AI extracts everything.
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
            <div className="mt-4">
                {/* Tag Section */}
                <div className="mt-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Tag this quote <span className="font-normal normal-case text-[10px]">(optional)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Plant */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Plant</label>
                            <select
                                className={`w-full h-10 border rounded-md px-3 text-sm bg-background`} value={plantId}
                                onChange={e => setPlantId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {plants.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Department */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Department</label>
                            <select
                                className={`w-full h-10 border rounded-md px-3 text-sm bg-background`}
                                value={departmentId}
                                onChange={e => setDepartmentId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {departments.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>


                        {/* Category */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Category</label>
                            <select className={`w-full h-10 border rounded-md px-3 text-sm bg-background`}
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >

                                <option value="">— Not specified —</option>
                                {categories?.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* PR Link */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                Link to PR
                            </label>
                            <select className={`w-full h-10 border rounded-md px-3 text-sm bg-background`}
                                value={prLinkId}
                                onChange={e => setPrLinkId(e.target.value)}
                            >
                                <option value="">— Not specified —</option>
                                {PRs?.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.pr_number
                                    }</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* your grid unchanged */}

                <div className="flex justify-end gap-3 mt-5">
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
