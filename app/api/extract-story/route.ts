import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

const EXTRACTION_PROMPT = `You are analyzing a live conversation between a screenwriter (Hank) and a director who is pitching a 30-second teaser film.

Extract ONLY what has been explicitly mentioned so far. Return a JSON object with these fields. Use null for anything not yet discussed.

{
  "character": "name and one-line description of the main character, or null",
  "setting": "where and when the scene takes place, or null",
  "tone": "emotional tone or mood, or null",
  "action": "what physically happens in the 30 seconds, or null",
  "arc": "setup-moment-resolution compressed into one sentence, or null"
}

Rules:
- Only extract what is clearly stated. Do not infer or invent.
- Be concise — each value should be one sentence max.
- Return raw JSON only. No markdown, no explanation.`

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()
    if (!transcript || transcript.length < 2) {
      return NextResponse.json({ extraction: { character: null, setting: null, tone: null, action: null, arc: null } })
    }

    const transcriptText = transcript
      .map((e: { speaker: string; text: string }) => `${e.speaker}: ${e.text}`)
      .join('\n')

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.5',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: transcriptText },
      ],
      temperature: 0.1,
    })

    const content = completion.choices[0]?.message?.content || '{}'
    const cleaned = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const extraction = JSON.parse(cleaned)

    return NextResponse.json({ extraction })
  } catch (error) {
    console.error('[extract-story] Error:', error)
    return NextResponse.json({
      extraction: { character: null, setting: null, tone: null, action: null, arc: null }
    })
  }
}
