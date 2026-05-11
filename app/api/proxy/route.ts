import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const range = request.headers.get('range') ?? undefined
    const upstream = await fetch(url, {
      headers: range ? { Range: range, 'User-Agent': 'DirectorRoom/1.0' } : { 'User-Agent': 'DirectorRoom/1.0' },
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream responded with ${upstream.status}` },
        { status: upstream.status }
      )
    }

    const headers = new Headers()
    const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']
    for (const h of passthrough) {
      const v = upstream.headers.get(h)
      if (v) headers.set(h, v)
    }
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'public, max-age=86400, immutable')

    return new NextResponse(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    return NextResponse.json({ error: `Proxy fetch failed: ${String(err)}` }, { status: 502 })
  }
}
