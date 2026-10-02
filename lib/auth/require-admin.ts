// lib/auth/require-admin.ts
// Gate for admin-only API routes. profiles.is_admin is a service-role-only
// column, so a user cannot grant it to themselves.
//
// Answers 404 rather than 403 for non-admins: an admin-only surface should not
// confirm it exists to someone who is not one. Same contract as the review
// queue in app/api/admin/review.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, type AuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

export async function requireAdmin(
  req: NextRequest,
): Promise<{ authedUser: AuthedUser; error?: undefined } | { error: NextResponse; authedUser?: undefined }> {
  const authedUser = await getAuthedUser(req);
  if (!authedUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('user_id', authedUser.supabaseUserId)
    .maybeSingle();

  if (profile?.is_admin !== true) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { authedUser };
}
