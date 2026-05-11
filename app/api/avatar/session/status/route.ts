import { NextRequest, NextResponse } from 'next/server'
import getRunwayClient from '@/lib/runway'

export const maxDuration = 15

/**
 * GET /api/avatar/session/status?id=<sessionId>
 *
 * Checks the provisioning status of a Runway realtime session.
 * Returns one of:
 *   { status: 'provisioning' }
 *   { status: 'ready', credentials: { sessionId, serverUrl, token, roomName } }
 *   { status: 'failed', error: string }
 *
 * The client polls this every 3s until status === 'ready'.
 * This replaces the old server-side 120× poll loop that held a connection open.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const client = getRunwayClient()
    const session = await client.realtimeSessions.retrieve(sessionId)

    if (session.status === 'FAILED') {
      return NextResponse.json({
        status: 'failed',
        error: 'Session failed to provision',
        details: session.failure,
      })
    }

    if (session.status !== 'READY') {
      return NextResponse.json({ status: 'provisioning' })
    }

    // READY — consume to get WebRTC credentials
    const sessionKey = session.sessionKey
    if (!sessionKey) {
      return NextResponse.json({ status: 'failed', error: 'No session key in READY response' })
    }

    const consumeResponse = await fetch(
      `https://api.dev.runwayml.com/v1/realtime_sessions/${sessionId}/consume`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionKey}`,
          'X-Runway-Version': '2024-11-06',
          'Content-Type': 'application/json',
        },
      }
    )

    if (!consumeResponse.ok) {
      const err = await consumeResponse.text()
      return NextResponse.json({ status: 'failed', error: 'Failed to consume session', details: err })
    }

    const creds = await consumeResponse.json()

    return NextResponse.json({
      status: 'ready',
      credentials: {
        sessionId,
        serverUrl: creds.url,
        token: creds.token,
        roomName: creds.roomName,
      },
    })
  } catch (error) {
    console.error('[avatar/session/status] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
