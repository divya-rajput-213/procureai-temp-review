'use client'

import { useState, useEffect } from 'react'

type LineItem = {
  id: number
  name: string
  code: string
  uom: string
  hasMatch: boolean
  action: 'approve' | 'create' | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { file: File; lineItems: LineItem[] }) => void
}

const VENDORS = [
  { id: 1, name: 'ABC Pvt Ltd', contact: 'abc@vendor.com', gstin: '29AABCU9603R1ZX' },
  { id: 2, name: 'XYZ Industries', contact: 'info@xyz.com', gstin: '27AAPFU0939F1ZV' },
  { id: 3, name: 'Global Supplies', contact: 'hello@global.com', gstin: '06AAHCG3683D1ZR' },
]

const INITIAL_LINE_ITEMS: LineItem[] = [
  { id: 1, name: 'Bolt M10', code: 'BOLT-M10-HT', uom: 'EA', hasMatch: true, action: null },
  { id: 2, name: 'Cable 2.5mm', code: 'CABLE-3C-2.5', uom: 'MTR', hasMatch: true, action: null },
  { id: 3, name: 'Safety Helmet', code: 'No code', uom: '—', hasMatch: false, action: null },
]

const STEP_SUBTITLES = [
  'Step 1 of 3 — Attach file',
  'Step 2 of 3 — Review vendors',
  'Step 3 of 3 — Verify line items',
]

const PROGRESS = ['33%', '66%', '100%']

function VendorInitials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: '#111', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 600, flexShrink: 0, letterSpacing: 0.5,
    }}>
      {initials.toUpperCase()}
    </div>
  )
}

