// app/api/resume/job-recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db, storage } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split('Bearer ')[1];
    return await auth.verifyIdToken(token);
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Image },
            },
            {
              type: 'text',
              text: `Extract ALL readable text from this resume image with complete accuracy.

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

Return only the extracted text, maintaining the original structure.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    console.log('✅ Image text extraction successful. Length:', text.length);
    return text;
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
    const sanitizedResumeText = resumeText
      .substring(0, 5000)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\\/g, ' ')
      .replace(/"/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Analyze this resume COMPREHENSIVELY and extract DETAILED job search information for PERFECT job matching.

COMPLETE RESUME TEXT:
${sanitizedResumeText}

CRITICAL: Read the ENTIRE resume carefully to understand the person's ACTUAL career field and experience. Do NOT default to software/tech unless the resume clearly shows software development experience.

You must respond with ONLY valid JSON in this exact format:
{
  "jobTitles": ["Primary Title", "Alternative Title 1", "Alternative Title 2", "Alternative Title 3", "Alternative Title 4"],
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7", "skill8", "skill9", "skill10"],
  "location": "City, State or Country",
  "experience": "Entry-Level OR Mid-Level OR Senior-Level OR Executive",
  "education": "High School OR Associates OR Bachelors OR Masters OR PhD",
  "industries": ["Industry 1", "Industry 2", "Industry 3"],
  "careerLevel": "Junior OR Mid-Level OR Senior OR Lead OR Principal OR Executive",
  "certifications": ["cert1", "cert2"],
  "preferredJobTypes": ["Full-time"]
}

EXTRACTION REQUIREMENTS:
1. JOB TITLES: Extract ACTUAL titles from work experience + 4 alternatives IN THE SAME FIELD
2. SKILLS: 10-12 skills that ACTUALLY match the career field shown in the resume
3. LOCATION: From contact section or recent job, format as "City, State"
4. EXPERIENCE: Based on years and responsibilities
5. EDUCATION: Highest degree completed
6. INDUSTRIES: Based ONLY on actual work experience
7. CAREER LEVEL: More granular than experience
8. CERTIFICATIONS: All professional certifications mentioned
9. PREFERRED JOB TYPES: Infer from experience

Return ONLY the JSON object with no markdown or additional text.`,
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('📊 Raw AI analysis response:', responseText.substring(0, 500));

    let cleaned = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
    }

    if (!cleaned) {
      console.error('❌ No valid JSON object found in response');
      return fallbackData;
    }

    let data;
    try {
      data = JSON.parse(cleaned);
      console.log('✅ Successfully parsed JSON');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return fallbackData;
    }

    if (!data || typeof data !== 'object') return fallbackData;

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

    const location = typeof data.location === 'string' && data.location.trim() ? data.location.trim() : 'United States';
    const experience = typeof data.experience === 'string' && data.experience.trim() ? data.experience.trim() : 'Mid-Level';
    const education = typeof data.education === 'string' && data.education.trim() ? data.education.trim() : 'Bachelor\'s Degree';
    const careerLevel = typeof data.careerLevel === 'string' && data.careerLevel.trim() ? data.careerLevel.trim() : 'Mid-Level';

    if (jobTitles.length === 0 || skills.length === 0 || industries.length === 0) {
      console.warn('⚠️ Insufficient data extracted, using fallback');
      return fallbackData;
    }

    return { jobTitles, skills, location, experience, education, industries, careerLevel, certifications, preferredJobTypes };

  } catch (error) {
    console.error('❌ Error analyzing resume:', error);
    return fallbackData;
  }
}

