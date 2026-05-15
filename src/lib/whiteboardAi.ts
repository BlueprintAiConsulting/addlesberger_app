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

// ─── API Key ────────────────────────────────────────────
function getApiKey(): string {
  const key = (import.meta.env.VITE_GEMINI_API_KEY || '').trim()
  if (!key) throw new Error('Gemini API key is not configured. Contact your administrator.')
  return key
}

// ─── File/Blob → Base64 with compression (fixes iOS large photo timeout) ──
async function fileOrBlobToBase64(source: File | Blob): Promise<{ base64: string; mimeType: string }> {
  const mimeType = source.type || 'image/jpeg'
  const MAX_DIMENSION = 2048  // max width or height — keeps text legible
  const JPEG_QUALITY = 0.82
  const SIZE_THRESHOLD = 1 * 1024 * 1024  // only compress if > 1MB

  // Small files: skip compression
  if (source.size < SIZE_THRESHOLD && !mimeType.includes('heic')) {
    return blobToBase64(source, mimeType)
  }

  // Large files or HEIC: resize + compress via canvas
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()
    img.onload = () => {
      try {
        let { naturalWidth: w, naturalHeight: h } = img
        // Scale down if either dimension exceeds max
        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(w, h)
          w = Math.round(w * scale)
          h = Math.round(h * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        const base64 = dataUrl.split(',')[1]
        URL.revokeObjectURL(url)
        if (!base64) { reject(new Error('Image compression failed')); return }
        resolve({ base64, mimeType: 'image/jpeg' })
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image for compression')) }
    img.src = url
  })
}

// ─── Image URL → Base64 (handles CORS gracefully) ───────
async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  // Try 1: Direct fetch (works when same-origin or CORS-enabled)
  try {
    const response = await fetch(url)
    if (response.ok) {
      const blob = await response.blob()
      const mimeType = blob.type || 'image/jpeg'
      return await blobToBase64(blob, mimeType)
    }
  } catch {
    // CORS or network error — fall through to proxy approach
  }

  // Try 2: Fetch via no-cors mode and create an image element to draw to canvas
  // This handles Firebase Storage URLs that may have CORS issues on GitHub Pages
  try {
    return await canvasBase64Fallback(url)
  } catch {
    // Last resort — if even canvas fails, throw descriptive error
  }

  throw new Error('Could not load the photo. The image may have expired — try re-uploading it.')
}

function blobToBase64(blob: Blob, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      if (!base64) { reject(new Error('Failed to encode image')); return }
      resolve({ base64, mimeType })
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(blob)
  })
}

function canvasBase64Fallback(url: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        const base64 = dataUrl.split(',')[1]
        if (!base64) { reject(new Error('Canvas export failed')); return }
        resolve({ base64, mimeType: 'image/jpeg' })
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Image failed to load'))
    // Timeout after 15s
    setTimeout(() => reject(new Error('Image load timed out')), 15000)
    img.src = url
  })
}

// ─── Robust JSON Parser ─────────────────────────────────
function robustJsonParse(text: string): any {
  // Strategy 1: Strip markdown fences and parse
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try { return JSON.parse(cleaned) } catch { /* next */ }

  // Strategy 2: Extract first JSON object via regex
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* next */ } }

  // Strategy 3: Fix common AI quirks — trailing commas, single quotes
  try {
    const fixed = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/'/g, '"')
      .replace(/\n/g, ' ')
    return JSON.parse(fixed)
  } catch { /* next */ }

  // Strategy 4: Extract just the items array if the outer object is broken
  const im = text.match(/"items"\s*:\s*\[([\s\S]*)\]/)
  if (im) {
    try {
      const arrText = `[${im[1]}]`
        .replace(/,\s*]/g, ']')
        .replace(/'/g, '"')
      return { summary: 'Partial extraction', items: JSON.parse(arrText) }
    } catch { /* next */ }
  }

  // Strategy 5: Try to find any array of objects
  const arrMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (arrMatch) {
    try { return { summary: 'Extracted from array', items: JSON.parse(arrMatch[0]) } } catch { /* next */ }
  }

  throw new Error('Could not parse AI response. The image may be too blurry or dark.')
}

// ─── Retry with Backoff ──────────────────────────────────
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout via AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout (mobile needs more time)
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.ok || res.status === 400) return res
      if (attempt < maxRetries && [429, 500, 503].includes(res.status)) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000 + Math.random() * 500))
        continue
      }
      return res
    } catch (err: any) {
      lastErr = err
      if (err.name === 'AbortError') {
        lastErr = new Error('Request timed out (60s). The image may be too large — try a smaller photo.')
      }
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw lastErr || new Error('Network request failed after retries')
}

