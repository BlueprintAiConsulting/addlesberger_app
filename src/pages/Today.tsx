import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp, where, orderBy } from 'firebase/firestore'
import { format, startOfDay, endOfDay, isToday } from 'date-fns'
import { Plus, ClipboardList, Briefcase, Camera, AlertTriangle, CalendarDays, ChevronRight } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { EmptyState } from '@/components/EmptyState'
import type { BoardItem, Job, JobStatus, JOB_STATUS_LABELS, JOB_STATUS_COLORS, BOARD_CATEGORY_LABELS, BOARD_CATEGORY_COLORS } from '@/types'
import * as T from '@/types'

export function Today() {
  const navigate = useNavigate()
  const today = new Date()

  // Fetch active board items
  const { data: boardItems } = useCollection<BoardItem>('boardItems', [
    where('archivedAt', '==', null),
    orderBy('createdAt', 'desc'),
  ])

  // Fetch active jobs
  const { data: jobs } = useCollection<Job>('jobs', [
    where('archivedAt', '==', null),
    orderBy('createdAt', 'desc'),
  ])

  // Stats
  const activeJobs = jobs.filter(j => !['paid', 'complete'].includes(j.status))
  const urgentItems = boardItems.filter(b => b.priority === 'urgent' && b.status !== 'done')
  const todoItems = boardItems.filter(b => b.status === 'todo')

  // Today's items (due today or urgent)
  const todayItems = boardItems.filter(b => {
    if (b.status === 'done') return false
    if (b.priority === 'urgent') return true
    if (b.dueDate) {
      const due = b.dueDate.toDate()
      return isToday(due)
    }
    return false
  })

  // Upcoming scheduled jobs
  const upcomingJobs = jobs
    .filter(j => j.scheduledDate && ['scheduled', 'approved'].includes(j.status))
    .sort((a, b) => (a.scheduledDate?.toMillis() || 0) - (b.scheduledDate?.toMillis() || 0))
    .slice(0, 5)

  return (
    <div className="stack stack-lg">
      {/* Date header */}
      <div>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {format(today, 'EEEE')}
        </p>
        <h1 className="page-title">{format(today, 'MMMM d, yyyy')}</h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="stat-card" onClick={() => navigate('/jobs')} style={{ cursor: 'pointer' }}>
          <div className="stat-value">{activeJobs.length}</div>
          <div className="stat-label">Active Jobs</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/board')} style={{ cursor: 'pointer' }}>
          <div className="stat-value">{todoItems.length}</div>
          <div className="stat-label">To Do</div>
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
        <button className="btn btn-outline btn-sm" style={{ flexDirection: 'column', padding: '14px 8px', height: 'auto', minHeight: 'auto' }} onClick={() => navigate('/board', { state: { openCreate: true } })}>
          <ClipboardList size={20} />
          <span style={{ fontSize: 12 }}>Board Item</span>
        </button>
        <button className="btn btn-outline btn-sm" style={{ flexDirection: 'column', padding: '14px 8px', height: 'auto', minHeight: 'auto' }} onClick={() => navigate('/jobs', { state: { openCreate: true } })}>
          <Briefcase size={20} />
          <span style={{ fontSize: 12 }}>New Job</span>
        </button>
        <button className="btn btn-outline btn-sm" style={{ flexDirection: 'column', padding: '14px 8px', height: 'auto', minHeight: 'auto' }} onClick={() => navigate('/photos', { state: { openCreate: true } })}>
          <Camera size={20} />
          <span style={{ fontSize: 12 }}>Photo</span>
        </button>
      </div>

      {/* Today's items */}
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>
          {todayItems.length > 0 ? "Needs Attention" : "All Clear"} 👋
        </h2>
        {todayItems.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
            <p style={{ margin: 0, fontSize: 15 }}>Nothing urgent today. Nice!</p>
          </div>
        ) : (
          <div className="stack stack-sm">
            {todayItems.map((item) => (
              <div key={item.id} className="card card-pressable" onClick={() => navigate('/board')}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-sm" style={{ marginBottom: 4 }}>
                      <span className={`badge ${T.BOARD_CATEGORY_COLORS[item.category]}`}>
                        {T.BOARD_CATEGORY_LABELS[item.category]}
                      </span>
                      {item.priority === 'urgent' && (
                        <span className="badge badge-urgent">Urgent</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{item.title}</p>
                    {item.assignedTo && (
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                        Assigned to {item.assignedTo}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming jobs */}
      {upcomingJobs.length > 0 && (
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>
            <CalendarDays size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Upcoming Jobs
          </h2>
          <div className="stack stack-sm">
            {upcomingJobs.map((job) => (
              <div key={job.id} className="card card-pressable" onClick={() => navigate(`/jobs/${job.id}`)}>
                <div className="row row-between gap-sm">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15 }}>{job.customerName}</p>
                    <p className="truncate" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                      {job.address}
                    </p>
                    {job.scheduledDate && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--info)', fontWeight: 500 }}>
                        📅 {format(job.scheduledDate.toDate(), 'EEE, MMM d')}
                      </p>
                    )}
                  </div>
                  <span className={`badge ${T.JOB_STATUS_COLORS[job.status]}`}>
                    {T.JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
