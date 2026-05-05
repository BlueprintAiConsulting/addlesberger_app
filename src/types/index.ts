import { Timestamp } from 'firebase/firestore'

// ─── Board Items ──────────────────────────────────────────
export type BoardCategory = 'repair' | 'estimate' | 'meeting' | 'followup' | 'material' | 'other'
export type BoardPriority = 'normal' | 'urgent'
export type BoardStatus = 'todo' | 'in-progress' | 'done'

export interface BoardItem {
  id: string
  title: string
  description: string
  category: BoardCategory
  priority: BoardPriority
  status: BoardStatus
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

// ─── Photos ───────────────────────────────────────────────
export interface Photo {
  id: string
  url: string
  thumbnailUrl: string | null
  caption: string
  jobId: string | null
  tags: string[]
  uploadedBy: string
  createdAt: Timestamp
  fileName: string
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

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  'lead': 'bg-slate-200 text-slate-700',
  'estimate-sent': 'bg-blue-100 text-blue-700',
  'approved': 'bg-emerald-100 text-emerald-700',
  'scheduled': 'bg-indigo-100 text-indigo-700',
  'in-progress': 'bg-amber-100 text-amber-800',
  'complete': 'bg-green-100 text-green-700',
  'invoiced': 'bg-purple-100 text-purple-700',
  'paid': 'bg-emerald-200 text-emerald-800',
}

export const BOARD_CATEGORY_LABELS: Record<BoardCategory, string> = {
  'repair': 'Repair',
  'estimate': 'Estimate',
  'meeting': 'Meeting',
  'followup': 'Follow-up',
  'material': 'Material',
  'other': 'Other',
}

export const BOARD_CATEGORY_COLORS: Record<BoardCategory, string> = {
  'repair': 'bg-red-100 text-red-700',
  'estimate': 'bg-blue-100 text-blue-700',
  'meeting': 'bg-purple-100 text-purple-700',
  'followup': 'bg-amber-100 text-amber-700',
  'material': 'bg-teal-100 text-teal-700',
  'other': 'bg-slate-100 text-slate-600',
}

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  'draft': 'Draft',
  'sent': 'Sent',
  'approved': 'Approved',
  'declined': 'Declined',
}

export const ESTIMATE_STATUS_COLORS: Record<EstimateStatus, string> = {
  'draft': 'bg-slate-200 text-slate-700',
  'sent': 'bg-blue-100 text-blue-700',
  'approved': 'bg-emerald-100 text-emerald-700',
  'declined': 'bg-red-100 text-red-700',
}
