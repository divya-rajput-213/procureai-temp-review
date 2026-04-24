'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { useToast } from '@/components/ui/use-toast'

type Suggestion = {
  master_item_id: number
  code: string
  description: string
  unit_of_measure: string
  unit_rate: number
  hsn_code?: string
  category?: string | null
}

type LineItem = {
  id: number
  quotationId: number
  name: string
  code: string
  uom: string
  hasMatch: boolean
  masterItemId: number | null
  suggestions: Suggestion[]
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
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  city?: string
  state?: string
  gstNumber?: string | null
  vendorCreated?: boolean
}

const STEP_SUBTITLES = [
  'Step 1 of 3 — Attach files',
  'Step 2 of 3 — Review vendors',
  'Step 3 of 3 — Verify line items',
]

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
      const itemId =
        toNumber(item?.quotation_item_id) ??
        toNumber(item?.id) ??
        toNumber(item?.item_id)
      if (!itemId) return null

      const suggestions: Suggestion[] = Array.isArray(item?.suggestions)
        ? item.suggestions
        : []

      const masterItemId =
        suggestions.length > 0
          ? toNumber(suggestions[0].master_item_id)
          : getMasterItemId(item)

      const hasMatch = Boolean(
        item?.master_item_matched ??
        item?.has_match ??
        item?.matched ??
        item?.is_matched ??
        suggestions.length > 0
      )

      const confirmedAction =
        item?.confirmed_action ?? item?.action_taken ?? item?.action

      return {
        id: itemId,
        quotationId,
        name:
          item?.item_name ?? item?.name ?? item?.description ?? `Item ${index + 1}`,
        code: item?.item_code ?? item?.code ?? 'No code',
        uom: item?.unit_of_measure ?? item?.uom ?? item?.unit ?? '—',
        hasMatch,
        masterItemId,
        suggestions,
        action:
          confirmedAction === 'approve'
            ? 'approve'
            : confirmedAction === 'create' ||
              confirmedAction === 'create new' ||
              confirmedAction === 'create_new'
              ? 'create'
              : null,
        isConfirmed: Boolean(
          item?.is_confirmed ?? item?.confirmed_at ?? confirmedAction
        ),
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
  const initials =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
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
  const [file, setFile] = useState<File | null>(null)
  const [quotation, setQuotation] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)

  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [vendors, setVendors] = useState<ExtractedVendor[]>([])
  const [pendingActionByItemKey, setPendingActionByItemKey] = useState<
    Record<string, 'approve' | 'create' | null>
  >({})
  const [selectedSuggIdxByKey, setSelectedSuggIdxByKey] = useState<
    Record<string, number>
  >({})

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please upload a file')
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post('/quotations/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data: any) => {
      setQuotation(data)

      const vendors = (data.vendor || []).map((v: any) => ({
        id: String(v.vendor_id),
        name: v.vendor_name,
        contactName: v.contact_name,
        contactEmail: v.contact_email,
        contactPhone: v.contact_phone,
        city: v.city,
        state: v.state,
        gstNumber: v.gst_number,
        vendorCreated: v.vendor_created,
      }))

      const mappedLineItems = mapLineItemsFromQuotationResponse(data)

      setVendors(vendors)
      setLineItems(mappedLineItems)
      setMeta({
        quotationId: data.quotation_id,
        refNo: data.ref_no,
        totalItems: data.total_items,
        matchedItems: data.matched_items,
      })
      setStep(2)
    },
    onError: (error: any) => {
      const data = error?.response?.data
      let message = 'Failed to upload quotation.'
      if (data) {
        if (typeof data === 'string') {
          message = data
        } else if (data.detail) {
          message = data.detail
        } else {
          message = Object.entries(data)
            .map(([key, value]) => {
              if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
              return `${key}: ${value}`
            })
            .join(' | ')
        }
      }
      setErrorMessage(message)
    },
  })

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFile(null)
      setLineItems([])
      setDragging(false)
      setVendors([])
      setPendingActionByItemKey({})
      setSelectedSuggIdxByKey({})
      setErrorMessage('')
      const input = document.getElementById('quotation-file') as HTMLInputElement
      if (input) input.value = ''
    }
  }, [isOpen])

  const addFile = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return
    const selectedFile = incoming[0]
    setErrorMessage('')
    setQuotation(null)
    setVendors([])
    setLineItems([])
    setPendingActionByItemKey({})
    setSelectedSuggIdxByKey({})
    setFile(selectedFile)
  }

  const removeFile = () => {
    setFile(null)
    setQuotation(null)
    setVendors([])
    setLineItems([])
    setPendingActionByItemKey({})
    setSelectedSuggIdxByKey({})
    setErrorMessage('')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFile(e.dataTransfer.files)
  }

  const confirmItemMutation = useMutation({
    mutationFn: async ({
      item,
      action,
    }: {
      item: LineItem
      action: 'approve' | 'create'
    }) => {
      const payload =
        action === 'approve'
          ? { action: 'approve', master_item_id: item.masterItemId }
          : { action: 'create_new', master_item_id: item.masterItemId }

      await apiClient.patch(
        `/quotations/${item.quotationId}/items/${item.id}/confirm/`,
        payload
      )

      return { itemId: item.id, quotationId: item.quotationId, action }
    },
    onMutate: ({ item, action }) => {
      setPendingActionByItemKey(prev => ({
        ...prev,
        [getLineItemKey(item)]: action,
      }))
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
      toast({
        title: action === 'approve' ? 'Item approved' : 'New item request saved',
      })
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
      setPendingActionByItemKey(prev => ({
        ...prev,
        [getLineItemKey(variables.item)]: null,
      }))
    },
  })

  const setAction = (item: LineItem, action: 'approve' | 'create') => {
    const key = getLineItemKey(item)
    if (pendingActionByItemKey[key]) return

    const selectedIdx = selectedSuggIdxByKey[key] ?? 0
    const selectedSugg = item.suggestions[selectedIdx] ?? null
    const masterItemId = selectedSugg
      ? toNumber(selectedSugg.master_item_id)
      : item.masterItemId

    if (action === 'approve' && !masterItemId) {
      const detail = 'No matched master item was returned for this quotation item.'
      setErrorMessage(detail)
      toast({ title: 'Approve failed', description: detail, variant: 'destructive' })
      return
    }

    confirmItemMutation.mutate({ item: { ...item, masterItemId }, action })
  }

  const handleUploadAndExtract = () => {
    if (!file || uploadMutation.isPending) return
    setErrorMessage('')
    // If we already have quotation data for this file (e.g. user went Back), skip the API call
    if (quotation) {
      setStep(2)
      return
    }
    uploadMutation.mutate()
  }

  const goNext = () => setStep(s => Math.min(s + 1, 3))
  const goBack = () => setStep(s => Math.max(s - 1, 1))

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isNotEmpty = (val?: string | null) =>
    val && val !== 'N/A' && val.trim() !== ''

  const isLoading = 
  uploadMutation.isPending ||
  confirmItemMutation.isPending
  if (!isOpen) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {isLoading && (
          <div style={styles.loaderOverlay}>
            <div style={styles.loaderBox}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111"
                strokeWidth="2"
                className="animate-spin"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                <path d="M22 12a10 10 0 0 1-10 10" />
              </svg>
              <p style={{ marginTop: 10, fontSize: 14, color: '#555' }}>
                Processing...
              </p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={styles.title}>Upload quotation</h2>
              <p style={styles.subtitle}>{STEP_SUBTITLES[step - 1]}</p>
            </div>
            <button onClick={() => {
              if (isLoading) return
              onClose()
            }} style={styles.closeBtn}>×</button>
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
        </div>

        {/* ── Body ── */}
        <div style={styles.body}>
          {errorMessage && (
            <div style={styles.errorText}>{errorMessage}</div>
          )}

          {/* Step 1 — Upload */}
          {step === 1 && (
            <div>
              {!file && (
                <div
                  style={{
                    ...styles.dropZone,
                    ...(dragging ? styles.dropZoneDragging : {}),
                  }}
                  onClick={() => document.getElementById('quotation-file')?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div style={styles.uploadIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>
                    {dragging ? 'Drop file here' : 'Drop file here or click to browse'}
                  </p>
                  <p style={{ fontSize: 14, color: '#888' }}>
                    Supports PDF — up to 25 MB
                  </p>
                  <input
                    id="quotation-file"
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={e => addFile(e.target.files)}
                  />
                </div>
              )}

              {file && (
                <div style={{ marginTop: 14 }}>
                  <p style={styles.sectionLabel}>Selected file</p>
                  <div style={styles.fileRow}>
                    <div style={styles.fileRowIcon}>
                      <FileIcon />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: '#aaa' }}>{formatSize(file.size)}</p>
                    </div>
                    <button onClick={removeFile} style={styles.fileRemoveBtn}>✕</button>
                  </div>
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
              <p style={styles.sectionLabel}>
                {vendors.length} vendor{vendors.length === 1 ? '' : 's'} detected
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendors.map(v => (
                  <div key={v.id} style={styles.vendorCard}>
                    <VendorInitials name={v.name} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>
                          {v.name}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 20px' }}>
                        {isNotEmpty(v.contactEmail) && (
                          <span style={styles.vendorDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                            {v.contactEmail}
                          </span>
                        )}
                        {isNotEmpty(v.contactPhone) && (
                          <span style={styles.vendorDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .9h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                            </svg>
                            {v.contactPhone}
                          </span>
                        )}
                        {isNotEmpty(v.city) && (
                          <span style={styles.vendorDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {v.city}{isNotEmpty(v.state) ? `, ${v.state}` : ''}
                          </span>
                        )}
                        {isNotEmpty(v.contactName) && (
                          <span style={styles.vendorDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            {v.contactName}
                          </span>
                        )}
                        {v.gstNumber && (
                          <span style={styles.vendorDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            GST: {v.gstNumber}
                          </span>
                        )}
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
                  Review each line item. Select a match from the dropdown, then approve it or create a new master item. Items with no suggestions require no action.
                </p>
              </div>

              <div style={{ border: '0.5px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 220px 120px 200px',
                  background: '#fafafa',
                  borderBottom: '0.5px solid #eee',
                  padding: '10px 20px',
                  gap: 16,
                }}>
                  {['Quotation item', 'Matches', 'Matched', 'Action'].map(h => (
                    <span key={h} style={{
                      fontSize: 12, fontWeight: 600, color: '#999',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {h}
                    </span>
                  ))}
                </div>

                {lineItems.length === 0 ? (
                  <div style={{ padding: '18px 16px', fontSize: 14, color: '#888' }}>
                    No line items were returned for verification.
                  </div>
                ) : (
                  <div style={{
                    maxHeight: lineItems.length > 3 ? 260 : 'auto',
                    overflowY: lineItems.length > 3 ? 'auto' : 'visible',
                    paddingRight: lineItems.length > 3 ? 6 : 0,
                  }}>
                    {lineItems.map((item, idx) => {
                      const key = getLineItemKey(item)
                      const suggestions = item.suggestions ?? []
                      const matchCount = suggestions.length
                      const isPending = Boolean(pendingActionByItemKey[key])
                      const selectedIdx = selectedSuggIdxByKey[key] ?? 0

                      // ── Matches column
                      const matchesCol = matchCount === 0 ? (
                        <span style={{ fontSize: 13, color: '#ccc' }}>No suggestions</span>
                      ) : (
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', maxWidth: '100%', width: '100%' }}>
                          <select
                            value={selectedIdx}
                            onChange={e =>
                              setSelectedSuggIdxByKey(prev => ({
                                ...prev,
                                [key]: Number(e.target.value),
                              }))
                            }
                            disabled={item.isConfirmed || isPending}
                            style={{
                              fontSize: 12,
                              padding: '5px 22px 5px 0px',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              color: '#111',
                              cursor: item.isConfirmed ? 'not-allowed' : 'pointer',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              width: '100%',
                              minWidth: 0,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap' as const,
                            }}
                          >
                            {suggestions.map((s, i) => (
                              <option key={s.master_item_id} value={i}>
                                {s.code} · {s.unit_of_measure} 
                              </option>
                            ))}
                          </select>
                          <span style={{
                            position: 'absolute', right: 2,
                            pointerEvents: 'none', color: '#999',
                            display: 'flex', alignItems: 'center',
                          }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="2,4 6,8 10,4" />
                            </svg>
                          </span>
                        </div>
                      )

                      // ── Matched column
                      const matchedCol = matchCount > 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, fontWeight: 500, padding: '4px 10px',
                          borderRadius: 20, background: '#e8f5e9', color: '#2e7d32',
                        }}>
                          {matchCount} matched
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          fontSize: 12, fontWeight: 500, padding: '4px 10px',
                          borderRadius: 20, background: '#fff6f6', color: '#111',
                          border: '0.5px solid #eee',
                        }}>
                          New item
                        </span>
                      )

                      // ── Action column
                      let actionCol
                      if (matchCount === 0) {
                        actionCol = (
                          <span style={{ fontSize: 13, color: '#ccc' }}>No action needed</span>
                        )
                      } else if (item.isConfirmed) {
                        actionCol = (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 12, padding: '5px 10px', borderRadius: 20,
                            background: '#e8f5e9', color: '#2e7d32',
                          }}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                            {item.action === 'approve' ? 'Approved' : 'Create requested'}
                          </span>
                        )
                      } else {
                        actionCol = (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' as const }}>
                            <button
                              onClick={() => setAction(item, 'approve')}
                              disabled={isPending}
                              style={{
                                ...styles.actionBtn,
                                ...(item.action === 'approve' ? styles.actionBtnFilled : {}),
                                ...(isPending ? styles.actionBtnDisabled : {}),
                                flexShrink: 0,
                              }}
                            >
                              {pendingActionByItemKey[key] === 'approve'
                                ? 'Approving...'
                                : 'Approve'}
                            </button>
                            <button
                              onClick={() => setAction(item, 'create')}
                              disabled={isPending}
                              style={{
                                ...styles.actionBtn,
                                ...(item.action === 'create' ? styles.actionBtnFilled : {}),
                                ...(isPending ? styles.actionBtnDisabled : {}),
                                flexShrink: 0,
                              }}
                            >
                              {pendingActionByItemKey[key] === 'create'
                                ? 'Saving...'
                                : 'Create new'}
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 220px 120px 200px',
                            alignItems: 'center',
                            padding: '14px 20px',
                            gap: 16,
                            borderBottom: idx === lineItems.length - 1 ? 'none' : '0.5px solid #f0f0f0',
                            background: '#fff',
                          }}
                        >
                          {/* Item info */}
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 15, color: '#111', margin: 0 }}>
                              {item.name}
                            </p>
                            <p style={{ fontSize: 13, color: '#888', marginTop: 3, marginBottom: 0 }}>
                              {item.code} · {item.uom}
                            </p>
                          </div>

                          {matchesCol}
                          {matchedCol}
                          {actionCol}
                        </div>
                      )
                    })}
                  </div>
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
            <button onClick={() => {
              if (isLoading) return
              onClose()
            }} style={styles.btnGhost}>Cancel</button>
            {step < 3 ? (
              <button
                onClick={step === 1 ? handleUploadAndExtract : goNext}
                disabled={step === 1 && !file}
                style={{
                  ...styles.btnPrimary,
                  opacity: step === 1 && !file ? 0.3 : 1,
                  cursor: step === 1 && !file ? 'not-allowed' : 'pointer',
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
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loaderOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.2)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    pointerEvents: 'all', 
  },
  loaderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    maxWidth: 920,
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
  infoNote: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#f7f7f7', borderRadius: 10,
    padding: '12px 14px', marginBottom: 20,
  },
  infoDot: { width: 7, height: 7, borderRadius: '50%', background: '#111', flexShrink: 0, marginTop: 5 },
  vendorCard: {
    background: '#fafafa', border: '0.5px solid #e8e8e8',
    borderRadius: 12, padding: '16px 20px',
    display: 'flex', alignItems: 'flex-start', gap: 16,
  },
  newBadge: {
    fontSize: 11, background: '#fff3cd', color: '#856404',
    padding: '2px 8px', borderRadius: 20, fontWeight: 500,
  },
  vendorDetail: {
    fontSize: 12, color: '#777',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  },
  matchBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 500,
  },
  actionBtn: {
    padding: '6px 12px', fontSize: 12, fontWeight: 500,
    borderRadius: 8, border: '0.5px solid #ddd',
    background: '#fff', color: '#111', cursor: 'pointer',
    transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
    flexShrink: 0,
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