export default function UploadQuotationModal({ isOpen, onClose, onSave }: Props) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(INITIAL_LINE_ITEMS)

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFile(null)
      setLineItems(INITIAL_LINE_ITEMS)
      const input = document.getElementById('quotation-file') as HTMLInputElement
      if (input) input.value = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFile(null)
    const input = document.getElementById('quotation-file') as HTMLInputElement
    if (input) input.value = ''
  }

  const setAction = (id: number, action: 'approve' | 'create') => {
    setLineItems(prev =>
      prev.map(item => (item.id === id ? { ...item, action } : item))
    )
  }

  const handleSave = () => {
    if (file) onSave({ file, lineItems })
  }

  const goNext = () => setStep(s => Math.min(s + 1, 3))
  const goBack = () => setStep(s => Math.max(s - 1, 1))

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={styles.title}>Upload quotation</h2>
              <p style={styles.subtitle}>{STEP_SUBTITLES[step - 1]}</p>
            </div>
            <button onClick={onClose} style={styles.closeBtn}>×</button>
          </div>

          {/* Stepper */}
          <div style={styles.stepper}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 3 ? 1 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    ...styles.stepDot,
                    background: s <= step ? '#111' : '#fff',
                    color: s <= step ? '#fff' : '#ccc',
                    border: s > step ? '1px solid #ddd' : 'none',
                  }}>
                    {s < step ? (
                      <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    ) : s}
                  </div>
                  <span style={{
                    fontSize: 14,
                    whiteSpace: 'nowrap' as const,
                    color: s === step ? '#111' : s < step ? '#555' : '#ccc',
                    fontWeight: s === step ? 600 : 400,
                  }}>
                    {s === 1 ? 'Upload' : s === 2 ? 'Vendors' : 'Items'}
                  </span>
                </div>
                {s < 3 && (
                  <div style={{
                    flex: 1, height: 1,
                    background: s < step ? '#111' : '#e5e5e5',
                    margin: '0 14px',
                  }} />
                )}
              </div>
            ))}
          </div>

          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: PROGRESS[step - 1] }} />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={styles.body}>

          {/* Step 1 — Upload */}
          {step === 1 && (
            <div
              style={{ ...styles.dropZone, ...(file ? styles.dropZoneActive : {}) }}
              onClick={() => document.getElementById('quotation-file')?.click()}
            >
              <div style={styles.uploadIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111', marginTop: 4 }}>
                {file ? 'File attached' : 'Drop your file here or click to browse'}
              </p>
              <p style={{ fontSize: 14, color: '#888' }}>Supports PDF, Excel, CSV — up to 25 MB</p>
              {file && (
                <div style={styles.fileChip} onClick={e => e.stopPropagation()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: 14, color: '#111', fontWeight: 500 }}>{file.name}</span>
                  <button onClick={removeFile} style={styles.removeBtn}>×</button>
                </div>
              )}
              <input
                id="quotation-file"
                type="file"
                accept=".pdf,.xls,.xlsx,.csv"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
            </div>
          )}

          {/* Step 2 — Vendors */}
          {step === 2 && (
            <div>
              <div style={styles.infoNote}>
                <div style={styles.infoDot} />
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
                  The following vendors were extracted from the uploaded quotation and will be created automatically.
                </p>
              </div>
              <p style={styles.sectionLabel}>{VENDORS.length} vendors detected</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {VENDORS.map(v => (
                  <div key={v.id} style={styles.vendorCard}>
                    <VendorInitials name={v.name} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 5 }}>{v.name}</p>
                      <div style={{ display: 'flex', gap: 24 }}>
                        <span style={{ fontSize: 13, color: '#666' }}>
                          <span style={{ color: '#aaa', marginRight: 5 }}>Email</span>
                          {v.contact}
                        </span>
                        <span style={{ fontSize: 13, color: '#666' }}>
                          <span style={{ color: '#aaa', marginRight: 5 }}>GSTIN</span>
                          {v.gstin}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Line Items */}
          {step === 3 && (
            <div>
              <div style={styles.infoNote}>
                <div style={styles.infoDot} />
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
                  Review each line item. Approve to use the matched master item, or create a new one. Items without a match require no action.
                </p>
              </div>

              {/* Row-based layout instead of table */}
              <div style={{ border: '0.5px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 220px',
                  background: '#fafafa',
                  borderBottom: '0.5px solid #eee',
                  padding: '10px 16px',
                }}>
                  {['Quotation item', 'Match', 'Action'].map(h => (
                    <span key={h} style={{
                      fontSize: 12, fontWeight: 600, color: '#999',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</span>
                  ))}
                </div>

                {/* Item rows */}
                {lineItems.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 140px 220px',
                      alignItems: 'center',
                      padding: '14px 16px',
                      borderBottom: idx === lineItems.length - 1 ? 'none' : '0.5px solid #f0f0f0',
                      background: '#fff',
                    }}
                  >
                    {/* Item name + code */}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15, color: '#111', margin: 0 }}>{item.name}</p>
                      <p style={{ fontSize: 13, color: '#888', marginTop: 3, marginBottom: 0 }}>{item.code} · {item.uom}</p>
                    </div>

                    {/* Match badge */}
                    <div>
                      {item.hasMatch ? (
                        <span style={{ ...styles.matchBadge, background: '#e8f5e9', color: '#2e7d32' }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                          Matched
                        </span>
                      ) : (
                        <span style={{ ...styles.matchBadge, background: '#fdecea', color: '#c62828' }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="3" y1="3" x2="9" y2="9" /><line x1="9" y1="3" x2="3" y2="9" />
                          </svg>
                          No match
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div>
                      {item.hasMatch ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setAction(item.id, 'approve')}
                            style={{
                              ...styles.actionBtn,
                              ...(item.action === 'approve' ? styles.actionBtnFilled : {}),
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setAction(item.id, 'create')}
                            style={{
                              ...styles.actionBtn,
                              ...(item.action === 'create' ? styles.actionBtnFilled : {}),
                            }}
                          >
                            Create new
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: '#ccc' }}>No action needed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={styles.footer}>
          <div>
            {step > 1 && (
              <button onClick={goBack} style={styles.btnBack}>← Back</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={styles.btnGhost}>Cancel</button>
            {step < 3 ? (
              <button
                onClick={goNext}
                disabled={step === 1 && !file}
                style={{
                  ...styles.btnPrimary,
                  opacity: step === 1 && !file ? 0.3 : 1,
                  cursor: step === 1 && !file ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            ) : (
              <button onClick={handleSave} style={styles.btnPrimary}>
                Save quotation
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    border: '0.5px solid #e5e5e5',
    width: '100%',
    maxWidth: 780,
    boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
  },
  header: { padding: '28px 32px 0' },
  title: { fontSize: 20, fontWeight: 600, color: '#111', margin: 0 },
  subtitle: { fontSize: 14, color: '#999', marginTop: 4 },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#bbb', fontSize: 22, lineHeight: 1, padding: 0,
  },
  stepper: { display: 'flex', alignItems: 'center', marginTop: 24, marginBottom: 4 },
  stepDot: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 600, flexShrink: 0, transition: 'all 0.2s',
  },
  progressBar: { height: 2, background: '#f0f0f0', marginTop: 18 },
  progressFill: { height: '100%', background: '#111', transition: 'width 0.35s ease' },
  body: { padding: '24px 32px' },
  footer: {
    padding: '18px 32px 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderTop: '0.5px solid #f0f0f0',
  },
  dropZone: {
    border: '1.5px dashed #ddd', borderRadius: 14,
    padding: '52px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    cursor: 'pointer', transition: 'all 0.2s',
    background: '#fafafa',
  },
  dropZoneActive: {
    borderColor: '#111', borderStyle: 'solid', background: '#f5f5f5',
  },
  uploadIcon: {
    width: 52, height: 52, borderRadius: 12,
    background: '#fff', border: '0.5px solid #e5e5e5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fileChip: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1px solid #111',
    borderRadius: 8, padding: '8px 14px', marginTop: 6,
  },
  removeBtn: {
    background: 'none', border: 'none', color: '#111',
    cursor: 'pointer', fontSize: 18, lineHeight: 1,
    padding: '0 0 0 6px', opacity: 0.4,
  },
  infoNote: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#f7f7f7', borderRadius: 10,
    padding: '12px 14px', marginBottom: 20,
  },
  infoDot: { width: 7, height: 7, borderRadius: '50%', background: '#111', flexShrink: 0, marginTop: 5 },
  sectionLabel: {
    fontSize: 12, fontWeight: 600, color: '#aaa',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
  },
  vendorCard: {
    background: '#fafafa', border: '0.5px solid #e8e8e8',
    borderRadius: 12, padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: 16,
  },
  matchBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 500,
  },
  actionBtn: {
    padding: '7px 14px', fontSize: 13, fontWeight: 500,
    borderRadius: 8, border: '0.5px solid #ddd',
    background: '#fff', color: '#111', cursor: 'pointer', transition: 'all 0.15s',
  },
  actionBtnFilled: {
    background: '#111', color: '#fff', borderColor: '#111',
  },
  btnBack: {
    padding: '9px 20px', fontSize: 14, fontWeight: 500,
    borderRadius: 8, border: '0.5px solid #ddd',
    background: '#fafafa', color: '#111', cursor: 'pointer',
  },
  btnGhost: {
    padding: '9px 20px', fontSize: 14, fontWeight: 500,
    borderRadius: 8, border: '0.5px solid #ddd',
    background: 'transparent', color: '#999', cursor: 'pointer',
  },
  btnPrimary: {
    padding: '9px 20px', fontSize: 14, fontWeight: 600,
    borderRadius: 8, border: 'none',
    background: '#111', color: '#fff',
  },
}