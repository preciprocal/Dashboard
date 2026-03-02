// content.js - Extract job data and provide globally

console.log('🔧 Preciprocal content.js loaded');

// JobExtractor class - defined once and made globally available
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

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  extractLinkedIn() {
    try {
      // Job Title
      const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent.trim() ||
                      document.querySelector('.jobs-unified-top-card__job-title')?.textContent.trim() ||
                      document.querySelector('h1')?.textContent.trim();
      
      // Company Name
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent.trim() ||
                     document.querySelector('.jobs-unified-top-card__company-name')?.textContent.trim() ||
                     document.querySelector('[data-anonymize="company-name"]')?.textContent.trim();
      
      // Location
      const location = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent.trim() ||
                      document.querySelector('.jobs-unified-top-card__bullet')?.textContent.trim() ||
                      document.querySelector('[class*="job-details-jobs-unified-top-card__workplace-type"]')?.textContent.trim();
      
      // Job Description (cleaned)
      let description = document.querySelector('.jobs-description__content')?.innerText ||
                       document.querySelector('.jobs-box__html-content')?.innerText ||
                       document.querySelector('[class*="job-details-jobs-unified-top-card__job-description"]')?.innerText ||
                       document.querySelector('.description__text')?.innerText;
      description = this.cleanText(description);
      
      // Salary/Compensation
      const salaryElement = document.querySelector('.job-details-jobs-unified-top-card__job-insight--highlight') ||
                           document.querySelector('[class*="salary"]') ||
                           document.querySelector('[class*="compensation"]');
      const salary = salaryElement?.textContent.trim();
      
      // Job Type
      const jobTypeElements = Array.from(document.querySelectorAll('.jobs-unified-top-card__job-insight'));
      const jobType = jobTypeElements.find(el => 
        el.textContent.includes('Full-time') || 
        el.textContent.includes('Part-time') || 
        el.textContent.includes('Contract') ||
        el.textContent.includes('Temporary') ||
        el.textContent.includes('Internship')
      )?.textContent.trim();

      // Seniority Level
      const seniorityElement = Array.from(document.querySelectorAll('.jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight')).find(el =>
        el.textContent.includes('Entry level') ||
        el.textContent.includes('Mid-Senior level') ||
        el.textContent.includes('Senior level') ||
        el.textContent.includes('Director') ||
        el.textContent.includes('Executive')
      );
      const seniority = seniorityElement?.textContent.trim();

      // Employment Type (Remote, Hybrid, On-site)
      const workplaceType = document.querySelector('[class*="workplace-type"]')?.textContent.trim() ||
                           Array.from(document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight')).find(el =>
                             el.textContent.includes('Remote') ||
                             el.textContent.includes('Hybrid') ||
                             el.textContent.includes('On-site')
                           )?.textContent.trim();

      // Number of Applicants
      const applicants = document.querySelector('[class*="applicant"]')?.textContent.trim() ||
                        document.querySelector('.jobs-unified-top-card__subtitle-secondary-grouping')?.textContent.match(/\d+\s+applicants?/i)?.[0];

      // Skills (cleaned and limited)
      const skillsSection = document.querySelector('[class*="skill"]') || 
                           document.querySelector('.job-details-skill-match-status-list');
      const skills = skillsSection ? 
        Array.from(skillsSection.querySelectorAll('span, li'))
          .map(el => el.textContent.trim())
          .filter(text => text && text.length > 0 && text.length < 50)
          .slice(0, 15) : 
        [];

      // Company Size
      const companySize = Array.from(document.querySelectorAll('.jobs-company__box')).find(el =>
        el.textContent.includes('employees')
      )?.textContent.trim();

      // Industry
      const industry = Array.from(document.querySelectorAll('.jobs-company__box')).find(el =>
        el.textContent.toLowerCase().includes('industry')
      )?.textContent.trim();

      // Benefits (cleaned and limited)
      const benefitsSection = document.querySelector('[class*="benefit"]');
      const benefits = benefitsSection ?
        Array.from(benefitsSection.querySelectorAll('span, li'))
          .map(el => el.textContent.trim())
          .filter(text => text && text.length > 0 && text.length < 100)
          .slice(0, 10) :
        [];

      // Job URL
      const url = window.location.href;

      // Posted Date
      const postedDate = document.querySelector('[class*="posted-time-ago"]')?.textContent.trim() ||
                        document.querySelector('.jobs-unified-top-card__posted-date')?.textContent.trim();

      return {
        platform: 'LinkedIn',
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: salary,
        jobType: jobType,
        seniority: seniority,
        workplaceType: workplaceType,
        applicants: applicants,
        skills: skills,
        companySize: companySize,
        industry: industry,
        benefits: benefits,
        url: url,
        postedDate: postedDate,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting LinkedIn data:', error);
      return null;
    }
  }

  extractIndeed() {
    try {
      const jobTitle = document.querySelector('[class*="jobsearch-JobInfoHeader-title"]')?.textContent.trim() ||
                      document.querySelector('h1')?.textContent.trim();
      
      const company = document.querySelector('[data-company-name="true"]')?.textContent.trim() ||
                     document.querySelector('[class*="jobsearch-InlineCompanyRating"]')?.textContent.split('·')[0]?.trim();
      
      const location = document.querySelector('[class*="jobsearch-JobInfoHeader-subtitle"] div')?.textContent.trim();
      
      let description = document.querySelector('#jobDescriptionText')?.innerText ||
                       document.querySelector('[class*="jobsearch-jobDescriptionText"]')?.innerText;
      description = this.cleanText(description);
      
      const salary = document.querySelector('[class*="salary-snippet"]')?.textContent.trim();
      
      const url = window.location.href;

      return {
        platform: 'Indeed',
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: salary,
        url: url,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Indeed data:', error);
      return null;
    }
  }

  extractGlassdoor() {
    try {
      const jobTitle = document.querySelector('[data-test="job-title"]')?.textContent.trim() ||
                      document.querySelector('h1')?.textContent.trim();
      
      const company = document.querySelector('[data-test="employer-name"]')?.textContent.trim() ||
                     document.querySelector('[class*="EmployerProfile"]')?.textContent.trim();
      
      const location = document.querySelector('[data-test="location"]')?.textContent.trim() ||
                      document.querySelector('[class*="location"]')?.textContent.trim();
      
      let description = document.querySelector('[data-test="job-description"]')?.innerText ||
                       document.querySelector('.desc')?.innerText;
      description = this.cleanText(description);
      
      const salary = document.querySelector('[data-test="salary-estimate"]')?.textContent.trim();
      
      const url = window.location.href;

      return {
        platform: 'Glassdoor',
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        salary: salary,
        url: url,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Glassdoor data:', error);
      return null;
    }
  }

  extractMonster() {
    try {
      const jobTitle = document.querySelector('h1[data-test-id="svx-job-title"]')?.textContent.trim() ||
                      document.querySelector('h1')?.textContent.trim();
      
      const company = document.querySelector('[data-test-id="svx-job-company"]')?.textContent.trim();
      
      const location = document.querySelector('[data-test-id="svx-job-location"]')?.textContent.trim();
      
      let description = document.querySelector('[data-test-id="svx-job-description"]')?.innerText ||
                       document.querySelector('.job-description')?.innerText;
      description = this.cleanText(description);
      
      const url = window.location.href;

      return {
        platform: 'Monster',
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        url: url,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Monster data:', error);
      return null;
    }
  }

  extractGeneric() {
    try {
      const jobTitle = document.querySelector('h1')?.textContent.trim() ||
                      document.querySelector('[class*="job-title"]')?.textContent.trim() ||
                      document.querySelector('[class*="title"]')?.textContent.trim();
      
      const company = document.querySelector('[class*="company"]')?.textContent.trim();
      
      const location = document.querySelector('[class*="location"]')?.textContent.trim();
      
      let description = document.querySelector('[class*="description"]')?.innerText ||
                       document.querySelector('article')?.innerText ||
                       document.querySelector('main')?.innerText;
      description = this.cleanText(description);
      
      const url = window.location.href;

      return {
        platform: 'Generic',
        title: jobTitle,
        company: company,
        location: location,
        description: description,
        url: url,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting generic data:', error);
      return null;
    }
  }
}

// ✨ MAKE JOBEXTRACTOR GLOBALLY AVAILABLE FOR BANNER.JS AND METRICS.JS
window.JobExtractor = JobExtractor;

console.log('✅ JobExtractor available globally');