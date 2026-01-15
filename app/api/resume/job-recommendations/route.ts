// app/api/resume/job-recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db, storage } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string | null;
  jobType: string;
  experience?: string | null;
  description: string;
  requirements: string[];
  matchScore: number;
  applyUrl: string;
  postedDate: string;
  source: string;
}

interface Filters {
  jobType?: string;
  minMatchScore?: number;
  location?: string;
}

interface FeedbackTip {
  tip?: string;
  type?: string;
  explanation?: string;
}

interface FeedbackSection {
  score?: number;
  tips?: FeedbackTip[];
}

interface ResumeFeedback {
  overallScore?: number;
  skills?: FeedbackSection;
  content?: FeedbackSection;
  ATS?: FeedbackSection;
  structure?: FeedbackSection;
  toneAndStyle?: FeedbackSection;
  resumeText?: string;
}

interface ResumeData {
  userId?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  feedback?: ResumeFeedback;
  extractedText?: string;
  parsedText?: string;
  resumeText?: string;
  text?: string;
  content?: string;
  fileName?: string;
  originalFileName?: string;
}

interface JSearchJob {
  job_id: string;
  employer_name: string;
  employer_logo?: string;
  job_title: string;
  job_description: string;
  job_apply_link: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_employment_type?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  job_required_experience?: {
    required_experience_in_months?: number;
  };
  job_posted_at_datetime_utc?: string;
  job_required_skills?: string[];
}

interface JSearchResponse {
  status: string;
  request_id: string;
  data: JSearchJob[];
}

interface ResumeAnalysis {
  jobTitles: string[];
  skills: string[];
  location: string;
  experience: string;
  education: string;
  industries: string[];
  careerLevel: string;
  certifications: string[];
  preferredJobTypes: string[];
}

async function verifyToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });
    
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/png'
      }
    };

    const prompt = `Extract ALL readable text from this resume image with complete accuracy.

CRITICAL INSTRUCTIONS:
1. Capture EVERY word, number, date, email, phone number, URL exactly as shown
2. Preserve ALL section headers (Education, Experience, Skills, Projects, etc.)
3. Include ALL job titles, company names, dates, locations
4. Extract ALL bullet points and descriptions completely
5. Capture ALL technical skills, tools, frameworks, languages
6. Include ALL education details (degrees, universities, GPAs, dates)
7. Extract ALL project names, descriptions, and technologies used
8. Maintain original structure and hierarchy
9. Include contact information (name, email, phone, LinkedIn, GitHub, etc.)
10. Preserve all formatting cues (bullets, dates, locations)

Return only the extracted text, maintaining the original structure.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();
    
    console.log('✅ Image text extraction successful. Length:', response.trim().length);
    return response.trim();
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error('Failed to extract text from resume');
  }
}

function constructResumeFromFeedback(resumeData: ResumeData): string {
  const feedback = resumeData.feedback;
  if (!feedback) return '';
  
  const sections: string[] = [];
  
  sections.push(`RESUME ANALYSIS PROFILE`);
  sections.push(`Overall Score: ${feedback.overallScore || 0}/100`);
  if (resumeData.fileName || resumeData.originalFileName) {
    sections.push(`Document: ${resumeData.fileName || resumeData.originalFileName}`);
  }
  if (resumeData.jobTitle) sections.push(`Target Role: ${resumeData.jobTitle}`);
  if (resumeData.companyName) sections.push(`Target Company: ${resumeData.companyName}`);
  sections.push('');
  
  if (resumeData.jobDescription && resumeData.jobDescription.length > 20) {
    sections.push('TARGET JOB REQUIREMENTS:');
    sections.push(resumeData.jobDescription);
    sections.push('');
  }
  
  if (feedback.skills?.tips) {
    sections.push('TECHNICAL SKILLS & COMPETENCIES');
    feedback.skills.tips.forEach((tip: FeedbackTip) => {
      if (tip.tip) sections.push(`• ${tip.tip}`);
    });
    sections.push('');
  }
  
  if (feedback.content?.tips) {
    sections.push('PROFESSIONAL EXPERIENCE');
    feedback.content.tips.forEach((tip: FeedbackTip) => {
      if (tip.tip) sections.push(`• ${tip.tip}`);
    });
    sections.push('');
  }
  
  return sections.join('\n').trim();
}

async function analyzeResumeForJobSearch(resumeText: string): Promise<ResumeAnalysis> {
  const fallbackData: ResumeAnalysis = { 
    jobTitles: ['Software Engineer', 'Full Stack Developer', 'Backend Engineer'], 
    skills: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'TypeScript', 'AWS', 'Git'], 
    location: 'United States',
    experience: 'Mid-Level',
    education: 'Bachelor\'s Degree',
    industries: ['Technology', 'Software Development'],
    careerLevel: 'Mid-Level',
    certifications: [],
    preferredJobTypes: ['Full-time']
  };

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.05,
        topP: 0.9,
        maxOutputTokens: 1500,
      },
    });

    const sanitizedResumeText = resumeText
      .substring(0, 5000)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\\/g, ' ')
      .replace(/"/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const prompt = `Analyze this resume COMPREHENSIVELY and extract DETAILED job search information for PERFECT job matching.

