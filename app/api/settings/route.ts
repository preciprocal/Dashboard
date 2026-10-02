// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

interface AppSettings {
  notifications: {
    /** Gates the support-reply email in app/api/support/inbound-email. */
    supportReplies: boolean;
    /** Mirrored to profiles.weekly_digest_opt_out, which the cron reads. */
    weeklyDigest: boolean;
    /** Mirrored to profiles.activation_email_opt_out, which the activation cron reads. */
    activation: boolean;
    /** Mirrored to profiles.application_email_opt_out, which the coaching cron reads. */
    coaching: boolean;
    /** Mirrored to newsletter_subscribers.subscribed. Opt-in. */
    productUpdates: boolean;
  };
  privacy: {
    shareAnalytics: boolean;
    allowDataCollection: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    fontSize: 'small' | 'medium' | 'large';
    reducedMotion: boolean;
  };
  preferences: {
    autoSave: boolean;
    soundEffects: boolean;
    defaultInterviewType: 'technical' | 'behavioral' | 'mixed';
    practiceReminders: boolean;
    emailFrequency: 'realtime' | 'daily' | 'weekly' | 'never';
  };
}

const defaultSettings: AppSettings = {
  notifications: {
    supportReplies: true,
    weeklyDigest: true,
    activation: true,
    coaching: true,
    productUpdates: false,
  },
  privacy: {
    shareAnalytics: false,
    allowDataCollection: true,
  },
  appearance: {
    theme: 'dark',
    language: 'en',
    fontSize: 'medium',
    reducedMotion: false,
  },
  preferences: {
    autoSave: true,
    soundEffects: true,
    defaultInterviewType: 'mixed',
    practiceReminders: true,
    emailFrequency: 'daily',
  },
};

// GET - Fetch user settings
export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from('user_settings')
      .select('settings')
      .eq('user_id', authedUser.supabaseUserId)
      .maybeSingle();
    if (error) throw error;

    // weeklyDigest and productUpdates are owned by other tables, so the JSON
    // blob is not authoritative for them. Read them from where their senders
    // read them, or the toggle lies after an unsubscribe from the digest
    // footer link (app/api/digest/unsubscribe writes the column directly and
    // never touches user_settings).
    const [{ data: profileRow }, stored] = await Promise.all([
      supabaseAdmin.from('profiles')
        .select('email, weekly_digest_opt_out, activation_email_opt_out, application_email_opt_out')
        .eq('user_id', authedUser.supabaseUserId).maybeSingle(),
      Promise.resolve(row?.settings as AppSettings | undefined),
    ]);

    let productUpdates = defaultSettings.notifications.productUpdates;
    if (profileRow?.email) {
      const { data: sub } = await supabaseAdmin
        .from('newsletter_subscribers')
        .select('subscribed')
        .eq('email', String(profileRow.email).toLowerCase().trim())
        .maybeSingle();
      productUpdates = sub?.subscribed === true;
    }

    // Section-by-section, because an email unsubscribe can create this row
    // holding only `notifications` (lib/email/unsubscribe.ts).
    const base: AppSettings = { ...defaultSettings, ...(stored ?? {}) };
    const settings: AppSettings = {
      ...base,
      notifications: {
        supportReplies: base.notifications?.supportReplies ?? defaultSettings.notifications.supportReplies,
        weeklyDigest:   profileRow?.weekly_digest_opt_out !== true,
        activation:     profileRow?.activation_email_opt_out !== true,
        coaching:       profileRow?.application_email_opt_out !== true,
        productUpdates,
      },
    };

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST - Update user settings
export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings data is required' },
        { status: 400 }
      );
    }

    // Validate settings structure
    const validatedSettings: AppSettings = {
      notifications: {
        supportReplies: settings.notifications?.supportReplies ?? defaultSettings.notifications.supportReplies,
        weeklyDigest:   settings.notifications?.weeklyDigest   ?? defaultSettings.notifications.weeklyDigest,
        activation:     settings.notifications?.activation     ?? defaultSettings.notifications.activation,
        coaching:       settings.notifications?.coaching       ?? defaultSettings.notifications.coaching,
        productUpdates: settings.notifications?.productUpdates ?? defaultSettings.notifications.productUpdates,
      },
      privacy: {
        shareAnalytics: settings.privacy?.shareAnalytics ?? defaultSettings.privacy.shareAnalytics,
        allowDataCollection: settings.privacy?.allowDataCollection ?? defaultSettings.privacy.allowDataCollection,
      },
      appearance: {
        theme: settings.appearance?.theme ?? defaultSettings.appearance.theme,
        language: settings.appearance?.language ?? defaultSettings.appearance.language,
        fontSize: settings.appearance?.fontSize ?? defaultSettings.appearance.fontSize,
        reducedMotion: settings.appearance?.reducedMotion ?? defaultSettings.appearance.reducedMotion,
      },
      preferences: {
        autoSave: settings.preferences?.autoSave ?? defaultSettings.preferences.autoSave,
        soundEffects: settings.preferences?.soundEffects ?? defaultSettings.preferences.soundEffects,
        defaultInterviewType: settings.preferences?.defaultInterviewType ?? defaultSettings.preferences.defaultInterviewType,
        practiceReminders: settings.preferences?.practiceReminders ?? defaultSettings.preferences.practiceReminders,
        emailFrequency: settings.preferences?.emailFrequency ?? defaultSettings.preferences.emailFrequency,
      },
    };

    // Save to Postgres with timestamp
    const { error: upsertError } = await supabaseAdmin
      .from('user_settings')
      .upsert({
        user_id: authedUser.supabaseUserId,
        settings: validatedSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (upsertError) throw upsertError;

    // Two of these three are not read from user_settings at all: the digest
    // cron filters on profiles.weekly_digest_opt_out, and product updates are
    // a newsletter_subscribers row keyed by email. Writing only the JSON blob
    // is exactly how the old toggles ended up controlling nothing, so mirror
    // them to where their senders actually look.
    //
    // Best-effort and logged: the user's choice is already recorded above, and
    // failing the whole save because a mirror write missed would lose it.
    const n = validatedSettings.notifications;
    const { error: digestErr } = await supabaseAdmin
      .from('profiles')
      .update({
        weekly_digest_opt_out: !n.weeklyDigest,
        activation_email_opt_out: !n.activation,
        application_email_opt_out: !n.coaching,
      })
      .eq('user_id', authedUser.supabaseUserId);
    if (digestErr) console.error('⚠️ could not mirror weeklyDigest:', digestErr.message);

    const { data: profileRow } = await supabaseAdmin
      .from('profiles').select('email').eq('user_id', authedUser.supabaseUserId).maybeSingle();
    const subscriberEmail = profileRow?.email
      ? String(profileRow.email).toLowerCase().trim()
      : null;
    if (subscriberEmail) {
      const { error: newsErr } = await supabaseAdmin
        .from('newsletter_subscribers')
        .upsert({ email: subscriberEmail, subscribed: n.productUpdates }, { onConflict: 'email' });
      if (newsErr) console.error('⚠️ could not mirror productUpdates:', newsErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: validatedSettings,
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

// DELETE - Reset settings to default
export async function DELETE(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete the settings row (will fall back to defaults on next GET)
    const { error: deleteError } = await supabaseAdmin
      .from('user_settings')
      .delete()
      .eq('user_id', authedUser.supabaseUserId);
    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults',
      settings: defaultSettings,
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json(
      { error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}