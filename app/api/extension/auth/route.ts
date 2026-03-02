// app/api/extension/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Generate extension auth token (valid for 7 days)
    const extensionToken = crypto.randomUUID();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    // Store token in Firestore
    await db.collection('extensionTokens').doc(extensionToken).set({
      userId,
      createdAt: Date.now(),
      expiresAt,
      active: true
    });

    console.log('✅ Extension token created for user:', userId);

    return NextResponse.json({
      success: true,
      token: extensionToken,
      expiresAt
    });

  } catch (error) {
    console.error('Extension auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

// Verify extension token
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-extension-token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'No extension token provided' },
        { status: 401 }
      );
    }

    const tokenDoc = await db.collection('extensionTokens').doc(token).get();
    
    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const tokenData = tokenDoc.data();
    
    if (!tokenData?.active || tokenData.expiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      );
    }

    // Get user data
    const userDoc = await db.collection('users').doc(tokenData.userId).get();
    const userData = userDoc.data();

    return NextResponse.json({
      success: true,
      userId: tokenData.userId,
      user: {
        email: userData?.email,
        displayName: userData?.name || userData?.displayName,
        subscriptionTier: userData?.subscription?.plan || 'free',
        usageLimits: userData?.subscription
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}