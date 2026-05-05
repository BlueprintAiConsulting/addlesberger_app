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
  { status: 'todo', label: 'To Do' },
  { status: 'in-progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
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
  const [category, setCategory] = useState<BoardCategory>('repair')
  const [priority, setPriority] = useState<BoardPriority>('normal')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Auto-open create modal when navigated with state.openCreate (from Today quick add)
  useEffect(() => {
    if ((location.state as any)?.openCreate) {
      setModalOpen(true)
      // Clear state so back navigation doesn't re-trigger
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const constraints = showArchived
    ? [orderBy('createdAt', 'desc')]
    : [where('archivedAt', '==', null), orderBy('createdAt', 'desc')]

  const { data: boardItems } = useCollection<BoardItem>(
    'boardItems', constraints, [showArchived]
  )

  const filteredItems = filterCategory === 'all'
    ? boardItems
    : boardItems.filter((i) => i.category === filterCategory)

  const openCreate = () => {
    setEditItem(null)
    setTitle(''); setDescription(''); setCategory('repair')
    setPriority('normal'); setAssignedTo(''); setDueDate('')
    setModalOpen(true)
  }

  const openEdit = (item: BoardItem) => {
    setEditItem(item)
    setTitle(item.title)
    setDescription(item.description)
    setCategory(item.category)
    setPriority(item.priority)
    setAssignedTo(item.assignedTo || '')
    setDueDate(
      item.dueDate
        ? new Date(item.dueDate.toDate()).toISOString().split('T')[0]
        : ''
    )
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const data = {
      title, description, category, priority,
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
        status: 'todo' as BoardStatus,
        createdBy: user?.uid || '',
        archivedAt: null,
      })
    }
    setModalOpen(false)
  }

  const moveItem = async (item: BoardItem, newStatus: BoardStatus) => {
    await updateItem('boardItems', item.id, { status: newStatus })
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

      {/* Board columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {COLUMNS.map((col) => {
          const items = filteredItems.filter((i) => i.status === col.status)
          return (
            <div key={col.status}>
              <div className="row row-between" style={{ marginBottom: 10 }}>
                <h3 style={{
                  fontSize: 14, fontWeight: 700, margin: 0,
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
                        <span className={`badge ${T.BOARD_CATEGORY_COLORS[item.category]}`}>
                          {T.BOARD_CATEGORY_LABELS[item.category]}
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
                        const overdue = isPast(due) && !isToday(due) && item.status !== 'done'
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
                        {col.status !== 'todo' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12, padding: '4px 10px', minHeight: 28 }}
                            onClick={() =>
                              moveItem(item, col.status === 'done' ? 'in-progress' : 'todo')
                            }
                          >
                            ← {col.status === 'done' ? 'In Progress' : 'To Do'}
                          </button>
                        )}
                        {col.status !== 'done' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12, padding: '4px 10px', minHeight: 28 }}
                            onClick={() =>
                              moveItem(item, col.status === 'todo' ? 'in-progress' : 'done')
                            }
                          >
                            {col.status === 'todo' ? 'In Progress' : 'Done'} →
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
                onChange={(e) => setCategory(e.target.value as BoardCategory)}
              >
                {Object.entries(T.BOARD_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
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
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            <div>
              <label className="label">Due Date</label>
              <input
                className="input" type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
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
