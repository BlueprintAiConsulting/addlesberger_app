import { useState, FormEvent, useRef } from 'react'
import { orderBy, where, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { Plus, FileText, Copy, Trash2, Printer, Eye, ArrowLeft, Download, Mail } from 'lucide-react'
import { downloadInvoicePDF, emailInvoice } from '@/lib/invoicePdf'
import type { InvoiceData } from '@/lib/invoicePdf'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/hooks/useAuth'
import { addItem, updateItem, deleteItem } from '@/lib/firestore'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DocumentUploader } from '@/components/DocumentUploader'
import { DEFAULT_INVOICE_TEMPLATES } from '@/data/defaultInvoiceTemplates'
import type { Invoice, InvoiceTemplate, InvoicePaymentStatus, InvoiceStatus, Job } from '@/types'
import * as T from '@/types'

export function Invoices() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'invoices' | 'templates'>('invoices')
  const [modalOpen, setModalOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [editTemplate, setEditTemplate] = useState<InvoiceTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Invoice form
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [servicesText, setServicesText] = useState('')
  const [warrantyText, setWarrantyText] = useState('')
  const [total, setTotal] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<InvoicePaymentStatus>('unpaid')
  const [paymentInstructions, setPaymentInstructions] = useState('Please make check payable to R. L. Addlesberger Roofing LLC')
  const [thankYouText, setThankYouText] = useState('Thank you for your business!')
  const [licenseText, setLicenseText] = useState('PA141502')
  const [invoiceJobId, setInvoiceJobId] = useState<string | null>(null)
  const [invoiceTemplateId, setInvoiceTemplateId] = useState<string | null>(null)

  // Template form
  const [tName, setTName] = useState('')
  const [tJobType, setTJobType] = useState('')
  const [tHeader, setTHeader] = useState('R. L. Addlesberger Roofing LLC')
  const [tServices, setTServices] = useState('')
  const [tWarranty, setTWarranty] = useState('')
  const [tPayment, setTPayment] = useState('Please make check payable to R. L. Addlesberger Roofing LLC')
  const [tThankYou, setTThankYou] = useState('Thank you for your business!')
  const [tLicense, setTLicense] = useState('PA141502')

  const { data: invoices } = useCollection<Invoice>('invoices', [orderBy('createdAt', 'desc')])
  const { data: invoiceTemplates } = useCollection<InvoiceTemplate>('invoiceTemplates', [orderBy('createdAt', 'desc')])
  const { data: jobs } = useCollection<Job>('jobs', [orderBy('createdAt', 'desc')])
  const { data: uploadedDocs } = useCollection<any>('documentTemplates', [where('type', '==', 'invoice'), orderBy('createdAt', 'desc')])

  // --- Seed defaults ---
  const seedDefaults = async () => {
    for (const tmpl of DEFAULT_INVOICE_TEMPLATES) {
      await addItem('invoiceTemplates', { ...tmpl, createdBy: user?.uid || '' })
    }
  }

  // --- Invoice CRUD ---
  const openCreateInvoice = () => {
    setEditInvoice(null)
    setClientName(''); setClientAddress(''); setServicesText(''); setWarrantyText('')
    setTotal(''); setPaymentStatus('unpaid'); setInvoiceJobId(null); setInvoiceTemplateId(null)
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setPaymentInstructions('Please make check payable to R. L. Addlesberger Roofing LLC')
    setThankYouText('Thank you for your business!')
    setLicenseText('PA141502')
    setModalOpen(true)
  }

  const openEditInvoice = (inv: Invoice) => {
    setEditInvoice(inv)
    setClientName(inv.clientName)
    setClientAddress(inv.clientAddress)
    setInvoiceDate(inv.invoiceDate ? format(inv.invoiceDate.toDate(), 'yyyy-MM-dd') : '')
    setServicesText(inv.servicesPerformedText)
    setWarrantyText(inv.warrantyText)
    setTotal(inv.total?.toString() || '')
    setPaymentStatus(inv.paymentStatus)
    setPaymentInstructions(inv.paymentInstructions)
    setThankYouText(inv.thankYouText)
    setLicenseText(inv.licenseText)
    setInvoiceJobId(inv.jobId)
    setInvoiceTemplateId(inv.templateId)
    setModalOpen(true)
  }

  const applyTemplate = (tmplId: string) => {
    setInvoiceTemplateId(tmplId)
    const tmpl = invoiceTemplates.find(t => t.id === tmplId)
    if (tmpl) {
      setServicesText(tmpl.servicesPerformedText)
      setWarrantyText(tmpl.warrantyText)
      setPaymentInstructions(tmpl.paymentInstructions)
      setThankYouText(tmpl.thankYouText)
      setLicenseText(tmpl.licenseText)
    }
  }

  const applyJob = (jId: string) => {
    setInvoiceJobId(jId || null)
    const job = jobs.find(j => j.id === jId)
    if (job) {
      setClientName(job.customerName)
      setClientAddress(job.address)
    }
  }

  const handleSubmitInvoice = async (e: FormEvent) => {
    e.preventDefault()
    const data = {
      clientName, clientAddress,
      invoiceDate: Timestamp.fromDate(new Date(invoiceDate + 'T00:00:00')),
      servicesPerformedText: servicesText,
      warrantyText, total: parseFloat(total) || 0,
      paymentStatus, paymentInstructions, thankYouText, licenseText,
      jobId: invoiceJobId, templateId: invoiceTemplateId,
    }
    if (editInvoice) {
      await updateItem('invoices', editInvoice.id, data)
    } else {
      await addItem('invoices', { ...data, status: 'draft' as InvoiceStatus, createdBy: user?.uid || '' })
    }
    setModalOpen(false)
  }

  const changeInvoiceStatus = async (inv: Invoice, newStatus: InvoiceStatus) => {
    await updateItem('invoices', inv.id, { status: newStatus })
  }

  // --- Template CRUD ---
  const openCreateTemplate = () => {
    setEditTemplate(null)
    setTName(''); setTJobType(''); setTServices(''); setTWarranty('')
    setTHeader('R. L. Addlesberger Roofing LLC')
    setTPayment('Please make check payable to R. L. Addlesberger Roofing LLC')
    setTThankYou('Thank you for your business!'); setTLicense('PA141502')
    setTemplateModalOpen(true)
  }

  const openEditTemplate = (tmpl: InvoiceTemplate) => {
    setEditTemplate(tmpl)
    setTName(tmpl.name); setTJobType(tmpl.jobType)
    setTHeader(tmpl.companyHeaderText); setTServices(tmpl.servicesPerformedText)
    setTWarranty(tmpl.warrantyText); setTPayment(tmpl.paymentInstructions)
    setTThankYou(tmpl.thankYouText); setTLicense(tmpl.licenseText)
    setTemplateModalOpen(true)
  }

  const handleSubmitTemplate = async (e: FormEvent) => {
    e.preventDefault()
    const data = {
      name: tName, jobType: tJobType, companyHeaderText: tHeader,
      servicesPerformedText: tServices, warrantyText: tWarranty,
      paymentInstructions: tPayment, thankYouText: tThankYou,
      licenseText: tLicense, active: true,
    }
    if (editTemplate) {
      await updateItem('invoiceTemplates', editTemplate.id, data)
    } else {
      await addItem('invoiceTemplates', { ...data, createdBy: user?.uid || '' })
    }
    setTemplateModalOpen(false)
  }

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Georgia', 'Times New Roman', serif; color: #1C1917; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 28px; text-align: center; margin: 16px 0; letter-spacing: 2px; border-bottom: 2px solid #C7330A; padding-bottom: 12px; }
        .company { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .meta { display: flex; justify-content: space-between; margin: 24px 0; font-size: 14px; }
        .meta-block { line-height: 1.6; }
        .meta-label { font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #666; }
        .section { margin: 24px 0; }
        .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #C7330A; margin-bottom: 8px; border-bottom: 1px solid #E7E5E4; padding-bottom: 4px; }
        .services { white-space: pre-line; line-height: 1.8; font-size: 14px; }
        .warranty { font-style: italic; font-size: 13px; line-height: 1.6; color: #444; }
        .total-row { display: flex; justify-content: space-between; padding: 16px 0; border-top: 2px solid #1C1917; border-bottom: 2px solid #1C1917; margin: 24px 0; font-size: 20px; font-weight: bold; }
        .payment-status { display: inline-block; padding: 4px 16px; border-radius: 4px; font-size: 13px; font-weight: bold; text-transform: uppercase; }
        .footer { margin-top: 40px; text-align: center; font-size: 13px; color: #666; line-height: 1.8; }
        .license { font-size: 12px; color: #999; margin-top: 8px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>${content.innerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  const buildInvoiceData = (inv: Invoice): InvoiceData => ({
    clientName: inv.clientName,
    clientAddress: inv.clientAddress,
    invoiceDate: inv.invoiceDate ? format(inv.invoiceDate.toDate(), 'MMMM d, yyyy') : '',
    servicesPerformedText: inv.servicesPerformedText,
    warrantyText: inv.warrantyText,
    total: inv.total || 0,
    paymentStatus: inv.paymentStatus,
    paymentStatusLabel: T.INVOICE_PAYMENT_STATUS_LABELS[inv.paymentStatus],
    paymentInstructions: inv.paymentInstructions,
    thankYouText: inv.thankYouText,
    licenseText: inv.licenseText,
  })

  // --- Preview mode ---
  if (previewInvoice) {
    const inv = previewInvoice
    const invData = buildInvoiceData(inv)
    return (
      <div className="stack stack-lg">
        <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreviewInvoice(null)}>
            <ArrowLeft size={16} /> Back
          </button>
          <button className="btn btn-outline btn-sm" onClick={handlePrint}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => downloadInvoicePDF(invData)}>
            <Download size={16} /> Save as PDF
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => emailInvoice(invData)}>
            <Mail size={16} /> Email Invoice
          </button>
        </div>
        <div ref={printRef} style={{
          background: 'white', padding: 32, borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', maxWidth: 700, margin: '0 auto', width: '100%',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}>
          <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            R. L. Addlesberger Roofing LLC
          </p>
          <h1 style={{
            textAlign: 'center', fontSize: 28, margin: '16px 0', letterSpacing: 2,
            borderBottom: '2px solid #C7330A', paddingBottom: 12,
          }}>INVOICE</h1>

          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '24px 0', fontSize: 14 }}>
            <div style={{ lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, color: '#666', marginBottom: 4 }}>Bill To</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{inv.clientName}</div>
              <div>{inv.clientAddress}</div>
            </div>
            <div style={{ textAlign: 'right', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, color: '#666', marginBottom: 4 }}>Invoice Date</div>
              <div>{inv.invoiceDate ? format(inv.invoiceDate.toDate(), 'MMMM d, yyyy') : '—'}</div>
            </div>
          </div>

          <div style={{ margin: '24px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#C7330A', marginBottom: 8, borderBottom: '1px solid #E7E5E4', paddingBottom: 4 }}>
              Services Performed
            </div>
            <div style={{ whiteSpace: 'pre-line', lineHeight: 1.8, fontSize: 14 }}>{inv.servicesPerformedText}</div>
          </div>

          {inv.warrantyText && (
            <div style={{ margin: '24px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#C7330A', marginBottom: 8, borderBottom: '1px solid #E7E5E4', paddingBottom: 4 }}>
                Warranty
              </div>
              <div style={{ fontStyle: 'italic', fontSize: 13, lineHeight: 1.6, color: '#444' }}>{inv.warrantyText}</div>
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '16px 0',
            borderTop: '2px solid #1C1917', borderBottom: '2px solid #1C1917', margin: '24px 0',
            fontSize: 20, fontWeight: 700,
          }}>
            <span>TOTAL</span>
            <span>${inv.total?.toLocaleString() || '0'}</span>
          </div>

          <div style={{ margin: '16px 0' }}>
            <span className={`badge ${T.INVOICE_PAYMENT_STATUS_COLORS[inv.paymentStatus]}`} style={{ fontSize: 13, padding: '6px 16px' }}>
              {T.INVOICE_PAYMENT_STATUS_LABELS[inv.paymentStatus]}
            </span>
          </div>

          <div style={{ marginTop: 40, textAlign: 'center', fontSize: 13, color: '#666', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 8px' }}>{inv.paymentInstructions}</p>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{inv.thankYouText}</p>
            <p style={{ fontSize: 12, color: '#999' }}>License #: {inv.licenseText}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stack stack-lg">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <button className="btn btn-accent btn-sm" onClick={() => tab === 'templates' ? openCreateTemplate() : openCreateInvoice()}>
          <Plus size={18} /> {tab === 'templates' ? 'Template' : 'Invoice'}
        </button>
      </div>

      <div className="filter-tabs">
        <button className={`filter-tab ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')}>Invoices</button>
        <button className={`filter-tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>Templates</button>
      </div>

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState icon={<FileText />} message="No invoices yet" action={<button className="btn btn-primary btn-sm" onClick={openCreateInvoice}>Create Invoice</button>} />
        ) : (
          <div className="stack stack-sm">
            {invoices.map(inv => (
              <div key={inv.id} className="invoice-card">
                <div className="row row-between gap-sm" style={{ marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15 }}>{inv.clientName}</p>
                    <p className="truncate" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{inv.clientAddress}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={`badge ${T.INVOICE_STATUS_COLORS[inv.status]}`}>{T.INVOICE_STATUS_LABELS[inv.status]}</span>
                    <span className={`badge ${T.INVOICE_PAYMENT_STATUS_COLORS[inv.paymentStatus]}`}>{T.INVOICE_PAYMENT_STATUS_LABELS[inv.paymentStatus]}</span>
                  </div>
                </div>
                <div className="row row-between" style={{ marginBottom: 12 }}>
                  <span className="invoice-amount">${inv.total?.toLocaleString() || '0'}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {inv.invoiceDate ? format(inv.invoiceDate.toDate(), 'MMM d, yyyy') : ''}
                  </span>
                </div>
                <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => setPreviewInvoice(inv)}>
                    <Eye size={14} /> Preview
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => openEditInvoice(inv)}>Edit</button>
                  {inv.status === 'draft' && (
                    <button className="btn btn-sm btn-primary" onClick={() => changeInvoiceStatus(inv, 'sent')}>Mark Sent</button>
                  )}
                  {inv.status === 'sent' && (
                    <button className="btn btn-sm btn-primary" onClick={() => changeInvoiceStatus(inv, 'paid')}>Mark Paid</button>
                  )}
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                    onClick={() => setDeleteTarget({ type: 'invoice', id: inv.id, name: inv.clientName })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="stack stack-md">
          {/* Document uploader */}
          <div>
            <h2 className="section-heading" style={{ marginBottom: 10 }}>📎 Uploaded Templates</h2>
            <DocumentUploader type="invoice" userId={user?.uid || ''} documents={uploadedDocs} />
          </div>

          <div>
            <h2 className="section-heading" style={{ marginBottom: 10 }}>✍️ Quick-Fill Templates</h2>
          </div>
          {invoiceTemplates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--bg-tinted)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>No templates yet</p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Load Addlesberger roofing defaults to get started</p>
              <button className="btn btn-primary btn-sm" onClick={seedDefaults}>
                <Copy size={14} /> Load Defaults
              </button>
            </div>
          )}
          {invoiceTemplates.map(tmpl => (
            <div key={tmpl.id} className="template-card">
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15 }}>{tmpl.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>{tmpl.jobType}</p>
              </div>
              <p className="truncate" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {tmpl.servicesPerformedText.split('\n')[0]}
              </p>
              <div className="row gap-sm">
                <button className="btn btn-sm btn-primary" onClick={() => { applyTemplate(tmpl.id); openCreateInvoice(); setTimeout(() => applyTemplate(tmpl.id), 50) }}>Use Template</button>
                <button className="btn btn-sm btn-outline" onClick={() => openEditTemplate(tmpl)}>Edit</button>
                <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => setDeleteTarget({ type: 'invoiceTemplate', id: tmpl.id, name: tmpl.name })}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => tab === 'templates' ? openCreateTemplate() : openCreateInvoice()}>
        <Plus size={24} />
      </button>

      {/* Invoice Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editInvoice ? 'Edit Invoice' : 'Create Invoice'}>
        <form onSubmit={handleSubmitInvoice} className="stack stack-md">
          {/* Job + Template selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Link to Job</label>
              <select className="input select" value={invoiceJobId || ''} onChange={e => applyJob(e.target.value)}>
                <option value="">Enter manually</option>
                {jobs.filter(j => !j.archivedAt).map(j => (
                  <option key={j.id} value={j.id}>{j.customerName} — {j.address}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Use Template</label>
              <select className="input select" value={invoiceTemplateId || ''} onChange={e => applyTemplate(e.target.value)}>
                <option value="">No template</option>
                {invoiceTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Client Name</label><input className="input" value={clientName} onChange={e => setClientName(e.target.value)} required /></div>
            <div><label className="label">Invoice Date</label><input className="input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
          </div>

          <div><label className="label">Client Address</label><input className="input" value={clientAddress} onChange={e => setClientAddress(e.target.value)} /></div>

          <div>
            <label className="label">Services Performed</label>
            <textarea className="input textarea" value={servicesText} onChange={e => setServicesText(e.target.value)} style={{ minHeight: 140 }} placeholder="• Service line items..." />
          </div>

          <div>
            <label className="label">Warranty</label>
            <textarea className="input textarea" value={warrantyText} onChange={e => setWarrantyText(e.target.value)} style={{ minHeight: 80 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Total ($)</label><input className="input" type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="0.00" required /></div>
            <div>
              <label className="label">Payment Status</label>
              <select className="input select" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as InvoicePaymentStatus)}>
                {Object.entries(T.INVOICE_PAYMENT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div><label className="label">Payment Instructions</label><input className="input" value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} /></div>
          <div><label className="label">Thank-You Text</label><input className="input" value={thankYouText} onChange={e => setThankYouText(e.target.value)} /></div>
          <div><label className="label">License #</label><input className="input" value={licenseText} onChange={e => setLicenseText(e.target.value)} /></div>

          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            {editInvoice && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                setModalOpen(false); setDeleteTarget({ type: 'invoice', id: editInvoice.id, name: editInvoice.clientName })
              }}><Trash2 size={14} /> Delete</button>
            )}
            <button type="submit" className="btn btn-primary">{editInvoice ? 'Save' : 'Create Invoice'}</button>
          </div>
        </form>
      </Modal>

      {/* Template Modal */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editTemplate ? 'Edit Template' : 'New Invoice Template'}>
        <form onSubmit={handleSubmitTemplate} className="stack stack-md">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Template Name</label><input className="input" value={tName} onChange={e => setTName(e.target.value)} required placeholder='e.g. "Shingle Roof"' /></div>
            <div><label className="label">Job Type</label><input className="input" value={tJobType} onChange={e => setTJobType(e.target.value)} placeholder="shingle, rubber, metal, repair" /></div>
          </div>
          <div><label className="label">Company Header</label><input className="input" value={tHeader} onChange={e => setTHeader(e.target.value)} /></div>
          <div><label className="label">Services Performed</label><textarea className="input textarea" value={tServices} onChange={e => setTServices(e.target.value)} style={{ minHeight: 140 }} /></div>
          <div><label className="label">Warranty Text</label><textarea className="input textarea" value={tWarranty} onChange={e => setTWarranty(e.target.value)} style={{ minHeight: 80 }} /></div>
          <div><label className="label">Payment Instructions</label><input className="input" value={tPayment} onChange={e => setTPayment(e.target.value)} /></div>
          <div><label className="label">Thank-You Text</label><input className="input" value={tThankYou} onChange={e => setTThankYou(e.target.value)} /></div>
          <div><label className="label">License #</label><input className="input" value={tLicense} onChange={e => setTLicense(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary btn-full">{editTemplate ? 'Save Template' : 'Create Template'}</button>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'invoiceTemplate' ? 'Template' : 'Invoice'}`}
        message={`Delete "${deleteTarget?.name}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            const col = deleteTarget.type === 'invoiceTemplate' ? 'invoiceTemplates' : 'invoices'
            await deleteItem(col, deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
