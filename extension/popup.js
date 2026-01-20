// Popup logic for Chrome extension

const PRECIPROCAL_URL = 'https://preciprocal.com';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  await checkCurrentPage();
  
  document.getElementById('extract-btn').addEventListener('click', extractAndGenerate);
  document.getElementById('dashboard-btn').addEventListener('click', openDashboard);
});

async function checkAuthStatus() {
  const statusEl = document.getElementById('auth-status');
  
  try {
    const result = await chrome.storage.local.get(['authToken', 'userEmail']);
    
    if (result.authToken) {
      statusEl.textContent = result.userEmail || 'Logged in';
      statusEl.classList.add('active');
      statusEl.classList.remove('inactive');
    } else {
      statusEl.textContent = 'Not logged in';
      statusEl.classList.add('inactive');
      statusEl.classList.remove('active');
    }
  } catch (error) {
    console.error('Error checking auth:', error);
    statusEl.textContent = 'Error';
    statusEl.classList.add('inactive');
  }
}

async function checkCurrentPage() {
  const statusEl = document.getElementById('page-status');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      statusEl.textContent = 'Unknown';
      return;
    }

    const jobSites = {
      'linkedin.com/jobs': 'LinkedIn',
      'indeed.com': 'Indeed',
      'glassdoor.com': 'Glassdoor',
      'monster.com': 'Monster'
    };

    let detected = 'Not a job site';
    for (const [site, name] of Object.entries(jobSites)) {
      if (tab.url.includes(site)) {
        detected = name;
        break;
      }
    }

    statusEl.textContent = detected;
    statusEl.style.color = detected !== 'Not a job site' ? '#10b981' : '#94a3b8';

  } catch (error) {
    console.error('Error checking page:', error);
    statusEl.textContent = 'Error';
  }
}

async function extractAndGenerate() {
  const btn = document.getElementById('extract-btn');
  const loading = document.getElementById('loading');
  const content = document.getElementById('content-main');
  
  try {
    // Check authentication
    const authResult = await chrome.storage.local.get(['authToken']);
    
    if (!authResult.authToken) {
      // Redirect to login
      chrome.tabs.create({ 
        url: `${PRECIPROCAL_URL}/login?extension=true&redirect=job-tools` 
      });
      return;
    }

    // Show loading
    btn.disabled = true;
    content.style.display = 'none';
    loading.classList.add('active');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script and extract data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractJobDataFromPage
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Failed to extract job data');
    }

    const jobData = results[0].result;

    // Validate job data
    if (!jobData.title || !jobData.company) {
      throw new Error('Incomplete job data. Please ensure you are on a job posting page.');
    }

    // Store job data
    await chrome.storage.local.set({
      currentJobData: jobData,
      timestamp: Date.now()
    });

    // Open Preciprocal job tools page
    chrome.tabs.create({ 
      url: `${PRECIPROCAL_URL}/job-tools?from_extension=true` 
    });

    // Close popup
    window.close();

  } catch (error) {
    console.error('Error extracting job:', error);
    alert(error.message || 'Failed to extract job data. Please try again.');
    
    // Reset UI
    btn.disabled = false;
    content.style.display = 'block';
    loading.classList.remove('active');
  }
}

function openDashboard() {
  chrome.tabs.create({ url: `${PRECIPROCAL_URL}/dashboard` });
  window.close();
}

// Function to inject into page
function extractJobDataFromPage() {
  class JobExtractor {
    constructor() {
      this.platform = this.detectPlatform();
    }

    detectPlatform() {
      const hostname = window.location.hostname;
      if (hostname.includes('linkedin.com')) return 'linkedin';
      if (hostname.includes('indeed.com')) return 'indeed';
      if (hostname.includes('glassdoor.com')) return 'glassdoor';
      if (hostname.includes('monster.com')) return 'monster';
      return 'unknown';
    }

    extract() {
      switch (this.platform) {
        case 'linkedin':
          return this.extractLinkedIn();
        case 'indeed':
          return this.extractIndeed();
        case 'glassdoor':
          return this.extractGlassdoor();
        default:
          return this.extractGeneric();
      }
    }

    extractLinkedIn() {
      const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title')?.textContent.trim();
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.textContent.trim();
      const location = document.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet')?.textContent.trim();
      const description = document.querySelector('.jobs-description__content, .jobs-box__html-content')?.innerText;

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        url: window.location.href,
        platform: 'LinkedIn',
        extractedAt: new Date().toISOString()
      };
    }

    extractIndeed() {
      const jobTitle = document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent.trim();
      const company = document.querySelector('[data-company-name="true"]')?.textContent.trim();
      const location = document.querySelector('[data-testid="job-location"]')?.textContent.trim();
      const description = document.querySelector('#jobDescriptionText')?.innerText;

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        url: window.location.href,
        platform: 'Indeed',
        extractedAt: new Date().toISOString()
      };
    }

    extractGlassdoor() {
      const jobTitle = document.querySelector('[data-test="job-title"]')?.textContent.trim();
      const company = document.querySelector('[data-test="employer-name"]')?.textContent.trim();
      const location = document.querySelector('[data-test="location"]')?.textContent.trim();
      const description = document.querySelector('.jobDescriptionContent')?.innerText;

      return {
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        url: window.location.href,
        platform: 'Glassdoor',
        extractedAt: new Date().toISOString()
      };
    }

    extractGeneric() {
      const getText = (selectors) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) return el.textContent.trim();
        }
        return null;
      };

      return {
        title: getText(['h1', '.job-title', '[class*="title"]']),
        company: getText(['.company', '[class*="company"]']),
        location: getText(['.location', '[class*="location"]']),
        description: document.body.innerText.substring(0, 5000),
        url: window.location.href,
        platform: 'Other',
        extractedAt: new Date().toISOString()
      };
    }
  }

  const extractor = new JobExtractor();
  return extractor.extract();
}