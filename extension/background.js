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
      const loginUrl = `${PRECIPROCAL_URL}/auth?extension=true&redirect=job-tools`;
      chrome.tabs.create({ url: loginUrl });
      return;
    }

    // Store job data in chrome storage
    await chrome.storage.local.set({
      currentJobData: jobData,
      timestamp: Date.now()
    });

    // Create the URL with a special flag
    const toolsUrl = `${PRECIPROCAL_URL}/job-tools?from_extension=true&job_id=${Date.now()}`;
    
    // Open new tab
    const tab = await chrome.tabs.create({ url: toolsUrl });
    
    if (!tab.id) {
      console.error('Failed to create tab');
      return;
    }

    // Wait for the page to load and inject the data
    const tabId = tab.id;
    
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        // Remove this listener
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait a bit for React to hydrate
        setTimeout(() => {
          // Inject script to set localStorage
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (data) => {
              try {
                localStorage.setItem('extensionJobData', JSON.stringify(data));
                console.log('Job data stored in localStorage:', data);
                // Trigger a custom event to notify the page
                window.dispatchEvent(new CustomEvent('extensionJobDataReady'));
              } catch (error) {
                console.error('Failed to store job data:', error);
              }
            },
            args: [jobData]
          }).catch(err => {
            console.error('Failed to inject script:', err);
          });
        }, 500); // Wait 500ms for React hydration
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