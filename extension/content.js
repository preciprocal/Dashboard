// Content script to extract job data and inject Preciprocal button

// JobExtractor class - defined once at the top
class JobExtractor {
  constructor() {
    this.platform = this.detectPlatform();
    this.jobData = null;
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('glassdoor.com')) return 'glassdoor';
    if (hostname.includes('monster.com')) return 'monster';
    return 'unknown';
  }

  extractJobData() {
    switch (this.platform) {
      case 'linkedin':
        return this.extractLinkedIn();
      case 'indeed':
        return this.extractIndeed();
      case 'glassdoor':
        return this.extractGlassdoor();
      case 'monster':
        return this.extractMonster();
      default:
        return this.extractGeneric();
    }
  }

  extractLinkedIn() {
    try {
      const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent.trim() ||
                      document.querySelector('.jobs-unified-top-card__job-title')?.textContent.trim();
      
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent.trim() ||
                     document.querySelector('.jobs-unified-top-card__company-name')?.textContent.trim();
      
      const location = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent.trim() ||
                      document.querySelector('.jobs-unified-top-card__bullet')?.textContent.trim();
      
      const description = document.querySelector('.jobs-description__content')?.innerText ||
                         document.querySelector('.jobs-box__html-content')?.innerText;
      
      const salary = document.querySelector('.job-details-jobs-unified-top-card__job-insight')?.textContent.trim();
      
      const jobType = Array.from(document.querySelectorAll('.jobs-unified-top-card__job-insight'))
        .find(el => el.textContent.includes('Full-time') || el.textContent.includes('Part-time'))
        ?.textContent.trim();

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: salary || 'Not specified',
        jobType: jobType || 'Not specified',
        url: window.location.href,
        platform: 'LinkedIn',
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('LinkedIn extraction error:', error);
      return this.extractGeneric();
    }
  }

  extractIndeed() {
    try {
      const jobTitle = document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent.trim();
      const company = document.querySelector('[data-company-name="true"]')?.textContent.trim();
      const location = document.querySelector('[data-testid="job-location"]')?.textContent.trim();
      const description = document.querySelector('#jobDescriptionText')?.innerText;
      const salary = document.querySelector('.js-match-insights-provider-tvvxwd')?.textContent.trim();

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: salary || 'Not specified',
        jobType: 'Not specified',
        url: window.location.href,
        platform: 'Indeed',
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Indeed extraction error:', error);
      return this.extractGeneric();
    }
  }

  extractGlassdoor() {
    try {
      const jobTitle = document.querySelector('[data-test="job-title"]')?.textContent.trim();
      const company = document.querySelector('[data-test="employer-name"]')?.textContent.trim();
      const location = document.querySelector('[data-test="location"]')?.textContent.trim();
      const description = document.querySelector('.jobDescriptionContent')?.innerText;
      const salary = document.querySelector('[data-test="salary-estimate"]')?.textContent.trim();

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: salary || 'Not specified',
        jobType: 'Not specified',
        url: window.location.href,
        platform: 'Glassdoor',
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Glassdoor extraction error:', error);
      return this.extractGeneric();
    }
  }

  extractMonster() {
    try {
      const jobTitle = document.querySelector('.job-title')?.textContent.trim();
      const company = document.querySelector('.company-name')?.textContent.trim();
      const location = document.querySelector('.job-location')?.textContent.trim();
      const description = document.querySelector('.job-description')?.innerText;

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: 'Not specified',
        jobType: 'Not specified',
        url: window.location.href,
        platform: 'Monster',
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Monster extraction error:', error);
      return this.extractGeneric();
    }
  }

  extractGeneric() {
    // Fallback for any job site
    const getText = (selectors) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el.textContent.trim();
      }
      return null;
    };

    return {
      title: getText(['h1', '.job-title', '[class*="title"]']),
      company: getText(['.company', '[class*="company"]', '[class*="employer"]']),
      location: getText(['.location', '[class*="location"]']),
      description: document.body.innerText.substring(0, 5000),
      salary: 'Not specified',
      jobType: 'Not specified',
      url: window.location.href,
      platform: 'Other',
      extractedAt: new Date().toISOString()
    };
  }
}

// Inject floating button
function injectPreciprocal() {
  // Check if already injected
  if (document.getElementById('preciprocal-fab')) return;

  const fab = document.createElement('div');
  fab.id = 'preciprocal-fab';
  fab.innerHTML = `
    <button class="preciprocal-btn">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Preciprocal</span>
    </button>
  `;

  document.body.appendChild(fab);

  // Click handler
  fab.querySelector('.preciprocal-btn').addEventListener('click', async () => {
    const extractor = new JobExtractor();
    const jobData = extractor.extractJobData();

    if (!jobData.title || !jobData.company) {
      showNotification('Unable to extract complete job data. Please try again.', 'error');
      return;
    }

    // Send to background script
    chrome.runtime.sendMessage({
      action: 'openPreciprocal',
      jobData: jobData
    });
  });
}

// Notification system
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `preciprocal-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPreciprocal);
} else {
  injectPreciprocal();
}

// Re-inject on dynamic page changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(injectPreciprocal, 1000);
  }
}).observe(document, { subtree: true, childList: true });