COMPLETE RESUME TEXT:
${sanitizedResumeText}

CRITICAL: Read the ENTIRE resume carefully to understand the person's ACTUAL career field and experience. Do NOT default to software/tech unless the resume clearly shows software development experience.

TASK: Extract ALL relevant information for highly accurate job recommendations based on what is ACTUALLY in the resume.

You must respond with ONLY valid JSON in this exact format:
{
  "jobTitles": ["Primary Title", "Alternative Title 1", "Alternative Title 2", "Alternative Title 3", "Alternative Title 4"],
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7", "skill8", "skill9", "skill10"],
  "location": "City, State or Country",
  "experience": "Entry-Level OR Mid-Level OR Senior-Level OR Executive",
  "education": "High School OR Associates OR Bachelors OR Masters OR PhD",
  "industries": ["Industry 1", "Industry 2", "Industry 3"],
  "careerLevel": "Junior OR Mid-Level OR Senior OR Lead OR Principal OR Executive",
  "certifications": ["cert1", "cert2", "cert3"],
  "preferredJobTypes": ["Full-time", "Part-time", "Contract", "Internship"]
}

DETAILED EXTRACTION REQUIREMENTS:

1. JOB TITLES (5 diverse titles):
   - Extract ACTUAL job titles from the resume work experience
   - Generate 4 alternative titles IN THE SAME FIELD based on their actual skills and experience
   - IMPORTANT: If the resume shows nursing experience, return nursing titles. If it shows teaching, return teaching titles. Match the ACTUAL field.
   - Be SPECIFIC with seniority: Junior, Mid-Level, Senior, Lead, Staff, Principal
   - Consider specializations within THEIR field
   - Examples: "Senior Registered Nurse", "Emergency Room Nurse", "Clinical Nurse Manager" for nurses
   - Examples: "High School Math Teacher", "Curriculum Specialist", "Education Coordinator" for teachers
   - Examples: "Senior Accountant", "Financial Analyst", "Tax Manager" for finance professionals

2. SKILLS (10-12 relevant skills):
   - Extract skills that are ACTUALLY mentioned or implied in the resume
   - MUST match the career field - if healthcare resume, list healthcare skills NOT programming skills
   - For nurses: Patient Care, Medical Terminology, Clinical Skills, etc.
   - For teachers: Curriculum Development, Classroom Management, etc.
   - For accountants: Financial Analysis, QuickBooks, Excel, Tax Preparation, etc.
   - For marketers: Digital Marketing, SEO, Social Media, Analytics, etc.
   - Include relevant tools, methodologies, and certifications from their field
   - Prioritize most recent and frequently mentioned skills

