import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Only protect /admin/* and /api/admin/* routes
  if (!path.startsWith('/admin') && !path.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  // For API routes, check Authorization header
  if (path.startsWith('/api/admin')) {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.next()
  }

  // For page routes (/admin/*), let the layout.tsx handle the full check
  // This is because middleware cookie handling with App Router is complex
  // The layout.tsx will do the proper server-side check with cookies
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