// ─── Normalize Extracted Item ────────────────────────────
function normalizeItem(item: any): ExtractedItem {
  // Phone normalization
  let phone = (item.phone || '').replace(/[^\d]/g, '')
  if (phone.length === 10) phone = `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`
  else if (phone.length === 11 && phone.startsWith('1')) phone = `${phone.slice(1,4)}-${phone.slice(4,7)}-${phone.slice(7)}`
  else phone = item.phone || ''

  // Estimate normalization — handles "$5k", "5,000", "5000", etc.
  let estimateAmount: number | null = null
  if (item.estimateAmount != null) {
    let raw = String(item.estimateAmount).replace(/[$,]/g, '').trim()
    if (/^\d+(\.\d+)?k$/i.test(raw)) { raw = String(parseFloat(raw) * 1000) }
    const n = Number(raw)
    if (!isNaN(n) && n > 0) estimateAmount = n
  }

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

// ─── Gemini Model Selection ─────────────────────────────
// Try multiple models in case one is unavailable for the API key
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

// ─── Main Extraction ─────────────────────────────────────
export type ProgressCallback = (step: string, percent: number) => void

export async function extractWhiteboardData(
  imageSource: string | File | Blob,
  userNotes?: string,
  onProgress?: ProgressCallback,
): Promise<ExtractionResult> {
  try {
    onProgress?.('Checking configuration...', 5)
    const apiKey = getApiKey()

    // Step 1: Convert image to base64 (with compression for large iOS photos)
    onProgress?.('Loading image...', 10)
    let base64Data: { base64: string; mimeType: string }
    try {
      if (imageSource instanceof File || imageSource instanceof Blob) {
        const fileSizeMB = (imageSource.size / (1024 * 1024)).toFixed(1)
        if (imageSource.size > 1024 * 1024) {
          onProgress?.(`Compressing photo (${fileSizeMB}MB)...`, 15)
        }
        // Direct File/Blob — compression handles large iOS HEIC photos
        base64Data = await fileOrBlobToBase64(imageSource)
        const payloadKB = Math.round(base64Data.base64.length * 0.75 / 1024)
        console.log(`[whiteboard] Image compressed: ${fileSizeMB}MB → ${payloadKB}KB payload`)
      } else {
        // URL string — fetch with CORS fallbacks
        base64Data = await imageUrlToBase64(imageSource)
      }
    } catch (imgErr: any) {
      return { items: [], rawSummary: '', error: `Failed to load image: ${imgErr.message}` }
    }
    onProgress?.('Image ready', 25)

    // Validate base64 isn't empty
    if (!base64Data.base64 || base64Data.base64.length < 100) {
      return { items: [], rawSummary: '', error: 'Image appears to be empty or corrupted. Try re-uploading.' }
    }

    let prompt = EXTRACTION_PROMPT
    if (userNotes?.trim()) {
      prompt += `\n\nADDITIONAL CONTEXT FROM USER:\n"${userNotes.trim()}"\n\nUse these notes to guide extraction.`
    }

    // Step 2: Try each Gemini model until one works
    onProgress?.('Sending to AI...', 35)
    let lastError = ''
    for (let mi = 0; mi < GEMINI_MODELS.length; mi++) {
      const model = GEMINI_MODELS[mi]
      try {
        onProgress?.(`Analyzing with ${model}...`, 40 + mi * 10)
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: base64Data.mimeType, data: base64Data.base64 } }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
            }),
          }
        )

        if (res.status === 404 || res.status === 400) {
          const errBody = await res.text()
          // Check for invalid API key FIRST — don't let "API Key not found" match the model-not-found check
          if (errBody.includes('API_KEY_INVALID') || errBody.includes('API key not valid') || errBody.includes('pass a valid API key')) {
            throw new Error('Gemini API key is invalid or expired. Contact your administrator to update it.')
          }
          if (errBody.includes('not found') || errBody.includes('not supported') || errBody.includes('does not exist')) {
            lastError = `Model ${model} not available`
            continue
          }
          throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 200)}`)
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`)
        }

        onProgress?.('Reading AI response...', 75)
        const data = await res.json()

        if (data.candidates?.[0]?.finishReason === 'SAFETY') {
          return { items: [], rawSummary: '', error: 'Image was blocked by safety filters. Try a different photo.' }
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (!text.trim()) {
          lastError = `Model ${model} returned empty response`
          continue
        }

        // Step 3: Parse the response
        onProgress?.('Extracting job data...', 85)
        const parsed = robustJsonParse(text)
        const items = (parsed.items || []).map(normalizeItem).filter((i: ExtractedItem) =>
          i.customerName || i.address || i.description || i.phone
        )

        onProgress?.('Done!', 100)
        return { items, rawSummary: parsed.summary || '' }
      } catch (modelErr: any) {
        lastError = modelErr.message
        if (modelErr.message?.includes('timed out') || modelErr.message?.includes('Network')) {
          throw modelErr
        }
        continue
      }
    }

    throw new Error(lastError || 'All AI models failed. Please try again.')
  } catch (err: any) {
    console.error('Whiteboard extraction failed:', err)
    return { items: [], rawSummary: '', error: err.message || 'Extraction failed. Please try again.' }
  }
}
