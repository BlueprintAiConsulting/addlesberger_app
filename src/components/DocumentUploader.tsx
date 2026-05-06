import { useState, useRef } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'
import { addItem } from '@/lib/firestore'
import { Upload, FileText, CheckCircle2, AlertCircle, X, File } from 'lucide-react'

interface UploadedDoc {
  id: string
  name: string
  fileName: string
  url: string
  type: 'estimate' | 'invoice'
  fileType: string
  fileSize: number
  uploadedBy: string
  createdAt: any
}

interface Props {
  type: 'estimate' | 'invoice'
  userId: string
  documents: UploadedDoc[]
  onUploaded?: () => void
}

const ACCEPT = '.docx,.doc,.pdf,.xlsx,.xls'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileIcon(name: string) {
  if (name.endsWith('.pdf')) return '📄'
  if (name.endsWith('.docx') || name.endsWith('.doc')) return '📝'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return '📊'
  return '📎'
}

export function DocumentUploader({ type, userId, documents, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (file.size > MAX_SIZE) {
      setError('File too large (max 10 MB)')
      return
    }

    setUploading(true)
    setProgress(0)
    setError('')
    setSuccess('')

    try {
      const timestamp = Date.now()
      const storagePath = `templates/${type}/${timestamp}_${file.name}`
      const storageRef = ref(storage, storagePath)

      const uploadTask = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          (err) => reject(err),
          () => resolve()
        )
      })

      const url = await getDownloadURL(storageRef)

      await addItem('documentTemplates', {
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        url,
        type,
        fileType: file.type || file.name.split('.').pop() || 'unknown',
        fileSize: file.size,
        uploadedBy: userId,
      })

      setSuccess(`"${file.name}" uploaded`)
      setTimeout(() => setSuccess(''), 3000)
      onUploaded?.()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const label = type === 'estimate' ? 'Estimate' : 'Invoice'

  return (
    <div>
      {/* Upload zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          background: 'var(--bg-tinted)',
          transition: 'all .15s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <div>
            <div style={{
              width: '100%', height: 6, borderRadius: 3,
              background: 'var(--border-light)', overflow: 'hidden',
              marginBottom: 8,
            }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--brand), var(--brand-light))',
                borderRadius: 3, transition: 'width .2s ease',
              }} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
              Uploading... {progress}%
            </p>
          </div>
        ) : (
          <>
            <Upload size={28} style={{ color: 'var(--brand)', marginBottom: 8 }} />
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
              Upload {label} Template
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              .docx, .doc, .pdf, .xlsx — max 10 MB
            </p>
          </>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginTop: 10,
          background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13, fontWeight: 500,
        }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
            <X size={14} />
          </button>
        </div>
      )}
      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginTop: 10,
          background: 'var(--success-bg)', color: 'var(--success)', fontSize: 13, fontWeight: 500,
        }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Uploaded files list */}
      {documents.length > 0 && (
        <div className="stack stack-sm" style={{ marginTop: 12 }}>
          {documents.map(doc => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card card-pressable"
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--brand-subtle)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>
                {fileIcon(doc.fileName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }} className="truncate">{doc.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  {doc.fileName} · {formatBytes(doc.fileSize)}
                </p>
              </div>
              <FileText size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
