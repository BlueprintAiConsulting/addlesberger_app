import { useState, FormEvent } from 'react'
import { orderBy } from 'firebase/firestore'
import { Plus, FileText, Copy, Edit2, Trash2, DollarSign } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, deleteItem } from '@/lib/firestore'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DocumentUploader } from '@/components/DocumentUploader'
import type { Estimate, EstimateTemplate, EstimateStatus, LineItem, Job } from '@/types'
import * as T from '@/types'

export function Estimates() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'estimates' | 'templates'>('estimates')
  const [modalOpen, setModalOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editEstimate, setEditEstimate] = useState<Estimate | null>(null)
  const [editTemplate, setEditTemplate] = useState<EstimateTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'estimate' | 'template'; id: string; name: string } | null>(null)

  // Estimate form
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', qty: 1, unitPrice: 0, unit: 'each', total: 0 }])

  // Price override — allows manually setting the total instead of auto-calculating from line items
  const [useManualPrice, setUseManualPrice] = useState(false)
  const [manualPrice, setManualPrice] = useState<number>(0)

  // Template form
  const [templateName, setTemplateName] = useState('')
  const [templateLines, setTemplateLines] = useState([{ description: '', defaultQty: 1, defaultUnitPrice: 0, unit: 'each' }])

  const { data: estimates } = useCollection<Estimate>('estimates', [orderBy('createdAt', 'desc')])
  const { data: templates } = useCollection<EstimateTemplate>('estimateTemplates', [orderBy('createdAt', 'desc')])
  const { data: jobs } = useCollection<Job>('jobs', [orderBy('createdAt', 'desc')])


  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems]
    ;(updated[idx] as any)[field] = value
    updated[idx].total = updated[idx].qty * updated[idx].unitPrice
    setLineItems(updated)
  }

  const addLine = () => setLineItems([...lineItems, { description: '', qty: 1, unitPrice: 0, unit: 'each', total: 0 }])
  const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0)

  // The effective total — uses manual price if override is active, otherwise line-item subtotal
  const effectiveTotal = useManualPrice ? manualPrice : subtotal

  // Helper to get the display price for an estimate (handles legacy data without priceOverride)
  const getDisplayPrice = (est: Estimate) => {
    if (est.priceOverride != null && est.priceOverride > 0) {
      return est.priceOverride
    }
    return est.total
  }

  // --- Estimate CRUD ---
  const openCreateEstimate = () => {
    setEditEstimate(null)
    setCustomerName(''); setAddress(''); setNotes(''); setJobId(null)
    setLineItems([{ description: '', qty: 1, unitPrice: 0, unit: 'each', total: 0 }])
    setUseManualPrice(false)
    setManualPrice(0)
    setModalOpen(true)
  }

  const openEditEstimate = (est: Estimate) => {
    setEditEstimate(est)
    setCustomerName(est.customerName)
    setAddress(est.address)
    setNotes(est.notes)
    setJobId(est.jobId)
    setLineItems(est.lineItems.map(li => ({ ...li })))
    // Restore price override state
    if (est.priceOverride != null && est.priceOverride > 0) {
      setUseManualPrice(true)
      setManualPrice(est.priceOverride)
    } else {
      setUseManualPrice(false)
      setManualPrice(0)
    }
    setModalOpen(true)
  }

  const handleSubmitEstimate = async (e: FormEvent) => {
    e.preventDefault()
    const finalTotal = useManualPrice ? manualPrice : subtotal
    const data = {
      customerName, address, lineItems, subtotal, tax: 0,
      total: finalTotal,
      priceOverride: useManualPrice ? manualPrice : null,
      notes, jobId,
    }
    if (editEstimate) {
      await updateItem('estimates', editEstimate.id, data)
    } else {
      await addItem('estimates', {
        ...data, jobId: null, status: 'draft' as EstimateStatus,
        templateId: null, createdBy: user?.uid || '',
      })
    }
    setModalOpen(false)
  }

  // --- Template CRUD ---
  const openCreateTemplate = () => {
    setEditTemplate(null)
    setTemplateName(''); setTemplateLines([{ description: '', defaultQty: 1, defaultUnitPrice: 0, unit: 'each' }])
    setTemplateModalOpen(true)
  }

  const openEditTemplate = (tmpl: EstimateTemplate) => {
    setEditTemplate(tmpl)
    setTemplateName(tmpl.name)
    setTemplateLines(tmpl.lineItems.map(li => ({ ...li })))
    setTemplateModalOpen(true)
  }

  const handleSubmitTemplate = async (e: FormEvent) => {
    e.preventDefault()
    const data = { name: templateName, lineItems: templateLines }
    if (editTemplate) {
      await updateItem('estimateTemplates', editTemplate.id, data)
    } else {
      await addItem('estimateTemplates', { ...data, createdBy: user?.uid || '' })
    }
    setTemplateModalOpen(false)
  }

  const useTemplate = (tmpl: EstimateTemplate) => {
    setEditEstimate(null)
    setCustomerName(''); setAddress(''); setNotes(''); setJobId(null)
    setLineItems(tmpl.lineItems.map(li => ({ description: li.description, qty: li.defaultQty, unitPrice: li.defaultUnitPrice, unit: li.unit, total: li.defaultQty * li.defaultUnitPrice })))
    setUseManualPrice(false)
    setManualPrice(0)
    setModalOpen(true)
  }

  const changeEstimateStatus = async (est: Estimate, newStatus: EstimateStatus) => {
    await updateItem('estimates', est.id, { status: newStatus })
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Estimates</h1>
        <button className="btn btn-accent btn-sm" onClick={() => tab === 'templates' ? openCreateTemplate() : openCreateEstimate()}>
          <Plus size={18} /> {tab === 'templates' ? 'Template' : 'Estimate'}
        </button>
      </div>

      {/* Tabs */}
      <div className="filter-tabs">
        <button className={`filter-tab ${tab === 'estimates' ? 'active' : ''}`} onClick={() => setTab('estimates')}>Estimates</button>
        <button className={`filter-tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>Templates</button>
      </div>

      {tab === 'estimates' ? (
        estimates.length === 0 ? (
          <EmptyState icon={<FileText />} message="No estimates yet" action={<button className="btn btn-primary btn-sm" onClick={openCreateEstimate}>Create Estimate</button>} />
        ) : (
          <div className="stack stack-sm">
            {estimates.map(est => (
              <div key={est.id} className="card card-pressable" onClick={() => openEditEstimate(est)}>
                <div className="row row-between gap-sm" style={{ marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 16 }}>{est.customerName}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{est.address}</p>
                  </div>
                  <span className="badge" style={{ background: T.ESTIMATE_STATUS_COLORS[est.status]?.bg, color: T.ESTIMATE_STATUS_COLORS[est.status]?.color }}>{T.ESTIMATE_STATUS_LABELS[est.status]}</span>
                </div>
                <div className="row row-between" style={{ marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>${getDisplayPrice(est).toLocaleString()}</span>
                    {est.priceOverride != null && est.priceOverride > 0 && (
                      <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--muted)', fontStyle: 'italic' }}>
                        <DollarSign size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> set price
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{est.lineItems.length} items</span>
                </div>
                <div className="row gap-sm" style={{ flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  {est.status === 'draft' && <button className="btn btn-sm btn-primary" onClick={() => changeEstimateStatus(est, 'sent')}>Mark Sent</button>}
                  {est.status === 'sent' && (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => changeEstimateStatus(est, 'approved')}>Approved</button>
                      <button className="btn btn-sm btn-outline" onClick={() => changeEstimateStatus(est, 'declined')}>Declined</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="stack stack-md">
          {/* Document uploader */}
          <div>
            <h2 className="section-heading" style={{ marginBottom: 10 }}>🤖 Import from Document</h2>
            <DocumentUploader type="estimate" userId={user?.uid || ''} />
          </div>

          {/* Manual templates */}
          <div>
            <h2 className="section-heading" style={{ marginBottom: 10 }}>✍️ Quick-Fill Templates</h2>
          </div>
          {templates.length === 0 ? (
            <EmptyState icon={<Copy />} message="No quick-fill templates yet" action={<button className="btn btn-primary btn-sm" onClick={openCreateTemplate}>Create Template</button>} />
          ) : (
          <div className="stack stack-sm">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="card">
                <div className="row row-between">
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 16 }}>{tmpl.name}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{tmpl.lineItems.length} line items</p>
                  </div>
                  <div className="row gap-sm">
                    <button className="btn btn-sm btn-primary" onClick={() => useTemplate(tmpl)}>Use</button>
                    <button className="btn btn-sm btn-outline" onClick={() => openEditTemplate(tmpl)}><Edit2 size={14} /></button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setDeleteTarget({ type: 'template', id: tmpl.id, name: tmpl.name })}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      <button className="fab" onClick={() => tab === 'templates' ? openCreateTemplate() : openCreateEstimate()}><Plus size={24} /></button>

      {/* Estimate Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEstimate ? 'Edit Estimate' : 'New Estimate'}>
        <form onSubmit={handleSubmitEstimate} className="stack stack-md">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Customer</label><input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} required /></div>
            <div><label className="label">Address</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} required /></div>
          </div>

          <div>
            <label className="label">Link to Job (optional)</label>
            <select className="input select" value={jobId || ''} onChange={e => setJobId(e.target.value || null)}>
              <option value="">No job linked</option>
              {jobs.filter(j => !j.archivedAt).map(j => (
                <option key={j.id} value={j.id}>{j.customerName} — {j.address}</option>
              ))}
            </select>
          </div>

          {/* ── Set Price Toggle ── */}
          <div style={{
            background: useManualPrice ? 'var(--brand-bg, rgba(180,80,30,0.08))' : 'var(--surface, rgba(255,255,255,0.04))',
            border: `1px solid ${useManualPrice ? 'var(--brand, #b4501e)' : 'var(--border)'}`,
            borderRadius: 10,
            padding: '14px 16px',
            transition: 'all 0.2s ease',
          }}>
            <div className="row row-between" style={{ marginBottom: useManualPrice ? 12 : 0 }}>
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <DollarSign size={18} style={{ color: useManualPrice ? 'var(--brand, #b4501e)' : 'var(--muted)' }} />
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Set Price</span>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                    {useManualPrice ? 'Using manual price' : 'Using line item total'}
                  </p>
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useManualPrice}
                  onChange={e => {
                    setUseManualPrice(e.target.checked)
                    if (e.target.checked && manualPrice === 0) {
                      setManualPrice(subtotal || 0)
                    }
                  }}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <span style={{
                  position: 'absolute', inset: 0,
                  background: useManualPrice ? 'var(--brand, #b4501e)' : 'var(--border, #555)',
                  borderRadius: 12, transition: 'background 0.2s ease',
                }} />
                <span style={{
                  position: 'absolute', top: 2, left: useManualPrice ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </label>
            </div>

            {useManualPrice && (
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 18, fontWeight: 700, color: 'var(--brand, #b4501e)', pointerEvents: 'none',
                }}>$</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualPrice || ''}
                  onChange={e => setManualPrice(parseFloat(e.target.value) || 0)}
                  placeholder="Enter total price"
                  style={{
                    paddingLeft: 28, fontSize: 20, fontWeight: 700,
                    textAlign: 'right', minHeight: 48,
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Line Items (always visible, but dimmed when manual price is active) ── */}
          <div style={{ opacity: useManualPrice ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
            <label className="label">Line Items {useManualPrice && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>(for reference only — price is set manually)</span>}</label>
            {lineItems.map((li, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <input className="input" placeholder="Description" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} style={{ minHeight: 40 }} />
                <input className="input" type="number" placeholder="Qty" value={li.qty} onChange={e => updateLineItem(idx, 'qty', parseFloat(e.target.value) || 0)} style={{ minHeight: 40 }} />
                <input className="input" type="number" placeholder="Price" value={li.unitPrice} onChange={e => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} style={{ minHeight: 40 }} />
                {lineItems.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(idx)} style={{ minHeight: 40, padding: '0 8px' }}>✕</button>}
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={addLine}><Plus size={14} /> Add Line</button>
          </div>

          {/* ── Total Display ── */}
          <div className="row row-between" style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {useManualPrice ? 'Set Price' : 'Total'}
            </span>
            <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand)' }}>
              ${effectiveTotal.toLocaleString()}
            </span>
          </div>

          {/* Show line-item subtotal for reference when using manual price */}
          {useManualPrice && subtotal > 0 && (
            <div className="row row-between" style={{ padding: '4px 0', opacity: 0.5 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Line item subtotal</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>${subtotal.toLocaleString()}</span>
            </div>
          )}

          <div><label className="label">Notes</label><textarea className="input textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms, conditions, etc." /></div>

          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            {editEstimate && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                setModalOpen(false)
                setDeleteTarget({ type: 'estimate', id: editEstimate.id, name: editEstimate.customerName })
              }}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {editEstimate ? 'Save Changes' : 'Create Estimate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Template Create/Edit Modal */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editTemplate ? 'Edit Template' : 'New Template'}>
        <form onSubmit={handleSubmitTemplate} className="stack stack-md">
          <div><label className="label">Template Name</label><input className="input" value={templateName} onChange={e => setTemplateName(e.target.value)} required placeholder='e.g. "Standard Tear-Off & Replace"' /></div>
          <div>
            <label className="label">Default Line Items</label>
            {templateLines.map((li, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="Description" value={li.description} onChange={e => { const u = [...templateLines]; u[idx].description = e.target.value; setTemplateLines(u) }} style={{ minHeight: 40 }} />
                <input className="input" type="number" placeholder="Qty" value={li.defaultQty} onChange={e => { const u = [...templateLines]; u[idx].defaultQty = parseFloat(e.target.value) || 0; setTemplateLines(u) }} style={{ minHeight: 40 }} />
                <input className="input" type="number" placeholder="Price" value={li.defaultUnitPrice} onChange={e => { const u = [...templateLines]; u[idx].defaultUnitPrice = parseFloat(e.target.value) || 0; setTemplateLines(u) }} style={{ minHeight: 40 }} />
                {templateLines.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTemplateLines(templateLines.filter((_, i) => i !== idx))} style={{ minHeight: 40, padding: '0 8px' }}>✕</button>}
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setTemplateLines([...templateLines, { description: '', defaultQty: 1, defaultUnitPrice: 0, unit: 'each' }])}><Plus size={14} /> Add Line</button>
          </div>
          <button type="submit" className="btn btn-primary btn-full">{editTemplate ? 'Save Template' : 'Create Template'}</button>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'template' ? 'Template' : 'Estimate'}`}
        message={`Delete "${deleteTarget?.name}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            const col = deleteTarget.type === 'template' ? 'estimateTemplates' : 'estimates'
            await deleteItem(col, deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
