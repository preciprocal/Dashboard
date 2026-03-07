// background.js - Preciprocal Chrome Extension Service Worker

console.log('🚀 Preciprocal background.js loaded');

// ─────────────────────────────────────────────────────────────────
// Listen for messages from banner.js / content scripts (internal)
// ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH') {
    chrome.storage.local.get(['preciprocal_auth'], (result) => {
      const auth = result.preciprocal_auth;
      if (auth && auth.uid && auth.token) {
        sendResponse({
          authenticated: true,
          user: {
            uid:   auth.uid,
            email: auth.email || '',
          },
        });
      } else {
        sendResponse({ authenticated: false });
      }
    });
    return true;
  }

  if (message.type === 'GET_TOKEN') {
    chrome.storage.local.get(['preciprocal_auth'], (result) => {
      const auth = result.preciprocal_auth;
      sendResponse({ token: auth?.token || null });
    });
    return true;
  }

  if (message.type === 'GET_USER') {
    chrome.storage.local.get(['preciprocal_auth'], (result) => {
      const auth = result.preciprocal_auth;
      sendResponse({ uid: auth?.uid || null, email: auth?.email || null });
    });
    return true;
  }

  if (message.type === 'SAVE_AUTH') {
    const { uid, email, token } = message;
    if (uid && token) {
      chrome.storage.local.set({
        preciprocal_auth: { uid, email: email || '', token, savedAt: Date.now() }
      }, () => {
        console.log('✅ Auth saved for:', email);
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Missing uid or token' });
    }
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['preciprocal_auth'], () => {
      console.log('🗑️ Auth cleared');
      sendResponse({ success: true });
    });
    return true;
  }
});

// ─────────────────────────────────────────────────────────────────
// Listen for auth messages from the web app (externally_connectable)
// This fires when preciprocal.com calls chrome.runtime.sendMessage
// ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const allowedOrigins = ['https://preciprocal.com', 'http://localhost:3000'];
  if (!allowedOrigins.includes(sender.origin)) {
    console.warn('🚫 Blocked external message from:', sender.origin);
    sendResponse({ success: false, error: 'Unauthorized origin' });
    return;
  }

  if (message.type === 'SAVE_AUTH') {
    const { uid, email, token } = message;
    if (uid && token) {
      chrome.storage.local.set({
        preciprocal_auth: { uid, email: email || '', token, savedAt: Date.now() }
      }, () => {
        console.log('✅ Auth saved via web app for:', email);
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Missing uid or token' });
    }
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['preciprocal_auth'], () => {
      console.log('🗑️ Auth cleared via web app');
      sendResponse({ success: true });
    });
    return true;
  }
});