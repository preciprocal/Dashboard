// app/api/extension/auto-apply/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

// ─── Token verification ───────────────────────────────────────────────────────
async function verifyExtensionToken(request: NextRequest): Promise<string | null> {
  const token  = request.headers.get('x-extension-token');
  const userId = request.headers.get('x-user-id');
  const email  = request.headers.get('x-user-email');

  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {}

  if (userId && token === userId) return userId;

  if (email) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      return userRecord.uid;
    } catch {}
  }

  return null;
}

// ─── Fetch resume from user profile doc ──────────────────────────────────────
// The resume used for applications is stored on the users/{uid} document,
// NOT in the resumes collection (that collection is for the AI analyzer tool).
// Field names mirror how transcript is stored: resumePath / resumeUrl / resume
async function getLatestResume(uid: string) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;

    // Log all fields so we can see exactly what's there
    console.log('🔍 User doc resume-related fields:');
    for (const [key, val] of Object.entries(data)) {
      if (/resume/i.test(key)) {
        const preview = typeof val === 'string' ? val.slice(0, 80) : JSON.stringify(val)?.slice(0, 80);
        console.log(`   ${key}: ${preview}`);
      }
    }

    // Try every possible field name the profile upload might use
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

    // Fallback: dedicated transcripts collection
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
function buildApplyProfile(userData: Record<string, any>, uid: string) {
  const name      = userData.name || userData.displayName || '';
  const nameParts = name.trim().split(/\s+/);
  return {
    // Identity
    firstName:  nameParts[0] || '',
    lastName:   nameParts.slice(1).join(' ') || '',
    fullName:   name,
    email:      userData.email      || '',
    phone:      (userData.phone && /^[+\d\s\-().]{7,}$/.test(userData.phone)) ? userData.phone : '',
    // Location
    location:   userData.location   || '',
    city:       userData.city       || (userData.location || '').split(',')[0]?.trim() || '',
    state:      userData.state      || (userData.location || '').split(',')[1]?.trim() || '',
    zipCode:    userData.zipCode    || '',
    streetAddress: userData.streetAddress || userData.address || '',
    country:    userData.country    || 'United States',
    // Professional
    headline:       userData.targetRole || userData.headline || '',
    yearsOfExperience: userData.yearsOfExperience || '',
    summary:        userData.bio || userData.summary || '',
    skills:         Array.isArray(userData.preferredTech) ? userData.preferredTech
                    : Array.isArray(userData.skills) ? userData.skills
                    : typeof userData.preferredTech === 'string' ? userData.preferredTech.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : typeof userData.skills === 'string' ? userData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [],
    certifications: userData.certifications || '',
    languages:      userData.languages || 'English',
    // Social
    linkedInUrl:  userData.linkedIn     || userData.linkedInUrl   || '',
    githubUrl:    userData.github       || userData.githubUrl     || '',
    portfolioUrl: userData.website      || userData.portfolioUrl  || '',
    // Job preferences
    desiredSalary:     userData.desiredSalary     || '',
    salaryType:        userData.salaryType        || 'yearly',
    noticePeriod:      userData.noticePeriod      || '2 weeks',
    workType:          userData.workType          || 'Remote',
    employmentType:    userData.employmentType    || 'Full-time',
    openToTravel:      userData.openToTravel      || 'No',
    willingToRelocate:  userData.willingToRelocate  ?? false,
    currentlyEmployed:  userData.currentlyEmployed  ?? false,
    reasonForLeaving:   userData.reasonForLeaving   || '',
    howDidYouHear:      userData.howDidYouHear      || 'LinkedIn',
    // Work authorization
    workAuthorization:  userData.workAuthorization  || 'Yes',
    requireSponsorship: userData.requireSponsorship ?? false,
    visaType:           userData.visaType           || '',
    // Standard questions
    over18:          userData.over18          ?? true,
    driverLicense:   userData.driverLicense   ?? true,
    backgroundCheck: userData.backgroundCheck ?? true,
    drugTest:        userData.drugTest        ?? true,
    criminalRecord:  userData.criminalRecord  ?? false,
    // Education & Experience
    education:  userData.education  || [],
    experience: userData.experience || [],
    // EEO / Demographics
    gender:           userData.gender           || 'Prefer not to say',
    pronouns:         userData.pronouns         || 'Prefer not to say',
    race:             userData.race             || 'Prefer not to say',
    veteranStatus:    userData.veteranStatus    || 'I am not a protected veteran',
    disabilityStatus: userData.disabilityStatus || 'I do not have a disability',
    // Cover letter
    coverLetterIntro: userData.coverLetterIntro || '',
    coverLetterBody:  userData.coverLetterBody  || '',
    // Meta
    subscriptionTier: userData.subscription?.plan || 'free',
    userId: uid,
  };
}

// ─── GET /api/extension/auto-apply ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  console.log('🔌 Extension auto-apply request');

  try {
    const uid = await verifyExtensionToken(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ uid:', uid);

    const [userDoc, resumeData, transcriptData] = await Promise.all([
      db.collection('users').doc(uid).get(),
      getLatestResume(uid),
      getTranscript(uid),
    ]);

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userData     = userDoc.data()!;
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

    return NextResponse.json({ success: true, applyProfile, files,
      user: { uid, email: userData.email, name: userData.name || userData.displayName, plan: userData.subscription?.plan || 'free' },
      profileUpdatedAt: userData.updatedAt || null,
    });

  } catch (error) {
    console.error('❌ auto-apply error:', error);
    return NextResponse.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500 });
  }
}