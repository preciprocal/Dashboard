// injector.js - Runs on job-tools page to inject data from chrome.storage

console.log('🔌 Preciprocal injector loaded on:', window.location.href);

// Flag to prevent multiple injections
let injectionAttempted = false;

// Function to inject job data into the page
function injectJobData() {
  if (injectionAttempted) {
    console.log('⚠️ Injection already attempted, skipping...');
    return;
  }
  
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error('❌ Chrome APIs not available');
    return;
  }

  chrome.storage.local.get(['preciprocalJobData', 'preciprocalTimestamp'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Chrome storage error:', chrome.runtime.lastError);
      return;
    }

    if (result.preciprocalJobData) {
      injectionAttempted = true;
      console.log('✅ Found job data in storage:', result.preciprocalJobData);
      
      try {
        // Check if data is not too old (within 5 minutes)
        const ageInMs = Date.now() - (result.preciprocalTimestamp || 0);
        const fiveMinutes = 5 * 60 * 1000;
        
        if (ageInMs > fiveMinutes) {
          console.warn('⚠️ Job data is older than 5 minutes, skipping injection');
          chrome.storage.local.remove(['preciprocalJobData', 'preciprocalTimestamp']);
          return;
        }

        // FIRST: Store in sessionStorage IMMEDIATELY
        try {
          sessionStorage.setItem('extensionJobData', JSON.stringify(result.preciprocalJobData));
          sessionStorage.setItem('extensionJobDataTimestamp', String(Date.now()));
          console.log('💾 Job data stored in sessionStorage');
        } catch (sessionError) {
          console.error('❌ Failed to store in sessionStorage:', sessionError);
        }

        // SECOND: Inject into page context using a script tag
        const script = document.createElement('script');
        script.id = 'preciprocal-data-injector';
        script.textContent = `
          (function() {
            try {
              const jobData = ${JSON.stringify(result.preciprocalJobData)};
              console.log('💉 Injecting job data into page context:', jobData);
              
              // Store in sessionStorage from page context too
              try {
                sessionStorage.setItem('extensionJobData', JSON.stringify(jobData));
                sessionStorage.setItem('extensionJobDataTimestamp', '${Date.now()}');
              } catch (e) {
                console.error('Failed to store in sessionStorage:', e);
              }
              
              // Dispatch custom event MULTIPLE TIMES with delays
              function dispatchEvent() {
                const event = new CustomEvent('preciprocalDataReady', { 
                  detail: jobData,
                  bubbles: true,
                  composed: true
                });
                window.dispatchEvent(event);
                document.dispatchEvent(event);
                
                // Also dispatch on document.body if it exists
                if (document.body) {
                  document.body.dispatchEvent(event);
                }
              }
              
              // Dispatch immediately
              dispatchEvent();
              
              // Dispatch again after delays to catch late listeners
              setTimeout(dispatchEvent, 100);
              setTimeout(dispatchEvent, 300);
              setTimeout(dispatchEvent, 500);
              setTimeout(dispatchEvent, 1000);
              setTimeout(dispatchEvent, 2000);
              
              console.log('✅ Job data successfully injected and events dispatched');
            } catch (error) {
              console.error('❌ Failed to inject job data:', error);
            }
          })();
        `;
        
        // Insert as early as possible
        const target = document.head || document.documentElement;
        if (target) {
          target.appendChild(script);
          script.remove();
          console.log('💾 Script injected into page context');
        }
        
        // Clear from chrome storage after successful injection
        setTimeout(() => {
          chrome.storage.local.remove(['preciprocalJobData', 'preciprocalTimestamp'], () => {
            console.log('🧹 Cleaned up chrome.storage');
          });
        }, 3000); // Wait 3 seconds before cleaning up
        
      } catch (error) {
        console.error('❌ Failed to inject data:', error);
      }
    } else {
      console.log('⚠️ No job data found in chrome.storage');
    }
  });
}

// Inject IMMEDIATELY - as early as possible
injectJobData();

// Inject on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectJobData);
} else {
  // DOM already loaded, inject again
  setTimeout(injectJobData, 10);
}

// Inject when page is fully loaded
window.addEventListener('load', injectJobData);

// Also try injecting at various intervals to catch the page
setTimeout(injectJobData, 50);
setTimeout(injectJobData, 100);
setTimeout(injectJobData, 200);
setTimeout(injectJobData, 500);
setTimeout(injectJobData, 1000);

// Listen for a signal from the page that it's ready
window.addEventListener('message', (event) => {
  if (event.data === 'preciprocalPageReady') {
    console.log('📡 Received page ready signal');
    injectJobData();
  }
});

console.log('✅ Preciprocal injector script loaded and scheduled');