3. LOCATION:
   - Extract from contact section, recent job, or preferences
   - Format as "City, State" for US (e.g., "Boston, MA")
   - Or "City, Country" for international
   - If multiple locations or remote work mentioned, use "Remote" or "Flexible"
   - If unclear, default to "United States"

4. EXPERIENCE LEVEL (based on years + responsibilities):
   - Entry-Level: 0-2 years, recent grad, learning phase, junior roles
   - Mid-Level: 2-5 years, independent contributor, solid expertise
   - Senior-Level: 5-10 years, advanced skills, mentorship, architecture
   - Executive: 10+ years, leadership, strategic, C-level or director

5. EDUCATION (highest degree completed):
   - High School: Only high school diploma
   - Associates: 2-year degree or associate's
   - Bachelors: BS, BA, or equivalent 4-year degree
   - Masters: MS, MA, MBA, or equivalent graduate degree
   - PhD: Doctoral degree or equivalent terminal degree

6. INDUSTRIES (3 relevant industries):
   - Based ONLY on actual work experience in the resume
   - Be specific and match their ACTUAL field
   - Healthcare examples: "Healthcare", "Hospital Administration", "Medical Services"
   - Education examples: "Education", "K-12 Education", "Higher Education"
   - Finance examples: "Accounting", "Financial Services", "Corporate Finance"
   - Marketing examples: "Digital Marketing", "Advertising", "Brand Management"
   - DO NOT default to "Technology" or "Software Development" unless clearly a tech role

7. CAREER LEVEL (more granular than experience):
   - Junior: 0-2 years, learning, entry-level
   - Mid-Level: 2-5 years, independent contributor
   - Senior: 5-8 years, expert, mentor
   - Lead: 8-12 years, team lead, technical leadership
   - Principal: 12+ years, strategic technical expert
   - Executive: Director, VP, C-level

8. CERTIFICATIONS (all professional certifications):
   - Extract ANY certifications mentioned
   - Include tech certs (AWS, Azure, Google Cloud, etc.)
   - Include professional certs (PMP, Scrum Master, etc.)
   - Include industry certs (CPA, CFA, etc.)
   - Empty array if none found

9. PREFERRED JOB TYPES (infer from experience):
   - Full-time: Default for most professionals
   - Part-time: If mentioned or part-time experience
   - Contract: If contractor/freelance experience
   - Internship: Only if student or recent grad
   - Return 1-2 types based on resume context

CRITICAL PARSING RULES:
- Use ONLY simple alphanumeric characters, spaces, hyphens
- NO special characters, quotes in values, or line breaks within strings
- Ensure ALL arrays have at least minimum items (use reasonable defaults)
- Be SPECIFIC and ACTIONABLE - avoid generic terms
- Extract ACTUAL information from resume, don't invent
- If unclear, use reasonable professional defaults

