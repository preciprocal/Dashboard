// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { toSupabaseUserId } from "@/lib/auth/verify-request";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";
import { redis } from "@/lib/redis/redis-client";
import { uploadUserFile, deleteUserFile, userFileExists } from "@/lib/storage/file-storage";
import { invalidateUserTextCache } from "@/lib/ai/user-context";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROFILE_CACHE_TTL = 5 * 60;

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: string;
  preferredTech?: string[];
  careerGoals?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  /** Storage path (not base64) - e.g. "users/{uid}/transcript.pdf" */
  transcriptPath?: string;
  transcriptFileName?: string;
  /** Storage path (not base64) - e.g. "users/{uid}/resume.pdf" */
  resumePath?: string;
  resumeFileName?: string;
  /** @deprecated - kept for backwards compat during migration */
  transcript?: string;
  resume?: string;
  provider: string;
  createdAt: string;
  lastLogin?: string;
  /** Auto-apply preference fields (components/profile/JobApplication.tsx) - a
   *  flexible jsonb blob rather than ~35 more named columns. */
  extendedData?: Record<string, unknown>;
  subscription?: {
    plan: string;
    status: string;
    interviewsUsed: number;
    interviewsLimit: number;
    createdAt: string;
    updatedAt?: string;
    trialEndsAt: string | null;
    subscriptionEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    canceledAt: string | null;
    lastPaymentAt: string | null;
  };
}

type InterviewData = Record<string, unknown>;

interface CachedProfileResponse {
  user: ProfileData;
  interviews: InterviewData[];
  cachedAt: string;
}

async function getCachedProfile(userId: string): Promise<CachedProfileResponse | null> {
  if (!redis) return null;
  try {
    const key = `profile-complete:${userId}`;
    const cached = await redis.get(key);
    if (cached) {
      console.log(`✅ Cache HIT - Profile for ${userId}`);
      return typeof cached === 'string' ? JSON.parse(cached) : (cached as CachedProfileResponse);
    }
    return null;
  } catch (error) {
    console.error('❌ Redis get error:', error);
    return null;
  }
}

async function cacheProfile(userId: string, data: CachedProfileResponse): Promise<void> {
  if (!redis) return;
  try {
    const key = `profile-complete:${userId}`;
    await redis.setex(key, PROFILE_CACHE_TTL, JSON.stringify(data));
  } catch (error) {
    console.error('❌ Redis set error:', error);
  }
}

