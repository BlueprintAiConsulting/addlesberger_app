import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { ArrowLeft, Phone, Mail, MapPin, Edit2, Archive } from 'lucide-react'
import { db, COMPANY_ID } from '@/firebase'
import { updateItem, archiveItem, unarchiveItem } from '@/lib/firestore'
import { Modal } from '@/components/Modal'
import type { Job, JobStatus } from '@/types'
import * as T from '@/types'

const STATUS_FLOW: JobStatus[] = ['lead','estimate-sent','approved','scheduled','in-progress','complete','invoiced','paid']

export function JobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  // Edit form state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [estimateAmount, setEstimateAmount] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')

  useEffect(() => {
    if (!jobId) return
    const unsubscribe = onSnapshot(doc(db, 'companies', COMPANY_ID, 'jobs', jobId), (snap) => {
      if (snap.exists()) {
        setJob({ id: snap.id, ...snap.data() } as Job)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [jobId])

  const openEdit = () => {
    if (!job) return
    setCustomerName(job.customerName)
    setCustomerPhone(job.customerPhone)
    setCustomerEmail(job.customerEmail)
    setAddress(job.address)
    setDescription(job.description)
    setNotes(job.notes)
    setEstimateAmount(job.estimateAmount?.toString() || '')
    setInvoiceAmount(job.invoiceAmount?.toString() || '')
    setScheduledDate(job.scheduledDate ? format(job.scheduledDate.toDate(), 'yyyy-MM-dd') : '')
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!jobId) return
    await updateItem('jobs', jobId, {
      customerName, customerPhone, customerEmail, address, description, notes,
      estimateAmount: estimateAmount ? parseFloat(estimateAmount) : null,
      invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : null,
      scheduledDate: scheduledDate ? Timestamp.fromDate(new Date(scheduledDate + 'T00:00:00')) : null,
    })
    setEditOpen(false)
  }

  const changeStatus = async (newStatus: JobStatus) => {
    if (!jobId) return
    const extra: Record<string, unknown> = {}
    if (newStatus === 'complete') extra.completedDate = Timestamp.now()
    await updateItem('jobs', jobId, { status: newStatus, ...extra })
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!job) return <div className="empty-state"><p>Job not found</p></div>

  const currentIdx = STATUS_FLOW.indexOf(job.status)

  return (
    <div className="stack stack-lg">
      <div className="row gap-sm">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/jobs')}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={openEdit}><Edit2 size={16} /> Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          job.archivedAt ? await unarchiveItem('jobs', job.id) : await archiveItem('jobs', job.id)
        }}>
          <Archive size={16} />
        </button>
      </div>

      {/* Customer info */}
      <div className="card">
        <div className="row row-between gap-sm" style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{job.customerName}</h1>
          <span className={`badge ${T.JOB_STATUS_COLORS[job.status]}`}>{T.JOB_STATUS_LABELS[job.status]}</span>
        </div>
        <div className="stack stack-sm">
          {job.address && <div className="row gap-sm"><MapPin size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} /><span style={{ fontSize: 14 }}>{job.address}</span></div>}
          {job.customerPhone && <div className="row gap-sm"><Phone size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} /><a href={`tel:${job.customerPhone}`} style={{ fontSize: 14, color: 'var(--info)' }}>{job.customerPhone}</a></div>}
          {job.customerEmail && <div className="row gap-sm"><Mail size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} /><a href={`mailto:${job.customerEmail}`} style={{ fontSize: 14, color: 'var(--info)' }}>{job.customerEmail}</a></div>}
        </div>
      </div>

      {/* Status pipeline */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>Status</h3>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {STATUS_FLOW.map((s, i) => (
            <button key={s} className={`filter-tab ${job.status === s ? 'active' : ''}`}
              style={{ fontSize: 12, padding: '6px 12px', opacity: i <= currentIdx ? 1 : 0.5 }}
              onClick={() => changeStatus(s)}>
              {T.JOB_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20 }}>{job.estimateAmount ? `$${job.estimateAmount.toLocaleString()}` : '—'}</div>
          <div className="stat-label">Estimate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20 }}>{job.invoiceAmount ? `$${job.invoiceAmount.toLocaleString()}` : '—'}</div>
          <div className="stat-label">Invoice</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20, color: job.paidAmount ? 'var(--success)' : undefined }}>{job.paidAmount ? `$${job.paidAmount.toLocaleString()}` : '—'}</div>
          <div className="stat-label">Paid</div>
        </div>
      </div>

      {/* Details */}
      {job.description && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Scope of Work</h3>
          <p style={{ margin: 0, fontSize: 15, whiteSpace: 'pre-wrap' }}>{job.description}</p>
        </div>
      )}
      {job.notes && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Notes</h3>
          <p style={{ margin: 0, fontSize: 15, whiteSpace: 'pre-wrap' }}>{job.notes}</p>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Job">
        <div className="stack stack-md">
          <div><label className="label">Customer Name</label><input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Phone</label><input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
          </div>
          <div><label className="label">Address</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input textarea" value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input textarea" value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="label">Estimate $</label><input className="input" type="number" value={estimateAmount} onChange={e => setEstimateAmount(e.target.value)} /></div>
            <div><label className="label">Invoice $</label><input className="input" type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} /></div>
            <div><label className="label">Scheduled</label><input className="input" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSave}>Save Changes</button>
        </div>
      </Modal>
    </div>
  )
}
