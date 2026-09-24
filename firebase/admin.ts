// firebase/admin.ts
// Firebase Admin, initialised LAZILY and allowed to be absent.
//
// ─── Why this is not initialised at module scope any more ───────────────────
//
// It used to be:
//
//   export const { auth, db, storage } = initFirebaseAdmin();
//
// `cert()` throws `app/invalid-credential` when the FIREBASE_ADMIN_* variables
// are missing or malformed, and that call ran on import. The only importer is
// lib/auth/verify-request.ts, which every authenticated route and every page
// pulls in to resolve the current user - so a missing Firebase credential did
// not disable the legacy extension path, it took the entire site down with a
// 500 on every dynamic route.
//
// That is exactly what happened in production. Firebase is being
// decommissioned and the credentials were removed from the deployment, while
// this file still demanded them at import time. Static routes kept serving and
// everything else died, which made it look like a database or deploy problem
// rather than a dependency that was supposed to be on its way out.
//
// ─── The rule now ───────────────────────────────────────────────────────────
//
// Firebase is OPTIONAL. getFirebaseAuth() returns null when it is not
// configured, and callers must handle null by skipping the legacy path rather
// than failing the request. Nothing in the product depends on Firebase any
// more except the extension-token grace window, and a grace window must never
// be load-bearing.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

interface FirebaseAdmin {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: ReturnType<typeof getStorage>;
}

// `undefined` = not attempted yet, `null` = attempted and unavailable. The
// distinction is what stops a missing config being retried on every request.
let cached: FirebaseAdmin | null | undefined;

function init(): FirebaseAdmin | null {
  if (cached !== undefined) return cached;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // The private key is stored with literal \n sequences in most secret
  // managers, so it has to be unescaped before cert() will accept it.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // Info, not error. Firebase being absent is the expected end state of the
    // migration; logging it as a failure would train people to ignore it.
    console.info("[firebase-admin] not configured - legacy Firebase paths are disabled");
    cached = null;
    return cached;
  }

  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });

    cached = { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  } catch (err) {
    // Malformed credentials land here, e.g. a private key that lost its
    // newlines in transit. Degrade rather than throw, for the same reason as
    // above: this must not be able to take the site down.
    console.error("[firebase-admin] initialisation failed, legacy paths disabled:", err);
    cached = null;
  }

  return cached;
}

/** Auth, or null when Firebase is not configured. Callers MUST handle null. */
export function getFirebaseAuth(): Auth | null {
  return init()?.auth ?? null;
}

/** Firestore, or null when Firebase is not configured. */
export function getFirebaseDb(): Firestore | null {
  return init()?.db ?? null;
}

/** Storage, or null when Firebase is not configured. */
export function getFirebaseStorage(): ReturnType<typeof getStorage> | null {
  return init()?.storage ?? null;
}

/** Whether the legacy Firebase paths can run at all. */
export function isFirebaseConfigured(): boolean {
  return init() !== null;
}