export async function invalidateProfileCache(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`profile-complete:${userId}`);
  } catch (error) {
    console.error('❌ Redis delete error:', error);
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const startTime = Date.now();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check cache
    const cachedProfile = await getCachedProfile(user.id);
    if (cachedProfile) {
      return NextResponse.json({
        user: cachedProfile.user,
        interviews: cachedProfile.interviews,
        _metadata: { cached: true, responseTime: Date.now() - startTime },
      });
    }

    const supabaseUserId = await toSupabaseUserId(user.id);
    const [{ data: d, error: profileError }, { data: sub }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("user_id", supabaseUserId).maybeSingle(),
      supabaseAdmin.from("subscriptions").select("*").eq("user_id", supabaseUserId).maybeSingle(),
    ]);
    if (profileError) throw profileError;
    if (!d) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check if files exist in Storage (for the "has file" indicator on frontend)
    const [hasResume, hasTranscript] = await Promise.all([
      d.resume_path ? userFileExists(user.id, 'resume') : Promise.resolve(false),
      d.transcript_path ? userFileExists(user.id, 'transcript') : Promise.resolve(false),
    ]);

    const interviews = await getInterviewsByUserId(user.id);

    const completeUser: ProfileData = {
      id: user.id,
      name: d.name || user.name || "User",
      email: d.email || user.email || "",
      phone: d.phone || "",
      streetAddress: d.street_address || "",
      city: d.city || "",
      state: d.state || "",
      bio: d.bio || "",
      targetRole: d.target_role || "",
      experienceLevel: d.experience_level || "mid",
      preferredTech: Array.isArray(d.preferred_tech) ? d.preferred_tech : [],
      careerGoals: d.career_goals || "",
      linkedIn: d.linked_in || "",
      github: d.github || "",
      website: d.website || "",
      // New Storage-based fields
      resumePath: d.resume_path || "",
      resumeFileName: d.resume_file_name || "",
      transcriptPath: d.transcript_path || "",
      transcriptFileName: d.transcript_file_name || "",
      // Backwards compat: send a truthy marker so frontend knows a file exists
      // but DON'T send the full base64 anymore (saves bandwidth)
      resume: hasResume ? "storage" : "",
      transcript: hasTranscript ? "storage" : "",
      provider: d.provider || user.provider || "email",
      createdAt: d.created_at || user.createdAt || new Date().toISOString(),
      lastLogin: d.last_login || new Date().toISOString(),
      extendedData: (d.extended_data as Record<string, unknown>) || {},
      subscription: {
        plan: sub?.plan || "free",
        status: sub?.status || "active",
        interviewsUsed: user.subscription?.interviewsUsed || 0,
        interviewsLimit: user.subscription?.interviewsLimit || 10,
        createdAt: sub?.created_at || d.created_at || new Date().toISOString(),
        updatedAt: sub?.updated_at || new Date().toISOString(),
        trialEndsAt: sub?.trial_ends_at || null,
        subscriptionEndsAt: sub?.subscription_ends_at || null,
        currentPeriodStart: sub?.current_period_start || null,
        currentPeriodEnd: sub?.current_period_end || null,
        stripeCustomerId: sub?.stripe_customer_id || null,
        stripeSubscriptionId: sub?.stripe_subscription_id || null,
        canceledAt: sub?.canceled_at || null,
        lastPaymentAt: sub?.last_payment_at || null,
      },
    };

    const interviewsData = (interviews || []) as unknown as InterviewData[];
    const responseData: CachedProfileResponse = {
      user: completeUser,
      interviews: interviewsData,
      cachedAt: new Date().toISOString(),
    };

    await cacheProfile(user.id, responseData);

    return NextResponse.json({
      user: completeUser,
      interviews: interviews || [],
      _metadata: { cached: false, responseTime: Date.now() - startTime, source: 'firestore' },
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // Strip protected fields
    const {
      id: _id, createdAt: _ca, subscription: _sub, provider: _prov,
      ...updateData
    } = body;
    void _id; void _ca; void _sub; void _prov;

    // ── Handle file uploads: base64 → Supabase Storage ──────────────
    for (const fileType of ['resume', 'transcript'] as const) {
      const fileData = updateData[fileType] as string | undefined;
      const fileName = updateData[`${fileType}FileName`] as string | undefined;

      if (fileData && fileData.startsWith('data:')) {
        // It's a new base64 upload - store in Supabase Storage
        console.log(`📤 Uploading ${fileType} to Supabase Storage for ${user.id}`);
        const storagePath = await uploadUserFile(user.id, fileType, fileData, fileName || `${fileType}.pdf`);

        // Replace base64 with storage path
        updateData[`${fileType}Path`] = storagePath;
        updateData[`${fileType}FileName`] = fileName || `${fileType}.pdf`;
        delete updateData[fileType]; // Don't store base64

        // Invalidate cached extracted text so AI routes re-parse the new file
        await invalidateUserTextCache(user.id, fileType);
      } else if (fileData === '') {
        // User deleted the file
        console.log(`🗑️ Deleting ${fileType} from Supabase Storage for ${user.id}`);
        await deleteUserFile(user.id, fileType);
        updateData[`${fileType}Path`] = '';
        updateData[`${fileType}FileName`] = '';
        delete updateData[fileType];
        await invalidateUserTextCache(user.id, fileType);
      } else {
        // No change to this file - remove from update payload
        delete updateData[fileType];
      }
    }

    if (updateData.email && !updateData.email.includes('@')) {
      return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
    }

    const supabaseUserId = await toSupabaseUserId(user.id);
    const columnMap: Record<string, string> = {
      streetAddress: 'street_address', targetRole: 'target_role', experienceLevel: 'experience_level',
      preferredTech: 'preferred_tech', careerGoals: 'career_goals', linkedIn: 'linked_in',
      resumePath: 'resume_path', resumeFileName: 'resume_file_name',
      transcriptPath: 'transcript_path', transcriptFileName: 'transcript_file_name',
    };
    // Fields with a real named column - everything else (e.g. the ~35
    // auto-apply preference fields from JobApplication.tsx) is opaque to
    // this route and gets bucketed into the extended_data jsonb blob.
    const KNOWN_FIELDS = new Set([
      'name', 'email', 'phone', 'bio', 'city', 'state', 'website', 'github',
      'streetAddress', 'targetRole', 'experienceLevel', 'preferredTech',
      'careerGoals', 'linkedIn', 'resumePath', 'resumeFileName',
      'transcriptPath', 'transcriptFileName',
    ]);

    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const extendedUpdate: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (KNOWN_FIELDS.has(key)) profileUpdate[columnMap[key] ?? key] = value;
      else extendedUpdate[key] = value;
    }

    if (Object.keys(extendedUpdate).length > 0) {
      const { data: current } = await supabaseAdmin
        .from('profiles')
        .select('extended_data')
        .eq('user_id', supabaseUserId)
        .maybeSingle();
      profileUpdate.extended_data = { ...(current?.extended_data as Record<string, unknown> ?? {}), ...extendedUpdate };
    }

    const { error: updateError } = await supabaseAdmin.from('profiles').update(profileUpdate).eq('user_id', supabaseUserId);
    if (updateError) throw updateError;
    await invalidateProfileCache(user.id);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      _metadata: { responseTime: Date.now() - startTime, fieldsUpdated: Object.keys(updateData).length },
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    let errorMessage = "Failed to update profile";
    let statusCode = 500;
    if (error instanceof Error) {
      if (error.message.includes('NOT_FOUND')) { errorMessage = "User profile not found"; statusCode = 404; }
      else if (error.message.includes('PERMISSION_DENIED')) { errorMessage = "Permission denied"; statusCode = 403; }
      else if (error.message.includes('INVALID_ARGUMENT')) { errorMessage = "Invalid data format"; statusCode = 400; }
    }
    return NextResponse.json({ success: false, error: errorMessage, message: error instanceof Error ? error.message : "Unknown error" }, { status: statusCode });
  }
}

