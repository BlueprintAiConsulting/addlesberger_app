import { useState, useEffect, useRef, FormEvent } from 'react'
import { orderBy } from 'firebase/firestore'
import { useLocation } from 'react-router-dom'
import { Camera, Upload, X, Image as ImageIcon, Tag } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem } from '@/lib/firestore'
import { uploadPhoto } from '@/lib/storage'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import type { Photo } from '@/types'

const TAG_OPTIONS = ['before', 'after', 'damage', 'progress', 'complete', 'whiteboard', 'material']

export function Photos() {
  const { user } = useAuth()
  const location = useLocation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null)
  const [filterTag, setFilterTag] = useState<string>('all')

  // Auto-open file picker when navigated with state.openCreate (from Today quick add)
  useEffect(() => {
    if ((location.state as any)?.openCreate) {
      setTimeout(() => fileRef.current?.click(), 300)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  // Upload form
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const { data: photos } = useCollection<Photo>('photos', [orderBy('createdAt', 'desc')])

  const filtered = filterTag === 'all' ? photos : photos.filter(p => p.tags.includes(filterTag))

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setUploadModalOpen(true)
  }

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    try {
      const { url, fileName } = await uploadPhoto(selectedFile)
      await addItem('photos', {
        url, fileName, caption, tags,
        thumbnailUrl: null, jobId: null,
        uploadedBy: user?.uid || '',
      })
      setUploadModalOpen(false)
      setCaption(''); setTags([]); setSelectedFile(null); setPreviewUrl(null)
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed. Please try again.')
    }
    setUploading(false)
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

      {/* Tag filter */}
      <div className="filter-tabs">
        <button className={`filter-tab ${filterTag === 'all' ? 'active' : ''}`} onClick={() => setFilterTag('all')}>All</button>
        {TAG_OPTIONS.map(tag => (
          <button key={tag} className={`filter-tab ${filterTag === tag ? 'active' : ''}`} onClick={() => setFilterTag(tag)}>
            {tag.charAt(0).toUpperCase() + tag.slice(1)}
          </button>
        ))}
      </div>

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<ImageIcon />} message="No photos yet" action={<button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>Take a Photo</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {filtered.map(photo => (
            <div key={photo.id} onClick={() => setViewPhoto(photo)} style={{
              cursor: 'pointer', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              aspectRatio: '1', position: 'relative', background: '#E2E8F0',
            }}>
              <img src={photo.url} alt={photo.caption} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {photo.tags.length > 0 && (
                <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {photo.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{ fontSize: 10, fontWeight: 600, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => fileRef.current?.click()} aria-label="Upload photo"><Camera size={24} /></button>

      {/* Upload modal */}
      <Modal open={uploadModalOpen} onClose={() => { setUploadModalOpen(false); setPreviewUrl(null); setSelectedFile(null) }} title="Upload Photo">
        <form onSubmit={handleUpload} className="stack stack-md">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
          )}
          <div><label className="label">Caption</label><input className="input" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Describe this photo" /></div>
          <div>
            <label className="label">Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TAG_OPTIONS.map(tag => (
                <button key={tag} type="button"
                  className={`filter-tab ${tags.includes(tag) ? 'active' : ''}`}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => toggleTag(tag)}>
                  {tag}
                </button>
              ))}
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
            {viewPhoto.tags.length > 0 && (
              <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                {viewPhoto.tags.map(tag => (
                  <span key={tag} className="badge" style={{ background: 'var(--bg)' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
