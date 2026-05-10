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

/**
 * Extract raw text from a DOCX file (which is a ZIP of XML).
 * Uses browser-native APIs — zero dependencies.
 */
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: 'application/zip' })

  // DOCX = ZIP archive. We need word/document.xml
  // Use the browser's native DecompressionStream if available, otherwise
  // fall back to a manual ZIP parse for the document.xml entry.
  try {
    // Try using the JSZip-free approach: read the zip manually
    const bytes = new Uint8Array(arrayBuffer)
    const textDecoder = new TextDecoder()

    // Find all local file headers and locate word/document.xml
    let documentXml = ''
    let i = 0
    while (i < bytes.length - 4) {
      // Local file header signature: 0x04034b50
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
        const nameLen = bytes[i + 26] | (bytes[i + 27] << 8)
        const extraLen = bytes[i + 28] | (bytes[i + 29] << 8)
        const compMethod = bytes[i + 8] | (bytes[i + 9] << 8)
        const compSize = bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24)
        const uncompSize = bytes[i + 22] | (bytes[i + 23] << 8) | (bytes[i + 24] << 16) | (bytes[i + 25] << 24)

        const nameStart = i + 30
        const fileName = textDecoder.decode(bytes.slice(nameStart, nameStart + nameLen))
        const dataStart = nameStart + nameLen + extraLen

        if (fileName === 'word/document.xml' && compMethod === 0) {
          // Stored (not compressed) — read directly
          documentXml = textDecoder.decode(bytes.slice(dataStart, dataStart + uncompSize))
          break
        } else if (fileName === 'word/document.xml' && compMethod === 8) {
          // Deflate compressed — use DecompressionStream
          const compressed = bytes.slice(dataStart, dataStart + compSize)
          const ds = new DecompressionStream('deflate-raw')
          const writer = ds.writable.getWriter()
          writer.write(compressed)
          writer.close()
          const reader = ds.readable.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          const total = chunks.reduce((s, c) => s + c.length, 0)
          const result = new Uint8Array(total)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }
          documentXml = textDecoder.decode(result)
          break
        }

        i = dataStart + (compMethod === 0 ? uncompSize : compSize)
      } else {
        i++
      }
    }

    if (!documentXml) {
      throw new Error('Could not find word/document.xml in DOCX file')
    }

    // Parse XML and extract text content
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(documentXml, 'application/xml')

    // Walk all w:p paragraph elements and collect text from w:t children
    const pNodes = xmlDoc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'
    )

    const paragraphs: string[] = []
    for (let j = 0; j < pNodes.length; j++) {
      const tNodes = pNodes[j].getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't'
      )
      let line = ''
      for (let k = 0; k < tNodes.length; k++) {
        line += tNodes[k].textContent || ''
      }
      if (line.trim()) paragraphs.push(line)
    }

    return paragraphs.join('\n')
  } catch (err) {
    console.warn('DOCX parse failed:', err)
    return ''
  }
}

function isDocx(file: File): boolean {
  return file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

// ─── Gemini Model Selection ─────────────────────────────
// Try multiple models in case one is unavailable for the API key
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

export async function extractTemplateFromDocument(
  file: File,
  type: 'estimate' | 'invoice'
): Promise<ExtractionResult<ExtractedEstimateTemplate | ExtractedInvoiceTemplate>> {
  try {
    const apiKey = getApiKey()
    const prompt = type === 'estimate' ? ESTIMATE_PROMPT : INVOICE_PROMPT

    let parts: any[]

    if (isDocx(file)) {
      // DOCX: extract text client-side, send as text-only prompt
      const docText = await extractDocxText(file)
      if (!docText) {
        throw new Error('Could not read text from this Word document. Try saving it as a PDF and uploading that instead.')
      }
      parts = [
        { text: `${prompt}\n\n--- DOCUMENT CONTENT ---\n${docText}\n--- END DOCUMENT ---` },
      ]
    } else {
      // PDF/image: send as binary inline data
      const { base64, mimeType } = await fileToBase64(file)
      parts = [
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ]
    }

    // Try each model until one succeeds
    let lastError = ''
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
            }),
          }
        )

        if (res.status === 404 || res.status === 400) {
          const errBody = await res.text()
          if (errBody.includes('not found') || errBody.includes('not supported') || errBody.includes('does not exist')) {
            lastError = `Model ${model} not available`
            continue
          }
          throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 200)}`)
        }

        if (!res.ok) {
          const err = await res.text()
          throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 200)}`)
        }

        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (!text.trim()) {
          lastError = `Model ${model} returned empty response`
          continue
        }

        // Parse JSON — strip markdown fences if present, with robust fallback
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        let parsed: any
        try {
          parsed = JSON.parse(cleaned)
        } catch {
          // Try extracting JSON object from response
          const match = text.match(/\{[\s\S]*\}/)
          if (match) {
            parsed = JSON.parse(match[0])
          } else {
            lastError = `Model ${model}: Could not parse AI response`
            continue
          }
        }

        return { data: parsed, rawText: text }
      } catch (modelErr: any) {
        lastError = modelErr.message
        continue
      }
    }

    throw new Error(lastError || 'All AI models failed. Please try again.')
  } catch (err: any) {
    console.error('Document extraction failed:', err)
    return { data: null, rawText: '', error: err.message || 'Extraction failed' }
  }
}
