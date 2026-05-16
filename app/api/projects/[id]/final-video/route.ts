import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.ARGON_BASE_URL!
const AUTH_TOKEN = process.env.ARGON_AUTH_TOKEN!

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()

    const res = await fetch(`${BASE_URL}/runway/projects/${id}/final-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || 'Upload failed' },
        { status: res.status }
      )
    }

    return NextResponse.json(data?.data ?? data)
  } catch (error) {
    console.error('[final-video] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload final video', details: String(error) },
      { status: 500 }
    )
  }
}
