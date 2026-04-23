'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'

type LineItem = {
  id: number
  quotationId: number
  name: string
  code: string
  uom: string
  hasMatch: boolean
  masterItemId: number | null
  action: 'approve' | 'create' | null
  isConfirmed: boolean
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSave: () => void | Promise<void>
}

type ExtractedVendor = {
  id: string
  name: string
}

const STEP_SUBTITLES = [
  'Step 1 of 3 — Attach files',
  'Step 2 of 3 — Review vendors',
  'Step 3 of 3 — Verify line items',
]

const PROGRESS = ['33%', '66%', '100%']

function toNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getQuotationId(response: any): number | null {
  return (
    toNumber(response?.quotation_id) ??
    toNumber(response?.quotation?.id) ??
    toNumber(response?.id)
  )
}

function getMasterItemId(item: any): number | null {
  return (
    toNumber(item?.master_item_id) ??
    toNumber(item?.master_item?.id) ??
    toNumber(item?.matched_item_id) ??
    toNumber(item?.matched_item?.id) ??
    toNumber(item?.match?.id)
  )
}

function mapLineItemsFromQuotationResponse(response: any): LineItem[] {
  const quotationId = getQuotationId(response)
  if (!quotationId) return []

  const items = Array.isArray(response?.items) ? response.items : []

  return items
    .map((item: any, index: number) => {
      const itemId = toNumber(item?.id) ?? toNumber(item?.item_id)
      if (!itemId) return null

      const masterItemId = getMasterItemId(item)
      const hasMatch = Boolean(
        item?.has_match ??
        item?.matched ??
        item?.is_matched ??
        masterItemId ??
        item?.master_item ??
        item?.matched_item ??
        item?.match
      )

      const confirmedAction = item?.confirmed_action ?? item?.action_taken ?? item?.action

      return {
        id: itemId,
        quotationId,
        name: item?.item_name ?? item?.name ?? item?.description ?? `Item ${index + 1}`,
        code: item?.item_code ?? item?.code ?? 'No code',
        uom: item?.unit_of_measure ?? item?.uom ?? item?.unit ?? '—',
        hasMatch,
        masterItemId,
        action:
          confirmedAction === 'approve'
            ? 'approve'
            : confirmedAction === 'create' || confirmedAction === 'create new' || confirmedAction === 'create_new'
              ? 'create'
              : null,
        isConfirmed: Boolean(item?.is_confirmed ?? item?.confirmed_at ?? confirmedAction),
      }
    })
    .filter((item: LineItem | null): item is LineItem => item !== null)
}

