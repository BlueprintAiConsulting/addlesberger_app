import { useState, useEffect, useRef, FormEvent } from 'react'
import { orderBy } from 'firebase/firestore'
import { format } from 'date-fns'
import { useLocation } from 'react-router-dom'
import { Camera, CheckCircle, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, deleteItem } from '@/lib/firestore'
import { uploadPhoto, deletePhoto } from '@/lib/storage'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import type { Photo, Job, BoardItem, PhotoSource } from '@/types'
import * as T from '@/types'

const PHOTO_SOURCES: PhotoSource[] = ['ryan-whiteboard', 'jobsite', 'before', 'after', 'damage', 'material', 'other']

export function Photos() {
  const { user } = useAuth()
  const location = useLocation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterProcessed, setFilterProcessed] = useState<string>('all')

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
  if (filterSource !== 'all') filtered = filtered.filter(p => (p as any).source === filterSource)
  if (filterProcessed === 'unprocessed') filtered = filtered.filter(p => !(p as any).processed)
  if (filterProcessed === 'processed') filtered = filtered.filter(p => (p as any).processed)

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
        <select
          className="input select"
          style={{ width: 'auto', fontSize: 13, padding: '6px 10px', minHeight: 'auto' }}
          value={filterProcessed}
          onChange={e => setFilterProcessed(e.target.value)}
        >
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
            const isWhiteboard = (photo as any).source === 'ryan-whiteboard'
            const isProcessed = (photo as any).processed
            return (
              <div key={photo.id} onClick={() => setViewPhoto(photo)} style={{
                cursor: 'pointer', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                aspectRatio: '1', position: 'relative', background: '#E2E8F0',
                border: isWhiteboard && !isProcessed ? '2px solid var(--warning)' : 'none',
              }}>
                <img src={photo.url} alt={photo.caption} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* Status badges */}
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                  {isProcessed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.9)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                      ✓
                    </span>
                  )}
                  {isWhiteboard && !isProcessed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.9)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                      Needs Processed
                    </span>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                    {T.PHOTO_SOURCE_LABELS[(photo as any).source as PhotoSource] || (photo as any).source || 'Photo'}
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
            <label className="label">Caption / Notes</label>
            <input className="input" value={caption} onChange={e => setCaption(e.target.value)} placeholder="What's in this photo?" />
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

      {/* View photo modal */}
      <Modal open={!!viewPhoto} onClose={() => setViewPhoto(null)} title={viewPhoto?.caption || 'Photo'}>
        {viewPhoto && (
          <div className="stack stack-md">
            <img src={viewPhoto.url} alt={viewPhoto.caption} style={{ width: '100%', borderRadius: 'var(--radius-sm)' }} />
            {viewPhoto.caption && <p style={{ margin: 0, fontSize: 15 }}>{viewPhoto.caption}</p>}

            <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--bg)' }}>
                {T.PHOTO_SOURCE_LABELS[(viewPhoto as any).source as PhotoSource] || 'Photo'}
              </span>
              <span className="badge" style={{
                background: (viewPhoto as any).processed ? '#DCFCE7' : '#FEF3C7',
                color: (viewPhoto as any).processed ? '#166534' : '#92400E',
              }}>
                {(viewPhoto as any).processed ? '✓ Processed' : 'Needs Processed'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Uploaded {format(viewPhoto.createdAt.toDate(), 'MMM d, yyyy h:mm a')}
            </p>

            <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
              {!(viewPhoto as any).processed ? (
                <button className="btn btn-primary btn-sm" onClick={() => markProcessed(viewPhoto)}>
                  <CheckCircle size={16} /> Mark Processed
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => markUnprocessed(viewPhoto)}>
                  Undo Processed
                </button>
              )}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { setViewPhoto(null); setDeleteTarget(viewPhoto) }}
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
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
            try {
              await deletePhoto(deleteTarget.fileName)
            } catch { /* file may already be gone */ }
            await deleteItem('photos', deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
