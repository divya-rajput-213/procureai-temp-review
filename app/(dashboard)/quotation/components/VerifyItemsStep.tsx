'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'

interface VerifyItemsStepProps {
    file: File | null
    quotation: any
    lineItems: any[]
    setLineItems: React.Dispatch<React.SetStateAction<any[]>>
    masterItems?: any[]
    onContinue?: () => void
    onBack?: () => void
    hideMasterMatch?: boolean
    onExport?: () => void
    disableAddRow?: boolean
    onValidationChange?: (isValid: boolean, incompleteCount: number) => void
    showValidationErrors?: boolean
    unlockAll?: boolean
}

const fmtI = (v: number) => '₹' + (isNaN(v) ? 0 : Math.round(v)).toLocaleString('en-IN')

const UOM_OPTIONS = ['EA', 'KG', 'LTR', 'MTR', 'PCS', 'SET', 'BOX', 'BAG', 'TON', 'NOS']

const editableStyle: React.CSSProperties = {
    border: '0.5px solid var(--bdm)', background: 'var(--bg)', color: 'var(--tx)',
    borderRadius: 4, padding: '3px 7px', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%',
}
const needsInputStyle: React.CSSProperties = {
    border: '0.5px solid var(--bdm)', background: 'var(--bg)', color: 'var(--tx)',
    borderRadius: 4, padding: '3px 7px', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%',
}
const errorInputStyle: React.CSSProperties = {
    border: '1px solid #E24B4A', background: '#fff5f5', color: '#1a1a18',
    borderRadius: 4, padding: '3px 7px', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%',
}