function getLineItemKey(item: Pick<LineItem, 'quotationId' | 'id'>) {
  return `${item.quotationId}-${item.id}`
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

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
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [files, setFiles] = useState<File[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [vendors, setVendors] = useState<ExtractedVendor[]>([])
  const [pendingActionByItemKey, setPendingActionByItemKey] = useState<Record<string, 'approve' | 'create' | null>>({})

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const uploadedData: Array<{ upload: any; detail: any | null }> = []

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        const { data: upload } = await apiClient.post('/quotations/upload/', formData)

        const quotationId = getQuotationId(upload)
        const detail = quotationId
          ? (await apiClient.get(`/quotations/${quotationId}/`)).data
          : null

        uploadedData.push({ upload, detail })
      }

      return uploadedData
    },
    onSuccess: (responses: Array<{ upload: any; detail: any | null }>) => {
      const extractedVendors = responses.map(({ upload, detail }, index) => ({
        id: String(getQuotationId(upload) ?? getQuotationId(detail) ?? index + 1),
        name:
          upload?.vendor_name ??
          upload?.vendor?.name ??
          upload?.vendor?.company_name ??
          detail?.vendor_name ??
          detail?.vendor?.name ??
          detail?.vendor?.company_name ??
          `Vendor ${index + 1}`,
      }))
      const extractedLineItems = responses.flatMap(({ upload, detail }) =>
        mapLineItemsFromQuotationResponse(detail ?? upload)
      )

      setVendors(extractedVendors)
      setLineItems(extractedLineItems)
      setStep(2)
    },
    onError: (error: any) => {
      setErrorMessage(
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        'Failed to upload quotation.'
      )
    },
  })

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFiles([])
      setLineItems([])
      setDragging(false)
      setVendors([])
      setPendingActionByItemKey({})
      setErrorMessage('')
      const input = document.getElementById('quotation-file') as HTMLInputElement
      if (input) input.value = ''
    }
  }, [isOpen])

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const arr = Array.from(incoming)
    setErrorMessage('')
    setVendors([])
    setLineItems([])
    setPendingActionByItemKey({})
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name))
      const fresh = arr.filter(f => !existingNames.has(f.name))
      return [...prev, ...fresh]
    })
  }

  const removeFile = (name: string) => {
    setVendors([])
    setLineItems([])
    setPendingActionByItemKey({})
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const confirmItemMutation = useMutation({
    mutationFn: async ({ item, action }: { item: LineItem; action: 'approve' | 'create' }) => {
      const payload =
        action === 'approve'
          ? { action: 'approve', master_item_id: item.masterItemId }
          : { action: 'create_new' }

      await apiClient.patch(
        `/quotations/${item.quotationId}/items/${item.id}/confirm/`,
        payload
      )

      return { itemId: item.id, quotationId: item.quotationId, action }
    },
    onMutate: ({ item, action }) => {
      setPendingActionByItemKey(prev => ({ ...prev, [getLineItemKey(item)]: action }))
      setErrorMessage('')
    },
    onSuccess: ({ itemId, quotationId, action }) => {
      setLineItems(prev =>
        prev.map(item =>
          item.id === itemId && item.quotationId === quotationId
            ? { ...item, action, isConfirmed: true }
            : item
        )
      )
      toast({ title: action === 'approve' ? 'Item approved' : 'New item request saved' })
    },
    onError: (error: any, { action }) => {
      const detail =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        `Failed to ${action === 'approve' ? 'approve item' : 'create new item'}.`

      setErrorMessage(detail)
      toast({ title: 'Action failed', description: detail, variant: 'destructive' })
    },
    onSettled: (_data, _error, variables) => {
      setPendingActionByItemKey(prev => ({ ...prev, [getLineItemKey(variables.item)]: null }))
    },
  })

  const setAction = (item: LineItem, action: 'approve' | 'create') => {
    if (pendingActionByItemKey[getLineItemKey(item)]) return

    if (action === 'approve' && !item.masterItemId) {
      const detail = 'No matched master item was returned for this quotation item.'
      setErrorMessage(detail)
      toast({ title: 'Approve failed', description: detail, variant: 'destructive' })
      return
    }

    confirmItemMutation.mutate({ item, action })
  }

  const handleUploadAndExtract = () => {
    if (files.length > 0 && !uploadMutation.isPending) {
      setErrorMessage('')
      uploadMutation.mutate()
    }
  }

  const goNext = () => setStep(s => Math.min(s + 1, 3))
  const goBack = () => setStep(s => Math.max(s - 1, 1))

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isOpen) return null

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
          {errorMessage && (
            <div style={styles.errorText}>{errorMessage}</div>
          )}

          {/* Step 1 — Upload */}
          {step === 1 && (
            <div>
              {/* Drop zone */}
              <div
                style={{
                  ...styles.dropZone,
                  ...(dragging ? styles.dropZoneDragging : {}),
                  ...(files.length > 0 ? styles.dropZoneHasFiles : {}),
                }}
                onClick={() => document.getElementById('quotation-file')?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div style={styles.uploadIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#111', marginTop: 4 }}>
                  {dragging ? 'Drop files here' : 'Drop files here or click to browse'}
                </p>
                <p style={{ fontSize: 14, color: '#888' }}>
                  Supports PDF — up to 25 MB each
                </p>
                <p style={{ fontSize: 13, color: '#bbb' }}>You can select multiple files</p>
                <input
                  id="quotation-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => addFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={styles.sectionLabel}>{files.length} file{files.length > 1 ? 's' : ''} selected</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: files.length > 3 ? 196 : 'none', overflowY: files.length > 3 ? 'auto' : 'visible', paddingRight: files.length > 3 ? 4 : 0 }}>
                    {files.map(f => (
                      <div key={f.name} style={styles.fileRow}>
                        <div style={styles.fileRowIcon}>
                          <FileIcon />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </p>
                          <p style={{ fontSize: 12, color: '#aaa', margin: '2px 0 0' }}>{formatSize(f.size)}</p>
                        </div>
                        <button
                          onClick={() => removeFile(f.name)}
                          style={styles.fileRemoveBtn}
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="3" x2="9" y2="9" /><line x1="9" y1="3" x2="3" y2="9" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add more files button */}
                  <button
                    style={styles.addMoreBtn}
                    onClick={() => document.getElementById('quotation-file')?.click()}
                  >
                    + Add more files
                  </button>
                </div>
              )}
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
              <p style={styles.sectionLabel}>{vendors.length} vendor{vendors.length === 1 ? '' : 's'} detected</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendors.map(v => (
                  <div key={v.id} style={styles.vendorCard}>
                    <VendorInitials name={v.name} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 5 }}>{v.name}</p>
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

              <div style={{ border: '0.5px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
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

                {lineItems.length === 0 ? (
                  <div style={{ padding: '18px 16px', fontSize: 14, color: '#888' }}>
                    No line items were returned for verification.
                  </div>
                ) : (
                  lineItems.map((item, idx) => (
                    <div
                      key={getLineItemKey(item)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 140px 220px',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderBottom: idx === lineItems.length - 1 ? 'none' : '0.5px solid #f0f0f0',
                        background: item.hasMatch ? '#fff' : '#e8f5e9',
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 15, color: '#111', margin: 0 }}>{item.name}</p>
                        <p style={{ fontSize: 13, color: '#888', marginTop: 3, marginBottom: 0 }}>{item.code} · {item.uom}</p>
                      </div>

                      <div>
                        {item.hasMatch ? (
                          <span style={{ ...styles.matchBadge, background: '#e8f5e9', color: '#2e7d32' }}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                            Matched
                          </span>
                        ) : (
                          <span style={{ ...styles.matchBadge, background: '#fff6f6', color: '#111' }}>
                            New Item
                          </span>
                        )}
                      </div>

                      <div>
                        {item.hasMatch ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => setAction(item, 'approve')}
                              disabled={Boolean(pendingActionByItemKey[getLineItemKey(item)]) || item.isConfirmed}
                              style={{
                                ...styles.actionBtn,
                                ...(item.action === 'approve' ? styles.actionBtnFilled : {}),
                                ...((pendingActionByItemKey[getLineItemKey(item)] || item.isConfirmed) ? styles.actionBtnDisabled : {}),
                              }}
                            >
                              {pendingActionByItemKey[getLineItemKey(item)] === 'approve' ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => setAction(item, 'create')}
                              disabled={Boolean(pendingActionByItemKey[getLineItemKey(item)]) || item.isConfirmed}
                              style={{
                                ...styles.actionBtn,
                                ...(item.action === 'create' ? styles.actionBtnFilled : {}),
                                ...((pendingActionByItemKey[getLineItemKey(item)] || item.isConfirmed) ? styles.actionBtnDisabled : {}),
                              }}
                            >
                              {pendingActionByItemKey[getLineItemKey(item)] === 'create' ? 'Saving...' : 'Create new'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: '#ccc' }}>No action needed</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
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
                onClick={step === 1 ? handleUploadAndExtract : goNext}
                disabled={step === 1 && files.length === 0}
                style={{
                  ...styles.btnPrimary,
                  opacity: step === 1 && files.length === 0 ? 0.3 : 1,
                  cursor: step === 1 && files.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {step === 1 && uploadMutation.isPending ? 'Extracting...' : 'Next →'}
              </button>
            ) : (
              <button
                onClick={async () => {
                  await onSave()
                  onClose()
                }}
                disabled={uploadMutation.isPending}
                style={{
                  ...styles.btnPrimary,
                  opacity: uploadMutation.isPending ? 0.7 : 1,
                  cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
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
  errorText: {
    marginBottom: 12,
    color: '#b42318',
    fontSize: 13,
  },
  footer: {
    padding: '18px 32px 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderTop: '0.5px solid #f0f0f0',
  },
  dropZone: {
    border: '1.5px dashed #ddd', borderRadius: 14,
    padding: '40px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    cursor: 'pointer', transition: 'all 0.2s',
    background: '#fafafa',
  },
  dropZoneHasFiles: {
    padding: '24px',
    borderColor: '#ccc',
  },
  dropZoneDragging: {
    borderColor: '#111', borderStyle: 'solid', background: '#f5f5f5',
  },
  uploadIcon: {
    width: 52, height: 52, borderRadius: 12,
    background: '#fff', border: '0.5px solid #e5e5e5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12, fontWeight: 600, color: '#aaa',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
  },
  fileRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#fafafa', border: '0.5px solid #eee',
    borderRadius: 10, padding: '10px 14px',
  },
  fileRowIcon: {
    width: 34, height: 34, borderRadius: 8,
    background: '#fff', border: '0.5px solid #e5e5e5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  fileRemoveBtn: {
    background: 'none', border: 'none',
    color: '#bbb', cursor: 'pointer',
    padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
    transition: 'color 0.15s',
    flexShrink: 0,
  },
  addMoreBtn: {
    marginTop: 10,
    background: 'none', border: '0.5px solid #ddd',
    borderRadius: 8, padding: '7px 14px',
    fontSize: 13, fontWeight: 500, color: '#555',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  infoNote: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#f7f7f7', borderRadius: 10,
    padding: '12px 14px', marginBottom: 20,
  },
  infoDot: { width: 7, height: 7, borderRadius: '50%', background: '#111', flexShrink: 0, marginTop: 5 },
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
  actionBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
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