Return ONLY the JSON object with no markdown or additional text.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log('📊 Raw AI analysis response:', response.substring(0, 500));
    
    let cleaned = response
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^\s+/gm, '')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .trim();
    
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error('❌ No valid JSON object found in response');
      console.log('Response was:', response);
      return fallbackData;
    }
    
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    
    let data;
    try {
      data = JSON.parse(cleaned);
      console.log('✅ Successfully parsed JSON');
      console.log('Extracted job titles:', data.jobTitles);
      console.log('Extracted skills:', data.skills);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.log('Failed to parse:', cleaned.substring(0, 500));
      return fallbackData;
    }
    
    if (!data || typeof data !== 'object') {
      console.error('❌ Response is not a valid object');
      return fallbackData;
    }
    
    // Validate and sanitize with better logging
    const jobTitles = Array.isArray(data.jobTitles) 
      ? data.jobTitles.slice(0, 5).map((t: unknown) => String(t).trim()).filter(Boolean)
      : fallbackData.jobTitles;
    
    const skills = Array.isArray(data.skills)
      ? data.skills.slice(0, 12).map((s: unknown) => String(s).trim()).filter(Boolean)
      : fallbackData.skills;

    const industries = Array.isArray(data.industries)
      ? data.industries.slice(0, 3).map((i: unknown) => String(i).trim()).filter(Boolean)
      : fallbackData.industries;

    const certifications = Array.isArray(data.certifications)
      ? data.certifications.slice(0, 5).map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];

    const preferredJobTypes = Array.isArray(data.preferredJobTypes)
      ? data.preferredJobTypes.slice(0, 3).map((t: unknown) => String(t).trim()).filter(Boolean)
      : ['Full-time'];
    
    const location = typeof data.location === 'string' && data.location.trim() 
      ? data.location.trim() 
      : 'United States';

    const experience = typeof data.experience === 'string' && data.experience.trim()
      ? data.experience.trim()
      : 'Mid-Level';

    const education = typeof data.education === 'string' && data.education.trim()
      ? data.education.trim()
      : 'Bachelor\'s Degree';

    const careerLevel = typeof data.careerLevel === 'string' && data.careerLevel.trim()
      ? data.careerLevel.trim()
      : 'Mid-Level';
    
    // Ensure we have minimum required data - if empty, it means extraction failed
    if (jobTitles.length === 0) {
      console.warn('⚠️ No job titles extracted, using fallback');
      console.log('Full response was:', response);
      return fallbackData;
    }
    
    if (skills.length === 0) {
      console.warn('⚠️ No skills extracted, using fallback');
      console.log('Full response was:', response);
      return fallbackData;
    }

    if (industries.length === 0) {
      console.warn('⚠️ No industries extracted, using fallback');
      console.log('Full response was:', response);
      return fallbackData;
    }
    
    const finalResult = {
      jobTitles,
      skills,
      location,
      experience,
      education,
      industries,
      careerLevel,
      certifications,
      preferredJobTypes
    };
    
    console.log('✅ Successfully extracted comprehensive data:', { 
      jobTitlesCount: jobTitles.length, 
      firstJobTitle: jobTitles[0],
      allJobTitles: jobTitles,
      skillsCount: skills.length,
      firstSkills: skills.slice(0, 5),
      allSkills: skills,
      industriesCount: industries.length,
      industries: industries,
      certificationsCount: certifications.length,
      preferredJobTypesCount: preferredJobTypes.length,
      location,
      experience,
      education,
      careerLevel
    });
    
    return finalResult;
    
  } catch (error) {
    console.error('❌ Error analyzing resume:', error);
    return fallbackData;
  }
}

