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

const EXTRACTION_PROMPT = `You are analyzing a photo of a roofing contractor's whiteboard. The contractor (Ryan) writes customer info, job details, and notes by hand.

Extract ALL distinct customers/jobs visible on the whiteboard. For each one, return a JSON object with these fields:

- customerName: the customer's name (best guess from handwriting)
- address: street address if visible
- phone: phone number if visible
- jobType: one of "shingle", "rubber roof", "metal roof", "repair", "gutter", "flashing", "inspection", "other"
- description: raw notes/details you can read (materials, measurements, special instructions, etc.)
- estimateAmount: dollar amount if any pricing is visible, otherwise null
- priority: "urgent" if marked urgent/ASAP/rush, otherwise "normal"
- confidence: "high" if clearly readable, "medium" if partially legible, "low" if guessing

Also include a brief "summary" field describing what you see overall on the whiteboard.

Return ONLY valid JSON in this exact format, no markdown:
{
  "summary": "...",
  "items": [ { ... }, { ... } ]
}

If you cannot read anything meaningful, return:
{ "summary": "Could not extract readable information from this image.", "items": [] }

Be generous with extraction — it's better to extract something imperfect that Charlene can edit than to miss information.`

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not configured. Add it to your environment variables.')
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
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mimeType })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function extractWhiteboardData(imageUrl: string, userNotes?: string): Promise<ExtractionResult> {
  try {
    const apiKey = getApiKey()
    const { base64, mimeType } = await imageUrlToBase64(imageUrl)

    // Build the prompt — append user notes as additional direction if provided
    let prompt = EXTRACTION_PROMPT
    if (userNotes && userNotes.trim()) {
      prompt += `\n\nADDITIONAL CONTEXT / DIRECTION FROM THE USER:\n"${userNotes.trim()}"\n\nUse the above notes to guide your extraction — they may describe what's on the board, which section to focus on, what type of jobs these are, or other helpful context.`
    }

    // Direct REST API call — zero dependencies
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

    return {
      items: (parsed.items || []).map((item: any) => ({
        customerName: item.customerName || '',
        address: item.address || '',
        phone: item.phone || '',
        jobType: item.jobType || 'other',
        description: item.description || '',
        estimateAmount: item.estimateAmount != null ? Number(item.estimateAmount) : null,
        priority: item.priority === 'urgent' ? 'urgent' : 'normal',
        confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
      })),
      rawSummary: parsed.summary || '',
    }
  } catch (err: any) {
    console.error('Whiteboard extraction failed:', err)
    return {
      items: [],
      rawSummary: '',
      error: err.message || 'Extraction failed',
    }
  }
}
