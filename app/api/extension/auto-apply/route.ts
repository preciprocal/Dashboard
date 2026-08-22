// app/api/extension/auto-apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getUserAIContext } from '@/lib/ai/user-context';
import { getSignedUrl } from '@/lib/storage/file-storage';
import { resolveStoragePathUrl } from '@/lib/storage/resolve-signed-url';
import { supabaseAdmin } from '@/supabase/admin';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Max-Age':       '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface ProfileRow {
  name: string | null; email: string | null; phone: string | null;
  city: string | null; state: string | null; street_address: string | null;
  target_role: string | null; bio: string | null; preferred_tech: string[] | null;
  linked_in: string | null; github: string | null; website: string | null;
  resume_path: string | null; resume_file_name: string | null;
  transcript_path: string | null; transcript_file_name: string | null;
  extended_data: Record<string, unknown> | null;
  updated_at: string | null;
}

async function getLatestResume(uid: string, supabaseUserId: string, profile: ProfileRow | null) {
  try {
    if (profile) {
      const fileUrl  = profile.resume_path || null;
      const fileName = profile.resume_file_name || 'resume.pdf';
      const resumeText = '';
      if (fileUrl) {
        // Profile-page uploads (lib/storage/file-storage.ts) store a bare Storage
        // path like "users/<uid>/resume.pdf", not a fetchable URL - sign it first.
        const url = /^https?:\/\//i.test(fileUrl) ? fileUrl : await getSignedUrl(uid, 'resume', 60);
        if (url) {
          console.log(`✅ Profile resume found | ${fileName}`);
          return { id: uid, fileName, url, available: true, text: resumeText || null };
        }
      }
    }

    // Fall back to the Resume Analyzer's `resumes` table, which stores a
    // real storage path but isn't written back to the user doc.
    const { data: rows } = await supabaseAdmin
      .from('resumes')
      .select('id, resume_path, file_url, file_name, original_file_name, resume_text')
      .eq('user_id', supabaseUserId)
      .order('created_at', { ascending: false })
      .limit(5);
    for (const row of rows ?? []) {
      const fileUrl = row.resume_path || row.file_url || null;
      if (fileUrl) {
        const fileName = row.file_name || row.original_file_name || 'resume.pdf';
        const url = await resolveStoragePathUrl(fileUrl);
        if (url) {
          console.log(`✅ Resume-analyzer resume found | ${fileName}`);
          return { id: row.id, fileName, url, available: true, text: row.resume_text || null };
        }
      }
    }

    console.log('⚠️ No resume found for user');
    return null;
  } catch (error) {
    console.error('❌ Error fetching resume:', error);
    return null;
  }
}

