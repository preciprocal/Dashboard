// popup.js

let authState = {
  authenticated: false,
  user: null,
  loading: true
};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Popup initializing...');
  await checkAuthStatus();
  render();
  setupEventListeners();
});

async function checkAuthStatus() {
  try {
    authState.loading = true;
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
    authState.authenticated = response.authenticated;
    authState.user = response.user;
    authState.loading = false;
    console.log('Auth status:', authState);
  } catch (error) {
    console.error('Auth check failed:', error);
    authState.loading = false;
    authState.authenticated = false;
  }
}

function setupEventListeners() {
  // Login button
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', openLoginPage);
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Open Dashboard button
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', openWebApp);
  }

  // Open Web button (alternative ID)
  const openWebBtn = document.getElementById('openWebBtn');
  if (openWebBtn) {
    openWebBtn.addEventListener('click', openWebApp);
  }

  // Resume Optimizer
  const resumeBtn = document.getElementById('resumeOptimizerBtn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => openFeature('/resume'));
  }

  // Cover Letter
  const coverLetterBtn = document.getElementById('coverLetterBtn');
  if (coverLetterBtn) {
    coverLetterBtn.addEventListener('click', () => openFeature('/cover-letter'));
  }

  // Mock Interview
  const mockInterviewBtn = document.getElementById('mockInterviewBtn');
  if (mockInterviewBtn) {
    mockInterviewBtn.addEventListener('click', () => openFeature('/interview'));
  }

  console.log('✅ Event listeners setup complete');
}

function openLoginPage() {
  console.log('📱 Opening login page...');
  chrome.tabs.create({
    url: 'http://localhost:3000/settings'
  });
  window.close();
}

function openWebApp() {
  console.log('📱 Opening dashboard...');
  chrome.tabs.create({
    url: 'http://localhost:3000/'
  });
  window.close();
}

function openFeature(path) {
  console.log('📱 Opening feature:', path);
  chrome.tabs.create({
    url: `http://localhost:3000${path}`
  });
  window.close();
}

async function logout() {
  try {
    console.log('🚪 Logging out...');
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    authState.authenticated = false;
    authState.user = null;
    render();
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

function render() {
  const container = document.getElementById('authContainer');
  if (!container) {
    console.error('❌ authContainer not found in DOM');
    return;
  }

  if (authState.loading) {
    container.innerHTML = renderLoadingView();
  } else if (authState.authenticated && authState.user) {
    container.innerHTML = renderAuthenticatedView();
  } else {
    container.innerHTML = renderUnauthenticatedView();
  }
  
  // Re-setup event listeners after render
  setTimeout(() => setupEventListeners(), 0);
}

function renderLoadingView() {
  return `
    <div class="loading-view">
      <div class="spinner"></div>
      <p>Checking authentication...</p>
    </div>
  `;
}

function renderAuthenticatedView() {
  const user = authState.user;
  const tierBadge = getTierBadge(user.subscriptionTier);

  return `
    <div class="authenticated">
      <div class="user-info">
        <div class="avatar">
          ${user.displayName.charAt(0).toUpperCase()}
        </div>
        <div class="user-details">
          <p class="user-name">${user.displayName}</p>
          <p class="user-email">${user.email}</p>
        </div>
      </div>
      
      <div class="tier-badge ${user.subscriptionTier}">
        <span class="tier-icon">${tierBadge.icon}</span>
        <span>${tierBadge.text}</span>
      </div>

      <div class="status-indicator">
        <div class="status-dot"></div>
        <span>Extension Connected</span>
      </div>

      <div class="feature-list">
        <button id="resumeOptimizerBtn" class="feature-btn">
          <div class="feature-icon">📄</div>
          <div class="feature-content">
            <span class="feature-title">Resume Optimizer</span>
            <span class="feature-desc">ATS score & optimization</span>
          </div>
        </button>
        
        <button id="coverLetterBtn" class="feature-btn">
          <div class="feature-icon">✉️</div>
          <div class="feature-content">
            <span class="feature-title">Cover Letter</span>
            <span class="feature-desc">Tailored to job posting</span>
          </div>
        </button>
        
        <button id="mockInterviewBtn" class="feature-btn">
          <div class="feature-icon">🎯</div>
          <div class="feature-content">
            <span class="feature-title">Mock Interview</span>
            <span class="feature-desc">AI-powered practice</span>
          </div>
        </button>
      </div>

      <div class="actions">
        <button id="openDashboardBtn" class="btn-primary">
          Open Dashboard
        </button>
        <button id="logoutBtn" class="btn-secondary">
          Disconnect
        </button>
      </div>
    </div>
  `;
}

function renderUnauthenticatedView() {
  return `
    <div class="unauthenticated">
      <div class="logo">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="url(#grad)"/>
          <path d="M32 20L44 32L32 44L20 32L32 20Z" fill="white" opacity="0.9"/>
          <path d="M32 26L38 32L32 38L26 32L32 26Z" fill="white"/>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#3b82f6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <h2>Welcome to Preciprocal</h2>
      <p class="description">
        AI Career Assistant for job seekers
      </p>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <div class="feature-text">
            <p class="feature-title">ATS Score</p>
            <p class="feature-desc">Check compatibility</p>
          </div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <div class="feature-text">
            <p class="feature-title">Skills Match</p>
            <p class="feature-desc">Gap analysis</p>
          </div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <div class="feature-text">
            <p class="feature-title">Instant</p>
            <p class="feature-desc">Real-time results</p>
          </div>
        </div>
      </div>

      <button id="loginBtn" class="btn-primary">
        Connect Your Account
      </button>

      <p class="help-text">
        Opens preciprocal.com to authorize this extension
      </p>
    </div>
  `;
}

function getTierBadge(tier) {
  const badges = {
    free: { icon: '🆓', text: 'Free' },
    starter: { icon: '🚀', text: 'Starter' },
    pro: { icon: '⭐', text: 'Pro' },
    premium: { icon: '💎', text: 'Premium' }
  };
  return badges[tier] || badges.free;
}

// Log when script loads
console.log('✅ Popup.js loaded');