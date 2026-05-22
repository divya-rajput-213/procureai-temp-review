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
}

const fmtI = (v: number) => '₹' + (isNaN(v) ? 0 : Math.round(v)).toLocaleString('en-IN')

const UOM_OPTIONS = ['EA', 'KG', 'LTR', 'MTR', 'PCS', 'SET', 'BOX', 'BAG', 'TON', 'NOS']

const editableStyle: React.CSSProperties = {
    border: '0.5px solid var(--blu-bd)', background: 'var(--blu-bg)', color: 'var(--blu-tx)',
    borderRadius: 4, padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, outline: 'none', width: '100%',
}
const needsInputStyle: React.CSSProperties = {
    border: '0.5px solid var(--amb-bd)', background: 'var(--amb-bg)', color: 'var(--amb-tx)',
    borderRadius: 4, padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, outline: 'none', width: '100%',
}
const extractedCellStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 11, color: 'var(--tel-tx)', background: 'var(--tel-bg)',
    border: '0.5px solid rgba(29,158,117,.3)', borderRadius: 4, padding: '2px 6px', display: 'inline-block',
}

export default function VerifyItemsStep({ lineItems, setLineItems, masterItems = [], hideMasterMatch = false, quotation }: VerifyItemsStepProps) {
    const [addRowActive, setAddRowActive] = useState(false)
    const [addSearch, setAddSearch] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const searchRowRef = useRef<HTMLTableRowElement>(null)

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
            if (e.key === 'Escape') { setAddRowActive(false); setAddSearch('') }
        }
        if (addRowActive) document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [addRowActive])

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
            u[idx] = { ...u[idx], createNew: checked, is_new: checked, replaceExisting: false, skipItem: false }
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
    const cgstAmount = quotation?.cgst_amount != null ? Number(quotation.cgst_amount) : null
    const sgstAmount = quotation?.sgst_amount != null ? Number(quotation.sgst_amount) : null
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
    const replaced = lineItems.filter(i => i.replaceExisting && !i.skipItem).length
    const skipped = lineItems.filter(i => !!i.skipItem).length
    const pending = lineItems.filter(i => !i.createNew && !i.is_new && !i.skipItem && !i.replaceExisting && !i.selectedMasterId).length
    const actioned = lineItems.length - pending
    const pct = lineItems.length > 0 ? Math.round(actioned / lineItems.length * 100) : 0

    return (
        <div className="vi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
            {/* LEFT */}
            <div>
                <div className="form-sec">
                    <div className="form-sec-head">
                        <div className="fsh-ic" style={{ background: 'var(--grn-bg)', color: 'var(--grn-tx)' }}>
                            <i className="ti ti-list-check" />
                        </div>
                        <div>
                            <div className="fsh-title">Extracted Items — Match to Master Catalogue</div>
                            <div className="fsh-sub">Edit extracted values · choose an action for each item · pick a master match if available</div>
                        </div>
                    </div>
                    <div className="form-body" style={{ padding: 14 }}>
                        {/* Extraction notice */}
                        <div style={{ background: 'var(--grn-bg)', border: '0.5px solid rgba(99,153,34,.3)', borderRadius: 'var(--r)', padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, fontSize: 12, color: 'var(--grn-tx)' }}>
                            <i className="ti ti-sparkles" style={{ fontSize: 14, flexShrink: 0 }} />
                            <span><strong style={{ fontWeight: 600 }}>AI extraction complete.</strong> {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} extracted. Edit any cell inline, then choose an action for each row.</span>
                        </div>

                        {/* Progress */}
                        <div className="match-progress">
                            <span style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{actioned} of {lineItems.length} actioned</span>
                            <div className="mp-bar"><div className="mp-fill" style={{ width: `${pct}%` }} /></div>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{pct}%</span>
                        </div>

                        {/* Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="match-tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 28 }}>#</th>
                                        <th>Item Description</th>
                                        <th style={{ width: 90 }}>HSN Code</th>
                                        <th style={{ width: 54, textAlign: 'right' }}>Qty</th>
                                        <th style={{ width: 72 }}>UOM</th>
                                        <th style={{ width: 96, textAlign: 'right' }}>Unit Price</th>
                                        <th style={{ width: 106, textAlign: 'right' }}>Total</th>
                                        <th style={{ width: 42, textAlign: 'center' }}>GST%</th>
                                        {!hideMasterMatch && <th>Master Item Match</th>}
                                        <th style={{ width: 28 }} />
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
                                        const gst = Number(item.gst_percentage || 0)
                                        const isManual = !!item._manuallyAdded

                                        return (
                                            <tr key={idx} style={{ opacity: isSkip ? 0.45 : 1 }}>
                                                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--tx3)' }}>{String(idx + 1).padStart(2, '0')}</td>
                                                <td>
                                                    {isManual
                                                        ? <input className="cell-inp" value={item.item_name || ''} onChange={e => updateItem(idx, 'item_name', e.target.value)} style={{ fontWeight: 500 }} />
                                                        : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{item.item_name}</span>
                                                    }
                                                </td>
                                                <td>
                                                    {isManual
                                                        ? item.hsn_code
                                                            ? <span style={extractedCellStyle}>{item.hsn_code}</span>
                                                            : <input
                                                                value={item.hsn_code || ''}
                                                                onChange={e => updateItem(idx, 'hsn_code', e.target.value)}
                                                                placeholder="Enter HSN"
                                                                style={{ ...needsInputStyle, fontFamily: 'monospace', width: 85 }}
                                                              />
                                                        : item.hsn_code
                                                            ? <span style={extractedCellStyle}>{item.hsn_code}</span>
                                                            : <span style={{ fontSize: 11, color: 'var(--tx3)' }}>—</span>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {isManual
                                                        ? <input
                                                            type="number"
                                                            value={qty}
                                                            onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                                                            style={{ ...editableStyle, width: 48, textAlign: 'right' }}
                                                          />
                                                        : <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{qty}</span>
                                                    }
                                                </td>
                                                <td>
                                                    {isManual
                                                        ? item.unit_of_measure
                                                            ? <span style={extractedCellStyle}>{item.unit_of_measure}</span>
                                                            : <select
                                                                value={item.unit_of_measure || ''}
                                                                onChange={e => updateItem(idx, 'unit_of_measure', e.target.value)}
                                                                style={{ ...needsInputStyle, width: 68 }}
                                                              >
                                                                <option value="">UOM</option>
                                                                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                                              </select>
                                                        : item.unit_of_measure
                                                            ? <span style={extractedCellStyle}>{item.unit_of_measure}</span>
                                                            : <span style={{ fontSize: 11, color: 'var(--tx3)' }}>—</span>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {isManual
                                                        ? price > 0
                                                            ? <span style={extractedCellStyle}>{fmtI(price)}</span>
                                                            : <input
                                                                type="number"
                                                                value={price || ''}
                                                                onChange={e => updateItem(idx, 'item_price', Number(e.target.value))}
                                                                placeholder="0"
                                                                style={{ ...needsInputStyle, width: 85, textAlign: 'right' }}
                                                              />
                                                        : price > 0
                                                            ? <span style={extractedCellStyle}>{fmtI(price)}</span>
                                                            : <span style={{ fontSize: 11, color: 'var(--tx3)' }}>—</span>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>{fmtI(qty * price)}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {isManual
                                                        ? <input className="cell-num" type="number" value={gst} onChange={e => updateItem(idx, 'gst_percentage', Number(e.target.value))} style={{ width: 32, textAlign: 'center' }} />
                                                        : <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--tx2)' }}>{gst}%</span>
                                                    }
                                                </td>
                                                {!hideMasterMatch && <td style={{ minWidth: isManual ? 0 : 220 }}>
                                                    {isManual ? null : hasSugg ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                            <select
                                                                value={selMasterId}
                                                                onChange={e => selectMaster(idx, e.target.value)}
                                                                disabled={isNew}
                                                                style={{
                                                                    fontSize: 11, fontFamily: 'monospace', padding: '4px 8px',
                                                                    border: `0.5px solid ${isNew ? 'var(--gry-bd)' : 'var(--blu-bd)'}`,
                                                                    borderRadius: 5,
                                                                    background: isNew ? 'var(--gry-bg)' : 'var(--blu-bg)',
                                                                    color: isNew ? 'var(--gry-tx)' : 'var(--blu-tx)',
                                                                    outline: 'none', cursor: isNew ? 'default' : 'pointer',
                                                                    opacity: isNew ? 0.5 : 1, width: '100%',
                                                                }}
                                                            >
                                                                {item.suggestions.map((s: any) => {
                                                                    const mId = String(s.master_item_id)
                                                                    const m = masterItems.find((x: any) => String(x.id) === mId || String(x.hash_id) === mId)
                                                                    const lp = m ? Number(m.unit_rate ?? m.item_price ?? 0) : 0
                                                                    const delta = lp > 0 ? (price - lp) / lp * 100 : null
                                                                    const dStr = delta !== null ? (delta >= 0 ? `▲${Math.abs(Math.round(delta))}%` : `▼${Math.abs(Math.round(delta))}%`) : ''
                                                                    return (
                                                                        <option key={mId} value={mId}>
                                                                            {mId} — {(s.description || '').substring(0, 28)}{lp > 0 ? ` (${fmtI(lp)})` : ''} {dStr}
                                                                        </option>
                                                                    )
                                                                })}
                                                            </select>
                                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tx2)', cursor: 'pointer' }}>
                                                                    <input type="checkbox" checked={isNew} onChange={e => toggleCreateNew(idx, e.target.checked)} style={{ accentColor: 'var(--grn-bd)', width: 12, height: 12 }} />
                                                                    <span>Create New</span>
                                                                </label>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tx2)', cursor: isNew ? 'default' : 'pointer', opacity: isNew ? 0.4 : 1 }}>
                                                                    <input type="checkbox" checked={isReplace} onChange={e => toggleReplace(idx, e.target.checked)} disabled={isNew} style={{ accentColor: 'var(--amb-bd)', width: 12, height: 12 }} />
                                                                    <span>Replace Existing</span>
                                                                </label>
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--tx3)', padding: '2px 0' }}>
                                                                {isNew
                                                                    ? <span style={{ color: 'var(--grn-tx)', fontWeight: 600 }}><i className="ti ti-plus" style={{ fontSize: 10, marginRight: 2 }} />Will create new master item</span>
                                                                    : isReplace
                                                                        ? <span style={{ color: 'var(--amb-tx)', fontWeight: 600 }}><i className="ti ti-refresh" style={{ fontSize: 10, marginRight: 2 }} />Will update existing item&apos;s spec &amp; price</span>
                                                                        : <span style={{ color: 'var(--blu-tx)', fontWeight: 600 }}><i className="ti ti-link" style={{ fontSize: 10, marginRight: 2 }} />Using existing master item</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                            <div style={{ fontSize: 11, color: 'var(--amb-tx)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <i className="ti ti-search-off" style={{ fontSize: 12 }} />No match found
                                                            </div>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx2)', cursor: 'pointer' }}>
                                                                <input type="checkbox" checked={isNew && !isSkip} onChange={e => toggleCreateNew(idx, e.target.checked)} style={{ accentColor: 'var(--grn-bd)', width: 12, height: 12 }} />
                                                                <span style={{ color: 'var(--grn-tx)', fontWeight: 500 }}>Create New Master Item</span>
                                                            </label>
            
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
                                            <td colSpan={7} style={{ padding: '6px 8px', position: 'relative' }}>
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
                                        <td colSpan={6} className="match-tfoot" style={{ fontWeight: 600, color: 'var(--tx2)', textAlign: 'right' }}>Sub Total</td>
                                        <td className="match-tfoot" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtI(subtotal)}</td>
                                        <td colSpan={3} className="match-tfoot" />
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>CGST{cgstRate != null ? ` @ ${cgstRate}%` : ''}</td>
                                        <td className="match-tfoot" style={{ textAlign: 'right', color: cgstAmount != null ? 'var(--tx2)' : 'var(--tx3)' }}>{cgstAmount != null ? fmtI(cgstAmount) : '—'}</td>
                                        <td colSpan={3} className="match-tfoot" />
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>SGST{sgstRate != null ? ` @ ${sgstRate}%` : ''}</td>
                                        <td className="match-tfoot" style={{ textAlign: 'right', color: sgstAmount != null ? 'var(--tx2)' : 'var(--tx3)' }}>{sgstAmount != null ? fmtI(sgstAmount) : '—'}</td>
                                        <td colSpan={3} className="match-tfoot" />
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>IGST{igstRate != null ? ` @ ${igstRate}%` : ''}</td>
                                        <td className="match-tfoot" style={{ textAlign: 'right', color: igst > 0 ? 'var(--tx2)' : 'var(--tx3)' }}>{igst > 0 ? fmtI(igst) : '—'}</td>
                                        <td colSpan={3} className="match-tfoot" />
                                    </tr>
                                    <tr style={{ background: 'var(--bg-t)' }}>
                                        <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', borderTop: '0.5px solid var(--bdm)' }}>Grand Total (incl. GST)</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)' }}>{fmtI(grandTotal)}</td>
                                        <td colSpan={3} style={{ borderTop: '0.5px solid var(--bdm)' }} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {!addRowActive && (
                            <button
                                onClick={() => setAddRowActive(true)}
                                style={{ marginTop: 10, padding: '5px 10px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tx)' }}
                            >
                                <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add Row
                            </button>
                        )}
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
                                <span style={{ fontSize: 12, color: tx, fontWeight: 500 }}><i className={`ti ${icon}`} style={{ marginRight: 4 }} />{label}</span>
                                <span style={{ fontSize: 15, fontWeight: 700, color: tx }}>{count}</span>
                            </div>
                        ))}

                    </div>
                </div>
                <div className="card">
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-info-circle" /> Action Guide</div>
                    </div>
                    <div className="card-body" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 2 }}>
                        <div><span className="tag t-match" style={{ fontSize: 10, marginRight: 5 }}>Match</span>Link to an existing master item</div>
                        <div><span className="tag t-new" style={{ fontSize: 10, marginRight: 5 }}>New</span>Create a new master item</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
