// auth-receiver.js
console.log('🎯 Preciprocal auth receiver loaded');

// Listen for auth token from web app
const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://preciprocal.com'];

window.addEventListener('message', async (event) => {
  // Only accept messages from allowed origins
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;

  if (event.data.type === 'PRECIPROCAL_AUTH_TOKEN') {
    console.log('🔑 Auth token received from web app');
    const { token, expiresAt } = event.data;

    try {
      // Send token to background script
      const response = await chrome.runtime.sendMessage({
        type: 'AUTH_TOKEN',
        token,
        expiresAt
      });

      if (response.success) {
        console.log('✅ Extension authenticated successfully');
        showNotification('success', 'Extension connected successfully!');
        
        // Notify web app of success
        window.postMessage({
          type: 'PRECIPROCAL_AUTH_SUCCESS',
          user: response.user
        }, '*');
      } else {
        console.error('❌ Auth failed:', response.error);
        showNotification('error', 'Failed to connect extension');
      }

    } catch (error) {
      console.error('❌ Extension auth error:', error);
      showNotification('error', 'Connection error');
    }
  }
});

// Show in-page notification
function showNotification(type, message) {
  // Check if notification already exists
  if (document.getElementById('preciprocal-notification')) return;

  const notification = document.createElement('div');
  notification.id = 'preciprocal-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
  `;
  
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✓' : '✕';
  icon.style.cssText = `
    font-size: 18px;
    font-weight: bold;
  `;
  
  const text = document.createElement('span');
  text.textContent = message;
  
  notification.appendChild(icon);
  notification.appendChild(text);
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Check auth status on page load
chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
  if (response?.authenticated) {
    console.log('✅ Extension already authenticated');
  } else {
    console.log('⚠️ Extension not authenticated');
  }
});