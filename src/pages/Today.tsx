import { useNavigate } from 'react-router-dom'
import { where, orderBy } from 'firebase/firestore'
import { format } from 'date-fns'
import { Inbox, Camera, AlertTriangle, Clock, ChevronRight, Briefcase, DollarSign } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import type { BoardItem, Job, Photo } from '@/types'
import * as T from '@/types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning, Charlene'
  if (h < 17) return 'Good afternoon, Charlene'
  return 'Good evening, Charlene'
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

  const inboxItems = boardItems.filter(b => T.migrateBoardStatus(b.status) === 'inbox')
  const urgentItems = boardItems.filter(b => b.priority === 'urgent' && T.migrateBoardStatus(b.status) !== 'completed')
  const unprocessedPhotos = photos.filter(p => (p as any).source === 'ryan-whiteboard' && !(p as any).processed)
  const waitingJobs = jobs.filter(j => ['lead', 'estimate-sent', 'approved'].includes(j.status))
  const needsInvoice = jobs.filter(j => j.status === 'complete' && !j.invoiceAmount)
  const activeJobs = jobs.filter(j => !['paid', 'complete', 'invoiced'].includes(j.status))

  return (
    <div className="stack stack-lg">
      {/* Greeting */}
      <div className="animate-in">
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 2px', fontWeight: 500 }}>
          {format(today, 'EEEE, MMMM d')}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em' }}>
          {getGreeting()}
        </h1>
      </div>

      {/* Stats — 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div className="stat-card" onClick={() => navigate('/board')}>
          <div className="stat-value" style={{ color: inboxItems.length > 0 ? 'var(--brand)' : undefined }}>
            {inboxItems.length}
          </div>
          <div className="stat-label">Inbox</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/photos')}>
          <div className="stat-value" style={{ color: unprocessedPhotos.length > 0 ? 'var(--warning)' : undefined }}>
            {unprocessedPhotos.length}
          </div>
          <div className="stat-label">Photos</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/board')}>
          <div className="stat-value" style={{ color: urgentItems.length > 0 ? 'var(--danger)' : undefined }}>
            {urgentItems.length}
          </div>
          <div className="stat-label">Urgent</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <button className="quick-action" onClick={() => navigate('/board', { state: { openCreate: true } })}>
          <div className="quick-action-icon" style={{ background: 'var(--brand-subtle)', color: 'var(--brand)' }}>
            <Inbox size={20} />
          </div>
          <span className="quick-action-label">Capture</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/photos', { state: { openCreate: true } })}>
          <div className="quick-action-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Camera size={20} />
          </div>
          <span className="quick-action-label">Photo</span>
        </button>
        <button className="quick-action" onClick={() => navigate('/jobs', { state: { openCreate: true } })}>
          <div className="quick-action-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Briefcase size={20} />
          </div>
          <span className="quick-action-label">New Job</span>
        </button>
      </div>

      {/* Unprocessed whiteboard photos */}
      {unprocessedPhotos.length > 0 && (
        <div>
          <h2 className="section-heading">
            <Camera size={16} style={{ color: 'var(--warning)' }} />
            Whiteboard Photos
          </h2>
          <div className="stack stack-sm">
            {unprocessedPhotos.slice(0, 5).map((photo) => (
              <div key={photo.id} className="card card-amber card-pressable" onClick={() => navigate('/photos')} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={photo.url} alt={photo.caption} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{photo.caption || 'Whiteboard Photo'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    {format(photo.createdAt.toDate(), 'MMM d, h:mm a')}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--placeholder)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox items */}
      {inboxItems.length > 0 && (
        <div>
          <h2 className="section-heading">
            <Inbox size={16} style={{ color: 'var(--brand)' }} />
            Needs Sorted
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
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{item.title}</p>
                    {(item as any).source && (item as any).source !== 'other' && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        📥 {T.UPDATE_SOURCE_LABELS[(item as any).source as T.UpdateSource] || ''}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--placeholder)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent items */}
      {urgentItems.filter(b => T.migrateBoardStatus(b.status) !== 'inbox').length > 0 && (
        <div>
          <h2 className="section-heading">
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
            Urgent
          </h2>
          <div className="stack stack-sm">
            {urgentItems.filter(b => T.migrateBoardStatus(b.status) !== 'inbox').slice(0, 5).map((item) => (
              <div key={item.id} className="card card-red card-pressable" onClick={() => navigate('/board')}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge badge-urgent" style={{ marginBottom: 4, display: 'inline-block' }}>Urgent</span>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                      {T.BOARD_STATUS_LABELS[T.migrateBoardStatus(item.status)] || item.status}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--placeholder)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs needing action */}
      {(waitingJobs.length > 0 || needsInvoice.length > 0) && (
        <div>
          <h2 className="section-heading">
            <Clock size={16} />
            Jobs Needing Action
          </h2>
          <div className="stack stack-sm">
            {waitingJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="card card-blue card-pressable" onClick={() => navigate(`/jobs/${job.id}`)}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14 }}>{job.customerName}</p>
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
              <div key={job.id} className="card card-green card-pressable" onClick={() => navigate(`/jobs/${job.id}`)}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14 }}>{job.customerName}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--warning)', fontWeight: 500 }}>
                      <DollarSign size={12} style={{ verticalAlign: -2 }} /> Needs invoice
                    </p>
                  </div>
                  <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>Complete</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All clear */}
      {inboxItems.length === 0 && urgentItems.length === 0 && unprocessedPhotos.length === 0 && waitingJobs.length === 0 && needsInvoice.length === 0 && (
        <div className="all-clear animate-in">
          <span className="emoji">✨</span>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--success)' }}>Everything's organized</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>No items need attention right now.</p>
        </div>
      )}
    </div>
  )
}
