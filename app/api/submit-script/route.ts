import { NextRequest, NextResponse } from 'next/server'
import { ScriptDocument } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { script }: { script: ScriptDocument } = await request.json()

    if (!script) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 })
    }

    // TODO: Replace this mock with the real FastAPI call when backend is ready
    // Example real call:
    // const response = await fetch(`${process.env.FASTAPI_BASE_URL}/api/v1/submit-script`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ script }),
    // })
    // const data = await response.json()
    // return NextResponse.json(data)

    // Mock response — simulates successful acceptance by the production pipeline
    console.log('[submit-script] Script received for production:', JSON.stringify(script, null, 2))

    await new Promise((r) => setTimeout(r, 800)) // simulate network latency

    return NextResponse.json({
      status: 'accepted',
      jobId: `job_${Date.now()}`,
      message: 'Your teaser is queued for production.',
      script,
    })
  } catch (error) {
    console.error('[submit-script] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit script', details: String(error) },
      { status: 500 }
    )
  }
}
