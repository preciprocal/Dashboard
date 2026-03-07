// app/api/extension/auto-apply/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

// ─── CORS ─────────────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

// ─── Token verification ───────────────────────────────────────────────────────
async function verifyExtensionToken(request: NextRequest): Promise<string | null> {
  const token  = request.headers.get('x-extension-token') || '';
  const userId = request.headers.get('x-user-id')         || '';
  const email  = request.headers.get('x-user-email')      || '';

  // Try 1: Firebase ID token
  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token, true);
      return decoded.uid;
    } catch { /* not an ID token */ }

    // Try 2: Firebase session cookie
    try {
      const decoded = await auth.verifySessionCookie(token, true);
      return decoded.uid;
    } catch { /* not a session cookie */ }
  }

  // Try 3: Direct userId header
  if (userId && /^[a-zA-Z0-9]{20,40}$/.test(userId)) {
    try {
      await auth.getUser(userId);
      return userId;
    } catch { /* invalid uid */ }
  }

  // Try 4: Look up by email
  if (email) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      return userRecord.uid;
    } catch { /* not found */ }
  }

  return null;
}

// ─── Fetch resume from user profile doc ──────────────────────────────────────
async function getLatestResume(uid: string) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;

    console.log('🔍 User doc resume-related fields:');
    for (const [key, val] of Object.entries(data)) {
      if (/resume/i.test(key)) {
        const preview = typeof val === 'string' ? val.slice(0, 80) : JSON.stringify(val)?.slice(0, 80);
        console.log(`   ${key}: ${preview}`);
      }
    }

    const fileUrl =
      data.resumePath     ||
      data.resumeUrl      ||
      data.resume         ||
      data.resumeFile     ||
      data.cvPath         ||
      data.cvUrl          ||
      data.cv             ||
      null;

    const fileName =
      data.resumeFileName ||
      data.resumeName     ||
      data.cvFileName     ||
      data.cvName         ||
      'resume.pdf';

    if (!fileUrl) {
      console.log('⚠️ No resume found on user doc');
      return null;
    }

    console.log(`✅ Profile resume found | ${fileName} | base64=${String(fileUrl).startsWith('data:')}`);
    return { id: uid, fileName, url: fileUrl, available: true };
  } catch (error) {
    console.error('❌ Error fetching profile resume:', error);
    return null;
  }
}

// ─── Fetch transcript ─────────────────────────────────────────────────────────
async function getTranscript(uid: string) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data()!;
      const fileUrl  = data.transcriptPath || data.transcriptUrl || data.transcript || null;
      const fileName = data.transcriptFileName || data.transcriptName || 'transcript.pdf';
      if (fileUrl) {
        console.log(`✅ Transcript found on user doc | ${fileName}`);
        return { id: uid, fileName, url: fileUrl, available: true };
      }
    }

    const snap = await db
      .collection('transcripts')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (!snap.empty) {
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.deleted) continue;
        const fileUrl  = data.transcriptPath || data.fileUrl || data.url || null;
        const fileName = data.fileName || data.originalFileName || 'transcript.pdf';
        if (fileUrl) {
          return { id: doc.id, fileName, url: fileUrl, available: true };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching transcript:', error);
    return null;
  }
}