async function getTranscript(uid: string, supabaseUserId: string, profile: ProfileRow | null) {
  try {
    if (profile) {
      const fileUrl  = profile.transcript_path || null;
      const fileName = profile.transcript_file_name || 'transcript.pdf';
      if (fileUrl) {
        // Profile-page uploads (lib/storage/file-storage.ts) store a bare Storage
        // path like "users/<uid>/transcript.pdf", not a fetchable URL - sign it first.
        const url = /^https?:\/\//i.test(fileUrl) ? fileUrl : await getSignedUrl(uid, 'transcript', 60);
        if (url) { console.log(`✅ Transcript found | ${fileName}`); return { id: uid, fileName, url, available: true }; }
      }
    }

    // Fall back to the legacy `transcripts` table (per-upload records from a
    // discontinued upload flow, kept only for historical rows).
    const { data: rows } = await supabaseAdmin
      .from('transcripts')
      .select('id, file_name, file_path')
      .eq('user_id', supabaseUserId)
      .order('created_at', { ascending: false })
      .limit(5);
    for (const row of rows ?? []) {
      const fileUrl = row.file_path || null;
      if (fileUrl) {
        const fileName = row.file_name || 'transcript.pdf';
        const url = await resolveStoragePathUrl(fileUrl);
        if (url) return { id: row.id, fileName, url, available: true };
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching transcript:', error);
    return null;
  }
}

function buildApplyProfile(profile: ProfileRow, plan: string, uid: string) {
  const ext = profile.extended_data || {};
  const name      = profile.name || '';
  const nameParts = name.trim().split(/\s+/);
  return {
    firstName:  nameParts[0] || '',
    lastName:   nameParts.slice(1).join(' ') || '',
    fullName:   name,
    email:      profile.email || '',
    phone:      (profile.phone && /^[+\d\s\-().]{7,}$/.test(profile.phone)) ? profile.phone : '',
    city:       profile.city  || '',
    state:      profile.state || '',
    location:   [profile.city, profile.state].filter(Boolean).join(', ') || '',
    zipCode:    (ext.zipCode as string) || '',
    streetAddress:     profile.street_address || '',
    country:    (ext.country as string) || 'United States',
    headline:          profile.target_role || (ext.headline as string) || '',
    yearsOfExperience: (ext.yearsOfExperience as string) || '',
    summary:           profile.bio || (ext.summary as string) || '',
    skills:
      Array.isArray(profile.preferred_tech) && profile.preferred_tech.length ? profile.preferred_tech
      : typeof ext.skills === 'string' ? (ext.skills as string).split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    certifications:    (ext.certifications as string) || '',
    languages:         (ext.languages as string) || 'English',
    linkedInUrl:  profile.linked_in || (ext.linkedInUrl as string)  || '',
    githubUrl:    profile.github    || (ext.githubUrl as string)    || '',
    portfolioUrl: profile.website   || (ext.portfolioUrl as string) || '',
    desiredSalary:      (ext.desiredSalary as string) || '',
    salaryType:         (ext.salaryType as string)    || 'yearly',
    noticePeriod:       (ext.noticePeriod as string)  || '2 weeks',
    workType:           (ext.workType as string)      || 'Remote',
    employmentType:     (ext.employmentType as string) || 'Full-time',
    openToTravel:       (ext.openToTravel as string)  || 'No',
    willingToRelocate:  (ext.willingToRelocate as boolean) ?? false,
    currentlyEmployed:  (ext.currentlyEmployed as boolean) ?? false,
    reasonForLeaving:   (ext.reasonForLeaving as string) || '',
    howDidYouHear:      (ext.howDidYouHear as string)    || 'LinkedIn',
    workAuthorization:  (ext.workAuthorization as string) || 'Yes',
    requireSponsorship: (ext.requireSponsorship as boolean) ?? false,
    visaType:           (ext.visaType as string) || '',
    over18:          (ext.over18 as boolean)          ?? true,
    driverLicense:   (ext.driverLicense as boolean)   ?? true,
    backgroundCheck: (ext.backgroundCheck as boolean) ?? true,
    drugTest:        (ext.drugTest as boolean)        ?? true,
    criminalRecord:  (ext.criminalRecord as boolean)  ?? false,
    education:  (ext.education  as unknown[]) || [],
    experience: (ext.experience as unknown[]) || [],
    gender:           (ext.gender as string)           || 'Prefer not to say',
    pronouns:         (ext.pronouns as string)         || 'Prefer not to say',
    race:             (ext.race as string)             || 'Prefer not to say',
    veteranStatus:    (ext.veteranStatus as string)    || 'I am not a protected veteran',
    disabilityStatus: (ext.disabilityStatus as string) || 'I do not have a disability',
    coverLetterIntro:   (ext.coverLetterIntro as string) || '',
    coverLetterBody:    (ext.coverLetterBody as string)  || '',
    preferredLocations: Array.isArray(ext.preferredLocations) ? ext.preferredLocations as string[] : [],
    subscriptionTier: plan || 'free',
    userId: uid,
  };
}

export async function GET(request: NextRequest) {
  console.log('🔌 Extension auto-apply request');
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
    const { userId: uid, supabaseUserId } = authedUser;

    console.log('✅ uid:', uid);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', supabaseUserId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404, headers: CORS });

    const [{ data: sub }, resumeData, transcriptData, aiCtx] = await Promise.all([
      supabaseAdmin.from('subscriptions').select('plan').eq('user_id', supabaseUserId).maybeSingle(),
      getLatestResume(uid, supabaseUserId, profile as ProfileRow),
      getTranscript(uid, supabaseUserId, profile as ProfileRow),
      getUserAIContext(uid).catch(() => null),
    ]);

    const applyProfile = buildApplyProfile(profile as ProfileRow, sub?.plan || 'free', uid);

    const resumeText     = aiCtx?.resumeText     || resumeData?.text     || null;
    const transcriptText = aiCtx?.transcriptText || null;

    const files = {
      resume:     resumeData     ? { available: true,  url: resumeData.url,     fileName: resumeData.fileName,     id: resumeData.id,     text: resumeText     }
                                 : { available: false, url: null,               fileName: null,                    id: null,              text: null           },
      transcript: transcriptData ? { available: true,  url: transcriptData.url, fileName: transcriptData.fileName, id: transcriptData.id, text: transcriptText }
                                 : { available: false, url: null,               fileName: null,                    id: null,              text: null           },
    };

    console.log('📦 Final response:', { user: applyProfile.email, resumeAvail: files.resume.available, resumeTextLen: resumeText?.length || 0, transcriptAvail: files.transcript.available });

    return NextResponse.json(
      { success: true, applyProfile, files,
        user: { uid, email: profile.email, name: profile.name, plan: sub?.plan || 'free' },
        profileUpdatedAt: profile.updated_at || null },
      { headers: CORS }
    );
  } catch (error) {
    console.error('❌ auto-apply error:', error);
    return NextResponse.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500, headers: CORS });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}