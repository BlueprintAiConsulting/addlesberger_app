import { useState, useEffect, useRef, FormEvent } from 'react'
import { orderBy } from 'firebase/firestore'
import { format } from 'date-fns'
import { useLocation } from 'react-router-dom'
import { Camera, CheckCircle, Image as ImageIcon, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, deleteItem } from '@/lib/firestore'
import { uploadPhoto, deletePhoto } from '@/lib/storage'
import { extractWhiteboardData, findDuplicates, type ExtractedItem, type ExtractionResult } from '@/lib/whiteboardAi'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import type { Photo, Job, BoardItem, PhotoSource } from '@/types'
import * as T from '@/types'

const PHOTO_SOURCES: PhotoSource[] = ['ryan-whiteboard', 'jobsite', 'before', 'after', 'damage', 'material', 'other']

const CONFIDENCE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'High' },
  medium: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Medium' },
  low: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Low' },
}

export function Photos() {
  const { user } = useAuth()
  const location = useLocation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterProcessed, setFilterProcessed] = useState<string>('all')

  // AI extraction state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStep, setScanStep] = useState('')
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [extractionSummary, setExtractionSummary] = useState('')
  const [extractionError, setExtractionError] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [acceptingAll, setAcceptingAll] = useState(false)
  const [duplicateWarnings, setDuplicateWarnings] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if ((location.state as any)?.openCreate) {
      setTimeout(() => fileRef.current?.click(), 300)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  // Upload form state
  const [caption, setCaption] = useState('')
  const [photoSource, setPhotoSource] = useState<PhotoSource>('ryan-whiteboard')
  const [photoJobId, setPhotoJobId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const { data: photos } = useCollection<Photo>('photos', [orderBy('createdAt', 'desc')])
  const { data: jobs } = useCollection<Job>('jobs', [orderBy('createdAt', 'desc')])
  const { data: boardItems } = useCollection<BoardItem>('boardItems', [orderBy('createdAt', 'desc')])

  // Filter logic
  let filtered = photos
  if (filterSource !== 'all') filtered = filtered.filter(p => p.source === filterSource)
  if (filterProcessed === 'unprocessed') filtered = filtered.filter(p => !p.processed)
  if (filterProcessed === 'processed') filtered = filtered.filter(p => p.processed)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setPhotoSource('ryan-whiteboard')
    setCaption('')
    setPhotoJobId(null)
    setUploadModalOpen(true)
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    try {
      const { url, fileName } = await uploadPhoto(selectedFile)
      await addItem('photos', {
        url, fileName, caption,
        tags: [photoSource],
        source: photoSource,
        processed: false,
        boardItemId: null,
        thumbnailUrl: null,
        jobId: photoJobId,
        uploadedBy: user?.uid || '',
      })
      setUploadModalOpen(false)
      setCaption(''); setPhotoSource('ryan-whiteboard'); setPhotoJobId(null)
      setSelectedFile(null); setPreviewUrl(null)
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed. Please try again.')
    }
    setUploading(false)
  }

  const markProcessed = async (photo: Photo) => {
    await updateItem('photos', photo.id, { processed: true })
    setViewPhoto(null)
  }

  const markUnprocessed = async (photo: Photo) => {
    await updateItem('photos', photo.id, { processed: false })
    setViewPhoto(null)
  }

  // ─── AI Extraction ──────────────────────────────────────
  const handleScanWhiteboard = async () => {
    if (!viewPhoto) return
    setScanning(true)
    setScanProgress(0)
    setScanStep('Starting...')
    setExtractionError('')
    setExtractedItems([])
    setExtractionSummary('')

    try {
      const timeoutPromise = new Promise<ExtractionResult>((_, reject) =>
        setTimeout(() => reject(new Error('Scan timed out after 60 seconds. Try a smaller or clearer photo.')), 60000)
      )
      const result = await Promise.race([
        extractWhiteboardData(viewPhoto.url, viewPhoto.caption, (step, pct) => {
          setScanStep(step)
          setScanProgress(pct)
        }),
        timeoutPromise,
      ])

      if (result.error) {
        setExtractionError(result.error)
      } else {
        setExtractedItems(result.items)
        setExtractionSummary(result.rawSummary)
        if (result.items.length > 0) {
          const existingNames = [
            ...boardItems.map(b => b.title),
            ...jobs.map(j => j.customerName),
          ].filter(Boolean)
          setDuplicateWarnings(findDuplicates(result.items, existingNames))
          setShowReview(true)
        } else {
          setExtractionError('No readable items found on this whiteboard.')
        }
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Extraction failed unexpectedly. Please try again.')
    }
    setScanning(false)
    setScanProgress(0)
    setScanStep('')
  }

  const updateExtractedItem = (index: number, field: keyof ExtractedItem, value: any) => {
    setExtractedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const removeExtractedItem = (index: number) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleAcceptAll = async () => {
    if (!viewPhoto || extractedItems.length === 0) return
    setAcceptingAll(true)

    try {
      for (const item of extractedItems) {
        // Create board item
        await addItem('boardItems', {
          title: item.customerName || item.description.slice(0, 60) || 'Whiteboard item',
          description: [
            item.address && `📍 ${item.address}`,
            item.phone && `📞 ${item.phone}`,
            item.jobType && item.jobType !== 'other' && `🔧 ${item.jobType}`,
            item.estimateAmount && `💰 $${item.estimateAmount.toLocaleString()}`,
            item.description,
          ].filter(Boolean).join('\n'),
          category: item.jobType === 'repair' ? 'repair' : 'estimate',
          priority: item.priority,
          status: 'inbox',
          source: 'ryan-whiteboard',
          assignedTo: null,
          dueDate: null,
          createdBy: user?.uid || '',
          archivedAt: null,
        })

        // Also create a Job if we have enough info
        if (item.customerName && (item.address || item.description)) {
          await addItem('jobs', {
            customerName: item.customerName,
            customerPhone: item.phone || '',
            customerEmail: '',
            address: item.address || '',
            description: item.description || '',
            status: 'lead',
            estimateAmount: item.estimateAmount,
            invoiceAmount: null,
            paidAmount: null,
            notes: `Auto-extracted from whiteboard photo on ${format(new Date(), 'MMM d, yyyy')}`,
            scheduledDate: null,
            completedDate: null,
            createdBy: user?.uid || '',
            archivedAt: null,
          })
        }
      }

      // Save extraction data to photo + mark processed
      await updateItem('photos', viewPhoto.id, {
        processed: true,
        extractedData: {
          items: extractedItems,
          rawSummary: extractionSummary,
          extractedAt: new Date().toISOString(),
        },
      })

      // Reset state
      setShowReview(false)
      setExtractedItems([])
      setExtractionSummary('')
      setViewPhoto(null)
    } catch (err) {
      console.error('Failed to create items:', err)
      alert('Failed to save extracted items. Please try again.')
    }
    setAcceptingAll(false)
  }

  const closeViewModal = () => {
    setViewPhoto(null)
    setShowReview(false)
    setExtractedItems([])
    setExtractionSummary('')
    setExtractionError('')
    setEditingIndex(null)
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Photos</h1>
        <button className="btn btn-accent btn-sm" onClick={() => fileRef.current?.click()}>
          <Camera size={18} /> Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileSelect} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="filter-tabs" style={{ flex: 1 }}>
          <button className={`filter-tab ${filterSource === 'all' ? 'active' : ''}`} onClick={() => setFilterSource('all')}>All</button>
          <button className={`filter-tab ${filterSource === 'ryan-whiteboard' ? 'active' : ''}`} onClick={() => setFilterSource('ryan-whiteboard')}>Whiteboard</button>
          <button className={`filter-tab ${filterSource === 'jobsite' ? 'active' : ''}`} onClick={() => setFilterSource('jobsite')}>Jobsite</button>
          <button className={`filter-tab ${filterSource === 'damage' ? 'active' : ''}`} onClick={() => setFilterSource('damage')}>Damage</button>
        </div>
        <select className="input select" style={{ width: 'auto', fontSize: 13, padding: '6px 10px', minHeight: 'auto' }} value={filterProcessed} onChange={e => setFilterProcessed(e.target.value)}>
          <option value="all">All Status</option>
          <option value="unprocessed">Needs Processed</option>
          <option value="processed">Processed ✓</option>
        </select>
      </div>

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<ImageIcon />} message="No photos yet" action={<button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>Upload Photo</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {filtered.map(photo => {
            const isWhiteboard = photo.source === 'ryan-whiteboard'
            const isProcessed = photo.processed
            return (
              <div key={photo.id} onClick={() => setViewPhoto(photo)} style={{
                cursor: 'pointer', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                aspectRatio: '1', position: 'relative', background: '#E2E8F0',
                border: isWhiteboard && !isProcessed ? '2px solid var(--warning)' : 'none',
              }}>
                <img src={photo.url} alt={photo.caption} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                  {isProcessed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.9)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>✓</span>
                  )}
                  {isWhiteboard && !isProcessed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.9)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>Needs Processed</span>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: 4, left: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                    {T.PHOTO_SOURCE_LABELS[photo.source as PhotoSource] || photo.source || 'Photo'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={() => fileRef.current?.click()} aria-label="Upload photo"><Camera size={24} /></button>

      {/* Upload modal */}
      <Modal open={uploadModalOpen} onClose={() => { setUploadModalOpen(false); setPreviewUrl(null); setSelectedFile(null) }} title="Upload Photo">
        <form onSubmit={handleUpload} className="stack stack-md">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
          )}
          <div>
            <label className="label">Notes / AI Direction</label>
            <textarea className="input textarea" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Describe what's in this photo — for whiteboard scans, add directions like 'focus on the left column' or 'these are all gutter jobs'" rows={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Source</label>
              <select className="input select" value={photoSource} onChange={e => setPhotoSource(e.target.value as PhotoSource)}>
                {PHOTO_SOURCES.map(s => (
                  <option key={s} value={s}>{T.PHOTO_SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Link to Job</label>
              <select className="input select" value={photoJobId || ''} onChange={e => setPhotoJobId(e.target.value || null)}>
                <option value="">None</option>
                {jobs.filter(j => !j.archivedAt).map(j => (
                  <option key={j.id} value={j.id}>{j.customerName} — {j.address}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Save Photo'}
          </button>
        </form>
      </Modal>

      {/* View photo modal — with AI scan */}
      <Modal open={!!viewPhoto} onClose={closeViewModal} title={viewPhoto?.caption || 'Photo'}>
        {viewPhoto && (
          <div className="stack stack-md">
            <img src={viewPhoto.url} alt={viewPhoto.caption} style={{ width: '100%', borderRadius: 'var(--radius-sm)' }} />
            {viewPhoto.caption && <p style={{ margin: 0, fontSize: 15 }}>{viewPhoto.caption}</p>}

            <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--bg)' }}>
                {T.PHOTO_SOURCE_LABELS[viewPhoto.source as PhotoSource] || 'Photo'}
              </span>
              <span className="badge" style={{
                background: viewPhoto.processed ? '#DCFCE7' : '#FEF3C7',
                color: viewPhoto.processed ? '#166534' : '#92400E',
              }}>
                {viewPhoto.processed ? '✓ Processed' : 'Needs Processed'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Uploaded {format(viewPhoto.createdAt.toDate(), 'MMM d, yyyy h:mm a')}
            </p>

            {/* Action buttons */}
            <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
              {/* AI Scan button — only for whiteboard photos */}
              {viewPhoto.source === 'ryan-whiteboard' && !viewPhoto.processed && !showReview && !scanning && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleScanWhiteboard}
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)', border: 'none' }}
                >
                  <Sparkles size={16} /> Scan Whiteboard
                </button>
              )}

              {!viewPhoto.processed ? (
                <button className="btn btn-outline btn-sm" onClick={() => markProcessed(viewPhoto)} disabled={scanning}>
                  <CheckCircle size={16} /> Mark Processed
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => markUnprocessed(viewPhoto)} disabled={scanning}>
                  Undo Processed
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => { closeViewModal(); setDeleteTarget(viewPhoto) }} disabled={scanning}>
                <Trash2 size={16} /> Delete
              </button>
            </div>

            {/* ─── Scan Progress Bar ─────────────────────────── */}
            {scanning && (
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(147,51,234,0.08))',
                border: '1px solid rgba(124,58,237,0.2)',
              }}>
                <div className="row gap-sm" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <Loader2 size={16} style={{ animation: 'spin .7s linear infinite', color: '#9333EA' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#9333EA' }}>{scanStep || 'Starting...'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {scanProgress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(124,58,237,0.12)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${scanProgress}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #7C3AED, #9333EA, #A855F7)',
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 0 8px rgba(147,51,234,0.4)',
                  }} />
                </div>
              </div>
            )}

            {/* Extraction error */}
            {extractionError && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 14 }}>
                {extractionError}
              </div>
            )}

            {/* Previously extracted data */}
            {viewPhoto.extractedData && !showReview && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--purple-bg)', border: '1px solid rgba(124,58,237,.15)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Previously Extracted
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {viewPhoto.extractedData.items.length} item{viewPhoto.extractedData.items.length !== 1 ? 's' : ''} extracted on {format(new Date(viewPhoto.extractedData.extractedAt), 'MMM d, yyyy')}
                </p>
              </div>
            )}

            {/* ─── AI Review UI ──────────────────────────── */}
            {showReview && extractedItems.length > 0 && (
              <div className="stack stack-md" style={{ animation: 'fadeInUp .3s ease both' }}>
                {/* Summary */}
                <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--purple-bg)', border: '1px solid rgba(124,58,237,.15)' }}>
                  <div className="row gap-sm" style={{ marginBottom: 4 }}>
                    <Sparkles size={14} style={{ color: 'var(--purple)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      AI Extraction
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Found {extractedItems.length} item{extractedItems.length !== 1 ? 's' : ''}. {extractionSummary}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                    Review each item below. Edit, remove, or accept. Low-confidence items are flagged.
                  </p>
                  {duplicateWarnings.size > 0 && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={13} /> {duplicateWarnings.size} possible duplicate{duplicateWarnings.size !== 1 ? 's' : ''} detected
                    </p>
                  )}
                </div>

                {/* Extracted items */}
                {extractedItems.map((item, idx) => {
                  const conf = CONFIDENCE_STYLES[item.confidence] || CONFIDENCE_STYLES.medium
                  const isEditing = editingIndex === idx
                  return (
                    <div key={idx} className="card" style={{ borderLeft: `3px solid var(--purple)` }}>
                      <div className="row row-between gap-sm" style={{ marginBottom: 8 }}>
                        <div className="row gap-sm">
                          <span style={{ fontSize: 13, fontWeight: 700 }}>#{idx + 1}</span>
                          <span className="badge" style={{ background: conf.bg, color: conf.color, fontSize: 10 }}>
                            {conf.label} confidence
                          </span>
                          {item.priority === 'urgent' && <span className="badge badge-urgent">Urgent</span>}
                          {duplicateWarnings.has(idx) && (
                            <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <AlertTriangle size={10} /> {duplicateWarnings.get(idx)}
                            </span>
                          )}
                          {item.confidence === 'low' && (
                            <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>⚠ Needs review</span>
                          )}
                        </div>
                        <div className="row gap-sm">
                          <button className="btn btn-ghost btn-sm" style={{ padding: 4, minHeight: 28 }} onClick={() => setEditingIndex(isEditing ? null : idx)}>
                            {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: 4, minHeight: 28, color: 'var(--danger)' }} onClick={() => removeExtractedItem(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Summary view */}
                      {!isEditing && (
                        <div>
                          <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15 }}>
                            {item.customerName || 'Unknown Customer'}
                          </p>
                          {item.address && <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--text-secondary)' }}>📍 {item.address}</p>}
                          {item.phone && <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--text-secondary)' }}>📞 {item.phone}</p>}
                          <div className="row gap-sm" style={{ marginTop: 4 }}>
                            <span className="badge" style={{ background: 'var(--bg)', fontSize: 11 }}>{item.jobType}</span>
                            {item.estimateAmount != null && (
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                                ${item.estimateAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{item.description}</p>
                          )}
                        </div>
                      )}

                      {/* Edit view */}
                      {isEditing && (
                        <div className="stack stack-sm" style={{ marginTop: 4 }}>
                          <div>
                            <label className="label">Customer Name</label>
                            <input className="input" value={item.customerName} onChange={e => updateExtractedItem(idx, 'customerName', e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Address</label>
                            <input className="input" value={item.address} onChange={e => updateExtractedItem(idx, 'address', e.target.value)} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label className="label">Phone</label>
                              <input className="input" value={item.phone} onChange={e => updateExtractedItem(idx, 'phone', e.target.value)} />
                            </div>
                            <div>
                              <label className="label">Estimate $</label>
                              <input className="input" type="number" value={item.estimateAmount ?? ''} onChange={e => updateExtractedItem(idx, 'estimateAmount', e.target.value ? Number(e.target.value) : null)} />
                            </div>
                          </div>
                          <div>
                            <label className="label">Job Type</label>
                            <select className="input select" value={item.jobType} onChange={e => updateExtractedItem(idx, 'jobType', e.target.value)}>
                              <option value="shingle">Shingle</option>
                              <option value="rubber roof">Rubber Roof</option>
                              <option value="metal roof">Metal Roof</option>
                              <option value="repair">Repair</option>
                              <option value="gutter">Gutter</option>
                              <option value="flashing">Flashing</option>
                              <option value="inspection">Inspection</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Notes / Description</label>
                            <textarea className="input textarea" value={item.description} onChange={e => updateExtractedItem(idx, 'description', e.target.value)} rows={3} />
                          </div>
                          <div>
                            <label className="label">Priority</label>
                            <select className="input select" value={item.priority} onChange={e => updateExtractedItem(idx, 'priority', e.target.value as 'normal' | 'urgent')}>
                              <option value="normal">Normal</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Accept All */}
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleAcceptAll}
                  disabled={acceptingAll || extractedItems.length === 0}
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)', border: 'none' }}
                >
                  {acceptingAll ? (
                    <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Creating Items...</>
                  ) : (
                    <><Plus size={16} /> Accept All — Create {extractedItems.length} Item{extractedItems.length !== 1 ? 's' : ''}</>
                  )}
                </button>

                <button className="btn btn-ghost btn-full" onClick={() => { setShowReview(false); setExtractedItems([]) }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Photo"
        message="Delete this photo permanently? This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            try { await deletePhoto(deleteTarget.fileName) } catch { /* file may already be gone */ }
            await deleteItem('photos', deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
