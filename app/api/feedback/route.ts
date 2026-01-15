// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { getCurrentUser } from '@/lib/actions/auth.action';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const feedbackData = await request.json();

    if (!feedbackData.featureType || !feedbackData.rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Save feedback to Firestore
    const feedbackRef = db.collection('feedback').doc();
    await feedbackRef.set({
      ...feedbackData,
      userId: user.id,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // Optionally: Send notification to admin/slack
    // await sendSlackNotification(feedbackData);

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}