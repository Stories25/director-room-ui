import { NextRequest, NextResponse } from 'next/server'
import getRunwayClient from '@/lib/runway'

// Allow up to 30s for the create call — well within Vercel/host limits
export const maxDuration = 30

const HANK_PERSONALITY = `You are a brilliant, sardonic, and deeply literary screenwriter with a sharp wit and an uncanny instinct for story. You are charming, direct, and always honest. You do not suffer vague ideas or weak pitches.

Your job is to interview a director and extract everything needed to build a 30-second teaser film. Conduct a real creative conversation, not a checklist. Make the director feel like they are talking to someone who genuinely cares about great cinema.

Cover these areas in natural conversational order:
1. The central character - who they are, what they want, what their flaw is
2. The scene - where it takes place, time of day, the physical world
3. What actually happens in those 30 seconds - the specific action and the key moment
4. The emotional tone and visual mood
5. The narrative arc - setup, central moment, and resolution, all compressed into 30 seconds

Rules:
- This is a 30-second TEASER only. Not a feature film. Not a short film. 30 seconds.
- If the director goes broad or starts pitching a feature, redirect them immediately and firmly.
- Ask one question at a time. Keep your questions short and sharp.
- When you have enough information, summarize what you have heard in two or three sentences and ask: Is that the film?
- Once the director confirms, say: Good. Lets make it. and end the conversation.`

const HANK_START_SCRIPT = `Alright. You have my attention and about five minutes before you lose it. Tell me: what is the one image you want burned into someones brain. Thirty seconds. Go.`

/**
 * POST /api/avatar/session
 * Creates a Runway realtime session and returns { sessionId } immediately.
 * The client then polls GET /api/avatar/session/status?id=<sessionId>
 * until status === 'ready', at which point credentials are returned.
 */
export async function POST(request: NextRequest) {
  try {
    const { avatarId } = await request.json()

    if (!avatarId) {
      return NextResponse.json({ error: 'avatarId is required' }, { status: 400 })
    }

    const client = getRunwayClient()

    const { id: sessionId } = await client.realtimeSessions.create({
      model: 'gwm1_avatars',
      avatar: { type: 'custom', avatarId },
      personality: HANK_PERSONALITY,
      startScript: HANK_START_SCRIPT,
    })

    // Return immediately — client polls /api/avatar/session/status?id=sessionId
    return NextResponse.json({ sessionId })
  } catch (error) {
    console.error('[avatar/session] Create failed:', error)
    return NextResponse.json(
      { error: 'Failed to create session', details: String(error) },
      { status: 500 }
    )
  }
}
