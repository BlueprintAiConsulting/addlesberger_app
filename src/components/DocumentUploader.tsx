import { useState, useRef } from 'react'
import { Upload, CheckCircle2, AlertCircle, X, Loader2, Sparkles } from 'lucide-react'
import { addItem } from '@/lib/firestore'
import { extractTemplateFromDocument, type ExtractedEstimateTemplate, type ExtractedInvoiceTemplate } from '@/lib/documentAi'

interface Props {
  type: 'estimate' | 'invoice'
  userId: string
  onTemplateCreated?: () => void
}

// Accept PDFs and images — Gemini can read both
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.docx,.doc'
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

export function DocumentUploader({ type, userId, onTemplateCreated }: Props) {
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (file.size > MAX_SIZE) {
      setError('File too large (max 20 MB)')
      return
    }

    setProcessing(true)
    setError('')
    setSuccess('')
    setStatus('Reading document with AI...')

    try {
      // Step 1: AI extraction
      const result = await extractTemplateFromDocument(file, type)

      if (result.error || !result.data) {
        throw new Error(result.error || 'Could not extract template data from this document')
      }

      setStatus('Creating template...')

      // Step 2: Save as template
      if (type === 'estimate') {
        const tmpl = result.data as ExtractedEstimateTemplate
        await addItem('estimateTemplates', {
          name: tmpl.name || `Imported from ${file.name}`,
          lineItems: tmpl.lineItems || [],
          createdBy: userId,
          source: 'ai-upload',
          sourceFileName: file.name,
        })
      } else {
        const tmpl = result.data as ExtractedInvoiceTemplate
        await addItem('invoiceTemplates', {
          name: tmpl.name || `Imported from ${file.name}`,
          jobType: tmpl.jobType || 'other',
          companyHeaderText: tmpl.companyHeaderText || 'R. L. Addlesberger Roofing LLC',
          servicesPerformedText: tmpl.servicesPerformedText || '',
          warrantyText: tmpl.warrantyText || '',
          paymentInstructions: tmpl.paymentInstructions || 'Please make check payable to R. L. Addlesberger Roofing LLC',
          thankYouText: tmpl.thankYouText || 'Thank you for your business!',
          licenseText: tmpl.licenseText || 'PA141502',
          active: true,
          createdBy: userId,
          source: 'ai-upload',
          sourceFileName: file.name,
        })
      }

      setSuccess(`✅ Template created from "${file.name}"`)
      setTimeout(() => setSuccess(''), 5000)
      onTemplateCreated?.()
    } catch (err: any) {
      setError(err.message || 'Failed to process document')
    } finally {
      setProcessing(false)
      setStatus('')
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
        onClick={() => !processing && inputRef.current?.click()}
        style={{
          border: '2px dashed var(--brand)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: processing ? 'wait' : 'pointer',
          background: processing ? 'var(--bg-tinted)' : 'linear-gradient(135deg, var(--brand-subtle) 0%, var(--bg-tinted) 100%)',
          transition: 'all .2s ease',
          opacity: processing ? 0.8 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        {processing ? (
          <div>
            <Loader2 size={28} style={{ color: 'var(--brand)', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
              {status}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              Gemini is reading your document...
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={22} style={{ color: 'var(--brand)' }} />
              <Upload size={22} style={{ color: 'var(--brand)' }} />
            </div>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Upload {label} — AI Creates Template
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Upload a PDF, photo, or document of an existing {label.toLowerCase()}.<br />
              AI will extract the content and auto-create a reusable template.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.02em' }}>
              .pdf · .docx · .png · .jpg — max 20 MB
            </p>
          </>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginTop: 10,
          background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #dc2626)', fontSize: 13, fontWeight: 500,
        }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #dc2626)' }}>
            <X size={14} />
          </button>
        </div>
      )}
      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginTop: 10,
          background: 'var(--success-bg, #f0fdf4)', color: 'var(--success, #16a34a)', fontSize: 13, fontWeight: 600,
        }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
    </div>
  )
}