function calculateAdvancedMatchScore(
  job: JSearchJob, 
  analysis: ResumeAnalysis
): number {
  try {
    const jobText = `${job.job_title} ${job.job_description}`.toLowerCase();
    const jobTitle = job.job_title.toLowerCase();
    let totalScore = 0;
    
    // 1. SKILL MATCHING (40% weight)
    const matchedSkills = analysis.skills.filter(skill => 
      jobText.includes(skill.toLowerCase())
    );
    const skillMatchPercentage = (matchedSkills.length / Math.max(analysis.skills.length, 1)) * 100;
    const skillScore = Math.min(skillMatchPercentage * 0.4, 40);
    totalScore += skillScore;
    console.log(`  Skills: ${matchedSkills.length}/${analysis.skills.length} matched = ${skillScore.toFixed(1)}%`);
    
    // 2. JOB TITLE RELEVANCE (25% weight)
    let titleScore = 0;
    const matchedTitles = analysis.jobTitles.filter(title => 
      jobTitle.includes(title.toLowerCase()) || title.toLowerCase().includes(jobTitle)
    );
    if (matchedTitles.length > 0) {
      titleScore = 25;
    } else {
      const titleWords = analysis.jobTitles.flatMap(t => t.toLowerCase().split(/\s+/));
      const jobTitleWords = jobTitle.split(/\s+/);
      const commonWords = titleWords.filter(w => jobTitleWords.includes(w) && w.length > 3);
      titleScore = Math.min(commonWords.length * 5, 15);
    }
    totalScore += titleScore;
    console.log(`  Title: ${titleScore.toFixed(1)}%`);
    
    // 3. EXPERIENCE LEVEL MATCHING (20% weight)
    let experienceScore = 10;
    const experienceKeywords: Record<string, string[]> = {
      'Entry-Level': ['entry', 'junior', 'associate', 'intern', 'graduate', 'early career'],
      'Mid-Level': ['mid', 'intermediate', 'experienced', 'professional', 'specialist'],
      'Senior-Level': ['senior', 'lead', 'principal', 'staff', 'expert', 'architect'],
      'Executive': ['director', 'vp', 'executive', 'chief', 'head of', 'president']
    };
    
    const levelKeywords = experienceKeywords[analysis.experience] || [];
    const hasExactMatch = levelKeywords.some(keyword => jobText.includes(keyword));
    
    if (hasExactMatch) {
      experienceScore = 20;
    } else {
      experienceScore = 10;
    }
    totalScore += experienceScore;
    console.log(`  Experience: ${experienceScore.toFixed(1)}%`);
    
    // 4. CERTIFICATION MATCHING (10% weight)
    let certScore = 0;
    if (analysis.certifications.length > 0) {
      const matchedCerts = analysis.certifications.filter(cert =>
        jobText.includes(cert.toLowerCase())
      );
      certScore = (matchedCerts.length / analysis.certifications.length) * 10;
    }
    totalScore += certScore;
    console.log(`  Certifications: ${certScore.toFixed(1)}%`);
    
    // 5. INDUSTRY RELEVANCE (5% weight)
    let industryScore = 0;
    const matchedIndustries = analysis.industries.filter(industry =>
      jobText.includes(industry.toLowerCase())
    );
    if (matchedIndustries.length > 0) {
      industryScore = 5;
    }
    totalScore += industryScore;
    console.log(`  Industry: ${industryScore.toFixed(1)}%`);
    
    // Round and ensure between 60-100
    const finalScore = Math.round(Math.min(Math.max(totalScore, 60), 100));
    console.log(`  FINAL MATCH SCORE: ${finalScore}%`);
    
    return finalScore;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error calculating match score:', errorMessage);
    return 75;
  }
}

function extractRequirementsFromDescription(description: string, resumeSkills: string[]): string[] {
  const requirements: string[] = [];
  const descLower = description.toLowerCase();
  
  // First priority: skills from resume that match
  resumeSkills.forEach(skill => {
    if (descLower.includes(skill.toLowerCase())) {
      requirements.push(skill);
    }
  });
  
  // AI/ML specific skills
  const aiMlSkills = [
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras',
    'Neural Networks', 'NLP', 'Computer Vision', 'Scikit-learn', 'OpenCV',
    'Transformers', 'BERT', 'GPT', 'LLM', 'MLOps', 'Model Deployment',
    'Feature Engineering', 'CNN', 'RNN', 'GAN', 'Reinforcement Learning'
  ];
  
  // Data Science skills
  const dataScienceSkills = [
    'Data Science', 'Data Analysis', 'Python', 'R', 'SQL', 'Pandas',
    'NumPy', 'Matplotlib', 'Seaborn', 'Jupyter', 'Statistics',
    'Data Visualization', 'Tableau', 'Power BI', 'Excel', 'Big Data'
  ];
  
  // General tech skills
  const techSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 
    'AWS', 'Docker', 'Kubernetes', 'Git', 'SQL', 'MongoDB', 'PostgreSQL',
    'REST API', 'GraphQL', 'CI/CD', 'Agile', 'Microservices',
    'Vue.js', 'Angular', 'Django', 'Flask', 'Spring Boot'
  ];
  
  // Check which skill set to use based on description
  let skillsToCheck = techSkills;
  if (descLower.match(/\b(machine learning|deep learning|ai|neural network|nlp|computer vision|tensorflow|pytorch)\b/)) {
    skillsToCheck = aiMlSkills;
  } else if (descLower.match(/\b(data science|data analyst|analytics|visualization|statistics)\b/)) {
    skillsToCheck = dataScienceSkills;
  }
  
  skillsToCheck.forEach(skill => {
    if (descLower.includes(skill.toLowerCase()) && !requirements.includes(skill)) {
      requirements.push(skill);
    }
  });
  
  return requirements.slice(0, 8);
}