export default function VerifyItemsStep({ lineItems, setLineItems, masterItems = [], hideMasterMatch = false, quotation, onExport, disableAddRow = false, onValidationChange, showValidationErrors = false, unlockAll = false }: VerifyItemsStepProps) {
    const [addRowActive, setAddRowActive] = useState(false)
    const [activeDropdownIdx, setActiveDropdownIdx] = useState<number | null>(null)
    const [addSearch, setAddSearch] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const searchRowRef = useRef<HTMLTableRowElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    // Snapshot which fields were non-null in the original backend response (set once per item index)
    const origRef = useRef<Record<number, { hsn: string | null; uom: string | null; qty: number; price: number | null }>>({})
    lineItems.forEach((item, idx) => {
        if (!item._manuallyAdded && origRef.current[idx] === undefined) {
            origRef.current[idx] = {
                hsn: item.hsn_code ?? null,
                uom: item.unit_of_measure ?? null,
                qty: Number(item.quantity) || 0,
                price: item.item_price != null ? Number(item.item_price) : null,
            }
        }
    })

    const { data: inventoryItems = [], isFetching: inventoryFetching } = useQuery({
        queryKey: ['items-inventory', addSearch],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (addSearch) params.set('search', addSearch)
            const r = await apiClient.get(`/procurement/items/?${params.toString()}`)
            return r.data.results ?? r.data
        },
        enabled: addRowActive,
    })

    useEffect(() => {
        if (addRowActive) {
            setTimeout(() => searchInputRef.current?.focus(), 50)
        }
    }, [addRowActive])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setAddRowActive(false)
                setAddSearch('')
                setActiveDropdownIdx(null)
            }
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdownIdx(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const addFromInventory = (inv: any) => {
        setLineItems(prev => [...prev, {
            item_name: inv.description || '',
            item_code: inv.code || '',
            item_price: Number(inv.unit_rate ?? 0),
            quantity: 1,
            unit_of_measure: inv.unit_of_measure || '',
            hsn_code: inv.hsn_code || '',
            gst_percentage: Number(inv.gst_percentage || 18),
            createNew: false,
            is_new: false,
            skipItem: false,
            replaceExisting: false,
            selectedMasterId: String(inv.hash_id || inv.id || ''),
            suggestions: [],
            _manuallyAdded: true,
        }])
        setAddRowActive(false)
        setAddSearch('')
    }

    const addBlankRow = () => {
        setLineItems(prev => [...prev, {
            item_name: '', item_code: '', item_price: 0,
            quantity: 1, unit_of_measure: '', hsn_code: '', gst_percentage: 18,
            createNew: true, is_new: true, skipItem: false, replaceExisting: false,
            selectedMasterId: '', suggestions: [],
            _manuallyAdded: true,
        }])
        setAddRowActive(false)
        setAddSearch('')
    }

    const removeItem = useCallback((idx: number) => {
        setLineItems(prev => prev.filter((_, i) => i !== idx))
    }, [setLineItems])

    const updateItem = useCallback((idx: number, field: string, value: any) => {
        setLineItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
    }, [setLineItems])

    const updateItemFields = useCallback((idx: number, fields: Record<string, any>) => {
        setLineItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], ...fields }; return u })
    }, [setLineItems])

    const selectMaster = (idx: number, masterId: string) => {
        setLineItems(prev => {
            const u = [...prev]
            u[idx] = { ...u[idx], selectedMasterId: masterId, createNew: false, is_new: false, replaceExisting: false, skipItem: false }
            return u
        })
    }

    const toggleCreateNew = (idx: number, checked: boolean) => {
        setLineItems(prev => {
            const u = [...prev]
            const item = u[idx]

            if (checked) {
                u[idx] = {
                    ...item,
                    createNew: true,
                    is_new: true,
                    replaceExisting: false,
                    skipItem: false,
                    selectedMasterId: '',
                }
            } else {
                u[idx] = {
                    ...item,
                    createNew: checked,
                    is_new: checked,
                    replaceExisting: false,
                    skipItem: false,
                    selectedMasterId: checked ? '' : item.selectedMasterId,
                }
            }
            return u
        })
    }

    const toggleReplace = (idx: number, checked: boolean) => {
        setLineItems(prev => {
            const u = [...prev]
            u[idx] = { ...u[idx], replaceExisting: checked, createNew: false, is_new: false, skipItem: false }
            return u
        })
    }

    const toggleSkip = (idx: number, checked: boolean) => {
        setLineItems(prev => {
            const u = [...prev]
            const item = u[idx]
            if (checked) {
                u[idx] = { ...item, skipItem: true, createNew: false, is_new: false }
            } else {
                const hasSugg = Array.isArray(item.suggestions) && item.suggestions.length > 0
                u[idx] = {
                    ...item, skipItem: false, createNew: !hasSugg, is_new: !hasSugg,
                    selectedMasterId: hasSugg ? (item.selectedMasterId || String(item.suggestions[0].master_item_id)) : ''
                }
            }
            return u
        })
    }

    // Totals
    const subtotal = lineItems.reduce((a, it) => a + Number(it.item_price || 0) * Number(it.quantity || 1), 0)
    const cgstRate = quotation?.cgst_rate != null ? Number(quotation.cgst_rate) : null
    const sgstRate = quotation?.sgst_rate != null ? Number(quotation.sgst_rate) : null
    const igstRate = quotation?.igst_rate != null ? Number(quotation.igst_rate) : null
    // Recalculate CGST/SGST from rate × subtotal when any unit price was entered or changed on the frontend
    const hasFrontendPrice = lineItems.some(item => item.is_manual_unit_price || item._manuallyAdded)
    const cgstAmount = hasFrontendPrice && cgstRate != null
        ? subtotal * cgstRate / 100
        : quotation?.cgst_amount != null ? Number(quotation.cgst_amount) : null
    const sgstAmount = hasFrontendPrice && sgstRate != null
        ? subtotal * sgstRate / 100
        : quotation?.sgst_amount != null ? Number(quotation.sgst_amount) : null
    const igst = igstRate != null
        ? subtotal * igstRate / 100
        : lineItems.reduce((a, it) => {
            const g = Number(it.gst_percentage || 0)
            return a + Number(it.item_price || 0) * Number(it.quantity || 1) * g / 100
        }, 0)
    const grandTotal = subtotal + (cgstAmount ?? 0) + (sgstAmount ?? 0) + igst

    // Summary
    const matched = lineItems.filter(i => !i.createNew && !i.is_new && !i.skipItem && !i.replaceExisting && !!i.selectedMasterId).length
    const newCount = lineItems.filter(i => (i.createNew || i.is_new) && !i.skipItem).length

    // Validation — items missing HSN, UOM or Unit Price block submission
    const incompleteItems = lineItems.filter((item, idx) => {
        if (item.skipItem) return false
        const orig = origRef.current[idx]
        const hsnFromBackend = !item._manuallyAdded && orig?.hsn != null
        const hsnOk = hsnFromBackend || /^\d{4,}$/.test(String(item.hsn_code || '').trim())
        return !hsnOk || !item.unit_of_measure || !(Number(item.item_price) > 0)
    })
    const isBlocked = incompleteItems.length > 0

    useEffect(() => {
        onValidationChange?.(!isBlocked, incompleteItems.length)
    }, [isBlocked, incompleteItems.length])

    return (
        <div className="vi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
            {/* LEFT */}
            <div>
                <div className="form-sec">
                    <div className="form-sec-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}>
                                <i className="ti ti-list-check" />
                            </div>
                            <div>
                                <div className="fsh-title">Extracted Items — Match to Master Catalogue</div>
                                <div className="fsh-sub">Edit extracted values · choose an action for each item · pick a master match if available</div>
                            </div>
                        </div>
                        {onExport && (() => {
                            const hasNewItems = lineItems.some(item => !item.skipItem && (item.createNew || item.is_new))
                            return (
                                <span style={{ flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        onClick={onExport}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '5px 12px', border: '0.5px solid var(--bd)', borderRadius: 6, background: 'white', whiteSpace: 'nowrap' }}
                                    >
                                        <i className="ti ti-file-spreadsheet" style={{ fontSize: 14 }} /> Export Excel
                                    </button>
                                </span>
                            )
                        })()}
                    </div>
                    <div className="form-body" style={{ padding: 14 }}>
                        {/* HSN info — only when any item is missing a valid HSN */}
                        {lineItems.some(item => !item.skipItem && !/^\d{4,}$/.test(String(item.hsn_code || '').replace(/\s+/g, ''))) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92540a', background: '#fef3c7', border: '0.5px solid #f59e0b', borderRadius: 6, padding: '7px 12px', marginBottom: 10 }}>
                                <i className="ti ti-info-circle" style={{ fontSize: 14, flexShrink: 0 }} />
                                <span>HSN code must be <strong>minimum 4 digits</strong> — required before submission.</span>
                            </div>
                        )}
                        {/* Extraction notice */}
                        <div style={{ background: 'var(--grn-bg)', border: '0.5px solid rgba(99,153,34,.3)', borderRadius: 'var(--r)', padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, fontSize: 12, color: 'var(--grn-tx)' }}>
                            <i className="ti ti-sparkles" style={{ fontSize: 14, flexShrink: 0 }} />
                            <span><strong style={{ fontWeight: 600 }}>AI extraction complete.</strong> {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} extracted.</span>
                        </div>

                        {/* Table */}
                        <div style={{ overflowX: addRowActive ? 'visible' : 'auto', overflowY: addRowActive ? 'visible' : 'unset', WebkitOverflowScrolling: 'touch' }}>
                            <table className="match-tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44, textAlign: 'center' }}>#</th>
                                        <th style={{ width: '24%' }}>Item Description</th>
                                        <th style={{ width: 100 }}>HSN Code</th>
                                        <th style={{ width: 56, textAlign: 'right' }}>Qty</th>
                                        <th style={{ width: 64 }}>UOM</th>
                                        <th style={{ width: 112, textAlign: 'right' }}>Unit Price</th>
                                        <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                                        <th style={{ width: '24%' }}>Master Item Match</th>
                                        <th style={{ width: 36 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, idx) => {
                                        const hasSugg = Array.isArray(item.suggestions) && item.suggestions.length > 0
                                        const isNew = !!(item.createNew || item.is_new)
                                        const isSkip = !!item.skipItem
                                        const isReplace = !!item.replaceExisting && !isNew
                                        const selMasterId = item.selectedMasterId || (hasSugg ? String(item.suggestions[0].master_item_id) : '')
                                        const qty = Number(item.quantity || 1)
                                        const price = Number(item.item_price || 0)
                                        const isManual = !!item._manuallyAdded

                                        const orig = origRef.current[idx]
                                        // In add flow: lock if backend provided the value
                                        // In edit flow (unlockAll): lock unless the field was previously marked is_manual by backend
                                        const hsnLocked = unlockAll
                                            ? !isManual && !item.is_manual_hsn
                                            : !isManual && orig?.hsn != null
                                        const uomLocked = unlockAll
                                            ? !isManual && !item.is_manual_uom
                                            : !isManual && !!orig?.uom
                                        const qtyLocked = !isManual && (orig?.qty ?? 0) > 0
                                        const priceLocked = unlockAll
                                            ? !isManual && !item.is_manual_unit_price
                                            : !isManual && orig?.price != null && orig.price > 0

                                        const hsnStr = String(item.hsn_code || '').replace(/\s+/g, '')
                                        const hsnValid = hsnLocked || /^\d{4,}$/.test(hsnStr)
                                        const uomValid = uomLocked || !!item.unit_of_measure
                                        const priceValid = priceLocked || Number(item.item_price) > 0
                                        const showErr = showValidationErrors && !isSkip

                                        return (
                                            <tr key={idx} style={{ opacity: isSkip ? 0.45 : 1 }}>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--tx3)', padding: '10px 4px', textAlign: 'center' }}>{String(idx + 1).padStart(2, '0')}</td>
                                                <td style={{ textOverflow: 'ellipsis' }} title={!isManual ? (item.item_name || '') : undefined}>
                                                    {isManual
                                                        ? <input className="cell-inp" value={item.item_name || ''} onChange={e => updateItem(idx, 'item_name', e.target.value)} style={{ fontWeight: 500 }} />
                                                        : <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</span>
                                                    }
                                                </td>
                                                <td>
                                                    {hsnLocked
                                                        ? <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--tel-tx)', background: 'var(--tel-bg)', border: '0.5px solid rgba(29,158,117,.3)', borderRadius: 4, padding: '3px 7px', display: 'inline-block' }}>{String(item.hsn_code || '').replace(/\s+/g, '')}</span>
                                                        : <>
                                                            <input
                                                                value={item.hsn_code || ''}
                                                                onChange={e => {
                                                                    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                                                                    updateItemFields(idx, { hsn_code: v, is_manual_hsn: true })
                                                                }}
                                                                placeholder="Min 4-digit HSN"
                                                                maxLength={20}
                                                                inputMode="numeric"
                                                                style={{ ...(showErr && !hsnValid ? errorInputStyle : /^\d{4,}$/.test(hsnStr) ? editableStyle : needsInputStyle), fontFamily: 'monospace', width: 95 }}
                                                            />
                                                            {showErr && !hsnValid && <div style={{ fontSize: 10, color: '#E24B4A', marginTop: 2 }}>HSN must be at least 4 digits</div>}
                                                          </>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {qtyLocked
                                                        ? <span style={{ fontSize: 14, fontFamily: 'monospace' }}>{qty}</span>
                                                        : <input
                                                            type="number"
                                                            value={qty || ''}
                                                            min={1}
                                                            onChange={e => {
                                                                const v = Math.max(1, Number(e.target.value) || 1)
                                                                updateItem(idx, 'quantity', v)
                                                            }}
                                                            placeholder="1"
                                                            style={{ ...(qty > 0 ? editableStyle : needsInputStyle), width: 48, textAlign: 'right' }}
                                                        />
                                                    }
                                                </td>
                                                <td>
                                                    {uomLocked
                                                        ? <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--tel-tx)', background: 'var(--tel-bg)', border: '0.5px solid rgba(29,158,117,.3)', borderRadius: 4, padding: '3px 7px', display: 'inline-block' }}>{item.unit_of_measure}</span>
                                                        : <>
                                                            <select
                                                                value={item.unit_of_measure || ''}
                                                                onChange={e => updateItemFields(idx, { unit_of_measure: e.target.value, is_manual_uom: true })}
                                                                style={{ ...(showErr && !uomValid ? errorInputStyle : item.unit_of_measure ? editableStyle : needsInputStyle), width: 68 }}
                                                            >
                                                                <option value="">UOM</option>
                                                                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                            {showErr && !uomValid && <div style={{ fontSize: 10, color: '#E24B4A', marginTop: 2 }}>UOM Required</div>}
                                                          </>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {priceLocked
                                                        ? <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--tel-tx)', background: 'var(--tel-bg)', border: '0.5px solid rgba(29,158,117,.3)', borderRadius: 4, padding: '3px 7px', display: 'inline-block' }}>{fmtI(price)}</span>
                                                        : <>
                                                            <input
                                                                type="number"
                                                                value={price || ''}
                                                                min={0.01}
                                                                step="any"
                                                                onChange={e => {
                                                                    const v = Math.abs(Number(e.target.value) || 0)
                                                                    updateItemFields(idx, { item_price: v, is_manual_unit_price: true })
                                                                }}
                                                                placeholder="0.00"
                                                                style={{ ...(showErr && !priceValid ? errorInputStyle : price > 0 ? editableStyle : needsInputStyle), width: 90, textAlign: 'right' }}
                                                            />
                                                            {showErr && !priceValid && <div style={{ fontSize: 10, color: '#E24B4A', marginTop: 2 }}>Price must be a positive value</div>}
                                                          </>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{fmtI(qty * price)}</td>
                                                { <td style={{ minWidth: isManual ? 0 : 220, position: 'relative', overflow: 'visible' }}>
                                                    {isManual ? null : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                            {/* Custom Rich Dropdown */}
                                                            <div className="relative w-full">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveDropdownIdx(activeDropdownIdx === idx ? null : idx)}
                                                                    disabled={isNew || (hideMasterMatch && !unlockAll)}
                                                                    style={{
                                                                        fontSize: 13, padding: '7px 10px',
                                                                        border: `0.5px solid ${isNew ? 'var(--gry-bd)' : 'var(--blu-bd)'}`,
                                                                        borderRadius: 6,
                                                                        background: isNew ? 'var(--gry-bg)' : 'var(--bg)',
                                                                        color: isNew ? 'var(--gry-tx)' : 'var(--tx)',
                                                                        outline: 'none', cursor: isNew ? 'default' : 'pointer',
                                                                        opacity: isNew ? 0.5 : 1, width: '100%',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        textAlign: 'left',
                                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                                    }}
                                                                >
                                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {(() => {
                                                                            const s = item.suggestions?.find((x: any) => String(x.master_item_id) === selMasterId)
                                                                            if (s) return <><div style={{ fontWeight: 600, fontSize: 13, color: 'var(--blu-tx)' }}>{s.description}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{s.code || 'N/A'} — {fmtI(Number(s.unit_rate ?? 0))}</div></>
                                                                            const m = masterItems.find((x: any) => String(x.id) === selMasterId || String(x.hash_id) === selMasterId)
                                                                            if (m) return <><div style={{ fontWeight: 600, fontSize: 13, color: 'var(--blu-tx)' }}>{m.description}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{m.code || 'N/A'} — {fmtI(Number(m.unit_rate ?? 0))}</div></>
                                                                            return <span style={{ color: 'var(--tx3)' }}>Select Match...</span>
                                                                        })()}
                                                                    </div>
                                                                    <i className={`ti ti-chevron-down ml-2 transition-transform ${activeDropdownIdx === idx ? 'rotate-180' : ''}`} />
                                                                </button>

                                                                {activeDropdownIdx === idx && (
                                                                    <div
                                                                        ref={dropdownRef}
                                                                        style={{
                                                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                                                                            marginTop: 4, background: '#fff', border: '0.5px solid var(--bdm)',
                                                                            borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                                                            maxHeight: 280, overflowY: 'auto'
                                                                        }}
                                                                    >
                                                                        {(item.suggestions || []).map((s: any) => {
                                                                            const mId = String(s.master_item_id)
                                                                            const isSelected = mId === selMasterId
                                                                            const rate = Number(s.unit_rate ?? 0)
                                                                            return (
                                                                                <div
                                                                                    key={mId}
                                                                                    onMouseDown={(e) => {
                                                                                        e.preventDefault()
                                                                                        selectMaster(idx, mId)
                                                                                        setActiveDropdownIdx(null)
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '10px 12px', cursor: 'pointer',
                                                                                        borderBottom: '0.5px solid var(--bd)',
                                                                                        background: isSelected ? 'var(--blu-bg)' : 'transparent',
                                                                                        transition: 'background 0.15s ease'
                                                                                    }}
                                                                                    onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'var(--bg-s)')}
                                                                                    onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                                                                >
                                                                                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--blu-tx)' : 'var(--tx)', marginBottom: 2 }}>
                                                                                        {s.description}
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                                                                                        <div style={{ color: 'var(--tx3)' }}>
                                                                                            {s.code || 'N/A'} — <span style={{ fontStyle: 'italic' }}>{(s.description || '').substring(0, 20)}...</span>
                                                                                        </div>
                                                                                        <div style={{ fontWeight: 700, color: 'var(--tel-tx)' }}>
                                                                                            {fmtI(rate)}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                        {(!item.suggestions || item.suggestions.length === 0) && (
                                                                            <div style={{ padding: '12px', fontSize: 12, color: 'var(--tx3)', textAlign: 'center' }}>
                                                                                No AI suggestions found
                                                                            </div>
                                                                        )}
                                                                        <div
                                                                            onMouseDown={() => {
                                                                                setAddRowActive(true)
                                                                                setActiveDropdownIdx(null)
                                                                            }}
                                                                            style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 6, borderTop: '0.5px solid var(--bd)' }}
                                                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-s)')}
                                                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                                        >
                                                                            <i className="ti ti-search" /> Search more in catalogue
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--tx2)', cursor: 'pointer' }}>
                                                                    <input type="checkbox" checked={isNew} onChange={e => toggleCreateNew(idx, e.target.checked)} style={{ accentColor: 'var(--grn-bd)', width: 12, height: 12 }} disabled={hideMasterMatch && !unlockAll} />
                                                                    <span>Create New</span>
                                                                </label>
                   
                                                            </div>
                                                            <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '2px 0' }}>
                                                                {isNew
                                                                    ? <span style={{ color: 'var(--grn-tx)', fontWeight: 600 }}><i className="ti ti-plus" style={{ fontSize: 11, marginRight: 2 }} />Will create new master item</span>

                                                                        : <span style={{ color: 'var(--blu-tx)', fontWeight: 600 }}><i className="ti ti-link" style={{ fontSize: 11, marginRight: 2 }} />Using existing master item</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>}
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                    {isManual && (
                                                        <button
                                                            onClick={() => removeItem(idx)}
                                                            title="Remove row"
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--tx3)', fontSize: 13, lineHeight: 1, borderRadius: 4 }}
                                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red-tx)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-bg)' }}
                                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx3)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                                                        >
                                                            <i className="ti ti-trash" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}

                                    {/* Inline search row */}
                                    {addRowActive && (
                                        <tr ref={searchRowRef} style={{ background: 'var(--blu-bg)' }}>
                                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--tx3)', verticalAlign: 'top', paddingTop: 10 }}>
                                                <i className="ti ti-search" style={{ fontSize: 12 }} />
                                            </td>
                                            <td colSpan={6} style={{ padding: '6px 8px', position: 'relative', overflow: 'visible' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '0.5px solid var(--blu-bd)', borderRadius: 5, padding: '5px 8px', background: 'var(--bg)' }}>
                                                    <input
                                                        ref={searchInputRef}
                                                        value={addSearch}
                                                        onChange={e => setAddSearch(e.target.value)}
                                                        placeholder="Search inventory by name or code..."
                                                        style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: 'var(--tx)', flex: 1, minWidth: 0 }}
                                                    />
                                                    {inventoryFetching
                                                        ? <i className="ti ti-loader-2" style={{ fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }} />
                                                        : <button
                                                            onClick={() => { setAddRowActive(false); setAddSearch('') }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--tx3)', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                                                            title="Cancel"
                                                        >
                                                            <i className="ti ti-x" />
                                                        </button>
                                                    }
                                                </div>

                                                {/* Dropdown results */}
                                                {(inventoryItems.length > 0 || (!inventoryFetching && addSearch)) && (
                                                    <div style={{
                                                        position: 'absolute', top: '100%', left: 8, right: 8, zIndex: 200,
                                                        background: 'var(--bg)', border: '0.5px solid var(--bdm)',
                                                        borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                                                        maxHeight: 200, overflowY: 'auto',
                                                    }}>
                                                        {inventoryItems.length > 0 ? inventoryItems.map((inv: any) => (
                                                            <div
                                                                key={inv.hash_id || inv.id}
                                                                onMouseDown={() => addFromInventory(inv)}
                                                                style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '0.5px solid var(--bdl)', display: 'flex', flexDirection: 'column', gap: 2 }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-s)')}
                                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                            >
                                                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{inv.description}</div>
                                                                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--tx3)' }}>
                                                                    {inv.code && <span style={{ fontFamily: 'monospace' }}>{inv.code}</span>}
                                                                    {inv.hsn_code && <span>HSN: {inv.hsn_code}</span>}
                                                                    {inv.unit_of_measure && <span>{inv.unit_of_measure}</span>}
                                                                    {inv.unit_rate != null && <span style={{ color: 'var(--tel-tx)', fontWeight: 600 }}>{fmtI(Number(inv.unit_rate))}</span>}
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tx3)', textAlign: 'center' }}>No items found</div>
                                                        )}
                                                        <div
                                                            onMouseDown={addBlankRow}
                                                            style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx2)', borderTop: '0.5px solid var(--bdm)' }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-s)')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                        >
                                                            <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add blank row
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td colSpan={2} />
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ fontWeight: 600, color: 'var(--tx2)', textAlign: 'right', whiteSpace: 'nowrap' }}>Sub Total</td>
                                        <td colSpan={3} className="match-tfoot" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtI(subtotal)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)', whiteSpace: 'nowrap' }}>CGST{cgstRate != null ? ` @ ${cgstRate}%` : ''}</td>
                                        <td colSpan={3} className="match-tfoot" style={{ textAlign: 'right', color: cgstAmount != null ? 'var(--tx2)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{cgstAmount != null ? fmtI(cgstAmount) : '—'}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)', whiteSpace: 'nowrap' }}>SGST{sgstRate != null ? ` @ ${sgstRate}%` : ''}</td>
                                        <td colSpan={3} className="match-tfoot" style={{ textAlign: 'right', color: sgstAmount != null ? 'var(--tx2)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{sgstAmount != null ? fmtI(sgstAmount) : '—'}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)', whiteSpace: 'nowrap' }}>IGST{igstRate != null ? ` @ ${igstRate}%` : ''}</td>
                                        <td colSpan={3} className="match-tfoot" style={{ textAlign: 'right', color: igst > 0 ? 'var(--tx2)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{igst > 0 ? fmtI(igst) : '—'}</td>
                                    </tr>
                                    <tr style={{ background: 'var(--bg-t)' }}>
                                        <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', borderTop: '0.5px solid var(--bdm)', whiteSpace: 'nowrap' }}>Grand Total (incl. GST)</td>
                                        <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)', whiteSpace: 'nowrap' }}>{fmtI(grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* {!addRowActive && !disableAddRow && (
                            <button
                                onClick={() => setAddRowActive(true)}
                                style={{ marginTop: 10, padding: '6px 12px ', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tx)' }}
                            >
                                <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Row
                            </button>
                        )} */}
                    </div>
                </div>
            </div>

            {/* SIDEBAR */}
            <div className="vi-sidebar">

                <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-chart-pie" /> Matching Summary</div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {([
                            { bg: 'var(--blu-bg)', tx: 'var(--blu-tx)', icon: 'ti-link', label: 'Matched', count: matched },
                            { bg: 'var(--grn-bg)', tx: 'var(--grn-tx)', icon: 'ti-plus', label: 'Add New', count: newCount },
                        ] as const).map(({ bg, tx, icon, label, count }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: bg, borderRadius: 'var(--r)' }}>
                                <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}><i className={`ti ${icon}`} style={{ marginRight: 4 }} />{label}</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: tx }}>{count}</span>
                            </div>
                        ))}

                    </div>
                </div>
                <div className="card">
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-info-circle" /> Action Guide</div>
                    </div>
                    <div className="card-body" style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 2 }}>
                        <div><span className="tag t-match" style={{ marginRight: 8, marginBottom: 8 }}>Match</span>Link to an existing master item</div>
                        <div><span className="tag t-new" style={{ marginRight: 8 }}>New</span>Create a new master item</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
