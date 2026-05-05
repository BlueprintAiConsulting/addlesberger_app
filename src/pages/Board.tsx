import { useState, useEffect, useRef, FormEvent } from 'react'
import { where, orderBy, Timestamp } from 'firebase/firestore'
import { format, isPast, isToday } from 'date-fns'
import { Plus, Archive, Camera, Sparkles, Loader2, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, archiveItem, deleteItem } from '@/lib/firestore'
import { uploadPhoto } from '@/lib/storage'
import { extractWhiteboardData, type ExtractedItem } from '@/lib/whiteboardAi'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { BoardItem, BoardCategory, BoardPriority, BoardStatus, UpdateSource } from '@/types'
import * as T from '@/types'

const COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: 'inbox', label: 'Inbox / Needs Sorted' },
  { status: 'estimates', label: 'Estimates' },
  { status: 'repairs', label: 'Repairs' },
  { status: 'activeJobs', label: 'Active Jobs' },
  { status: 'waitingOn', label: 'Waiting On' },
  { status: 'completed', label: 'Completed' },
]

const CONFIDENCE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'High' },
  medium: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Medium' },
  low: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Low' },
}

export function Board() {
  const location = useLocation()
  const { user } = useAuth()
  const photoRef = useRef<HTMLInputElement>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [filterCategory, setFilterCategory] = useState<BoardCategory | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BoardItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoardItem | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<BoardCategory>('note')
  const [priority, setPriority] = useState<BoardPriority>('normal')
  const [source, setSource] = useState<UpdateSource>('charlene-note')
  const [status, setStatus] = useState<BoardStatus>('inbox')
  const [dueDate, setDueDate] = useState('')

  // AI Scan state
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [extractionSummary, setExtractionSummary] = useState('')
  const [extractionError, setExtractionError] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [acceptingAll, setAcceptingAll] = useState(false)
  const [autoCreated, setAutoCreated] = useState(0)

  useEffect(() => {
    if ((location.state as any)?.openCreate) {
      setModalOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const constraints = showArchived
    ? [orderBy('createdAt', 'desc')]
    : [where('archivedAt', '==', null), orderBy('createdAt', 'desc')]

  const { data: boardItems } = useCollection<BoardItem>('boardItems', constraints, [showArchived])

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
    setTitle(''); setDescription(''); setCategory('note')
    setPriority('normal'); setSource('charlene-note')
    setStatus('inbox'); setDueDate('')
    setModalOpen(true)
  }

  const openEdit = (item: BoardItem) => {
    setEditItem(item)
    setTitle(item.title); setDescription(item.description)
    setCategory(T.migrateBoardCategory(item.category) as BoardCategory)
    setPriority(item.priority); setSource((item as any).source || 'other')
    setStatus(T.migrateBoardStatus(item.status))
    setDueDate(item.dueDate ? new Date(item.dueDate.toDate()).toISOString().split('T')[0] : '')
    setModalOpen(true)
  }

  const handleCategoryChange = (newCat: BoardCategory) => {
    setCategory(newCat)
    if (!editItem) setStatus(T.CATEGORY_DEFAULT_STATUS[newCat])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const data = {
      title, description, category, priority, status, source,
      assignedTo: null,
      dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate + 'T00:00:00')) : null,
    }
    if (editItem) {
      await updateItem('boardItems', editItem.id, data)
    } else {
      await addItem('boardItems', { ...data, createdBy: user?.uid || '', archivedAt: null })
    }
    setModalOpen(false)
  }

  const moveItem = async (item: BoardItem, newStatus: BoardStatus) => {
    await updateItem('boardItems', item.id, { status: newStatus })
  }

  const getAdjacentStatuses = (currentStatus: BoardStatus) => {
    const idx = COLUMNS.findIndex(c => c.status === currentStatus)
    return {
      prev: idx > 0 ? COLUMNS[idx - 1] : null,
      next: idx < COLUMNS.length - 1 ? COLUMNS[idx + 1] : null,
    }
  }

  // ─── Photo Scan Flow ──────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanFile(file)
    setScanPreview(URL.createObjectURL(file))
    setExtractedItems([]); setExtractionSummary(''); setExtractionError('')
    setEditingIndex(null); setAutoCreated(0)
    setScanModalOpen(true)
    // Auto-trigger scan immediately
    setTimeout(() => runScan(file), 100)
  }

  const runScan = async (file: File) => {
    setScanning(true); setUploading(true); setExtractionError('')

    try {
      const { url } = await uploadPhoto(file)
      await addItem('photos', {
        url, fileName: file.name, caption: 'Whiteboard scan',
        tags: ['ryan-whiteboard'], source: 'ryan-whiteboard',
        processed: false, boardItemId: null, thumbnailUrl: null,
        jobId: null, uploadedBy: user?.uid || '',
      })
      setUploading(false)

      // Now scan with AI
      const result = await extractWhiteboardData(url)
      if (result.error) {
        setExtractionError(result.error)
      } else if (result.items.length === 0) {
        setExtractionError('No readable items found on this whiteboard.')
      } else {
        // Auto-accept high-confidence items, show review for the rest
        const highConf = result.items.filter(i => i.confidence === 'high')
        const needsReview = result.items.filter(i => i.confidence !== 'high')

        // Auto-create high-confidence items immediately
        let created = 0
        for (const item of highConf) {
          await addItem('boardItems', {
            title: item.customerName || item.description.slice(0, 60) || 'Whiteboard item',
            description: [item.address && `📍 ${item.address}`, item.phone && `📞 ${item.phone}`, item.jobType !== 'other' && `🔧 ${item.jobType}`, item.estimateAmount && `💰 $${item.estimateAmount.toLocaleString()}`, item.description].filter(Boolean).join('\n'),
            category: item.jobType === 'repair' ? 'repair' : 'estimate',
            priority: item.priority, status: 'inbox' as BoardStatus,
            source: 'ryan-whiteboard' as UpdateSource,
            assignedTo: null, dueDate: null, createdBy: user?.uid || '', archivedAt: null,
          })
          if (item.customerName && (item.address || item.description)) {
            await addItem('jobs', {
              customerName: item.customerName, customerPhone: item.phone || '',
              customerEmail: '', address: item.address || '',
              description: item.description || '', status: 'lead',
              estimateAmount: item.estimateAmount, invoiceAmount: null, paidAmount: null,
              notes: `Auto-extracted from whiteboard on ${format(new Date(), 'MMM d, yyyy')}`,
              scheduledDate: null, completedDate: null,
              createdBy: user?.uid || '', archivedAt: null,
            })
          }
          created++
        }
        setAutoCreated(created)

        if (needsReview.length > 0) {
          setExtractedItems(needsReview)
          setExtractionSummary(result.rawSummary)
        } else {
          // All items were high-confidence — auto-close after brief success
          setExtractionSummary(`✅ ${created} item${created !== 1 ? 's' : ''} auto-added to your Inbox`)
          setTimeout(() => closeScanModal(), 2500)
        }
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Upload or scan failed')
    }
    setScanning(false); setUploading(false)
  }

  const updateExtractedItem = (index: number, field: keyof ExtractedItem, value: any) => {
    setExtractedItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeExtractedItem = (index: number) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleAcceptAll = async () => {
    if (extractedItems.length === 0) return
    setAcceptingAll(true)
    try {
      for (const item of extractedItems) {
        await addItem('boardItems', {
          title: item.customerName || item.description.slice(0, 60) || 'Whiteboard item',
          description: [
            item.address && `📍 ${item.address}`,
            item.phone && `📞 ${item.phone}`,
            item.jobType !== 'other' && `🔧 ${item.jobType}`,
            item.estimateAmount && `💰 $${item.estimateAmount.toLocaleString()}`,
            item.description,
          ].filter(Boolean).join('\n'),
          category: item.jobType === 'repair' ? 'repair' : 'estimate',
          priority: item.priority, status: 'inbox' as BoardStatus,
          source: 'ryan-whiteboard' as UpdateSource,
          assignedTo: null, dueDate: null,
          createdBy: user?.uid || '', archivedAt: null,
        })
        if (item.customerName && (item.address || item.description)) {
          await addItem('jobs', {
            customerName: item.customerName, customerPhone: item.phone || '',
            customerEmail: '', address: item.address || '',
            description: item.description || '', status: 'lead',
            estimateAmount: item.estimateAmount, invoiceAmount: null, paidAmount: null,
            notes: `Auto-extracted from whiteboard on ${format(new Date(), 'MMM d, yyyy')}`,
            scheduledDate: null, completedDate: null,
            createdBy: user?.uid || '', archivedAt: null,
          })
        }
      }
      setScanModalOpen(false); setScanFile(null); setScanPreview(null)
      setExtractedItems([]); setExtractionSummary('')
    } catch (err) {
      alert('Failed to save items. Please try again.')
    }
    setAcceptingAll(false)
  }

  const closeScanModal = () => {
    setScanModalOpen(false); setScanFile(null); setScanPreview(null)
    setExtractedItems([]); setExtractionSummary(''); setExtractionError('')
    setEditingIndex(null)
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Board</h1>
        <div className="row gap-sm">
          <button className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowArchived(!showArchived)}>
            <Archive size={16} />
          </button>
          <button className="btn btn-sm" onClick={() => photoRef.current?.click()}
            style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)', color: '#fff', border: 'none' }}>
            <Camera size={16} /> Scan
          </button>
          <button className="btn btn-accent btn-sm" onClick={openCreate}>
            <Plus size={18} /> Capture
          </button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoSelect} />
      </div>

      {/* Category filter */}
      <div className="filter-tabs">
        <button className={`filter-tab ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>All</button>
        {Object.entries(T.BOARD_CATEGORY_LABELS).map(([key, label]) => (
          <button key={key} className={`filter-tab ${filterCategory === key ? 'active' : ''}`} onClick={() => setFilterCategory(key as BoardCategory)}>{label}</button>
        ))}
      </div>

      {/* Board columns */}
      <div className="board-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUMNS.map((col) => {
          const items = filteredItems.filter((i) => i.status === col.status)
          const { prev, next } = getAdjacentStatuses(col.status)
          const isInbox = col.status === 'inbox'
          return (
            <div key={col.status} className="board-col" style={{ minWidth: 260, flex: '0 0 260px' }}>
              <div className={`row row-between ${
                col.status === 'inbox' ? 'col-header-inbox' :
                col.status === 'estimates' ? 'col-header-estimates' :
                col.status === 'repairs' ? 'col-header-repairs' :
                col.status === 'activeJobs' ? 'col-header-active' :
                col.status === 'waitingOn' ? 'col-header-waiting' : 'col-header-completed'
              }`} style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{col.label}</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: isInbox && items.length > 0 ? 'var(--brand)' : 'var(--muted)', background: isInbox && items.length > 0 ? 'var(--brand-subtle)' : 'var(--bg)', padding: '2px 8px', borderRadius: 999, minWidth: 24, textAlign: 'center' }}>{items.length}</span>
              </div>
              <div className="stack stack-sm" style={{ minHeight: 60, background: isInbox ? '#FFF8F5' : 'var(--bg)', borderRadius: 'var(--radius)', padding: 8, border: isInbox && items.length > 0 ? '1.5px dashed var(--brand)' : 'none' }}>
                {items.length === 0 ? (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', padding: 16 }}>{isInbox ? 'No unsorted items 👍' : 'Empty'}</p>
                ) : items.map((item) => (
                  <div key={item.id} className="card card-pressable" onClick={() => openEdit(item)}>
                    <div className="row gap-sm" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${T.BOARD_CATEGORY_COLORS[item.category as BoardCategory] || 'bg-slate-100 text-slate-600'}`}>{T.BOARD_CATEGORY_LABELS[item.category as BoardCategory] || item.category}</span>
                      {item.priority === 'urgent' && <span className="badge badge-urgent">Urgent</span>}
                    </div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>{item.title}</p>
                    {item.description && <p className="truncate" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{item.description}</p>}
                    {(item as any).source && (item as any).source !== 'other' && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>📥 {T.UPDATE_SOURCE_LABELS[(item as any).source as UpdateSource] || (item as any).source}</p>
                    )}
                    {item.dueDate && (() => {
                      const due = item.dueDate.toDate()
                      const overdue = isPast(due) && !isToday(due) && item.status !== 'completed'
                      return <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: overdue ? 'var(--danger)' : 'var(--info)' }}>📅 {format(due, 'EEE, MMM d')}{overdue ? ' — overdue' : ''}</p>
                    })()}
                    <div className="row gap-sm" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                      {prev && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', minHeight: 26 }} onClick={() => moveItem(item, prev.status)}>← {prev.label.split(' /')[0]}</button>}
                      {next && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px', minHeight: 26 }} onClick={() => moveItem(item, next.status)}>{next.label.split(' /')[0]} →</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <button className="fab" onClick={openCreate} aria-label="Capture update"><Plus size={24} /></button>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Item' : 'Capture Update'}>
        <form onSubmit={handleSubmit} className="stack stack-md">
          <div>
            <label className="label">What happened?</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Ryan texted — Smith roof needs flashing" />
          </div>
          <div>
            <label className="label">Details / Notes</label>
            <textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any extra info from the text, photo, or call" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Source</label>
              <select className="input select" value={source} onChange={(e) => setSource(e.target.value as UpdateSource)}>
                {Object.entries(T.UPDATE_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input select" value={category} onChange={(e) => handleCategoryChange(e.target.value as BoardCategory)}>
                {Object.entries(T.BOARD_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Column</label>
              <select className="input select" value={status} onChange={(e) => setStatus(e.target.value as BoardStatus)}>
                {COLUMNS.map(col => <option key={col.status} value={col.status}>{col.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input select" value={priority} onChange={(e) => setPriority(e.target.value as BoardPriority)}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due Date (optional)</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {editItem && !editItem.archivedAt && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await archiveItem('boardItems', editItem.id); setModalOpen(false) }}>Archive</button>
            )}
            {editItem && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => { setModalOpen(false); setDeleteTarget(editItem) }}>Delete</button>
            )}
            <button type="submit" className="btn btn-primary">{editItem ? 'Save' : 'Capture'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── AI Scan Whiteboard Modal ─── */}
      <Modal open={scanModalOpen} onClose={closeScanModal} title="📸 Scan Whiteboard">
        <div className="stack stack-md">
          {scanPreview && (
            <img src={scanPreview} alt="Whiteboard" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
          )}

          {/* Scanning */}
          {scanning && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Loader2 size={28} style={{ animation: 'spin .7s linear infinite', color: 'var(--purple)', margin: '0 auto 10px', display: 'block' }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>
                {uploading ? 'Uploading photo...' : "Scanning Ryan's whiteboard..."}
              </p>
            </div>
          )}

          {/* Auto-created success */}
          {!scanning && autoCreated > 0 && extractedItems.length === 0 && !extractionError && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>✅</span>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 17, color: 'var(--success)' }}>
                {autoCreated} item{autoCreated !== 1 ? 's' : ''} added to Inbox
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Auto-created from high-confidence extraction</p>
            </div>
          )}

          {/* Error */}
          {extractionError && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 14 }}>
              {extractionError}
              <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: 10 }} onClick={() => runScan(scanFile!)}>Retry</button>
            </div>
          )}

          {/* Extracted items */}
          {extractedItems.length > 0 && (
            <>
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--purple-bg)', border: '1px solid rgba(124,58,237,.15)' }}>
                <div className="row gap-sm" style={{ marginBottom: 2 }}>
                  <Sparkles size={14} style={{ color: 'var(--purple)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Found {extractedItems.length} item{extractedItems.length !== 1 ? 's' : ''}</span>
                </div>
                {extractionSummary && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{extractionSummary}</p>}
              </div>

              {extractedItems.map((item, idx) => {
                const conf = CONFIDENCE_STYLES[item.confidence] || CONFIDENCE_STYLES.medium
                const isEditing = editingIndex === idx
                return (
                  <div key={idx} className="card" style={{ borderLeft: '3px solid var(--purple)' }}>
                    <div className="row row-between gap-sm" style={{ marginBottom: 6 }}>
                      <div className="row gap-sm">
                        <span style={{ fontSize: 13, fontWeight: 700 }}>#{idx + 1}</span>
                        <span className="badge" style={{ background: conf.bg, color: conf.color, fontSize: 10 }}>{conf.label}</span>
                        {item.priority === 'urgent' && <span className="badge badge-urgent">Urgent</span>}
                      </div>
                      <div className="row gap-sm">
                        <button className="btn btn-ghost btn-sm" style={{ padding: 4, minHeight: 28 }} onClick={() => setEditingIndex(isEditing ? null : idx)}>
                          {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: 4, minHeight: 28, color: 'var(--danger)' }} onClick={() => removeExtractedItem(idx)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {!isEditing ? (
                      <div>
                        <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15 }}>{item.customerName || 'Unknown Customer'}</p>
                        {item.address && <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--text-secondary)' }}>📍 {item.address}</p>}
                        {item.phone && <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--text-secondary)' }}>📞 {item.phone}</p>}
                        <div className="row gap-sm" style={{ marginTop: 4 }}>
                          <span className="badge" style={{ background: 'var(--bg)', fontSize: 11 }}>{item.jobType}</span>
                          {item.estimateAmount != null && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>${item.estimateAmount.toLocaleString()}</span>}
                        </div>
                        {item.description && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{item.description}</p>}
                      </div>
                    ) : (
                      <div className="stack stack-sm" style={{ marginTop: 4 }}>
                        <div><label className="label">Customer</label><input className="input" value={item.customerName} onChange={e => updateExtractedItem(idx, 'customerName', e.target.value)} /></div>
                        <div><label className="label">Address</label><input className="input" value={item.address} onChange={e => updateExtractedItem(idx, 'address', e.target.value)} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div><label className="label">Phone</label><input className="input" value={item.phone} onChange={e => updateExtractedItem(idx, 'phone', e.target.value)} /></div>
                          <div><label className="label">Estimate $</label><input className="input" type="number" value={item.estimateAmount ?? ''} onChange={e => updateExtractedItem(idx, 'estimateAmount', e.target.value ? Number(e.target.value) : null)} /></div>
                        </div>
                        <div><label className="label">Job Type</label>
                          <select className="input select" value={item.jobType} onChange={e => updateExtractedItem(idx, 'jobType', e.target.value)}>
                            {['shingle','rubber roof','metal roof','repair','gutter','flashing','inspection','other'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div><label className="label">Notes</label><textarea className="input textarea" value={item.description} onChange={e => updateExtractedItem(idx, 'description', e.target.value)} rows={2} /></div>
                      </div>
                    )}
                  </div>
                )
              })}

              <button className="btn btn-primary btn-full" onClick={handleAcceptAll} disabled={acceptingAll}
                style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)', border: 'none' }}>
                {acceptingAll ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Creating...</> :
                  <><Plus size={16} /> Accept All — Create {extractedItems.length} Item{extractedItems.length !== 1 ? 's' : ''}</>}
              </button>
              <button className="btn btn-ghost btn-full" onClick={closeScanModal}>Cancel</button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleteTarget} title="Delete Item" message={`Delete "${deleteTarget?.title}"? This can't be undone.`}
        confirmLabel="Delete" danger
        onConfirm={async () => { if (deleteTarget) { await deleteItem('boardItems', deleteTarget.id); setDeleteTarget(null) } }}
        onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
