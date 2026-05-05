// Pure browser PDF generation — renders invoice HTML to a printable document
// Uses the print-to-PDF flow built into every browser

const INVOICE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1C1917; padding: 48px 56px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
  .company { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 4px; color: #1C1917; }
  h1.invoice-title { font-size: 30px; text-align: center; margin: 16px 0 24px; letter-spacing: 4px; border-bottom: 2px solid #C7330A; padding-bottom: 14px; color: #1C1917; }
  .meta-row { display: flex; justify-content: space-between; margin: 20px 0; font-size: 14px; }
  .meta-block { line-height: 1.7; }
  .meta-label { font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1.5px; color: #888; margin-bottom: 4px; }
  .client-name { font-weight: 700; font-size: 17px; }
  .section { margin: 28px 0; }
  .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #C7330A; margin-bottom: 10px; border-bottom: 1px solid #E5E5E5; padding-bottom: 6px; }
  .services { white-space: pre-line; line-height: 2; font-size: 14px; }
  .warranty { font-style: italic; font-size: 13px; line-height: 1.7; color: #555; }
  .total-row { display: flex; justify-content: space-between; padding: 18px 0; border-top: 2.5px solid #1C1917; border-bottom: 2.5px solid #1C1917; margin: 28px 0; font-size: 22px; font-weight: bold; }
  .payment-badge { display: inline-block; padding: 6px 20px; border-radius: 4px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .payment-unpaid { background: #FEF2F2; color: #DC2626; }
  .payment-depositPaid { background: #FFFBEB; color: #D97706; }
  .payment-balanceDue { background: #EFF6FF; color: #2563EB; }
  .payment-paidInFull { background: #ECFDF5; color: #059669; }
  .footer { margin-top: 48px; text-align: center; font-size: 13px; color: #777; line-height: 2; }
  .footer .thank-you { font-weight: 600; font-size: 14px; color: #333; }
  .license { font-size: 11px; color: #AAA; margin-top: 4px; }
  @media print { body { padding: 24px 36px; } }
  @page { margin: 0.5in; }
`

export interface InvoiceData {
  clientName: string
  clientAddress: string
  invoiceDate: string
  servicesPerformedText: string
  warrantyText: string
  total: number
  paymentStatus: string
  paymentStatusLabel: string
  paymentInstructions: string
  thankYouText: string
  licenseText: string
}

function buildInvoiceHTML(inv: InvoiceData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice — ${inv.clientName}</title>
  <style>${INVOICE_CSS}</style>
</head>
<body>
  <div class="company">R. L. Addlesberger Roofing LLC</div>
  <h1 class="invoice-title">INVOICE</h1>

  <div class="meta-row">
    <div class="meta-block">
      <div class="meta-label">Bill To</div>
      <div class="client-name">${inv.clientName}</div>
      <div>${inv.clientAddress}</div>
    </div>
    <div class="meta-block" style="text-align:right;">
      <div class="meta-label">Invoice Date</div>
      <div>${inv.invoiceDate}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Services Performed</div>
    <div class="services">${inv.servicesPerformedText}</div>
  </div>

  ${inv.warrantyText ? `
  <div class="section">
    <div class="section-title">Warranty</div>
    <div class="warranty">${inv.warrantyText}</div>
  </div>` : ''}

  <div class="total-row">
    <span>TOTAL</span>
    <span>$${inv.total.toLocaleString()}</span>
  </div>

  <div style="margin: 16px 0;">
    <span class="payment-badge payment-${inv.paymentStatus}">${inv.paymentStatusLabel}</span>
  </div>

  <div class="footer">
    <p>${inv.paymentInstructions}</p>
    <p class="thank-you">${inv.thankYouText}</p>
    <p class="license">License #: ${inv.licenseText}</p>
  </div>
</body>
</html>`
}

/**
 * Opens a new window with the invoice, triggers Save as PDF (via print dialog).
 * All modern browsers support "Save as PDF" as a printer destination.
 */
export function downloadInvoicePDF(inv: InvoiceData): void {
  const html = buildInvoiceHTML(inv)
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow popups to download the invoice PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  // Give fonts a moment to load
  setTimeout(() => {
    win.print()
  }, 400)
}

/**
 * Opens the user's email client with the invoice details pre-filled in the body.
 * Uses mailto: — works on mobile and desktop without any backend.
 */
export function emailInvoice(inv: InvoiceData, recipientEmail?: string): void {
  const subject = encodeURIComponent(`Invoice from R. L. Addlesberger Roofing — ${inv.clientName}`)
  const body = encodeURIComponent(
`Invoice from R. L. Addlesberger Roofing LLC
${'='.repeat(48)}

BILL TO:
${inv.clientName}
${inv.clientAddress}

INVOICE DATE: ${inv.invoiceDate}

SERVICES PERFORMED:
${inv.servicesPerformedText}

${inv.warrantyText ? `WARRANTY:\n${inv.warrantyText}\n` : ''}
${'─'.repeat(48)}
TOTAL: $${inv.total.toLocaleString()}
STATUS: ${inv.paymentStatusLabel}
${'─'.repeat(48)}

${inv.paymentInstructions}

${inv.thankYouText}

License #: ${inv.licenseText}
`
  )
  const to = recipientEmail ? encodeURIComponent(recipientEmail) : ''
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
}