// ─── PATCH (cache invalidation) ───────────────────────────────────────────────

export async function PATCH() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await invalidateProfileCache(user.id);
    return NextResponse.json({ success: true, message: 'Cache invalidated' });
  } catch (error) {
    console.error("❌ Error in PATCH:", error);
    return NextResponse.json({ success: false, error: "Failed to invalidate cache" }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Delete files from Storage
    await Promise.all([
      deleteUserFile(user.id, 'resume'),
      deleteUserFile(user.id, 'transcript'),
    ]);

    // Delete the profile/subscription/usage rows - the split-up equivalent of
    // the old single Firestore doc. Matches the original's scope exactly:
    // this never touched other collections (resumes, interviews, etc.)
    // either, and doesn't delete the Supabase Auth account itself.
    const supabaseUserId = await toSupabaseUserId(user.id);
    await supabaseAdmin.from('usage_counters').delete().eq('user_id', supabaseUserId);
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', supabaseUserId);
    await supabaseAdmin.from('profiles').delete().eq('user_id', supabaseUserId);
    await invalidateProfileCache(user.id);
    await invalidateUserTextCache(user.id);

    return NextResponse.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    console.error("❌ Error deleting profile:", error);
    return NextResponse.json({ success: false, error: "Failed to delete profile" }, { status: 500 });
  }
}