// ─── Build apply profile ──────────────────────────────────────────────────────
function buildApplyProfile(userData: Record<string, unknown>, uid: string) {
  const name      = (userData.name as string) || (userData.displayName as string) || '';
  const nameParts = name.trim().split(/\s+/);
  return {
    firstName:  nameParts[0] || '',
    lastName:   nameParts.slice(1).join(' ') || '',
    fullName:   name,
    email:      (userData.email as string)      || '',
    phone:      (userData.phone && /^[+\d\s\-().]{7,}$/.test(userData.phone as string)) ? userData.phone as string : '',
    location:   (userData.location as string)   || '',
    city:       (userData.city as string)       || ((userData.location as string) || '').split(',')[0]?.trim() || '',
    state:      (userData.state as string)      || ((userData.location as string) || '').split(',')[1]?.trim() || '',
    zipCode:    (userData.zipCode as string)    || '',
    streetAddress: (userData.streetAddress as string) || (userData.address as string) || '',
    country:    (userData.country as string)    || 'United States',
    headline:       (userData.targetRole as string) || (userData.headline as string) || '',
    yearsOfExperience: (userData.yearsOfExperience as string) || '',
    summary:        (userData.bio as string) || (userData.summary as string) || '',
    skills:         Array.isArray(userData.preferredTech) ? userData.preferredTech
                    : Array.isArray(userData.skills) ? userData.skills
                    : typeof userData.preferredTech === 'string' ? (userData.preferredTech as string).split(',').map((s: string) => s.trim()).filter(Boolean)
                    : typeof userData.skills === 'string' ? (userData.skills as string).split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [],
    certifications: (userData.certifications as string) || '',
    languages:      (userData.languages as string) || 'English',
    linkedInUrl:  (userData.linkedIn as string)     || (userData.linkedInUrl as string)   || '',
    githubUrl:    (userData.github as string)       || (userData.githubUrl as string)     || '',
    portfolioUrl: (userData.website as string)      || (userData.portfolioUrl as string)  || '',
    desiredSalary:     (userData.desiredSalary as string)     || '',
    salaryType:        (userData.salaryType as string)        || 'yearly',
    noticePeriod:      (userData.noticePeriod as string)      || '2 weeks',
    workType:          (userData.workType as string)          || 'Remote',
    employmentType:    (userData.employmentType as string)    || 'Full-time',
    openToTravel:      (userData.openToTravel as string)      || 'No',
    willingToRelocate:  (userData.willingToRelocate as boolean)  ?? false,
    currentlyEmployed:  (userData.currentlyEmployed as boolean)  ?? false,
    reasonForLeaving:   (userData.reasonForLeaving as string)    || '',
    howDidYouHear:      (userData.howDidYouHear as string)       || 'LinkedIn',
    workAuthorization:  (userData.workAuthorization as string)   || 'Yes',
    requireSponsorship: (userData.requireSponsorship as boolean) ?? false,
    visaType:           (userData.visaType as string)            || '',
    over18:          (userData.over18 as boolean)          ?? true,
    driverLicense:   (userData.driverLicense as boolean)   ?? true,
    backgroundCheck: (userData.backgroundCheck as boolean) ?? true,
    drugTest:        (userData.drugTest as boolean)        ?? true,
    criminalRecord:  (userData.criminalRecord as boolean)  ?? false,
    education:  (userData.education as unknown[])  || [],
    experience: (userData.experience as unknown[]) || [],
    gender:           (userData.gender as string)           || 'Prefer not to say',
    pronouns:         (userData.pronouns as string)         || 'Prefer not to say',
    race:             (userData.race as string)             || 'Prefer not to say',
    veteranStatus:    (userData.veteranStatus as string)    || 'I am not a protected veteran',
    disabilityStatus: (userData.disabilityStatus as string) || 'I do not have a disability',
    coverLetterIntro: (userData.coverLetterIntro as string) || '',
    coverLetterBody:  (userData.coverLetterBody as string)  || '',
    subscriptionTier: (userData.subscription as Record<string, string>)?.plan || 'free',
    userId: uid,
  };
}

// ─── GET /api/extension/auto-apply ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  console.log('🔌 Extension auto-apply request');

  try {
    const uid = await verifyExtensionToken(request);
    if (!uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() }
      );
    }

    console.log('✅ uid:', uid);

    const [userDoc, resumeData, transcriptData] = await Promise.all([
      db.collection('users').doc(uid).get(),
      getLatestResume(uid),
      getTranscript(uid),
    ]);

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const userData     = userDoc.data() as Record<string, unknown>;
    const applyProfile = buildApplyProfile(userData, uid);

    const files = {
      resume: resumeData
        ? { available: true,  url: resumeData.url,      fileName: resumeData.fileName,      id: resumeData.id      }
        : { available: false, url: null,                 fileName: null,                     id: null               },
      transcript: transcriptData
        ? { available: true,  url: transcriptData.url,  fileName: transcriptData.fileName,  id: transcriptData.id  }
        : { available: false, url: null,                 fileName: null,                     id: null               },
    };

    console.log('📦 Final response:', {
      user:            applyProfile.email,
      resumeAvail:     files.resume.available,
      resumeFile:      files.resume.fileName,
      transcriptAvail: files.transcript.available,
    });

    return NextResponse.json(
      {
        success: true,
        applyProfile,
        files,
        user: {
          uid,
          email: userData.email,
          name:  (userData.name as string) || (userData.displayName as string),
          plan:  (userData.subscription as Record<string, string>)?.plan || 'free',
        },
        profileUpdatedAt: userData.updatedAt || null,
      },
      { headers: corsHeaders() }
    );

  } catch (error) {
    console.error('❌ auto-apply error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// ─── POST /api/extension/auto-apply ──────────────────────────────────────────
// Some callers POST instead of GET — handle both the same way
export async function POST(request: NextRequest) {
  return GET(request);
}