function formatSalary(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `${currency} ${amount}`;
}

function formatPostedDate(dateString: string): string {
  try {
    const posted = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - posted.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Posted today';
    if (diffDays === 1) return 'Posted yesterday';
    if (diffDays < 7) return `Posted ${diffDays} days ago`;
    if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)} weeks ago`;
    return `Posted ${Math.floor(diffDays / 30)} months ago`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Date formatting error';
    console.error('Error formatting posted date:', errorMessage);
    return 'Recently posted';
  }
}

function normalizeJobType(type: string): string {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('full')) return 'Full-time';
  if (typeLower.includes('part')) return 'Part-time';
  if (typeLower.includes('contract')) return 'Contract';
  if (typeLower.includes('intern')) return 'Internship';
  return 'Full-time';
}

function formatExperience(months: number): string | null {
  const years = Math.floor(months / 12);
  if (years === 0) return 'Entry Level';
  if (years === 1) return '1 year';
  if (years <= 3) return `${years} years`;
  if (years <= 5) return '3-5 years';
  if (years <= 7) return '5-7 years';
  return `${years}+ years`;
}

function truncateDescription(description: string): string {
  const text = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const preview = sentences.slice(0, 3).join('. ') + '.';
  
  if (preview.length > 350) {
    return preview.substring(0, 347) + '...';
  }
  
  return preview;
}

function extractSource(url: string): string {
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('indeed.com')) return 'Indeed';
  if (url.includes('glassdoor.com')) return 'Glassdoor';
  if (url.includes('monster.com')) return 'Monster';
  if (url.includes('ziprecruiter.com')) return 'ZipRecruiter';
  return 'Job Board';
}

async function fetchRealJobsFromJSearch(
  analysis: ResumeAnalysis,
  searchQuery?: string,
  filters?: Filters
): Promise<JobListing[]> {
  const { jobTitles, skills, location, experience } = analysis;

  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️ No RapidAPI key found');
    return [];
  }

  try {
    const allJobs: JobListing[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    
    const searchTerms = searchQuery 
      ? [searchQuery]
      : jobTitles.slice(0, 3);

    console.log(`🔍 Searching for jobs with terms:`, searchTerms);
    console.log(`📍 Location: ${location}, Experience: ${experience}`);
    if (filters?.jobType && filters.jobType !== 'all') {
      console.log(`🎯 Job Type Filter: ${filters.jobType}`);
    }

    for (const searchTerm of searchTerms) {
      for (let page = 1; page <= 2; page++) {
        try {
          console.log(`📄 Fetching page ${page} for: ${searchTerm}`);

          let queryString = `${searchTerm} in ${location}`;
          
          // Add job type to search query if filtered
          if (filters?.jobType && filters.jobType !== 'all') {
            queryString += ` ${filters.jobType}`;
          }

          const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(queryString)}&page=${page}&num_pages=1&date_posted=week`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
          });

          if (!response.ok) {
            console.warn(`⚠️ JSearch API returned ${response.status} for page ${page}`);
            continue;
          }

          const data: JSearchResponse = await response.json();
          console.log(`✅ Page ${page} returned ${data.data?.length || 0} jobs`);

          if (!data.data || data.data.length === 0) {
            break;
          }

          data.data.forEach((job: JSearchJob) => {
            if (seenIds.has(job.job_id) || seenUrls.has(job.job_apply_link)) {
              return;
            }

            const jobType = normalizeJobType(job.job_employment_type || 'Full-time');
            
            // Apply job type filter at API level
            if (filters?.jobType && filters.jobType !== 'all' && jobType !== filters.jobType) {
              return;
            }

            console.log(`\n🔍 Analyzing job: ${job.job_title} at ${job.employer_name}`);
            const matchScore = calculateAdvancedMatchScore(job, analysis);
            
            const requirements = job.job_required_skills || 
              extractRequirementsFromDescription(job.job_description, skills);

            let salary: string | null = null;
            if (job.job_min_salary && job.job_max_salary) {
              const currency = job.job_salary_currency || 'USD';
              const period = job.job_salary_period || 'YEAR';
              const min = formatSalary(job.job_min_salary, currency);
              const max = formatSalary(job.job_max_salary, currency);
              salary = `${min} - ${max}${period === 'YEAR' ? '/year' : ''}`;
            }

            const locationParts = [job.job_city, job.job_state].filter(Boolean);
            const jobLocation = locationParts.length > 0 ? locationParts.join(', ') : 'Remote';
            const postedDate = job.job_posted_at_datetime_utc 
              ? formatPostedDate(job.job_posted_at_datetime_utc)
              : 'Recently posted';
            const jobExperience: string | null = job.job_required_experience?.required_experience_in_months
              ? formatExperience(job.job_required_experience.required_experience_in_months)
              : null;

            seenIds.add(job.job_id);
            seenUrls.add(job.job_apply_link);

            allJobs.push({
              id: job.job_id || `job-${allJobs.length}`,
              title: job.job_title,
              company: job.employer_name,
              location: jobLocation,
              salary,
              jobType,
              experience: jobExperience,
              description: truncateDescription(job.job_description),
              requirements: requirements.slice(0, 6),
              matchScore,
              applyUrl: job.job_apply_link,
              postedDate,
              source: extractSource(job.job_apply_link)
            });
          });

          if (allJobs.length >= 40) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 150));

        } catch (pageError) {
          const errorMessage = pageError instanceof Error ? pageError.message : 'Page fetch error';
          console.error(`❌ Error fetching page ${page}:`, errorMessage);
          continue;
        }
      }

      if (allJobs.length >= 40) {
        break;
      }
    }

    console.log(`✅ Total unique jobs fetched: ${allJobs.length}`);

    allJobs.sort((a, b) => b.matchScore - a.matchScore);
    return allJobs.slice(0, 40);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'JSearch error';
    console.error('❌ JSearch error:', errorMessage);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resumeId, filters, searchQuery }: { 
      resumeId: string;
      filters?: Filters; 
      searchQuery?: string;
    } = body;

    if (!resumeId) {
      return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });
    }

    console.log(`🔍 Fetching resume ${resumeId} for user ${user.uid}`);

    const resumeRef = db.collection('resumes').doc(resumeId);
    const resumeDoc = await resumeRef.get();

    if (!resumeDoc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resumeData = resumeDoc.data() as ResumeData;

    if (resumeData?.userId !== user.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let resumeText = resumeData?.extractedText || '';
    console.log(`📝 ExtractedText length: ${resumeText.length}`);

    if (!resumeText || resumeText.length < 100) {
      resumeText = resumeData?.feedback?.resumeText || '';
      console.log(`📝 Feedback.resumeText length: ${resumeText.length}`);
    }

    if (!resumeText || resumeText.length < 100) {
      resumeText = resumeData?.resumeText || resumeData?.parsedText || '';
      console.log(`📝 Alternative text field length: ${resumeText.length}`);
    }

    if (!resumeText || resumeText.length < 100) {
      console.log(`🖼️ Attempting to extract text from image...`);
      try {
        const imagePath = `resumes/${user.uid}/${resumeId}/image.png`;
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(imagePath);
        
        const [exists] = await file.exists();
        if (exists) {
          const [imageBuffer] = await file.download();
          resumeText = await extractTextFromImage(imageBuffer);
          
          if (resumeText && resumeText.length >= 100) {
            console.log(`✅ Successfully extracted ${resumeText.length} characters from image`);
            await resumeRef.update({ extractedText: resumeText });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Image extraction error';
        console.error('❌ Error extracting text from storage:', errorMessage);
      }
    }

    if (!resumeText || resumeText.length < 100) {
      console.log(`📋 Constructing text from feedback data...`);
      if (resumeData?.feedback) {
        resumeText = constructResumeFromFeedback(resumeData);
        console.log(`📝 Constructed text length: ${resumeText.length}`);
      }
    }

    if (!resumeText || resumeText.length < 100) {
      console.error(`❌ Failed to extract sufficient resume text. Length: ${resumeText.length}`);
      return NextResponse.json({ 
        error: 'Resume text could not be extracted. Please re-upload your resume for analysis.',
        details: {
          extractedLength: resumeText.length,
          minRequired: 100,
          suggestion: 'Go to Resume Analysis and re-upload your resume'
        }
      }, { status: 400 });
    }

    console.log(`✅ Resume text ready. Length: ${resumeText.length} characters`);
    console.log(`📄 Preview: ${resumeText.substring(0, 200)}...`);

    const analysis = await analyzeResumeForJobSearch(resumeText);
    console.log(`📊 Analysis complete:`, {
      jobTitles: analysis.jobTitles,
      skillsCount: analysis.skills.length,
      location: analysis.location,
      experience: analysis.experience,
      education: analysis.education,
      industries: analysis.industries,
      careerLevel: analysis.careerLevel,
      certificationsCount: analysis.certifications.length,
      preferredJobTypes: analysis.preferredJobTypes
    });

    let jobs = await fetchRealJobsFromJSearch(analysis, searchQuery, filters);

    // Apply additional filters (most filtering now happens in API call)
    if (filters?.minMatchScore) {
      jobs = jobs.filter(job => job.matchScore >= (filters.minMatchScore || 0));
      console.log(`🔍 Filtered by match score >= ${filters.minMatchScore}, remaining: ${jobs.length}`);
    }
    
    if (filters?.location) {
      jobs = jobs.filter(job => 
        job.location.toLowerCase().includes((filters.location || '').toLowerCase())
      );
      console.log(`🔍 Filtered by location: ${filters.location}, remaining: ${jobs.length}`);
    }

    jobs.sort((a, b) => b.matchScore - a.matchScore);
    const finalJobs = jobs.slice(0, 30);

    console.log(`✅ Returning ${finalJobs.length} job recommendations`);

    return NextResponse.json({ 
      jobs: finalJobs,
      total: finalJobs.length,
      analysis: {
        jobTitles: analysis.jobTitles,
        skills: analysis.skills.slice(0, 10),
        location: analysis.location,
        experience: analysis.experience,
        education: analysis.education,
        industries: analysis.industries,
        careerLevel: analysis.careerLevel,
        certifications: analysis.certifications,
        preferredJobTypes: analysis.preferredJobTypes
      },
      meta: {
        timestamp: new Date().toISOString(),
        resumeTextLength: resumeText.length,
        filtersApplied: !!(filters?.jobType || filters?.minMatchScore || filters?.location),
        matchScoreRange: finalJobs.length > 0 
          ? `${Math.min(...finalJobs.map(j => j.matchScore))}-${Math.max(...finalJobs.map(j => j.matchScore))}`
          : 'N/A'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Job recommendations error:', errorMessage);
    return NextResponse.json(
      { 
        error: 'Failed to generate recommendations.',
        message: errorMessage,
        details: 'Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}