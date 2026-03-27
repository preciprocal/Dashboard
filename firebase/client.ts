// firebase/client.ts

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    '❌ Firebase configuration is incomplete. ' +
    'Ensure all NEXT_PUBLIC_FIREBASE_* variables are set in .env.local'
  );
}

// Initialise once — Next.js hot-reload can re-run this module
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Always use local persistence — prevents login loops when tabs are backgrounded
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('❌ Failed to set auth persistence:', err);
});

// initializeFirestore must be called before any other module calls getFirestore(app).
// We use the app's _isDeleted check via getApps() to detect if this module has
// already run (Next.js hot-reload re-executes modules). On the first run we
// call initializeFirestore with experimentalForceLongPolling which replaces the
// WebChannel with standard HTTP long-polling — permanently eliminating the CORS
// wildcard error on both localhost and production. On subsequent module
// evaluations (hot-reload) we fall back to getFirestore which returns the
// already-configured instance.
const g = globalThis as typeof globalThis & { __preciprocal_db?: Firestore };
if (!g.__preciprocal_db) {
  g.__preciprocal_db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
}
export const db: Firestore = g.__preciprocal_db;
export const storage = getStorage(app);
export default app;