function calculateAdvancedMatchScore(job: JSearchJob, analysis: ResumeAnalysis): number {
  try {
    const jobText = `${job.job_title} ${job.job_description}`.toLowerCase();
    const jobTitle = job.job_title.toLowerCase();
    let totalScore = 0;

    const matchedSkills = analysis.skills.filter(skill => jobText.includes(skill.toLowerCase()));
    const skillScore = Math.min((matchedSkills.length / Math.max(analysis.skills.length, 1)) * 100 * 0.4, 40);
    totalScore += skillScore;

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

    const experienceKeywords: Record<string, string[]> = {
      'Entry-Level': ['entry', 'junior', 'associate', 'intern', 'graduate', 'early career'],
      'Mid-Level': ['mid', 'intermediate', 'experienced', 'professional', 'specialist'],
      'Senior-Level': ['senior', 'lead', 'principal', 'staff', 'expert', 'architect'],
      'Executive': ['director', 'vp', 'executive', 'chief', 'head of', 'president']
    };
    const levelKeywords = experienceKeywords[analysis.experience] || [];
    totalScore += levelKeywords.some(keyword => jobText.includes(keyword)) ? 20 : 10;

    if (analysis.certifications.length > 0) {
      const matchedCerts = analysis.certifications.filter(cert => jobText.includes(cert.toLowerCase()));
      totalScore += (matchedCerts.length / analysis.certifications.length) * 10;
    }

    const matchedIndustries = analysis.industries.filter(industry => jobText.includes(industry.toLowerCase()));
    if (matchedIndustries.length > 0) totalScore += 5;

    return Math.round(Math.min(Math.max(totalScore, 60), 100));
  } catch {
    return 75;
  }
}

function extractRequirementsFromDescription(description: string, resumeSkills: string[]): string[] {
  const requirements: string[] = [];
  const descLower = description.toLowerCase();

  resumeSkills.forEach(skill => {
    if (descLower.includes(skill.toLowerCase())) requirements.push(skill);
  });

  const techSkills = ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes', 'Git', 'SQL', 'MongoDB', 'PostgreSQL', 'REST API', 'GraphQL', 'CI/CD', 'Agile'];
  techSkills.forEach(skill => {
    if (descLower.includes(skill.toLowerCase()) && !requirements.includes(skill)) requirements.push(skill);
  });

  return requirements.slice(0, 8);
}

function formatSalary(amount: number, currency: string): string {
  if (currency === 'USD') return `$${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount}`;
}

