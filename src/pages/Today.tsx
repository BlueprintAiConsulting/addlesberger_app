import { useNavigate } from 'react-router-dom'
import { where, orderBy } from 'firebase/firestore'
import { format, isToday } from 'date-fns'
import { Inbox, Camera, AlertTriangle, Clock, ChevronRight, Briefcase, DollarSign, Sparkles } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import type { BoardItem, Job, Photo } from '@/types'
import * as T from '@/types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Today() {
  const navigate = useNavigate()
  const today = new Date()

  const { data: boardItems } = useCollection<BoardItem>('boardItems', [
    where('archivedAt', '==', null),
    orderBy('createdAt', 'desc'),
  ])

  const { data: jobs } = useCollection<Job>('jobs', [
    where('archivedAt', '==', null),
    orderBy('createdAt', 'desc'),
  ])

  const { data: photos } = useCollection<Photo>('photos', [
    orderBy('createdAt', 'desc'),
  ])

  // --- Charlene's Control Panel Stats ---
  const inboxItems = boardItems.filter(b => T.migrateBoardStatus(b.status) === 'inbox')
  const urgentItems = boardItems.filter(b => b.priority === 'urgent' && T.migrateBoardStatus(b.status) !== 'completed')
  const unprocessedPhotos = photos.filter(p => (p as any).source === 'ryan-whiteboard' && !(p as any).processed)
  const waitingJobs = jobs.filter(j => ['lead', 'estimate-sent', 'approved'].includes(j.status))
  const needsInvoice = jobs.filter(j => j.status === 'complete' && !j.invoiceAmount)
  const activeJobs = jobs.filter(j => !['paid', 'complete', 'invoiced'].includes(j.status))

  return (
    <div className="stack stack-lg">
      {/* Warm greeting */}
      <div className="animate-in">
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.03em' }}>
          {format(today, 'EEEE')} · {format(today, 'MMMM d')}
        </p>
        <h1 className="page-title" style={{ fontSize: 28 }}>
          {getGreeting()}, Charlene
        </h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="stat-card" onClick={() => navigate('/board')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: inboxItems.length > 0 ? 'var(--brand)' : undefined }}>
            {inboxItems.length}
          </div>
          <div className="stat-label">Needs Sorted</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/photos')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: unprocessedPhotos.length > 0 ? 'var(--warning)' : undefined }}>
            {unprocessedPhotos.length}
          </div>
          <div className="stat-label">Unprocessed</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/board')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: urgentItems.length > 0 ? 'var(--danger)' : undefined }}>
            {urgentItems.length}
          </div>
          <div className="stat-label">Urgent</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <button className="card card-pressable" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 8px', textAlign: 'center', border: '1.5px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/board', { state: { openCreate: true } })}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
            <Inbox size={19} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Capture Update</span>
        </button>
        <button className="card card-pressable" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 8px', textAlign: 'center', border: '1.5px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/photos', { state: { openCreate: true } })}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
            <Camera size={19} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Whiteboard Photo</span>
        </button>
        <button className="card card-pressable" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 8px', textAlign: 'center', border: '1.5px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/jobs', { state: { openCreate: true } })}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }}>
            <Briefcase size={19} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>New Job</span>
        </button>
      </div>

      {/* Unprocessed whiteboard photos */}
      {unprocessedPhotos.length > 0 && (
        <div>
          <h2 className="section-heading">
            <Camera size={18} style={{ color: 'var(--warning)' }} />
            Unprocessed Whiteboard Photos
          </h2>
          <div className="stack stack-sm">
            {unprocessedPhotos.slice(0, 5).map((photo) => (
              <div key={photo.id} className="card card-pressable" onClick={() => navigate('/photos')} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={photo.url} alt={photo.caption} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{photo.caption || 'Whiteboard Photo'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    {format(photo.createdAt.toDate(), 'MMM d, h:mm a')} — Needs processed
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox items */}
      {inboxItems.length > 0 && (
        <div>
          <h2 className="section-heading">
            <Inbox size={18} style={{ color: 'var(--brand)' }} />
            Inbox / Needs Sorted
          </h2>
          <div className="stack stack-sm">
            {inboxItems.slice(0, 8).map((item) => (
              <div key={item.id} className="card card-pressable" onClick={() => navigate('/board')}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-sm" style={{ marginBottom: 4 }}>
                      <span className={`badge ${T.BOARD_CATEGORY_COLORS[T.migrateBoardCategory(item.category) as T.BoardCategory] || 'bg-slate-100 text-slate-600'}`}>
                        {T.BOARD_CATEGORY_LABELS[T.migrateBoardCategory(item.category) as T.BoardCategory] || item.category}
                      </span>
                      {item.priority === 'urgent' && (
                        <span className="badge badge-urgent">Urgent</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{item.title}</p>
                    {(item as any).source && (item as any).source !== 'other' && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        📥 {T.UPDATE_SOURCE_LABELS[(item as any).source as T.UpdateSource] || ''}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent items (not in inbox) */}
      {urgentItems.filter(b => T.migrateBoardStatus(b.status) !== 'inbox').length > 0 && (
        <div>
          <h2 className="section-heading">
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
            Urgent
          </h2>
          <div className="stack stack-sm">
            {urgentItems.filter(b => T.migrateBoardStatus(b.status) !== 'inbox').slice(0, 5).map((item) => (
              <div key={item.id} className="card card-pressable" onClick={() => navigate('/board')}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge badge-urgent" style={{ marginBottom: 4, display: 'inline-block' }}>Urgent</span>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                      {T.BOARD_STATUS_LABELS[T.migrateBoardStatus(item.status)] || item.status}
                    </p>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs waiting / needing action */}
      {(waitingJobs.length > 0 || needsInvoice.length > 0) && (
        <div>
          <h2 className="section-heading">
            <Clock size={18} />
            Jobs Needing Action
          </h2>
          <div className="stack stack-sm">
            {waitingJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="card card-pressable" onClick={() => navigate(`/jobs/${job.id}`)}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15 }}>{job.customerName}</p>
                    <p className="truncate" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                      {job.address}
                    </p>
                  </div>
                  <span className={`badge ${T.JOB_STATUS_COLORS[job.status]}`}>
                    {T.JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>
              </div>
            ))}
            {needsInvoice.map((job) => (
              <div key={job.id} className="card card-pressable" onClick={() => navigate(`/jobs/${job.id}`)}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15 }}>{job.customerName}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--warning)', fontWeight: 500 }}>
                      <DollarSign size={13} style={{ verticalAlign: -2 }} /> Needs invoice
                    </p>
                  </div>
                  <span className="badge bg-green-100 text-green-700">Complete</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All clear — calm, rewarding */}
      {inboxItems.length === 0 && urgentItems.length === 0 && unprocessedPhotos.length === 0 && waitingJobs.length === 0 && needsInvoice.length === 0 && (
        <div className="all-clear animate-in">
          <span className="emoji">✨</span>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>Everything's organized</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>No items need attention. You're all caught up.</p>
        </div>
      )}
    </div>
  )
}
