import { NextRequest, NextResponse } from 'next/server'
import { openai, SCRIPT_FORMATTING_PROMPT } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, avatarId, transcriptFallback } = await request.json()

    if (!sessionId || !avatarId) {
      return NextResponse.json({ error: 'sessionId and avatarId are required' }, { status: 400 })
    }

    let rawTranscript = ''

    // Try to fetch transcript from Runway REST API directly
    // (the SDK's avatars.conversations is not yet in the current SDK version)
    try {
      const res = await fetch(
        `https://api.dev.runwayml.com/v1/avatar_conversations/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,
            'X-Runway-Version': '2024-11-06',
          },
        }
      )

      if (res.ok) {
        const conversation = await res.json()
        if (conversation.transcript && Array.isArray(conversation.transcript)) {
          rawTranscript = conversation.transcript
            .map((entry: { role: string; content: string }) => {
              const speaker = entry.role === 'assistant' ? 'HANK' : 'DIRECTOR'
              return `${speaker}: ${entry.content}`
            })
            .join('\n')
        }
      }
    } catch (err) {
      console.warn('[format-script] Runway transcript fetch failed, using client fallback:', err)
    }

    // Fall back to client-side accumulated transcript
    if (!rawTranscript && transcriptFallback) {
      rawTranscript = transcriptFallback
    }

    if (!rawTranscript) {
      return NextResponse.json(
        { error: 'No transcript available to format' },
        { status: 422 }
      )
    }

    // Send to OpenAI for structured formatting
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.5',
      messages: [
        { role: 'system', content: SCRIPT_FORMATTING_PROMPT },
        {
          role: 'user',
          content: `Here is the raw conversation transcript:\n\n${rawTranscript}\n\nExtract and return the structured script document as JSON.`,
        },
      ],
      temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'OpenAI returned empty response' }, { status: 500 })
    }

    // Parse JSON — strip any accidental markdown code fences
    const cleaned = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const scriptDocument = JSON.parse(cleaned)

    return NextResponse.json({ script: scriptDocument })
  } catch (error) {
    console.error('[format-script] Error:', error)
    return NextResponse.json(
      { error: 'Failed to format script', details: String(error) },
      { status: 500 }
    )
  }
}
