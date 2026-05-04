interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content" style={{ maxWidth: 400 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, margin: '0 0 24px' }}>{message}</p>
        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
