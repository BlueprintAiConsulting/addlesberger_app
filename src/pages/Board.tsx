import { useState, useEffect, FormEvent } from 'react'
import { where, orderBy, Timestamp } from 'firebase/firestore'
import { format, isPast, isToday } from 'date-fns'
import { Plus, Archive } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, archiveItem, deleteItem } from '@/lib/firestore'
import { ALLOWED_EMAILS } from '@/firebase'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { BoardItem, BoardCategory, BoardPriority, BoardStatus } from '@/types'
import * as T from '@/types'

const COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: 'new', label: 'New / Needs Added' },
  { status: 'estimates', label: 'Estimates' },
  { status: 'repairs', label: 'Repairs' },
  { status: 'activeJobs', label: 'Active Jobs' },
  { status: 'waitingOn', label: 'Waiting On' },
  { status: 'completed', label: 'Completed' },
]

export function Board() {
  const location = useLocation()
  const { user } = useAuth()
  const [showArchived, setShowArchived] = useState(false)
  const [filterCategory, setFilterCategory] = useState<BoardCategory | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BoardItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoardItem | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<BoardCategory>('other')
  const [priority, setPriority] = useState<BoardPriority>('normal')
  const [status, setStatus] = useState<BoardStatus>('new')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Auto-open create modal when navigated with state.openCreate
  useEffect(() => {
    if ((location.state as any)?.openCreate) {
      setModalOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const constraints = showArchived
    ? [orderBy('createdAt', 'desc')]
    : [where('archivedAt', '==', null), orderBy('createdAt', 'desc')]

  const { data: boardItems } = useCollection<BoardItem>(
    'boardItems', constraints, [showArchived]
  )

  // Migrate old statuses/categories on read
  const migratedItems = boardItems.map(item => ({
    ...item,
    status: T.migrateBoardStatus(item.status),
    category: T.migrateBoardCategory(item.category),
  }))

  const filteredItems = filterCategory === 'all'
    ? migratedItems
    : migratedItems.filter((i) => i.category === filterCategory)

  const openCreate = () => {
    setEditItem(null)
    setTitle(''); setDescription(''); setCategory('other')
    setPriority('normal'); setStatus('new'); setAssignedTo(''); setDueDate('')
    setModalOpen(true)
  }

  const openEdit = (item: BoardItem) => {
    setEditItem(item)
    setTitle(item.title)
    setDescription(item.description)
    setCategory(T.migrateBoardCategory(item.category) as BoardCategory)
    setPriority(item.priority)
    setStatus(T.migrateBoardStatus(item.status))
    setAssignedTo(item.assignedTo || '')
    setDueDate(
      item.dueDate
        ? new Date(item.dueDate.toDate()).toISOString().split('T')[0]
        : ''
    )
    setModalOpen(true)
  }

  // Auto-set default status when category changes (new items only)
  const handleCategoryChange = (newCat: BoardCategory) => {
    setCategory(newCat)
    if (!editItem) {
      setStatus(T.CATEGORY_DEFAULT_STATUS[newCat])
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const data = {
      title, description, category, priority, status,
      assignedTo: assignedTo || null,
      dueDate: dueDate
        ? Timestamp.fromDate(new Date(dueDate + 'T00:00:00'))
        : null,
    }
    if (editItem) {
      await updateItem('boardItems', editItem.id, data)
    } else {
      await addItem('boardItems', {
        ...data,
        createdBy: user?.uid || '',
        archivedAt: null,
      })
    }
    setModalOpen(false)
  }

  const moveItem = async (item: BoardItem, newStatus: BoardStatus) => {
    await updateItem('boardItems', item.id, { status: newStatus })
  }

  // Get adjacent columns for move buttons
  const getAdjacentStatuses = (currentStatus: BoardStatus) => {
    const idx = COLUMNS.findIndex(c => c.status === currentStatus)
    return {
      prev: idx > 0 ? COLUMNS[idx - 1] : null,
      next: idx < COLUMNS.length - 1 ? COLUMNS[idx + 1] : null,
    }
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Board</h1>
        <div className="row gap-sm">
          <button
            className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive size={16} />
          </button>
          <button className="btn btn-accent btn-sm" onClick={openCreate}>
            <Plus size={18} /> Add
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filterCategory === 'all' ? 'active' : ''}`}
          onClick={() => setFilterCategory('all')}
        >
          All
        </button>
        {Object.entries(T.BOARD_CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`filter-tab ${filterCategory === key ? 'active' : ''}`}
            onClick={() => setFilterCategory(key as BoardCategory)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Board columns — horizontal scroll on mobile */}
      <div style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
        WebkitOverflowScrolling: 'touch',
      }}>
        {COLUMNS.map((col) => {
          const items = filteredItems.filter((i) => i.status === col.status)
          const { prev, next } = getAdjacentStatuses(col.status)
          return (
            <div key={col.status} style={{ minWidth: 260, flex: '0 0 260px' }}>
              <div className="row row-between" style={{ marginBottom: 10 }}>
                <h3 style={{
                  fontSize: 13, fontWeight: 700, margin: 0,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: 'var(--text-secondary)',
                }}>
                  {col.label}
                </h3>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--muted)',
                  background: 'var(--bg)', padding: '2px 8px', borderRadius: 999,
                }}>
                  {items.length}
                </span>
              </div>

              <div className="stack stack-sm" style={{
                minHeight: 60, background: 'var(--bg)',
                borderRadius: 'var(--radius)', padding: 8,
              }}>
                {items.length === 0 ? (
                  <p style={{
                    textAlign: 'center', fontSize: 13,
                    color: 'var(--muted)', padding: 16,
                  }}>
                    Empty
                  </p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="card card-pressable"
                      onClick={() => openEdit(item)}
                    >
                      <div className="row gap-sm" style={{
                        marginBottom: 6, flexWrap: 'wrap',
                      }}>
                        <span className={`badge ${T.BOARD_CATEGORY_COLORS[item.category as BoardCategory] || 'bg-slate-100 text-slate-600'}`}>
                          {T.BOARD_CATEGORY_LABELS[item.category as BoardCategory] || item.category}
                        </span>
                        {item.priority === 'urgent' && (
                          <span className="badge badge-urgent">Urgent</span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="truncate" style={{
                          margin: 0, fontSize: 13, color: 'var(--muted)',
                        }}>
                          {item.description}
                        </p>
                      )}
                      {item.assignedTo && (
                        <p style={{
                          margin: '6px 0 0', fontSize: 12,
                          color: 'var(--text-secondary)',
                        }}>
                          👤 {item.assignedTo}
                        </p>
                      )}
                      {item.dueDate && (() => {
                        const due = item.dueDate.toDate()
                        const overdue = isPast(due) && !isToday(due) && item.status !== 'completed'
                        return (
                          <p style={{
                            margin: '4px 0 0', fontSize: 12, fontWeight: 500,
                            color: overdue ? 'var(--danger)' : 'var(--info)',
                          }}>
                            📅 {format(due, 'EEE, MMM d')}{overdue ? ' — overdue' : ''}
                          </p>
                        )
                      })()}
                      {/* Quick move buttons */}
                      <div
                        className="row gap-sm"
                        style={{ marginTop: 10 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {prev && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px', minHeight: 26 }}
                            onClick={() => moveItem(item, prev.status)}
                          >
                            ← {prev.label.split(' /')[0]}
                          </button>
                        )}
                        {next && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px', minHeight: 26 }}
                            onClick={() => moveItem(item, next.status)}
                          >
                            {next.label.split(' /')[0]} →
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* FAB */}
      <button className="fab" onClick={openCreate} aria-label="Add board item">
        <Plus size={24} />
      </button>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Edit Item' : 'New Board Item'}
      >
        <form onSubmit={handleSubmit} className="stack stack-md">
          <div>
            <label className="label">Title</label>
            <input
              className="input" value={title}
              onChange={(e) => setTitle(e.target.value)}
              required placeholder="What needs to be done?"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input textarea" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details (optional)"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Category</label>
              <select
                className="input select" value={category}
                onChange={(e) => handleCategoryChange(e.target.value as BoardCategory)}
              >
                {Object.entries(T.BOARD_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Column</label>
              <select
                className="input select" value={status}
                onChange={(e) => setStatus(e.target.value as BoardStatus)}
              >
                {COLUMNS.map(col => (
                  <option key={col.status} value={col.status}>{col.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Priority</label>
              <select
                className="input select" value={priority}
                onChange={(e) => setPriority(e.target.value as BoardPriority)}
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <select
                className="input select" value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {ALLOWED_EMAILS.map((email: string) => {
                  const name = email.split('@')[0].replace(/[.]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                  return <option key={email} value={name}>{name}</option>
                })}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              className="input" type="date" value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {editItem && !editItem.archivedAt && (
              <button
                type="button" className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await archiveItem('boardItems', editItem.id)
                  setModalOpen(false)
                }}
              >
                Archive
              </button>
            )}
            {editItem && (
              <button
                type="button" className="btn btn-danger btn-sm"
                onClick={() => { setModalOpen(false); setDeleteTarget(editItem) }}
              >
                Delete
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {editItem ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Item"
        message={`Delete "${deleteTarget?.title}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteItem('boardItems', deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
