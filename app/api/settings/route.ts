// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

interface AppSettings {
  notifications: {
    email: boolean;
    push: boolean;
    interviewReminders: boolean;
    weeklyDigest: boolean;
    aiRecommendations: boolean;
    systemUpdates: boolean;
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
    email: true,
    push: true,
    interviewReminders: true,
    weeklyDigest: true,
    aiRecommendations: true,
    systemUpdates: true,
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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Fetch settings from Firestore
    const settingsDoc = await db
      .collection('users')
      .doc(userId)
      .collection('settings')
      .doc('app_settings')
      .get();

    if (!settingsDoc.exists) {
      // Return default settings if none exist
      return NextResponse.json({
        success: true,
        settings: defaultSettings,
      });
    }

    const settings = settingsDoc.data() as AppSettings;

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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

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
        email: settings.notifications?.email ?? defaultSettings.notifications.email,
        push: settings.notifications?.push ?? defaultSettings.notifications.push,
        interviewReminders: settings.notifications?.interviewReminders ?? defaultSettings.notifications.interviewReminders,
        weeklyDigest: settings.notifications?.weeklyDigest ?? defaultSettings.notifications.weeklyDigest,
        aiRecommendations: settings.notifications?.aiRecommendations ?? defaultSettings.notifications.aiRecommendations,
        systemUpdates: settings.notifications?.systemUpdates ?? defaultSettings.notifications.systemUpdates,
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

    // Save to Firestore with timestamp
    await db
      .collection('users')
      .doc(userId)
      .collection('settings')
      .doc('app_settings')
      .set({
        ...validatedSettings,
        updatedAt: new Date().toISOString(),
      });

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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Delete the settings document (will fall back to defaults on next GET)
    await db
      .collection('users')
      .doc(userId)
      .collection('settings')
      .doc('app_settings')
      .delete();

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