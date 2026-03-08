// app/api/extension/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Max-Age':       '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401, headers: CORS });
    }
    const idToken      = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId       = decodedToken.uid;
    const extensionToken = crypto.randomUUID();
    const expiresAt      = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await db.collection('extensionTokens').doc(extensionToken).set({ userId, createdAt: Date.now(), expiresAt, active: true });
    return NextResponse.json({ success: true, token: extensionToken, expiresAt }, { headers: CORS });
  } catch (error) {
    console.error('Extension auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401, headers: CORS });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-extension-token');
    if (!token) return NextResponse.json({ error: 'No extension token provided' }, { status: 401, headers: CORS });
    const tokenDoc = await db.collection('extensionTokens').doc(token).get();
    if (!tokenDoc.exists) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const tokenData = tokenDoc.data();
    if (!tokenData?.active || tokenData.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401, headers: CORS });
    }
    const userDoc  = await db.collection('users').doc(tokenData.userId).get();
    const userData = userDoc.data();
    return NextResponse.json(
      { success: true, userId: tokenData.userId,
        user: { email: userData?.email, displayName: userData?.name || userData?.displayName,
                subscriptionTier: userData?.subscription?.plan || 'free', usageLimits: userData?.subscription } },
      { headers: CORS }
    );
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500, headers: CORS });
  }
}