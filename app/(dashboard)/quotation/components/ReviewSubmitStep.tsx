'use client'

import React, { useState } from 'react'

interface ReviewSubmitStepProps {
    quotation: any
    lineItems: any[]
    vendors: any
    plants?: any[]
    plantId?: string
    PRs?: any[]
    prLinkId?: string
    setPrLinkId?: (v: string) => void
    internalNotes?: string
    setInternalNotes?: (v: string) => void
    discount?: number
}

const fmtI = (v: number) => '₹' + (isNaN(v) ? 0 : Math.round(v)).toLocaleString('en-IN')

const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return String(d) }
}

export default function ReviewSubmitStep({
    quotation,
    lineItems,
    vendors,
    plants = [],
    plantId = '',
    PRs = [],
    prLinkId = '',
    setPrLinkId,
    internalNotes = '',
    setInternalNotes,
    discount = 0,
}: ReviewSubmitStepProps) {
    const [prEnabled, setPrEnabled] = useState(!!prLinkId)
    const [prTab, setPrTab] = useState<'exist' | 'new'>('exist')
    const [prSearch, setPrSearch] = useState('')

    const getAction = (item: any) => {
        if (item.skipItem) return 'skip'
        if (item.createNew || item.is_new) return 'new'
        if (item.replaceExisting) return 'replace'
        if (item.selectedMasterId) return 'match'
        return 'pending'
    }

    const matched = lineItems.filter(i => getAction(i) === 'match').length
    const newCount = lineItems.filter(i => getAction(i) === 'new').length
    const replaced = lineItems.filter(i => getAction(i) === 'replace').length
    const skipped = lineItems.filter(i => getAction(i) === 'skip').length
    const pending = lineItems.filter(i => getAction(i) === 'pending').length
    const allActioned = lineItems.length > 0 && pending === 0

    const subtotal = lineItems.filter(i => !i.skipItem).reduce((a, it) => a + Number(it.item_price || 0) * Number(it.quantity || 1), 0)
    const discAmt = subtotal * discount / 100
    const taxable = subtotal - discAmt
    const gstRate = (vendors?.gst_percentage ?? 18) / 100
    const igst = taxable * gstRate
    const grandTotal = taxable + igst

    const plantName = plants.find((p: any) => String(p.id) === String(plantId))?.name || plantId || '—'

    const filteredPRs = PRs.filter((pr: any) =>
        !prSearch ||
        String(pr.id).includes(prSearch) ||
        (pr.title || pr.description || '').toLowerCase().includes(prSearch.toLowerCase())
    )
    const selectedPR = PRs.find((pr: any) => String(pr.id) === String(prLinkId)) || null

    const warnings: string[] = []
    if (pending > 0) warnings.push(`${pending} item${pending > 1 ? 's' : ''} still need an action`)
    if (!vendors?.company_name) warnings.push('Vendor details incomplete')

    const tagClass = (action: string) => {
        if (action === 'new') return 'tag t-new'
        if (action === 'match') return 'tag t-match'
        if (action === 'replace') return 'tag t-replace'
        return 'tag t-skip'
    }
    const tagLabel = (action: string) => {
        if (action === 'new') return 'New'
        if (action === 'match') return 'Match'
        if (action === 'replace') return 'Replace'
        if (action === 'skip') return 'Skip'
        return 'Pending'
    }

    const tabBtn = (active: boolean) => ({
        padding: '5px 10px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)',
        background: active ? '#1a1a18' : 'var(--bg-s)', color: active ? '#fff' : 'var(--tx)',
        fontSize: 12, cursor: 'pointer' as const, display: 'inline-flex' as const, alignItems: 'center' as const, gap: 6, fontFamily: 'inherit',
    })

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

            {/* ── LEFT MAIN ── */}
            <div>

                {/* Summary Hero */}
                <div className="review-hero" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.3px' }}>
                                {vendors?.company_name || 'New Quotation'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 3 }}>
                                {vendors?.quotation_no ? `Quote No. ${vendors.quotation_no}` : 'Draft quotation'}
                            </div>
                        </div>
                        <span className="pill p-draft"><span className="dot" />Draft</span>
                    </div>
                    <div className="rh-meta">
                        <div className="rhm-item">
                            <div className="rhm-lbl">Vendor</div>
                            <div className="rhm-val">{vendors?.company_name || '—'}</div>
                        </div>
                        <div className="rhm-item">
                            <div className="rhm-lbl">Quote No.</div>
                            <div className="rhm-val" style={{ fontFamily: 'monospace', fontSize: 12 }}>{vendors?.quotation_no || '—'}</div>
                        </div>
                        <div className="rhm-item">
                            <div className="rhm-lbl">Quote Date</div>
                            <div className="rhm-val">{fmtDate(vendors?.quotation_date)}</div>
                        </div>
                        <div className="rhm-item">
                            <div className="rhm-lbl">Valid Until</div>
                            <div className="rhm-val">{fmtDate(vendors?.valid_until)}</div>
                        </div>
                        <div className="rhm-item">
                            <div className="rhm-lbl">Plant</div>
                            <div className="rhm-val">{plantName}</div>
                        </div>
                        <div className="rhm-item">
                            <div className="rhm-lbl">Grand Total</div>
                            <div className="rhm-val" style={{ color: 'var(--tel-tx)', fontWeight: 700, fontSize: 15 }}>{fmtI(grandTotal)}</div>
                        </div>
                    </div>
                </div>

                {/* Item count stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                    <div className="stat-mini"><div className="sm-lbl">Line Items</div><div className="sm-val">{lineItems.length}</div></div>
                    <div className="stat-mini"><div className="sm-lbl">Matched</div><div className="sm-val" style={{ color: 'var(--blu-tx)' }}>{matched}</div></div>
                    <div className="stat-mini"><div className="sm-lbl">New Items</div><div className="sm-val" style={{ color: 'var(--grn-tx)' }}>{newCount}</div></div>
                    <div className="stat-mini"><div className="sm-lbl">Skipped</div><div className="sm-val" style={{ color: 'var(--gry-tx)' }}>{skipped}</div></div>
                </div>

                {/* Final items table */}
                <div className="form-sec" style={{ marginBottom: 16 }}>
                    <div className="card-head" style={{ padding: '11px 16px' }}>
                        <div className="card-title"><i className="ti ti-table" />Final Line Items</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="match-tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 28 }}>#</th>
                                    <th>Item Description</th>
                                    <th style={{ width: 90 }}>HSN</th>
                                    <th style={{ width: 80 }}>Action</th>
                                    <th style={{ textAlign: 'right', width: 70 }}>Qty</th>
                                    <th style={{ textAlign: 'right', width: 100 }}>Unit Price</th>
                                    <th style={{ textAlign: 'right', width: 100 }}>Total</th>
                                    <th style={{ textAlign: 'center', width: 55 }}>GST</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item, idx) => {
                                    const action = getAction(item)
                                    const isSkip = action === 'skip'
                                    const qty = Number(item.quantity || 1)
                                    const price = Number(item.item_price || 0)
                                    const total = isSkip ? 0 : qty * price
                                    return (
                                        <tr key={idx} style={{ opacity: isSkip ? 0.5 : 1 }}>
                                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--tx3)' }}>{String(idx + 1).padStart(2, '0')}</td>
                                            <td>
                                                <div style={{ fontWeight: 500, fontSize: 13 }}>{item.item_name || '—'}</div>
                                                {item.item_code && <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{item.item_code}</div>}
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--tx2)', fontFamily: 'monospace' }}>{item.hsn_code || '—'}</td>
                                            <td><span className={tagClass(action)}>{tagLabel(action)}</span></td>
                                            <td style={{ textAlign: 'right', fontSize: 13 }}>
                                                {qty} <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{item.unit_of_measure || item.uom || ''}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: 13 }}>{fmtI(price)}</td>
                                            <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                                                {isSkip ? <span style={{ color: 'var(--tx3)' }}>—</span> : fmtI(total)}
                                            </td>
                                            <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--tx3)' }}>{item.gst_percentage ?? 18}%</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6} className="match-tfoot" style={{ fontWeight: 600, color: 'var(--tx2)', textAlign: 'right' }}>Sub Total</td>
                                    <td className="match-tfoot" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtI(subtotal)}</td>
                                    <td className="match-tfoot" />
                                </tr>
                                <tr>
                                    <td colSpan={6} className="match-tfoot" style={{ color: 'var(--tx3)', textAlign: 'right' }}>Discount</td>
                                    <td className="match-tfoot" style={{ textAlign: 'right', color: 'var(--red-tx)', fontWeight: 600 }}>
                                        {discAmt > 0 ? `− ${fmtI(discAmt)}` : '—'}
                                    </td>
                                    <td className="match-tfoot" />
                                </tr>
                                <tr>
                                    <td colSpan={6} className="match-tfoot" style={{ fontWeight: 600, color: 'var(--tx2)', textAlign: 'right' }}>Taxable Value</td>
                                    <td className="match-tfoot" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtI(taxable)}</td>
                                    <td className="match-tfoot" />
                                </tr>
                                <tr>
                                    <td colSpan={6} className="match-tfoot" style={{ color: 'var(--tx3)', textAlign: 'right' }}>IGST @ {vendors?.gst_percentage ?? 18}%</td>
                                    <td className="match-tfoot" style={{ textAlign: 'right', color: 'var(--tx3)' }}>{fmtI(igst)}</td>
                                    <td className="match-tfoot" />
                                </tr>
                                <tr style={{ background: 'var(--bg-t)' }}>
                                    <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', borderTop: '0.5px solid var(--bdm)' }}>
                                        Grand Total (incl. GST)
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--tel-tx)', borderTop: '0.5px solid var(--bdm)' }}>
                                        {fmtI(grandTotal)}
                                    </td>
                                    <td style={{ borderTop: '0.5px solid var(--bdm)' }} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Link to PR */}
                <div className="form-sec" style={{ marginBottom: 16 }}>
                    <div className="form-sec-head">
                        <div className="fsh-ic" style={{ background: 'var(--blu-bg)', color: 'var(--blu-tx)' }}>
                            <i className="ti ti-file-plus" />
                        </div>
                        <div>
                            <div className="fsh-title">
                                Link to Purchase Request{' '}
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--tx3)', marginLeft: 6 }}>Optional</span>
                            </div>
                            <div className="fsh-sub">Attach this quotation to an existing PR or create a new one</div>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--tx2)' }}>
                                <input
                                    type="checkbox"
                                    checked={prEnabled}
                                    onChange={e => { setPrEnabled(e.target.checked); if (!e.target.checked && setPrLinkId) setPrLinkId('') }}
                                    style={{ accentColor: '#1a1a18', width: 13, height: 13 }}
                                />
                                Enable PR link
                            </label>
                        </div>
                    </div>

                    {prEnabled && (
                        <div style={{ padding: 16, borderTop: '0.5px solid var(--bd)' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <button style={tabBtn(prTab === 'exist')} onClick={() => setPrTab('exist')}>
                                    <i className="ti ti-link" style={{ fontSize: 12 }} /> Link to Existing PR
                                </button>
                                <button style={tabBtn(prTab === 'new')} onClick={() => setPrTab('new')}>
                                    <i className="ti ti-plus" style={{ fontSize: 12 }} /> Create New PR
                                </button>
                            </div>

                            {prTab === 'exist' && (
                                <div>
                                    {!selectedPR ? (
                                        <>
                                            <div style={{ position: 'relative', marginBottom: 10 }}>
                                                <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', fontSize: 14, pointerEvents: 'none' }} />
                                                <input
                                                    className="inp"
                                                    style={{ paddingLeft: 32 }}
                                                    placeholder="Search by PR number or description…"
                                                    value={prSearch}
                                                    onChange={e => setPrSearch(e.target.value)}
                                                />
                                            </div>
                                            {filteredPRs.length === 0 && (
                                                <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '8px 0' }}>No matching PRs found</div>
                                            )}
                                            {filteredPRs.slice(0, 5).map((pr: any) => (
                                                <div
                                                    key={pr.id}
                                                    onClick={() => setPrLinkId && setPrLinkId(String(pr.id))}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '0.5px solid var(--bd)', borderRadius: 'var(--r)', marginBottom: 6, cursor: 'pointer', transition: 'background .1s' }}
                                                    onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-s)')}
                                                    onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = '')}
                                                >
                                                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--blu-bg)', color: 'var(--blu-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                                                        <i className="ti ti-file-plus" />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{pr.title || pr.description || `PR #${pr.id}`}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                                                            {pr.pr_number || `PR-${pr.id}`}
                                                            {pr.plant ? ` · ${pr.plant}` : ''}
                                                        </div>
                                                    </div>
                                                    <span className="pill" style={{ background: 'var(--amb-bg)', color: 'var(--amb-tx)', fontSize: 10 }}>
                                                        <span className="dot" style={{ background: 'var(--amb-bd)' }} />Open
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <div style={{ border: '0.5px solid var(--grn-bd)', borderRadius: 'var(--r)', padding: '10px 14px', background: 'var(--grn-bg)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <i className="ti ti-circle-check" style={{ color: 'var(--grn-tx)', fontSize: 16, flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--grn-tx)' }}>
                                                    {selectedPR.title || selectedPR.description || `PR #${selectedPR.id}`}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--grn-tx)', opacity: 0.8 }}>
                                                    {selectedPR.pr_number || `PR-${selectedPR.id}`}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setPrLinkId && setPrLinkId('')}
                                                style={{ padding: '3px 8px', borderRadius: 'var(--r)', border: '0.5px solid var(--bdm)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center' }}
                                            >
                                                <i className="ti ti-x" style={{ fontSize: 11 }} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {prTab === 'new' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="fgrp" style={{ gridColumn: '1/-1' }}>
                                        <label className="lbl">PR Title <span className="req">*</span></label>
                                        <input className="inp" placeholder="e.g. IT Infrastructure Expansion Q2 2026" />
                                    </div>
                                    <div className="fgrp">
                                        <label className="lbl">Department</label>
                                        <input className="inp" placeholder="e.g. IT &amp; Technology" />
                                    </div>
                                    <div className="fgrp">
                                        <label className="lbl">Budget Code</label>
                                        <input className="inp" placeholder="e.g. CAPEX-IT-2026" />
                                    </div>
                                    <div className="fgrp">
                                        <label className="lbl">Required By</label>
                                        <input className="inp" type="date" />
                                    </div>
                                    <div className="fgrp">
                                        <label className="lbl">Cost Centre</label>
                                        <input className="inp" placeholder="e.g. CC-2031" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Terms & Conditions */}
                <div className="form-sec" style={{ marginBottom: 16 }}>
                    <div className="form-sec-head">
                        <div className="fsh-ic" style={{ background: 'var(--gry-bg)', color: 'var(--gry-tx)' }}>
                            <i className="ti ti-file-description" />
                        </div>
                        <div>
                            <div className="fsh-title">Terms &amp; Conditions</div>
                            <div className="fsh-sub">From vendor&apos;s quotation document</div>
                        </div>
                    </div>
                    <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {(() => {
                            const terms: string[] = vendors?.terms_and_conditions ?? []
                            if (terms.length === 0) {
                                return (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px 0', color: 'var(--tx3)', fontSize: 12 }}>
                                        <i className="ti ti-file-off" style={{ fontSize: 22, display: 'block', marginBottom: 6 }} />
                                        No terms &amp; conditions provided
                                    </div>
                                )
                            }
                            return terms.map((term, i) => (
                                <div key={i} style={{ background: 'var(--bg-s)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>
                                        Term {i + 1}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                                        {String(term).replace(/^\d+[).]\s*/, '').trim()}
                                    </div>
                                </div>
                            ))
                        })()}
                    </div>
                </div>

                {/* Internal Notes */}
                <div className="form-sec">
                    <div className="form-sec-head">
                        <div className="fsh-ic" style={{ background: 'var(--pur-bg)', color: 'var(--pur-tx)' }}>
                            <i className="ti ti-notes" />
                        </div>
                        <div>
                            <div className="fsh-title">Internal Notes</div>
                            <div className="fsh-sub">Optional notes for the procurement team</div>
                        </div>
                    </div>
                    <div className="form-body">
                        <div className="fgrp">
                            <label className="lbl">Notes</label>
                            <textarea
                                className="textarea"
                                value={internalNotes}
                                onChange={e => setInternalNotes && setInternalNotes(e.target.value)}
                                placeholder="Negotiation outcome, special considerations, follow-up actions…"
                            />
                        </div>
                    </div>
                </div>

            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div>
                {/* Checklist */}
                <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-clipboard-check" />Checklist</div>
                    </div>
                    <div>
                        <div className="ci ci-ok">
                            <i className="ti ti-circle-check" style={{ fontSize: 14 }} /><span>Document uploaded</span>
                        </div>
                        <div className={`ci ${vendors?.company_name ? 'ci-ok' : 'ci-idle'}`}>
                            <i className={`ti ${vendors?.company_name ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize: 14 }} />
                            <span>Vendor &amp; quote number</span>
                        </div>
                        <div className={`ci ${lineItems.length > 0 ? 'ci-ok' : 'ci-idle'}`}>
                            <i className={`ti ${lineItems.length > 0 ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize: 14 }} />
                            <span>Items extracted</span>
                        </div>
                        <div className={`ci ${allActioned ? 'ci-ok' : 'ci-idle'}`}>
                            <i className={`ti ${allActioned ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize: 14 }} />
                            <span>All items actioned</span>
                        </div>
                        <div className="ci ci-idle">
                            <i className="ti ti-circle" style={{ fontSize: 14 }} /><span>PR link (optional)</span>
                        </div>
                    </div>
                </div>

                {/* On Submit */}
                <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-history" />On Submit</div>
                    </div>
                    <div className="card-body" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.9 }}>
                        <div>1. System QT number assigned</div>
                        {newCount > 0 && <div>2. {newCount} new master item{newCount > 1 ? 's' : ''} created</div>}
                        {replaced > 0 && <div>{newCount > 0 ? '3' : '2'}. {replaced} replacement{replaced > 1 ? 's' : ''} versioned</div>}
                        <div>{newCount > 0 && replaced > 0 ? '4' : newCount > 0 || replaced > 0 ? '3' : '2'}. Saved as Draft</div>
                    </div>
                </div>

                {/* Warnings */}
                <div className="card">
                    <div className="card-head">
                        <div className="card-title"><i className="ti ti-alert-triangle" />Warnings</div>
                    </div>
                    <div style={{ padding: '12px 14px', fontSize: 12, color: warnings.length ? 'var(--amb-tx)' : 'var(--tx3)' }}>
                        {warnings.length === 0
                            ? 'No warnings — ready to submit!'
                            : warnings.map((w, i) => <div key={i} style={{ marginBottom: 4 }}>⚠ {w}</div>)
                        }
                    </div>
                </div>
            </div>

        </div>
    )
}
