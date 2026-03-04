// background.js
console.log('🚀 Preciprocal Extension - Service Worker Started');

// Configuration
const IS_DEV = false; // Set to true for local development
const BASE_URL = IS_DEV ? 'http://localhost:3000' : 'https://preciprocal.com';
const CONFIG = {
  TOKEN_KEY: 'preciprocal_auth_token',
  USER_KEY: 'preciprocal_user_data',
  API_BASE: `${BASE_URL}/api`
};

// ========== AUTH FUNCTIONS ==========

async function saveToken(token, expiresAt) {
  await chrome.storage.local.set({
    [CONFIG.TOKEN_KEY]: { 
      token, 
      expiresAt, 
      savedAt: Date.now() 
    }
  });
  console.log('✅ Token saved successfully');
}

async function getToken() {
  try {
    const result = await chrome.storage.local.get(CONFIG.TOKEN_KEY);
    const authData = result[CONFIG.TOKEN_KEY];

    if (!authData) {
      console.log('❌ No token found');
      return null;
    }

    // Check if token is expired
    if (authData.expiresAt < Date.now()) {
      console.log('⏰ Token expired');
      await clearAuth();
      return null;
    }

    return authData.token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

async function verifyAndFetchUser() {
  const token = await getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/extension/auth`, {
      method: 'GET',
      headers: {
        'x-extension-token': token
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('❌ Token invalid, clearing auth');
        await clearAuth();
      }
      return null;
    }

    const data = await response.json();
    
    // Cache user data
    await chrome.storage.local.set({
      [CONFIG.USER_KEY]: {
        ...data.user,
        lastFetch: Date.now()
      }
    });

    console.log('✅ User verified:', data.user.email);
    return data.user;

  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function isAuthenticated() {
  const token = await getToken();
  return token !== null;
}

async function clearAuth() {
  await chrome.storage.local.remove([CONFIG.TOKEN_KEY, CONFIG.USER_KEY]);
  console.log('🗑️ Auth cleared');
}

// ========== MESSAGE HANDLERS ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.type);

  // Handle auth token from web app
  if (message.type === 'AUTH_TOKEN') {
    saveToken(message.token, message.expiresAt)
      .then(() => verifyAndFetchUser())
      .then((user) => {
        console.log('✅ Auth complete:', user);
        sendResponse({ success: true, user });
      })
      .catch((error) => {
        console.error('❌ Auth error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Check auth status
  if (message.type === 'CHECK_AUTH') {
    verifyAndFetchUser()
      .then((user) => {
        sendResponse({ authenticated: !!user, user });
      })
      .catch((error) => {
        sendResponse({ authenticated: false, error: error.message });
      });
    return true;
  }

  // Get user data
  if (message.type === 'GET_USER_DATA') {
    chrome.storage.local.get(CONFIG.USER_KEY)
      .then((result) => {
        sendResponse({ user: result[CONFIG.USER_KEY] || null });
      })
      .catch((error) => {
        sendResponse({ user: null, error: error.message });
      });
    return true;
  }

  // Get token
  if (message.type === 'GET_TOKEN') {
    getToken()
      .then((token) => {
        sendResponse({ token });
      })
      .catch((error) => {
        sendResponse({ token: null, error: error.message });
      });
    return true;
  }

  // Logout
  if (message.type === 'LOGOUT') {
    clearAuth()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return false;
});

// ========== EXTENSION LIFECYCLE ==========

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('✅ Extension installed');
    
    // Open settings page with extension query param
    chrome.tabs.create({
      url: `${BASE_URL}/settings?from=extension`
    });
  } else if (details.reason === 'update') {
    console.log('🔄 Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🖱️ Extension icon clicked');
  
  // Check if user is on LinkedIn
  if (tab.url?.includes('linkedin.com/jobs')) {
    console.log('💼 On LinkedIn job page');
    
    // Check auth first
    const authStatus = await isAuthenticated();
    if (authStatus) {
      // User is authenticated, inject job analyzer
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['injector.js']
      });
    } else {
      // Not authenticated, show popup
      chrome.action.openPopup();
    }
  } else {
    // Not on LinkedIn, open popup
    chrome.action.openPopup();
  }
});

console.log('✅ Service worker initialized');

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;

  const url = tab.url.toLowerCase();
  const isJobSite = (
    // Already covered by content_scripts — skip
    url.includes('lever.co') ||
    url.includes('greenhouse.io') ||
    url.includes('workday.com') ||
    url.includes('myworkdayjobs.com') ||
    url.includes('indeed.com') ||
    url.includes('ashbyhq.com') ||
    url.includes('icims.com') ||
    url.includes('jobvite.com') ||
    url.includes('smartrecruiters.com') ||
    url.includes('linkedin.com') ||
    url.includes('localhost:3000') ||
    url.includes('preciprocal.com')
  );

  if (isJobSite) return; // Already handled by content_scripts

  // Dynamically inject on career/apply pages of ANY site
  const looksLikeJobPage = (
    /\/(apply|application|careers?|jobs?|hiring|openings?|positions?)\b/i.test(tab.url) ||
    url.includes('career') ||
    url.includes('/apply') ||
    url.includes('/job/')
  );

  if (!looksLikeJobPage) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['external-apply.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css']
    });
    console.log('💉 Dynamically injected external-apply.js on:', tab.url);
  } catch {
    // Tab may not allow injection (chrome:// pages etc) — ignore
  }
});