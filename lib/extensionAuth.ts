// lib/extensionAuth.ts
// Call these functions from your app after Firebase login/logout
// to sync auth state into the Chrome extension.

const EXTENSION_ID = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID || '';

/**
 * Sends the Firebase auth token to the Chrome extension after login.
 * Call this right after getIdToken() in your sign-in flow.
 */
export async function syncAuthToExtension(
  uid: string,
  email: string,
  token: string
): Promise<boolean> {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: 'SAVE_AUTH', uid, email, token },
        (response) => {
          if (chrome.runtime.lastError) {
            // Extension not installed or not reachable — silent fail
            console.warn('Extension not reachable:', chrome.runtime.lastError.message);
            resolve(false);
          } else {
            console.log('✅ Auth synced to extension');
            resolve(response?.success === true);
          }
        }
      );
    } catch {
      resolve(false);
    }
  });
}

/**
 * Clears auth from the extension on logout.
 */
export async function clearExtensionAuth(): Promise<void> {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime) return;

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: 'CLEAR_AUTH' },
        () => resolve()
      );
    } catch {
      resolve();
    }
  });
}