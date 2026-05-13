import { Timestamp } from 'firebase/firestore'

// ─── Board Items ──────────────────────────────────────────
export type BoardCategory = 'estimate' | 'repair' | 'job' | 'note' | 'other'
export type BoardPriority = 'normal' | 'urgent'
export type BoardStatus = 'inbox' | 'estimates' | 'repairs' | 'activeJobs' | 'waitingOn' | 'completed'

// Source of the update — who/what did this come from?
export type UpdateSource = 'ryan-text' | 'ryan-whiteboard' | 'charlene-note' | 'customer-update' | 'other'

export interface BoardItem {
  id: string
  title: string
  description: string
  category: BoardCategory
  priority: BoardPriority
  status: BoardStatus
  source: UpdateSource
  assignedTo: string | null
  dueDate: Timestamp | null
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  archivedAt: Timestamp | null
}

// ─── Jobs ─────────────────────────────────────────────────
export type JobStatus =
  | 'lead'
  | 'estimate-sent'
  | 'approved'
  | 'scheduled'
  | 'in-progress'
  | 'complete'
  | 'invoiced'
  | 'paid'

export interface Job {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string
  address: string
  description: string
  status: JobStatus
  estimateAmount: number | null
  invoiceAmount: number | null
  paidAmount: number | null
  notes: string
  scheduledDate: Timestamp | null
  completedDate: Timestamp | null
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  archivedAt: Timestamp | null
}

// ─── Estimates ────────────────────────────────────────────
export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined'

export interface LineItem {
  description: string
  qty: number
  unitPrice: number
  unit: string
  total: number
}

