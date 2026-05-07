export interface ExtractedItem {
  customerName: string
  address: string
  phone: string
  jobType: string
  description: string
  estimateAmount: number | null
  priority: 'normal' | 'urgent'
  confidence: 'high' | 'medium' | 'low'
}

export interface ExtractionResult {
  items: ExtractedItem[]
  rawSummary: string
  error?: string
}

const EXTRACTION_PROMPT = `You are a highly skilled OCR specialist analyzing a photo of a roofing contractor's whiteboard. The contractor (Ryan) writes customer info, job details, and notes by hand — often in messy handwriting, with abbreviations.

CRITICAL RULES FOR ACCURACY:
1. LOOK CAREFULLY at each word — handwritten text can be ambiguous. Take your best guess.
2. If there's GLARE, SHADOW, or the image is at an ANGLE, describe what you can see and flag confidence as "low".
3. ABBREVIATIONS are common: "shgl" = shingle, "rpr" = repair, "gtr" = gutter, "flsh" = flashing, "ins" = inspection, "rub" = rubber roof, "mtl" = metal.
4. PHONE NUMBERS may have dashes, dots, or no separator — normalize to xxx-xxx-xxxx format.
5. DOLLAR AMOUNTS may be written as "$5k", "$5,000", "5000" — normalize to a number.
6. Items CROSSED OUT or with a line through them should be SKIPPED.
7. If text is CIRCLED or STARRED or has an arrow, that usually means URGENT.
8. Look for COLUMN or SECTION separations on the board — treat each section independently.

Extract ALL distinct customers/jobs visible. For each one return JSON:
- customerName: the customer's name (best guess from handwriting)
- address: street address if visible (include city/state if written)
- phone: phone number if visible, normalized to xxx-xxx-xxxx
- jobType: one of "shingle", "rubber roof", "metal roof", "repair", "gutter", "flashing", "inspection", "other"
- description: raw notes/details (materials, measurements, special instructions)
- estimateAmount: dollar amount if visible, otherwise null
- priority: "urgent" if marked urgent/ASAP/rush/circled/starred, otherwise "normal"
- confidence: "high" if clearly readable, "medium" if partially legible, "low" if guessing

Return ONLY valid JSON, no markdown fences:
{
  "summary": "...",
  "items": [ { ... } ]
}

If nothing readable: { "summary": "Could not extract readable information.", "items": [] }

Be generous — better to extract something imperfect that can be edited than to miss information.`

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not configured.')
  return key
}

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url)
  const blob = await response.blob()
  const mimeType = blob.type || 'image/jpeg'
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      resolve({ base64: dataUrl.split(',')[1], mimeType })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ─── Robust JSON Parser ─────────────────────────────────
function robustJsonParse(text: string): any {
  // 1: Strip markdown fences
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try { return JSON.parse(cleaned) } catch { /* next */ }

  // 2: Extract first JSON object
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* next */ } }

  // 3: Fix trailing commas + single quotes
  try {
    return JSON.parse(cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/'/g, '"'))
  } catch { /* next */ }

  // 4: Extract items array if outer object broken
  const im = text.match(/"items"\s*:\s*\[([\s\S]*)\]/)
  if (im) { try { return { summary: 'Partial extraction', items: JSON.parse(`[${im[1]}]`) } } catch { /* next */ } }

  throw new Error('Could not parse AI response. The image may be too blurry.')
}

// ─── Retry with Backoff ──────────────────────────────────
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.ok || res.status === 400) return res
      if (attempt < maxRetries && [429, 500, 503].includes(res.status)) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000 + Math.random() * 500))
        continue
      }
      return res
    } catch (err: any) {
      lastErr = err
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw lastErr || new Error('Network request failed after retries')
}

// ─── Normalize Extracted Item ────────────────────────────
function normalizeItem(item: any): ExtractedItem {
  let phone = (item.phone || '').replace(/[^\d]/g, '')
  if (phone.length === 10) phone = `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`
  else if (phone.length === 11 && phone.startsWith('1')) phone = `${phone.slice(1,4)}-${phone.slice(4,7)}-${phone.slice(7)}`
  else phone = item.phone || ''

  let estimateAmount: number | null = null
  if (item.estimateAmount != null) { const n = Number(item.estimateAmount); if (!isNaN(n) && n > 0) estimateAmount = n }

  const validTypes = ['shingle','rubber roof','metal roof','repair','gutter','flashing','inspection','other']
  return {
    customerName: (item.customerName || '').trim(),
    address: (item.address || '').trim(),
    phone,
    jobType: validTypes.includes(item.jobType?.toLowerCase()) ? item.jobType.toLowerCase() : 'other',
    description: (item.description || '').trim(),
    estimateAmount,
    priority: item.priority === 'urgent' ? 'urgent' : 'normal',
    confidence: ['high','medium','low'].includes(item.confidence) ? item.confidence : 'medium',
  }
}

// ─── Duplicate Detection ─────────────────────────────────
export function findDuplicates(newItems: ExtractedItem[], existingNames: string[]): Map<number, string> {
  const dupes = new Map<number, string>()
  const normalized = existingNames.map(n => n.toLowerCase().trim())
  newItems.forEach((item, idx) => {
    const name = item.customerName.toLowerCase().trim()
    if (!name) return
    if (normalized.includes(name)) { dupes.set(idx, 'Already exists on board'); return }
    for (let i = 0; i < normalized.length; i++) {
      if (!normalized[i] || normalized[i].length < 3) continue
      if (name.includes(normalized[i]) || normalized[i].includes(name)) {
        dupes.set(idx, `Similar to "${existingNames[i]}"`)
        break
      }
    }
  })
  return dupes
}

// ─── Main Extraction ─────────────────────────────────────
export async function extractWhiteboardData(imageUrl: string, userNotes?: string): Promise<ExtractionResult> {
  try {
    const apiKey = getApiKey()
    const { base64, mimeType } = await imageUrlToBase64(imageUrl)

    let prompt = EXTRACTION_PROMPT
    if (userNotes?.trim()) {
      prompt += `\n\nADDITIONAL CONTEXT FROM USER:\n"${userNotes.trim()}"\n\nUse these notes to guide extraction.`
    }

    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    )

    if (!res.ok) { const err = await res.text(); throw new Error(`Gemini API error (${res.status}): ${err}`) }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text.trim()) return { items: [], rawSummary: '', error: 'AI returned empty response. Image may be too blurry or dark.' }

    const parsed = robustJsonParse(text)
    const items = (parsed.items || []).map(normalizeItem).filter((i: ExtractedItem) =>
      i.customerName || i.address || i.description || i.phone
    )

    return { items, rawSummary: parsed.summary || '' }
  } catch (err: any) {
    console.error('Whiteboard extraction failed:', err)
    return { items: [], rawSummary: '', error: err.message || 'Extraction failed. Please try again.' }
  }
}
