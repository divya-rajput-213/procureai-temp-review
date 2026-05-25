'use client'

import { MapPin } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

const financialYears = [
    { label: 'FY 2024–25', value: '2024-25' },
    { label: 'FY 2025–26', value: '2025-26' },
    { label: 'FY 2026–27', value: '2026-27' },
]

const AVATAR_COLORS = [
    { bg: 'var(--pur-bg)', tx: 'var(--pur-tx)' },
    { bg: 'var(--tel-bg)', tx: 'var(--tel-tx)' },
    { bg: 'var(--grn-bg)', tx: 'var(--grn-tx)' },
    { bg: 'var(--blu-bg)', tx: 'var(--blu-tx)' },
    { bg: 'var(--amb-bg)', tx: 'var(--amb-tx)' },
]

function vendorInitials(name: string) {
    return (name || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'V'
}
function avatarColor(name: string) {
    return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}
function statusPill(status?: string, isNew?: boolean) {
    if (isNew) return { label: 'New', bg: 'var(--amb-bg)', tx: 'var(--amb-tx)', dot: 'var(--amb-bd)' }
    if (!status) return { label: 'Matched', bg: 'var(--grn-bg)', tx: 'var(--grn-tx)', dot: 'var(--grn-bd)' }
    const s = status.toLowerCase()
    if (s === 'approved') return { label: 'Approved', bg: 'var(--grn-bg)', tx: 'var(--grn-tx)', dot: 'var(--grn-bd)' }
    if (s.includes('pending')) return { label: 'Pending Approval', bg: 'var(--amb-bg)', tx: 'var(--amb-tx)', dot: 'var(--amb-bd)' }
    if (s === 'rejected') return { label: 'Rejected', bg: 'var(--red-bg)', tx: 'var(--red-tx)', dot: 'var(--red-bd)' }
    if (s === 'draft') return { label: 'Draft', bg: 'var(--gry-bg)', tx: 'var(--gry-tx)', dot: 'var(--gry-bd)' }
    return { label: status, bg: 'var(--gry-bg)', tx: 'var(--gry-tx)', dot: 'var(--gry-bd)' }
}

type UploadFileProps = {
    selectedFile: File | null
    setSelectedFile: (file: File | null) => void
    handleRemoveTagState: () => void
    dragging: boolean
    handleDragOver: (e: React.DragEvent) => void
    handleDragLeave: (e: React.DragEvent) => void
    handleDrop: (e: React.DragEvent) => void
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
    internalNotes: string
    setInternalNotes: (v: string) => void
    plants: any[]
    departments: any[]
    categories: any
    PRs: any[]
    formatSize: (size: number) => string
    quotation?: any
    vendors?: any
    isExtracting?: boolean
    allVendors?: any[]
    vendorsFetching?: boolean
    onSelectVendor?: (vendor: any) => void
    disableUpload?: boolean
    pdfUrl?: string
    pdfName?: string
}

export default function UploadFile({
    selectedFile, setSelectedFile, handleRemoveTagState,
    dragging, handleDragOver, handleDragLeave, handleDrop,
    plantId, setPlantId, departmentId, setDepartmentId,
    categoryId, setCategoryId, prLinkId, setPrLinkId,
    financialYear, setFinancialYear,
    internalNotes, setInternalNotes,
    plants, departments, categories, PRs, formatSize,
    quotation, vendors, isExtracting = false,
    allVendors = [], vendorsFetching = false, onSelectVendor,
    disableUpload = false, pdfUrl, pdfName,
}: UploadFileProps) {
    const [showVendorSearch, setShowVendorSearch] = useState(false)
    const [vendorQuery, setVendorQuery] = useState('')
    const [extractProgress, setExtractProgress] = useState(0)

    useEffect(() => { setShowVendorSearch(false); setVendorQuery('') }, [vendors])

    useEffect(() => {
        if (isExtracting) {
            setExtractProgress(0)
            const id = setInterval(() => {
                setExtractProgress(p => {
                    if (p >= 90) { clearInterval(id); return 90 }
                    const step = p < 30 ? 4 : p < 60 ? 2 : 1
                    return p + step
                })
            }, 300)
            return () => clearInterval(id)
        } else {
            setExtractProgress(prev => prev > 0 ? 100 : 0)
        }
    }, [isExtracting])

    const filteredVendors = useMemo(() => {
        if (!vendorQuery.trim()) return allVendors
        const q = vendorQuery.toLowerCase()
        return allVendors.filter((v: any) =>
            v.company_name?.toLowerCase().includes(q) ||
            v.city?.toLowerCase().includes(q) ||
            v.state?.toLowerCase().includes(q) ||
            v.gst_number?.toLowerCase().includes(q)
        )
    }, [allVendors, vendorQuery])

    const isNewVendor = vendors?.is_new === true
    const isMatchedVendor = vendors && !vendors.is_new
    const av = vendors ? avatarColor(vendors.company_name || '') : { bg: 'var(--pur-bg)', tx: 'var(--pur-tx)' }
    const sp = statusPill(vendors?.status, vendors?.is_new === true)

    return (
        <div className="uf-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
            {/* LEFT COLUMN */}
            <div>
                {/* Upload section */}
                <div className="form-sec">
                    <div className="form-sec-head">
                        <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}>
                            <i className="ti ti-upload" />
                        </div>
                        <div>
                            <div className="fsh-title">Upload Quotation Document</div>
                            <div className="fsh-sub">{disableUpload ? 'Original uploaded PDF — cannot be changed here' : 'PDF. max 20 MB · vendor details extracted automatically'}</div>
                        </div>
                    </div>
                    <div className="form-body">
                        {disableUpload ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-s)', borderRadius: 'var(--r)', border: '0.5px solid var(--bd)' }}>
                                <i className="ti ti-file-text" style={{ fontSize: 20, color: 'var(--red-tx)', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{pdfName || 'quotation.pdf'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>Original uploaded document</div>
                                </div>
                                {pdfUrl && (
                                    <button
                                        onClick={() => window.open(pdfUrl, '_blank')}
                                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', color: 'var(--tx)' }}
                                    >
                                        <i className="ti ti-eye" style={{ fontSize: 12 }} /> Preview
                                    </button>
                                )}
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--gry-bg)', color: 'var(--gry-tx)' }}>
                                    <i className="ti ti-lock" style={{ fontSize: 10, marginRight: 3 }} />Read-only
                                </span>
                            </div>
                        ) : selectedFile ? (
                            <div className="drop-zone has-file" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <i className="ti ti-file-text" style={{ fontSize: 22, color: 'var(--grn-tx)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--grn-tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--grn-tx)', opacity: 0.8, marginTop: 2 }}>
                                        {formatSize(selectedFile.size)} · {isExtracting ? 'Extracting…' : vendors ? 'Extracted' : 'Ready for extraction'}
                                    </div>
                                </div>
                                {!isExtracting && (
                                    <button
                                        onClick={() => { setSelectedFile(null); handleRemoveTagState() }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--grn-tx)', padding: '4px 10px', borderRadius: 4, fontWeight: 600, fontFamily: 'inherit' }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div
                                className={`drop-zone${dragging ? ' drag-over' : ''}`}
                                onClick={() => document.getElementById('uf-file-input')?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <i className="ti ti-file-upload dz-icon" />
                                <div className="dz-title">Click to upload or drag &amp; drop</div>
                                <div className="dz-sub">PDF supported · max 20 MB</div>
                            </div>
                        )}
                        {!disableUpload && (
                            <input
                                id="uf-file-input"
                                type="file"
                                accept=".pdf,application/pdf"
                                style={{ display: 'none' }}
                                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                            />
                        )}
                        {!disableUpload && isExtracting && (
                            <div style={{ marginTop: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)' }}>Extracting data from document…</div>
                                    <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'monospace' }}>{extractProgress}%</div>
                                </div>
                                <div className="parse-bar">
                                    <div className="parse-fill" style={{ width: `${extractProgress}%`, transition: 'width 0.3s ease', animation: 'none' }} />
                                </div>
                                {[
                                    { label: 'OCR & text extraction', activeAt: 10 },
                                    { label: 'Vendor identification', activeAt: 35 },
                                    { label: 'Line item parsing', activeAt: 65 },
                                ].map(({ label, activeAt }) => (
                                    <div key={label} className={`parse-step${extractProgress >= activeAt ? ' active-ps' : ''}`}>
                                        <i className={`ti ${extractProgress >= activeAt ? 'ti-loader-2' : 'ti-circle'}`} style={{ fontSize: 13 }} /> {label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quotation details section */}
                <div className="form-sec">
                    <div className="form-sec-head">
                        <div className="fsh-ic" style={{ background: 'var(--pur-bg)', color: 'var(--pur-tx)' }}>
                            <i className="ti ti-file-invoice" />
                        </div>
                        <div>
                            <div className="fsh-title">Quotation Details</div>
                            <div className="fsh-sub">Fields highlighted in green are auto-extracted from your document</div>
                        </div>
                    </div>
                    <div className="form-body">
                        {/* VENDOR CARD */}
                        <div className="fgrp" style={{ marginBottom: 14 }}>
                            <div className="extracted-lbl" style={{ marginBottom: 6 }}>
                                <i className="ti ti-sparkles" style={{ fontSize: 11 }} /> Vendor  {isExtracting
                                    ? <span style={{ fontSize: 9, background: 'var(--blu-bg)', color: 'var(--blu-tx)', padding: '1px 5px', borderRadius: 20, fontWeight: 600, marginLeft: 4 }}>Extracting…</span>
                                    : vendors
                                        ? <span style={{ fontSize: 9, background: 'var(--tel-bg)', color: 'var(--tel-tx)', padding: '1px 5px', borderRadius: 20, fontWeight: 600, marginLeft: 4 }}>Auto-extracted</span>
                                        : null
                                }
                                
                            </div>

                            {/* State 1: Placeholder */}
                            {!vendors && !isExtracting && (
                                <div style={{ border: '1.5px dashed var(--bdm)', borderRadius: 'var(--r)', padding: 16, background: 'var(--bg-s)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--tx3)' }}>
                                    <i className="ti ti-building-store" style={{ fontSize: 22, flexShrink: 0 }} />
                                    <div style={{ fontSize: 13 }}>Vendor will be extracted and matched automatically after document upload</div>
                                </div>
                            )}

                            {/* Extracting */}
                            {isExtracting && (
                                <div style={{ border: '1.5px dashed var(--blu-bd)', borderRadius: 'var(--r)', padding: 16, background: 'var(--blu-bg)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--blu-tx)' }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>Identifying vendor from document…</div>
                                </div>
                            )}

                            {/* State 2: New vendor (amber) */}
                            {isNewVendor && (
                                <div style={{ border: '0.5px solid rgba(186,117,23,.4)', borderRadius: 'var(--r)', background: 'var(--bg)', overflow: 'hidden' }}>
                                    <div style={{ background: 'var(--amb-bg)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '0.5px solid rgba(186,117,23,.2)' }}>
                                        <i className="ti ti-alert-circle" style={{ fontSize: 15, color: 'var(--amb-tx)', flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amb-tx)' }}>New Vendor Detected — Not in Master</div>
                                            <div style={{ fontSize: 11, color: 'var(--amb-tx)', opacity: 0.8, marginTop: 1 }}>
                                                Extracted from document. Will be created in <strong>Draft</strong> and sent for approval before a PO can be raised.
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowVendorSearch(p => !p)}
                                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: showVendorSearch ? 'var(--bg-t)' : 'var(--bg)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', color: 'var(--tx)' }}
                                        >
                                            <i className="ti ti-refresh" style={{ fontSize: 11 }} /> Change
                                        </button>
                                    </div>
                                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--amb-bg)', color: 'var(--amb-tx)', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {vendorInitials(vendors.company_name || '')}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.3px', marginBottom: 8 }}>{vendors.company_name || '—'}</div>
                                            <div className="g4v" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                                                {[
                                                    { label: 'Location', value: [vendors.city, vendors.state].filter(Boolean).join(', ') || '—' },
                                                    { label: 'GSTIN', value: vendors.gst_number || '—', mono: true },
                                                    { label: 'Contact', value: vendors.contact_name || vendors.contact_email || '—' },
                                                    { label: 'Phone', value: vendors.contact_phone || '—' },
                                                ].map(({ label, value, mono }) => (
                                                    <div key={label} style={{ background: 'var(--bg-s)', borderRadius: 6, padding: '8px 10px' }}>
                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{label}</div>
                                                        <div style={{ fontSize: mono ? 11 : 12, fontFamily: mono ? 'monospace' : 'inherit', color: 'var(--tx2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px 16px', background: 'var(--bg-s)', borderTop: '0.5px solid var(--bd)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <i className="ti ti-info-circle" style={{ fontSize: 14, color: 'var(--blu-tx)', flexShrink: 0, marginTop: 1 }} />
                                        <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.7 }}>
                                            Clicking <strong>Continue</strong> will automatically <strong>create this vendor in Draft state</strong>. The quotation will proceed — the vendor must be approved before a Purchase Order can be raised.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* State 3: Matched vendor (green) */}
                            {isMatchedVendor && (() => {
                                const score = vendors.score ?? vendors.vendor_score ?? null
                                const scoreNum = score != null ? Number(score) : null
                                const scoreColor = scoreNum != null
                                    ? scoreNum >= 75 ? 'var(--grn-bd)' : scoreNum >= 50 ? 'var(--amb-bd)' : 'var(--red-bd)'
                                    : 'var(--tel-bd)'
                                const riskLabel = vendors.risk_level || vendors.risk || null
                                const riskScore = vendors.risk_score != null ? vendors.risk_score : null
                                const vendorId = vendors.hash_id || vendors.vendor_id || (vendors.id ? `VND-${vendors.id}` : null)
                                const plantName = vendors.plant_name || vendors.plant || null
                                const openQuotes = vendors.open_quotations ?? vendors.quotation_count ?? null
                                const openPRs = vendors.open_prs ?? vendors.pr_count ?? null
                                const openPOs = vendors.open_pos ?? vendors.po_count ?? null
                                const hasDocChips = openQuotes != null || openPRs != null || openPOs != null
                                const category = vendors.category_name || vendors.category || null

                                return (
                                    <div style={{ border: '0.5px solid rgba(29,158,117,.4)', borderRadius: 'var(--r)', background: 'var(--bg)', overflow: 'hidden' }}>
                                        {/* Green strip */}
                                        <div style={{ background: 'var(--tel-bg)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '0.5px solid rgba(29,158,117,.2)' }}>
                                            <i className="ti ti-circle-check" style={{ fontSize: 14, color: 'var(--tel-tx)' }} />
                                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tel-tx)' }}>Matched from vendor master</span>
                                            {vendors?.vendor_code && (
                                                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, color: 'var(--tel-tx)', opacity: 0.75 }}>{vendors?.vendor_code}</span>
                                            )}
                                        </div>
                                        {/* Body */}
                                        <div style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 10, background: av.bg, color: av.tx, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {vendorInitials(vendors.company_name || '')}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {/* Name + status + risk */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.3px' }}>{vendors.company_name || '—'}</span>
                                                    <span style={{ background: sp.bg, color: sp.tx, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sp.dot, flexShrink: 0 }} />
                                                        {sp.label}
                                                    </span>
                                                    {riskLabel && (
                                                        <span style={{ background: 'var(--amb-bg)', color: 'var(--amb-tx)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                            <i className="ti ti-shield-half" style={{ fontSize: 10 }} />
                                                            {riskLabel}{riskScore != null ? ` (${riskScore})` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Location + category */}
                                                <div style={{ fontSize: 12, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                                                    <span><i className="ti ti-map-pin" style={{ fontSize: 11, marginRight: 2 }} />{[vendors.city, vendors.state].filter(Boolean).join(', ') || '—'}</span>
                                                    {category && <span><i className="ti ti-tag" style={{ fontSize: 11, marginRight: 2 }} />{category}</span>}
                                                </div>
                                                {/* 3-col info grid: GSTIN | Contact | Vendor Score */}
                                                <div className="g3v" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                                                    <div style={{ background: 'var(--bg-s)', borderRadius: 6, padding: '8px 10px' }}>
                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>GSTIN</div>
                                                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendors.gst_number || '—'}</div>
                                                    </div>
                                                    <div style={{ background: 'var(--bg-s)', borderRadius: 6, padding: '8px 10px' }}>
                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>Contact</div>
                                                        <div style={{ fontSize: 11, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {vendors.contact_name
                                                                ? `${vendors.contact_name}${vendors.contact_phone ? ` · ${vendors.contact_phone}` : ''}`
                                                                : vendors.contact_email || '—'}
                                                        </div>
                                                    </div>
                                                    <div style={{ background: 'var(--bg-s)', borderRadius: 6, padding: '8px 10px' }}>
                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>Vendor Score</div>
                                                        {scoreNum != null ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{scoreNum}</span>
                                                                    <span style={{ fontSize: 10, color: 'var(--tx3)' }}>/100</span>
                                                                </div>
                                                                <div style={{ height: 4, background: 'var(--bg-t)', borderRadius: 2, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', borderRadius: 2, background: scoreColor, width: `${scoreNum}%` }} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>—</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right: Change button + Plant */}
                                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                                                <button
                                                    onClick={() => setShowVendorSearch(p => !p)}
                                                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: showVendorSearch ? 'var(--bg-t)' : 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', color: 'var(--tx)' }}
                                                >
                                                    <i className="ti ti-refresh" style={{ fontSize: 11 }} /> Change
                                                </button>
                                                {plantName && (
                                                    <span style={{ fontSize: 10, color: 'var(--tx3)', textAlign: 'right' }}>
                                                        Plant: <strong style={{ fontWeight: 500, color: 'var(--tx2)' }}>{plantName}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Open documents footer */}
                                        {hasDocChips && (
                                            <div style={{ borderTop: '0.5px solid var(--bd)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-s)' }}>
                                                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>Open documents:</span>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                    {openQuotes != null && openQuotes > 0 && (
                                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--blu-bg)', color: 'var(--blu-tx)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <i className="ti ti-file-text" style={{ fontSize: 11 }} /> {openQuotes} Quot.
                                                        </span>
                                                    )}
                                                    {openPRs != null && openPRs > 0 && (
                                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--pur-bg)', color: 'var(--pur-tx)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <i className="ti ti-file-text" style={{ fontSize: 11 }} /> {openPRs} PR
                                                        </span>
                                                    )}
                                                    {openPOs != null && openPOs > 0 && (
                                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--grn-bg)', color: 'var(--grn-tx)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <i className="ti ti-file-text" style={{ fontSize: 11 }} /> {openPOs} PO
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Inline vendor search (shared by states 2 and 3) */}
                            {showVendorSearch && (
                                <div style={{ marginTop: 8, border: '0.5px solid var(--bdm)', borderRadius: 'var(--r)', background: 'var(--bg)', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--bd)' }}>
                                        <div style={{ position: 'relative' }}>
                                            <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', fontSize: 14, pointerEvents: 'none' }} />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={vendorQuery}
                                                onChange={e => setVendorQuery(e.target.value)}
                                                placeholder="Search vendors by name, GSTIN, city…"
                                                className="inp"
                                                style={{ paddingLeft: 32 }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                        {vendorsFetching && (
                                            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--tx3)' }}>
                                                <i className="ti ti-loader-2" style={{ fontSize: 16, display: 'block', margin: '0 auto 4px' }} /> Loading…
                                            </div>
                                        )}
                                        {!vendorsFetching && filteredVendors.length === 0 && (
                                            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--tx3)' }}>
                                                <i className="ti ti-building-off" style={{ fontSize: 24, display: 'block', margin: '0 auto 6px', opacity: 0.3 }} />
                                                No vendors found{vendorQuery.trim() ? ` for "${vendorQuery}"` : ''}
                                            </div>
                                        )}
                                        {!vendorsFetching && filteredVendors.map((v: any) => {
                                            const vav = avatarColor(v.company_name || '')
                                            const vsp = statusPill(v.status || v.is_new)
                                            return (
                                                <button
                                                    key={v.id}
                                                    onClick={() => { onSelectVendor?.(v); setShowVendorSearch(false); setVendorQuery('') }}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '0.5px solid var(--bd)', cursor: 'pointer', fontFamily: 'inherit' }}
                                                >
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: vav.bg, color: vav.tx, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {vendorInitials(v.company_name || '')}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{v.company_name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                                                            <div className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                <span>{[v.city, v.state].filter(Boolean).join(', ')}</span>

                                                                {v.vendor_code && (
                                                                    <span
                                                                        style={{
                                                                            fontFamily: 'monospace',
                                                                            color: 'var(--blu-tx)',
                                                                        }}
                                                                    >
                                                                        {v.vendor_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span style={{ background: vsp.bg, color: vsp.tx, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{vsp.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {!vendorsFetching && filteredVendors.length > 0 && (
                                        <div style={{ padding: '7px 14px', borderTop: '0.5px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)' }}>
                                            <span>Showing <strong style={{ color: 'var(--tx)' }}>{filteredVendors.length}</strong> of <strong style={{ color: 'var(--tx)' }}>{allVendors.length}</strong></span>
                                            {vendorQuery.trim() && (
                                                <button onClick={() => setVendorQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 11, color: 'var(--tx3)', fontFamily: 'inherit' }}>Clear</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Auto-extracted fields */}
                        <div className="g3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                            {[
                                { label: 'Quotation Number', value: quotation?.vendor?.quotation_no || '' },
                                { label: 'Quote Date', value: quotation?.vendor?.quotation_date || '' },
                                { label: 'Valid Until', value: quotation?.vendor?.valid_until || '' },
                            ].map(({ label, value }) => (
                                <div key={label} className="fgrp">
                                    <div className="extracted-lbl">
                                        <i className="ti ti-sparkles" style={{ fontSize: 11 }} /> {label}
                                        { value
                                                ? <span style={{ fontSize: 9, background: 'var(--tel-bg)', color: 'var(--tel-tx)', padding: '1px 5px', borderRadius: 20, fontWeight: 600, marginLeft: 4 }}>Auto-extracted</span>
                                                : null
                                        }
                                    </div>
                                    <input readOnly className="inp-extracted" placeholder="Extract from document…" value={value} onChange={() => { }} />
                                </div>
                            ))}
                        </div>

                        {/* Plant, Department, Category */}
                        <div className="g3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <div className="fgrp">
                                <label className="lbl">Plant / Location <span className="req">*</span></label>
                                <select className="sel" value={plantId} onChange={e => setPlantId(e.target.value)}>
                                    <option value="">Select plant</option>
                                    {plants.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="fgrp">
                                <label className="lbl">Department <span className="req">*</span></label>
                                <select className="sel" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                                    <option value="">Select department</option>
                                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="fgrp">
                                <label className="lbl">Category <span className="req">*</span></label>
                                <select className="sel" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                    <option value="">Select category</option>
                                    {categories?.map((c: any) => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* PR Link + Financial Year */}
                        <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <div className="fgrp">
                                <label className="lbl">Link to Purchase Request</label>
                                <select className="sel" value={prLinkId} onChange={e => setPrLinkId(e.target.value)}>
                                    <option value="">— Not specified —</option>
                                    {PRs.map((p: any) => <option key={p.id} value={p.id}>{p.pr_number || p.id}</option>)}
                                </select>
                            </div>
                            {/* <div className="fgrp">
                                <label className="lbl">Financial Year</label>
                                <select className="sel" value={financialYear} onChange={e => setFinancialYear(e.target.value)}>
                                    <option value="">— Not specified —</option>
                                    {financialYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                                </select>
                            </div> */}
                        </div>

                        {/* Internal Notes */}
                        <div className="fgrp">
                            <label className="lbl">
                                Internal Notes
                                <span style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 6 }}>
                                    ({internalNotes.length}/500)
                                </span>
                            </label>

                            <textarea
                                className="textarea"
                                placeholder="Negotiation points, concerns, context for approvers…"
                                value={internalNotes}
                                minLength={10}
                                maxLength={500}
                                onChange={e => setInternalNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* SIDEBAR */}
            <div className="uf-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Checklist */}
                <div className="card">
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-checklist" /> Checklist</div>
                    </div>
                    {[
                        { ok: !!selectedFile, label: 'Document uploaded' },
                        { ok: !!vendors, label: 'Vendor extracted' },
                        { ok: !!quotation?.vendor?.quotation_no, label: 'Quotation number extracted' },
                        { ok: !!plantId, label: 'Plant selected' },
                    ].map(({ ok, label }) => (
                        <div key={label} className={`ci ${ok ? 'ci-ok' : 'ci-idle'}`}>
                            <i className={`ti ${ok ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize: 14 }} />
                            <span>{label}</span>
                        </div>
                    ))}
                </div>

                {/* What gets extracted */}
                <div className="card">
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-sparkles" /> What gets extracted</div>
                    </div>
                    <div className="card-body" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.9 }}>
                        {[
                            { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Vendor name → auto-matched' },
                            { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Quotation number' },
                            { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'Quote & validity dates' },
                            { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'All line items with qty & price' },
                            { icon: 'ti-circle-check', c: 'var(--grn-tx)', t: 'GST rates per item' },
                            { icon: 'ti-alert-circle', c: 'var(--amb-tx)', t: 'Part numbers (best effort)' },
                        ].map(({ icon, c, t }) => (
                            <div key={t}><i className={`ti ${icon}`} style={{ color: c, marginRight: 4 }} />{t}</div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}
