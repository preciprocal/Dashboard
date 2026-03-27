import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json() as { url: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Only allow Firebase Storage — never proxy arbitrary URLs
    const isStorageUrl =
      url.startsWith('https://firebasestorage.googleapis.com/') ||
      url.startsWith('https://storage.googleapis.com/');

    if (!isStorageUrl) {
      return NextResponse.json({ error: 'Only Firebase Storage URLs are allowed' }, { status: 403 });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: `Storage fetch failed: ${upstream.status}` }, { status: upstream.status });
    }

    const bytes = await upstream.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type':   'application/pdf',
        'Content-Length': bytes.byteLength.toString(),
        'Cache-Control':  'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('❌ PDF proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy PDF' }, { status: 500 });
  }
}