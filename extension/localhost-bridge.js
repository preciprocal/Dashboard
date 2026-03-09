// localhost-bridge.js - Bridges chrome.storage to localhost pages

console.log('🌉 Preciprocal localhost bridge loaded');

// Listen for page requests for job data
window.addEventListener('message', async (event) => {
  // Only respond to messages from same origin (localhost)
  if (event.origin !== window.location.origin) return;
  
  if (event.data.type === 'GET_LINKEDIN_JOB_DATA') {
    console.log('📥 Page requesting LinkedIn job data');
    
    try {
      // Get data from chrome.storage
      const result = await chrome.storage.local.get(['preciprocal_linkedin_job', 'preciprocal_timestamp']);
      
      if (result.preciprocal_linkedin_job) {
        console.log('✅ Job data found in storage:', result.preciprocal_linkedin_job.title);
        
        // Send data back to page
        window.postMessage({
          type: 'LINKEDIN_JOB_DATA_RESPONSE',
          data: result.preciprocal_linkedin_job,
          timestamp: result.preciprocal_timestamp
        }, window.location.origin);
        
        console.log('📤 Job data sent to page');
      } else {
        console.log('ℹ️ No job data in storage');
        
        // Send empty response
        window.postMessage({
          type: 'LINKEDIN_JOB_DATA_RESPONSE',
          data: null
        }, window.location.origin);
      }
    } catch (error) {
      console.error('Error reading chrome.storage:', error);
    }
  }
});

// Auto-send data when page loads if it exists
(async () => {
  try {
    const result = await chrome.storage.local.get(['preciprocal_linkedin_job', 'preciprocal_timestamp']);
    
    if (result.preciprocal_linkedin_job) {
      const timestamp = result.preciprocal_timestamp;
      
      // Only send if data is recent (within 1 minute)
      if (timestamp && Date.now() - timestamp < 300000) {
        console.log('🎁 Auto-sending LinkedIn job data to page');
        
        // Wait a bit for page to load
        setTimeout(() => {
          window.postMessage({
            type: 'LINKEDIN_JOB_DATA_RESPONSE',
            data: result.preciprocal_linkedin_job,
            timestamp: result.preciprocal_timestamp
          }, window.location.origin);
        }, 500);
      }
    }
  } catch (error) {
    console.error('Error in auto-send:', error);
  }
})();

console.log('✅ Localhost bridge ready');