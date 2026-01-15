// app/api/feedback/reward/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { getCurrentUser } from '@/lib/actions/auth.action';

interface RewardConfig {
  field: string;
  amount: number;
  label: string;
}

interface UserData {
  usage?: {
    coverLettersUsed?: number;
    resumesUsed?: number;
    studyPlansUsed?: number;
    interviewsUsed?: number;
    [key: string]: number | string | undefined;
  };
  rewards?: {
    [key: string]: boolean | string | number | undefined;
  };
  [key: string]: unknown;
}

interface RewardStatus {
  claimed: boolean;
  date: string | null;
  amount: number;
}

// Define reward amounts for each feature type
const REWARD_AMOUNTS: Record<string, RewardConfig> = {
  coverLetters: { 
    field: 'coverLettersUsed', 
    amount: 2, 
    label: '2 free cover letters' 
  },
  resumes: { 
    field: 'resumesUsed', 
    amount: 2, 
    label: '2 free resume reviews' 
  },
  studyPlans: { 
    field: 'studyPlansUsed', 
    amount: 1, 
    label: '1 free study plan' 
  },
  interviews: { 
    field: 'interviewsUsed', 
    amount: 1, 
    label: '1 free interview session' 
  },
};

export async function POST(request: NextRequest) {
  try {
    console.log('🎁 Feedback reward API called');
    
    // Verify user authentication
    const user = await getCurrentUser();

    if (!user) {
      console.error('❌ Unauthorized - no user found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Parse request body
    const body = await request.json();
    const userId = body.userId as string;
    const featureType = body.featureType as string;

    console.log('📝 Request data:', { userId, featureType });

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      console.error('❌ User ID mismatch:', { requestUserId: userId, authUserId: user.id });
      return NextResponse.json(
        { error: 'Unauthorized - user ID mismatch' },
        { status: 401 }
      );
    }

    // Get reward configuration for this feature
    const rewardConfig = REWARD_AMOUNTS[featureType];
    
    if (!rewardConfig) {
      console.error('❌ Invalid feature type:', featureType);
      return NextResponse.json(
        { error: 'Invalid feature type' },
        { status: 400 }
      );
    }

    console.log('🎯 Reward config:', rewardConfig);

    // Check if user has already been rewarded for this feature
    const rewardKey = `feedback_reward_${featureType}`;
    console.log('🔑 Checking reward key:', rewardKey);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.error('❌ User document not found:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data() as UserData;
    const rewards = userData?.rewards || {};
    const currentUsage = userData?.usage || {};
    
    console.log('📊 Current rewards:', rewards);
    console.log('📊 Current usage:', currentUsage);
    
    // Check if already rewarded
    if (rewards[rewardKey]) {
      console.log('⚠️ User already rewarded for this feature');
      return NextResponse.json({
        rewarded: false,
        message: 'Already rewarded for this feature',
        alreadyClaimed: true,
      });
    }
    
    // Get current usage for the specific feature field
    const currentFeatureUsage = (currentUsage[rewardConfig.field] as number) || 0;
    console.log(`📈 Current ${rewardConfig.field}:`, currentFeatureUsage);
    
    // Calculate new usage (subtract reward amount, but don't go below 0)
    const newUsage = Math.max(0, currentFeatureUsage - rewardConfig.amount);
    console.log(`📉 New ${rewardConfig.field}:`, newUsage, `(reduced by ${rewardConfig.amount})`);
    
    // Prepare update data
    const updateData: Record<string, string | number | boolean> = {
      [`usage.${rewardConfig.field}`]: newUsage,
      [`rewards.${rewardKey}`]: true,
      [`rewards.${rewardKey}_date`]: new Date().toISOString(),
      [`rewards.${rewardKey}_amount`]: rewardConfig.amount,
      [`rewards.${rewardKey}_type`]: rewardConfig.field,
      'updatedAt': new Date().toISOString(),
    };

    console.log('💾 Update data:', updateData);

    // Update Firestore
    await db.collection('users').doc(userId).update(updateData);
    
    console.log(`✅ Successfully rewarded user with ${rewardConfig.label}`);
    
    return NextResponse.json({
      success: true,
      rewarded: true,
      message: `Successfully added ${rewardConfig.label}`,
      rewardAmount: rewardConfig.amount,
      rewardLabel: rewardConfig.label,
      featureType,
      featureField: rewardConfig.field,
      previousUsage: currentFeatureUsage,
      newUsage,
      rewardKey,
    });
  } catch (error) {
    console.error('❌ Error processing reward:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process reward',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check reward status
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's reward history
    const userDoc = await db.collection('users').doc(user.id).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data() as UserData;
    const rewards = userData?.rewards || {};

    // Build reward status for each feature
    const rewardStatus: Record<string, RewardStatus> = {
      coverLetters: {
        claimed: !!rewards.feedback_reward_coverLetters,
        date: (rewards.feedback_reward_coverLetters_date as string) || null,
        amount: (rewards.feedback_reward_coverLetters_amount as number) || 0,
      },
      resumes: {
        claimed: !!rewards.feedback_reward_resumes,
        date: (rewards.feedback_reward_resumes_date as string) || null,
        amount: (rewards.feedback_reward_resumes_amount as number) || 0,
      },
      studyPlans: {
        claimed: !!rewards.feedback_reward_studyPlans,
        date: (rewards.feedback_reward_studyPlans_date as string) || null,
        amount: (rewards.feedback_reward_studyPlans_amount as number) || 0,
      },
      interviews: {
        claimed: !!rewards.feedback_reward_interviews,
        date: (rewards.feedback_reward_interviews_date as string) || null,
        amount: (rewards.feedback_reward_interviews_amount as number) || 0,
      },
    };

    const totalRewardsClaimed = Object.values(rewardStatus).filter(r => r.claimed).length;
    const totalBonusCredits = Object.values(rewardStatus).reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      success: true,
      rewardStatus,
      totalRewardsClaimed,
      totalBonusCredits,
      userId: user.id,
    });
  } catch (error) {
    console.error('Error fetching reward status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reward status' },
      { status: 500 }
    );
  }
}