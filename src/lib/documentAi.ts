/**
 * AI-powered document extraction for estimates and invoices.
 * Reads an uploaded PDF/image via Gemini and returns structured template data.
 */

// ─── Estimate Template Extraction ─────────────────────────
export interface ExtractedEstimateTemplate {
  name: string
  lineItems: {
    description: string
    defaultQty: number
    defaultUnitPrice: number
    unit: string
  }[]
}

// ─── Invoice Template Extraction ──────────────────────────
export interface ExtractedInvoiceTemplate {
  name: string
  jobType: string
  companyHeaderText: string
  servicesPerformedText: string
  warrantyText: string
  paymentInstructions: string
  thankYouText: string
  licenseText: string
}

export interface ExtractionResult<T> {
  data: T | null
  rawText: string
  error?: string
}

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not configured.')
  return key
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mimeType: file.type || 'application/octet-stream' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const ESTIMATE_PROMPT = `You are analyzing a roofing contractor's estimate document. Extract the line items and create a reusable template.

Return ONLY valid JSON (no markdown fences) in this exact format:
{
  "name": "Short template name based on the job type (e.g. 'Shingle Roof Estimate', 'Flat Roof Repair')",
  "lineItems": [
    {
      "description": "Description of the line item (e.g. 'Remove old shingles', 'Install GAF Timberline HDZ')",
      "defaultQty": 1,
      "defaultUnitPrice": 0,
      "unit": "sq ft" or "each" or "linear ft" or "bundle" etc.
    }
  ]
}

Rules:
- Extract EVERY line item / service mentioned in the document
- If prices are visible, use them as defaultUnitPrice
- If quantities are visible, use them as defaultQty
- Group related work into logical line items
- Use descriptive line item names that a roofing contractor would understand
- If it's a simple document without clear line items, break the described work into logical items
- If you can't extract anything useful, return: { "name": "Imported Template", "lineItems": [{ "description": "See uploaded document for details", "defaultQty": 1, "defaultUnitPrice": 0, "unit": "each" }] }`

const INVOICE_PROMPT = `You are analyzing a roofing contractor's invoice document. Extract the template content to create a reusable invoice template.

Return ONLY valid JSON (no markdown fences) in this exact format:
{
  "name": "Short template name (e.g. 'Shingle Roof Invoice', 'Emergency Repair Invoice')",
  "jobType": "Type of job (e.g. 'shingle', 'rubber roof', 'repair', 'gutter')",
  "companyHeaderText": "Company name and header text if visible (default to 'R. L. Addlesberger Roofing LLC')",
  "servicesPerformedText": "Full text of services performed / work description, preserving line breaks",
  "warrantyText": "Warranty text if present, otherwise empty string",
  "paymentInstructions": "Payment instructions if present (default: 'Please make check payable to R. L. Addlesberger Roofing LLC')",
  "thankYouText": "Thank you / closing text (default: 'Thank you for your business!')",
  "licenseText": "License number if visible (default: 'PA141502')"
}

Rules:
- Extract the services/work description as thoroughly as possible
- Preserve the original wording and line breaks in servicesPerformedText
- If warranty info exists, capture it
- Use sensible defaults for R. L. Addlesberger Roofing LLC if fields are missing
- If you can't extract anything, still return valid JSON with the defaults`

export async function extractTemplateFromDocument(
  file: File,
  type: 'estimate' | 'invoice'
): Promise<ExtractionResult<ExtractedEstimateTemplate | ExtractedInvoiceTemplate>> {
  try {
    const apiKey = getApiKey()
    const { base64, mimeType } = await fileToBase64(file)

    const prompt = type === 'estimate' ? ESTIMATE_PROMPT : INVOICE_PROMPT

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error (${res.status}): ${err}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse JSON — strip markdown fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return { data: parsed, rawText: text }
  } catch (err: any) {
    console.error('Document extraction failed:', err)
    return { data: null, rawText: '', error: err.message || 'Extraction failed' }
  }
}
