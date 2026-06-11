// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCurrentUser } from '@/lib/actions/auth.action';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;

    const featureType = body.featureType as string | undefined;
    const rating      = body.rating as number | undefined;

    if (!featureType || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await db.collection('feedback').add({
      type:        'feature-rating',
      featureType,
      rating,
      nps:         (body.nps     as number  | null) ?? null,
      tags:        (body.tags    as string[])        ?? [],
      comment:     (body.comment as string)          ?? '',
      interviewId: (body.interviewId as string | null) ?? null,
      userId:    user.id,
      userEmail: user.email ?? null,
      userName:  user.name  ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
