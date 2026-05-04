import { useState, FormEvent } from 'react'
import { orderBy, Timestamp } from 'firebase/firestore'
import { Plus, FileText, Copy } from 'lucide-react'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, deleteItem } from '@/lib/firestore'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Estimate, EstimateTemplate, EstimateStatus, LineItem } from '@/types'
import * as T from '@/types'

export function Estimates() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'estimates' | 'templates'>('estimates')
  const [modalOpen, setModalOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  // Estimate form
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', qty: 1, unitPrice: 0, unit: 'each', total: 0 }])

  // Template form
  const [templateName, setTemplateName] = useState('')
  const [templateLines, setTemplateLines] = useState([{ description: '', defaultQty: 1, defaultUnitPrice: 0, unit: 'each' }])

  const { data: estimates } = useCollection<Estimate>('estimates', [orderBy('createdAt', 'desc')])
  const { data: templates } = useCollection<EstimateTemplate>('estimateTemplates', [orderBy('createdAt', 'desc')])

  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems]
    ;(updated[idx] as any)[field] = value
    updated[idx].total = updated[idx].qty * updated[idx].unitPrice
    setLineItems(updated)
  }

  const addLine = () => setLineItems([...lineItems, { description: '', qty: 1, unitPrice: 0, unit: 'each', total: 0 }])
  const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0)

  const handleCreateEstimate = async (e: FormEvent) => {
    e.preventDefault()
    await addItem('estimates', {
      jobId: null, customerName, address, lineItems, subtotal, tax: 0, total: subtotal,
      status: 'draft' as EstimateStatus, notes, templateId: null, createdBy: user?.uid || '',
    })
    setModalOpen(false)
    setCustomerName(''); setAddress(''); setNotes('')
    setLineItems([{ description: '', qty: 1, unitPrice: 0, unit: 'each', total: 0 }])
  }

  const handleCreateTemplate = async (e: FormEvent) => {
    e.preventDefault()
    await addItem('estimateTemplates', { name: templateName, lineItems: templateLines, createdBy: user?.uid || '' })
    setTemplateModalOpen(false)
    setTemplateName(''); setTemplateLines([{ description: '', defaultQty: 1, defaultUnitPrice: 0, unit: 'each' }])
  }

  const useTemplate = (tmpl: EstimateTemplate) => {
    setLineItems(tmpl.lineItems.map(li => ({ description: li.description, qty: li.defaultQty, unitPrice: li.defaultUnitPrice, unit: li.unit, total: li.defaultQty * li.defaultUnitPrice })))
    setModalOpen(true)
  }

  const changeEstimateStatus = async (est: Estimate, newStatus: EstimateStatus) => {
    await updateItem('estimates', est.id, { status: newStatus })
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Estimates</h1>
        <button className="btn btn-accent btn-sm" onClick={() => tab === 'templates' ? setTemplateModalOpen(true) : setModalOpen(true)}>
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
          <EmptyState icon={<FileText />} message="No estimates yet" action={<button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>Create Estimate</button>} />
        ) : (
          <div className="stack stack-sm">
            {estimates.map(est => (
              <div key={est.id} className="card">
                <div className="row row-between gap-sm" style={{ marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 16 }}>{est.customerName}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{est.address}</p>
                  </div>
                  <span className={`badge ${T.ESTIMATE_STATUS_COLORS[est.status]}`}>{T.ESTIMATE_STATUS_LABELS[est.status]}</span>
                </div>
                <div className="row row-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>${est.total.toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{est.lineItems.length} items</span>
                </div>
                <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
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
        templates.length === 0 ? (
          <EmptyState icon={<Copy />} message="No templates yet" action={<button className="btn btn-primary btn-sm" onClick={() => setTemplateModalOpen(true)}>Create Template</button>} />
        ) : (
          <div className="stack stack-sm">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="card">
                <div className="row row-between">
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 16 }}>{tmpl.name}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{tmpl.lineItems.length} line items</p>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => useTemplate(tmpl)}>Use</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <button className="fab" onClick={() => tab === 'templates' ? setTemplateModalOpen(true) : setModalOpen(true)}><Plus size={24} /></button>

      {/* New Estimate Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Estimate">
        <form onSubmit={handleCreateEstimate} className="stack stack-md">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Customer</label><input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} required /></div>
            <div><label className="label">Address</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} required /></div>
          </div>

          <div>
            <label className="label">Line Items</label>
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

          <div className="row row-between" style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand)' }}>${subtotal.toLocaleString()}</span>
          </div>

          <div><label className="label">Notes</label><textarea className="input textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms, conditions, etc." /></div>
          <button type="submit" className="btn btn-primary btn-full">Create Estimate</button>
        </form>
      </Modal>

      {/* New Template Modal */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title="New Template">
        <form onSubmit={handleCreateTemplate} className="stack stack-md">
          <div><label className="label">Template Name</label><input className="input" value={templateName} onChange={e => setTemplateName(e.target.value)} required placeholder='e.g. "Standard Tear-Off & Replace"' /></div>
          <div>
            <label className="label">Default Line Items</label>
            {templateLines.map((li, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="Description" value={li.description} onChange={e => { const u = [...templateLines]; u[idx].description = e.target.value; setTemplateLines(u) }} style={{ minHeight: 40 }} />
                <input className="input" type="number" placeholder="Qty" value={li.defaultQty} onChange={e => { const u = [...templateLines]; u[idx].defaultQty = parseFloat(e.target.value) || 0; setTemplateLines(u) }} style={{ minHeight: 40 }} />
                <input className="input" type="number" placeholder="Price" value={li.defaultUnitPrice} onChange={e => { const u = [...templateLines]; u[idx].defaultUnitPrice = parseFloat(e.target.value) || 0; setTemplateLines(u) }} style={{ minHeight: 40 }} />
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setTemplateLines([...templateLines, { description: '', defaultQty: 1, defaultUnitPrice: 0, unit: 'each' }])}><Plus size={14} /> Add Line</button>
          </div>
          <button type="submit" className="btn btn-primary btn-full">Save Template</button>
        </form>
      </Modal>
    </div>
  )
}