export interface Estimate {
  id: string
  jobId: string | null
  customerName: string
  address: string
  lineItems: LineItem[]
  subtotal: number
  tax: number
  total: number
  priceOverride: number | null  // Manual price override — when set, this is used as the total instead of line-item sum
  status: EstimateStatus
  notes: string
  templateId: string | null
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EstimateTemplate {
  id: string
  name: string
  lineItems: {
    description: string
    defaultQty: number
    defaultUnitPrice: number
    unit: string
  }[]
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Invoices ─────────────────────────────────────────────
export type InvoicePaymentStatus = 'unpaid' | 'depositPaid' | 'balanceDue' | 'paidInFull'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'archived'

export interface InvoiceTemplate {
  id: string
  name: string
  jobType: string
  companyHeaderText: string
  servicesPerformedText: string
  warrantyText: string
  paymentInstructions: string
  thankYouText: string
  licenseText: string
  active: boolean
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Invoice {
  id: string
  jobId: string | null
  templateId: string | null
  clientName: string
  clientAddress: string
  invoiceDate: Timestamp
  servicesPerformedText: string
  warrantyText: string
  total: number
  paymentStatus: InvoicePaymentStatus
  paymentInstructions: string
  thankYouText: string
  licenseText: string
  status: InvoiceStatus
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export const INVOICE_PAYMENT_STATUS_LABELS: Record<InvoicePaymentStatus, string> = {
  'unpaid': 'Unpaid',
  'depositPaid': 'Deposit Paid',
  'balanceDue': 'Balance Due',
  'paidInFull': 'Paid in Full',
}

export const INVOICE_PAYMENT_STATUS_COLORS: Record<InvoicePaymentStatus, { bg: string; color: string }> = {
  'unpaid': { bg: '#FEE2E2', color: '#B91C1C' },
  'depositPaid': { bg: '#FEF3C7', color: '#B45309' },
  'balanceDue': { bg: '#DBEAFE', color: '#1D4ED8' },
  'paidInFull': { bg: '#D1FAE5', color: '#047857' },
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  'draft': 'Draft',
  'sent': 'Sent',
  'paid': 'Paid',
  'archived': 'Archived',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; color: string }> = {
  'draft': { bg: '#E2E8F0', color: '#334155' },
  'sent': { bg: '#DBEAFE', color: '#1D4ED8' },
  'paid': { bg: '#D1FAE5', color: '#047857' },
  'archived': { bg: '#F1F5F9', color: '#64748B' },
}

// ─── Photos ───────────────────────────────────────────────
export type PhotoSource = 'ryan-whiteboard' | 'jobsite' | 'before' | 'after' | 'damage' | 'material' | 'other'

export interface Photo {
  id: string
  url: string
  thumbnailUrl: string | null
  caption: string
  jobId: string | null
  boardItemId: string | null
  tags: string[]
  source: PhotoSource
  processed: boolean
  uploadedBy: string
  createdAt: Timestamp
  fileName: string
  extractedData?: {
    items: {
      customerName: string
      address: string
      phone: string
      jobType: string
      description: string
      estimateAmount: number | null
      priority: 'normal' | 'urgent'
      confidence: 'high' | 'medium' | 'low'
    }[]
    rawSummary: string
    extractedAt: string
  }
}

// ─── Company ─────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  phone: string
  email: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── UI Helpers ──────────────────────────────────────────
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  'lead': 'Lead',
  'estimate-sent': 'Estimate Sent',
  'approved': 'Approved',
  'scheduled': 'Scheduled',
  'in-progress': 'In Progress',
  'complete': 'Complete',
  'invoiced': 'Invoiced',
  'paid': 'Paid',
}

export const JOB_STATUS_COLORS: Record<JobStatus, { bg: string; color: string }> = {
  'lead': { bg: '#E2E8F0', color: '#334155' },
  'estimate-sent': { bg: '#DBEAFE', color: '#1D4ED8' },
  'approved': { bg: '#D1FAE5', color: '#047857' },
  'scheduled': { bg: '#E0E7FF', color: '#4338CA' },
  'in-progress': { bg: '#FEF3C7', color: '#92400E' },
  'complete': { bg: '#DCFCE7', color: '#15803D' },
  'invoiced': { bg: '#F3E8FF', color: '#7C3AED' },
  'paid': { bg: '#A7F3D0', color: '#065F46' },
}

export const BOARD_CATEGORY_LABELS: Record<BoardCategory, string> = {
  'estimate': 'Estimate',
  'repair': 'Repair',
  'job': 'Job',
  'note': 'Note',
  'other': 'Other',
}

export const BOARD_CATEGORY_COLORS: Record<BoardCategory, { bg: string; color: string }> = {
  'estimate': { bg: '#DBEAFE', color: '#1D4ED8' },
  'repair': { bg: '#FEE2E2', color: '#B91C1C' },
  'job': { bg: '#E0E7FF', color: '#4338CA' },
  'note': { bg: '#FEF3C7', color: '#B45309' },
  'other': { bg: '#F1F5F9', color: '#475569' },
}

export const BOARD_STATUS_LABELS: Record<BoardStatus, string> = {
  'inbox': 'Inbox / Needs Sorted',
  'estimates': 'Estimates',
  'repairs': 'Repairs',
  'activeJobs': 'Active Jobs',
  'waitingOn': 'Waiting On',
  'completed': 'Completed',
}

export const UPDATE_SOURCE_LABELS: Record<UpdateSource, string> = {
  'ryan-text': 'Ryan Text',
  'ryan-whiteboard': 'Ryan Whiteboard Photo',
  'charlene-note': 'Charlene Note',
  'customer-update': 'Customer / Job Update',
  'other': 'Other',
}

export const PHOTO_SOURCE_LABELS: Record<PhotoSource, string> = {
  'ryan-whiteboard': 'Ryan Whiteboard',
  'jobsite': 'Jobsite',
  'before': 'Before',
  'after': 'After',
  'damage': 'Damage',
  'material': 'Material',
  'other': 'Other',
}

// Map category to default status
export const CATEGORY_DEFAULT_STATUS: Record<BoardCategory, BoardStatus> = {
  'estimate': 'estimates',
  'repair': 'repairs',
  'job': 'activeJobs',
  'note': 'inbox',
  'other': 'inbox',
}

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  'draft': 'Draft',
  'sent': 'Sent',
  'approved': 'Approved',
  'declined': 'Declined',
}

export const ESTIMATE_STATUS_COLORS: Record<EstimateStatus, { bg: string; color: string }> = {
  'draft': { bg: '#E2E8F0', color: '#334155' },
  'sent': { bg: '#DBEAFE', color: '#1D4ED8' },
  'approved': { bg: '#D1FAE5', color: '#047857' },
  'declined': { bg: '#FEE2E2', color: '#B91C1C' },
}

// ─── Shared UI Styles ─────────────────────────────────────
export const CONFIDENCE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'High' },
  medium: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Medium' },
  low: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Low' },
}

// Safe migration helpers for old data
export function migrateBoardStatus(status: string): BoardStatus {
  const map: Record<string, BoardStatus> = {
    'todo': 'inbox',
    'new': 'inbox',
    'in-progress': 'activeJobs',
    'done': 'completed',
  }
  return map[status] || (status as BoardStatus)
}

export function migrateBoardCategory(category: string): BoardCategory {
  if (category === 'meeting') return 'note'
  if (category === 'followup') return 'note'
  if (category === 'material') return 'other'
  return category as BoardCategory
}
