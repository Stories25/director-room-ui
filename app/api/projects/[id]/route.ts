import { NextRequest, NextResponse } from 'next/server'
import { getProject } from '@/lib/argon'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await getProject(id)
    return NextResponse.json({ project })
  } catch (error) {
    console.error('[projects/id] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project', details: String(error) },
      { status: 500 }
    )
  }
}
