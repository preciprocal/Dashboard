// Background service worker for Chrome extension

const PRECIPROCAL_URL = 'https://preciprocal.com';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'openPreciprocal') {
    handleJobDataExtraction(request.jobData);
  }
  return true;
});

async function handleJobDataExtraction(jobData) {
  try {
    // Check if user is authenticated
    const authToken = await getAuthToken();
    
    if (!authToken) {
      // Open login page with redirect
      const loginUrl = `${PRECIPROCAL_URL}/login?extension=true&redirect=job-tools`;
      chrome.tabs.create({ url: loginUrl });
      return;
    }

    // Store job data temporarily
    await chrome.storage.local.set({
      currentJobData: jobData,
      timestamp: Date.now()
    });

    // Open Preciprocal in new tab with job data
    const toolsUrl = `${PRECIPROCAL_URL}/job-tools?from_extension=true`;
    
    // Create tab and inject script to set localStorage
    chrome.tabs.create({ url: toolsUrl }, (tab) => {
      if (tab.id) {
        // Wait for page to load, then inject job data
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            
            // Inject script to set localStorage
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: (data) => {
                localStorage.setItem('extensionJobData', JSON.stringify(data));
              },
              args: [jobData]
            });
          }
        });
      }
    });

  } catch (error) {
    console.error('Error handling job data:', error);
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