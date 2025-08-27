// lib/firebase/config.ts
// Client-side Firebase configuration
export { auth, db } from '@/firebase/client'; // Adjust path to your client config file

// Add storage for resume file uploads
import { getStorage } from 'firebase/storage';
import { getApp } from 'firebase/app';

let storage: any;
try {
  storage = getStorage(getApp());
} catch (error) {
  console.error('Error initializing Firebase Storage:', error);
  // Make sure you have added getStorage to your firebase/clients.ts:
  // import { getStorage } from 'firebase/storage';
  // export const storage = getStorage(app);
}

export { storage };

// Note: Admin SDK should only be imported in API routes, not here
// The admin imports will be handled in the API route files