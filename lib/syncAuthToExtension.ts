// lib/utils/syncAuthToExtension.ts

import { User } from 'firebase/auth';

const EXTENSION_ID = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID;

export async function syncAuthToExtension(user: User): Promise<void> {
  if (!EXTENSION_ID) {
    console.warn('[AuthSync] No extension ID configured — set NEXT_PUBLIC_CHROME_EXTENSION_ID in .env');
    return;
  }

  try {
    const token = await user.getIdToken();

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type:  'SAVE_AUTH',
          uid:   user.uid,
          email: user.email,
          token,
        },
        () => {
          if (chrome.runtime.lastError) {
            // Extension not installed or not active — silent fail, never block login
          } else {
            console.log('[AuthSync] Extension auth synced for:', user.email);
          }
        }
      );
    }
  } catch {
    // Non-critical — never throw, never block the login flow
  }
}

export async function clearAuthFromExtension(): Promise<void> {
  if (!EXTENSION_ID) return;

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: 'CLEAR_AUTH' },
        () => {
          if (chrome.runtime.lastError) {
            // Extension not installed — silent fail
          } else {
            console.log('[AuthSync] Extension auth cleared');
          }
        }
      );
    }
  } catch {
    // Non-critical
  }
}