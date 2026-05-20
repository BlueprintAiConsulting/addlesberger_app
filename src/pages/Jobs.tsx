import { useState, useEffect, FormEvent } from 'react'
import { where, orderBy } from 'firebase/firestore'
import { Plus, Search, Briefcase } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem } from '@/lib/firestore'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import type { Job, JobStatus } from '@/types'
import * as T from '@/types'
import { useNavigate, useLocation } from 'react-router-dom'

const STATUS_FILTERS = ['all', 'active', 'complete', 'archived'] as const

export function Jobs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  // Auto-open create modal when navigated with state.openCreate (from Today quick add)
  useEffect(() => {
    if ((location.state as any)?.openCreate) {
      setModalOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  // Form state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')

  const { data: jobs, loading } = useCollection<Job>('jobs', [orderBy('createdAt', 'desc')])

  const filtered = jobs.filter(j => {
    // Status filter
    if (filter === 'active') {
      if (['paid', 'complete'].includes(j.status) || j.archivedAt) return false
    } else if (filter === 'complete') {
      if (!['paid', 'complete'].includes(j.status)) return false
    } else if (filter === 'archived') {
      if (!j.archivedAt) return false
    }
    // Search
    if (search) {
      const q = search.toLowerCase()
      return j.customerName.toLowerCase().includes(q) || j.address.toLowerCase().includes(q)
    }
    return true
  })

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    await addItem('jobs', {
      customerName, customerPhone, customerEmail, address, description,
      status: 'lead' as JobStatus,
      estimateAmount: null, invoiceAmount: null, paidAmount: null,
      notes: '', scheduledDate: null, completedDate: null,
      createdBy: user?.uid || '', archivedAt: null,
    })
    setModalOpen(false)
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setAddress(''); setDescription('')
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
        <button className="btn btn-accent btn-sm" onClick={() => setModalOpen(true)}>
          <Plus size={18} /> New Job
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input className="input" style={{ paddingLeft: 42 }} placeholder="Search by name or address..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {STATUS_FILTERS.map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Briefcase />} message="No jobs found" action={<button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>Create First Job</button>} />
      ) : (
        <div className="stack stack-sm">
          {filtered.map(job => (
            <div key={job.id} className="card card-pressable" onClick={() => navigate(`/jobs/${job.id}`)}>
              <div className="row row-between gap-sm">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 16 }}>{job.customerName}</p>
                  <p className="truncate" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{job.address}</p>
                  {job.estimateAmount && (
                    <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      ${job.estimateAmount.toLocaleString()}
                    </p>
                  )}
                </div>
                <span className="badge" style={{ background: T.JOB_STATUS_COLORS[job.status]?.bg, color: T.JOB_STATUS_COLORS[job.status]?.color }}>
                  {T.JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setModalOpen(true)} aria-label="New job"><Plus size={24} /></button>

      {/* New Job Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Job">
        <form onSubmit={handleCreate} className="stack stack-md">
          <div>
            <label htmlFor="jobCustomerName" className="label">Customer Name</label>
            <input id="jobCustomerName" name="customerName" autoComplete="name" className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Full name" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="jobCustomerPhone" className="label">Phone</label>
              <input id="jobCustomerPhone" name="customerPhone" autoComplete="tel" className="input" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="555-0123" />
            </div>
            <div>
              <label htmlFor="jobCustomerEmail" className="label">Email</label>
              <input id="jobCustomerEmail" name="customerEmail" autoComplete="email" className="input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label htmlFor="jobAddress" className="label">Address</label>
            <input id="jobAddress" name="address" autoComplete="street-address" className="input" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Job site address" />
          </div>
          <div>
            <label htmlFor="jobDescription" className="label">Description</label>
            <textarea id="jobDescription" name="description" className="input textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Scope of work" />
          </div>
          <button type="submit" className="btn btn-primary btn-full">Create Job</button>
        </form>
      </Modal>
    </div>
  )
}