function formatPostedDate(dateString: string): string {
  try {
    const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Posted today';
    if (diffDays === 1) return 'Posted yesterday';
    if (diffDays < 7) return `Posted ${diffDays} days ago`;
    if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)} weeks ago`;
    return `Posted ${Math.floor(diffDays / 30)} months ago`;
  } catch {
    return 'Recently posted';
  }
}

function normalizeJobType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('full')) return 'Full-time';
  if (t.includes('part')) return 'Part-time';
  if (t.includes('contract')) return 'Contract';
  if (t.includes('intern')) return 'Internship';
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
  return preview.length > 350 ? preview.substring(0, 347) + '...' : preview;
}

function extractSource(url: string): string {
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('indeed.com')) return 'Indeed';
  if (url.includes('glassdoor.com')) return 'Glassdoor';
  if (url.includes('monster.com')) return 'Monster';
  if (url.includes('ziprecruiter.com')) return 'ZipRecruiter';
  return 'Job Board';
}

async function fetchRealJobsFromJSearch(analysis: ResumeAnalysis, searchQuery?: string, filters?: Filters): Promise<JobListing[]> {
  if (!process.env.RAPIDAPI_KEY) { console.warn('⚠️ No RapidAPI key found'); return []; }

  try {
    const allJobs: JobListing[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const searchTerms = searchQuery ? [searchQuery] : analysis.jobTitles.slice(0, 3);

    for (const searchTerm of searchTerms) {
      for (let page = 1; page <= 2; page++) {
        try {
          let queryString = `${searchTerm} in ${analysis.location}`;
          if (filters?.jobType && filters.jobType !== 'all') queryString += ` ${filters.jobType}`;

          const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(queryString)}&page=${page}&num_pages=1&date_posted=week`;
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
          });

          if (!response.ok) continue;

          const data: JSearchResponse = await response.json();
          if (!data.data || data.data.length === 0) break;

          data.data.forEach((job: JSearchJob) => {
            if (seenIds.has(job.job_id) || seenUrls.has(job.job_apply_link)) return;

            const jobType = normalizeJobType(job.job_employment_type || 'Full-time');
            if (filters?.jobType && filters.jobType !== 'all' && jobType !== filters.jobType) return;

            const matchScore = calculateAdvancedMatchScore(job, analysis);
            const requirements = job.job_required_skills || extractRequirementsFromDescription(job.job_description, analysis.skills);

            let salary: string | null = null;
            if (job.job_min_salary && job.job_max_salary) {
              const currency = job.job_salary_currency || 'USD';
              salary = `${formatSalary(job.job_min_salary, currency)} - ${formatSalary(job.job_max_salary, currency)}${(job.job_salary_period || 'YEAR') === 'YEAR' ? '/year' : ''}`;
            }

            const locationParts = [job.job_city, job.job_state].filter(Boolean);
            seenIds.add(job.job_id);
            seenUrls.add(job.job_apply_link);

            allJobs.push({
              id: job.job_id || `job-${allJobs.length}`,
              title: job.job_title,
              company: job.employer_name,
              location: locationParts.length > 0 ? locationParts.join(', ') : 'Remote',
              salary,
              jobType,
              experience: job.job_required_experience?.required_experience_in_months
                ? formatExperience(job.job_required_experience.required_experience_in_months)
                : null,
              description: truncateDescription(job.job_description),
              requirements: requirements.slice(0, 6),
              matchScore,
              applyUrl: job.job_apply_link,
              postedDate: job.job_posted_at_datetime_utc ? formatPostedDate(job.job_posted_at_datetime_utc) : 'Recently posted',
              source: extractSource(job.job_apply_link)
            });
          });

          if (allJobs.length >= 40) break;
          await new Promise(resolve => setTimeout(resolve, 150));

        } catch (pageError) {
          console.error(`❌ Error fetching page ${page}:`, pageError);
        }
      }
      if (allJobs.length >= 40) break;
    }

    allJobs.sort((a, b) => b.matchScore - a.matchScore);
    return allJobs.slice(0, 40);

  } catch (error) {
    console.error('❌ JSearch error:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { resumeId, filters, searchQuery }: { resumeId: string; filters?: Filters; searchQuery?: string } = body;

    if (!resumeId) return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });

    console.log(`🔍 Fetching resume ${resumeId} for user ${user.uid}`);

    const resumeRef = db.collection('resumes').doc(resumeId);
    const resumeDoc = await resumeRef.get();

    if (!resumeDoc.exists) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    const resumeData = resumeDoc.data() as ResumeData;
    if (resumeData?.userId !== user.uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    let resumeText = resumeData?.extractedText || '';
    if (!resumeText || resumeText.length < 100) resumeText = resumeData?.feedback?.resumeText || '';
    if (!resumeText || resumeText.length < 100) resumeText = resumeData?.resumeText || resumeData?.parsedText || '';

    if (!resumeText || resumeText.length < 100) {
      console.log(`🖼️ Attempting to extract text from image...`);
      try {
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
        const file = storage.bucket(bucketName).file(`resumes/${user.uid}/${resumeId}/image.png`);
        const [exists] = await file.exists();
        if (exists) {
          const [imageBuffer] = await file.download();
          resumeText = await extractTextFromImage(imageBuffer);
          if (resumeText && resumeText.length >= 100) {
            await resumeRef.update({ extractedText: resumeText });
          }
        }
      } catch (error) {
        console.error('❌ Error extracting text from storage:', error);
      }
    }

    if (!resumeText || resumeText.length < 100) {
      if (resumeData?.feedback) resumeText = constructResumeFromFeedback(resumeData);
    }

    if (!resumeText || resumeText.length < 100) {
      return NextResponse.json({
        error: 'Resume text could not be extracted. Please re-upload your resume for analysis.',
        details: { extractedLength: resumeText.length, minRequired: 100, suggestion: 'Go to Resume Analysis and re-upload your resume' }
      }, { status: 400 });
    }

    const analysis = await analyzeResumeForJobSearch(resumeText);
    console.log(`📊 Analysis complete:`, { jobTitles: analysis.jobTitles, location: analysis.location });

    let jobs = await fetchRealJobsFromJSearch(analysis, searchQuery, filters);

    if (filters?.minMatchScore) jobs = jobs.filter(job => job.matchScore >= (filters.minMatchScore || 0));
    if (filters?.location) jobs = jobs.filter(job => job.location.toLowerCase().includes((filters.location || '').toLowerCase()));

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
    console.error('❌ Job recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations.', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}