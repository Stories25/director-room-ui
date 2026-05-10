import { NextResponse } from 'next/server'
import { getProjects } from '@/lib/argon'

export async function GET() {
  try {
    const projects = await getProjects()
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[projects] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: String(error) },
      { status: 500 }
    )
  }
}
