// Background service worker for Chrome extension

const PRECIPROCAL_URL = 'https://preciprocal.com';

// Listen for messages from content script and from the web page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  if (request.action === 'openPreciprocal') {
    handleJobDataExtraction(request.jobData);
  } else if (request.action === 'getJobData') {
    // Web page is requesting job data
    chrome.storage.local.get(['pendingJobData'], (result) => {
      console.log('📤 Sending job data to page:', result.pendingJobData);
      sendResponse({ jobData: result.pendingJobData });
      
      // Clear after sending
      chrome.storage.local.remove(['pendingJobData']);
    });
    return true; // Keep channel open for async response
  }
  return true;
});

async function handleJobDataExtraction(jobData) {
  try {
    console.log('📦 Job data extracted:', jobData);
    
    // Check if user is authenticated
    const authToken = await getAuthToken();
    
    if (!authToken) {
      console.log('❌ No auth token, redirecting to login');
      const loginUrl = `${PRECIPROCAL_URL}/auth?extension=true&redirect=job-tools`;
      chrome.tabs.create({ url: loginUrl });
      return;
    }

    console.log('✅ User authenticated');

    // Store job data in chrome storage (persistent)
    await chrome.storage.local.set({
      pendingJobData: jobData,
      timestamp: Date.now()
    });

    console.log('💾 Job data saved to chrome.storage');

    // Open Preciprocal in new tab
    const toolsUrl = `${PRECIPROCAL_URL}/job-tools?from_extension=true`;
    chrome.tabs.create({ url: toolsUrl });

  } catch (error) {
    console.error('❌ Error handling job data:', error);
  }
}

async function getAuthToken() {
  try {
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const jobSites = [
      'linkedin.com/jobs',
      'indeed.com/viewjob',
      'glassdoor.com/job-listing',
      'monster.com/job-openings'
    ];

    const isJobSite = jobSites.some(site => tab.url.includes(site));
    
    if (isJobSite) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => console.error('Script injection failed:', err));
    }
  }
});

// Handle storage changes for auth
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.authToken) {
    console.log('Auth token updated');
  }
});