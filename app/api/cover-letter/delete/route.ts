// app/api/cover-letter/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

export async function DELETE(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('cover_letters')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.user_id !== authedUser.supabaseUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabaseAdmin.from('cover_letters').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ cover-letter delete DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete cover letter' }, { status: 500 });
  }
}
