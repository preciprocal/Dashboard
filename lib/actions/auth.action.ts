"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie
export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  try {
    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION * 1000, // milliseconds
    });

    // Set cookie in the browser
    cookieStore.set("session", sessionCookie, {
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return { success: true };
  } catch (error) {
    console.error("Error setting session cookie:", error);
    return { success: false, error: "Failed to set session cookie" };
  }
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email, provider } = params;

  try {
    // check if user exists in db
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    // save user to db with subscription data
    await db
      .collection("users")
      .doc(uid)
      .set({
        name,
        email,
        provider: provider || "email",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: "starter",
          status: "active",
          interviewsUsed: 0,
          interviewsLimit: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          trialEndsAt: null,
          subscriptionEndsAt: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          canceledAt: null,
          lastPaymentAt: null,
        },
      });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error: any) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken, provider } = params;

  console.log("Sign in attempt:", { email, provider, hasToken: !!idToken });

  try {
    // Verify the ID token first
    const decodedToken = await auth.verifyIdToken(idToken);
    if (!decodedToken) {
      console.error("Failed to decode ID token");
      return {
        success: false,
        message: "Invalid authentication token.",
      };
    }

    console.log("Token decoded successfully for UID:", decodedToken.uid);

    // Check if user exists in our database
    const userRecord = await db.collection("users").doc(decodedToken.uid).get();

    console.log("User exists in DB:", userRecord.exists, "Provider:", provider);

    // If user doesn't exist and this is OAuth sign-in, create the user automatically
    if (!userRecord.exists) {
      if (provider === "google" || provider === "facebook") {
        console.log("Creating new OAuth user for provider:", provider);
        try {
          // Get user info from Firebase Auth
          const firebaseUser = await auth.getUser(decodedToken.uid);
          console.log("Firebase user data:", {
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            uid: firebaseUser.uid,
          });

          const userData = {
            name:
              firebaseUser.displayName ||
              `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
            email: firebaseUser.email || email,
            provider: provider,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            subscription: {
              plan: "starter",
              status: "active",
              interviewsUsed: 0,
              interviewsLimit: 10,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              trialEndsAt: null,
              subscriptionEndsAt: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
              canceledAt: null,
              lastPaymentAt: null,
            },
          };

          await db.collection("users").doc(decodedToken.uid).set(userData);

          console.log("Successfully created OAuth user in database");
        } catch (createError) {
          console.error("Error creating OAuth user:", createError);
          return {
            success: false,
            message: "Failed to create user account. Please try again.",
          };
        }
      } else {
        // For email/password sign-in, user must exist
        console.log("Email/password user doesn't exist in database");
        return {
          success: false,
          message: "User does not exist. Create an account.",
        };
      }
    } else {
      console.log("User already exists in database");
    }

    // Set the session cookie
    console.log("Setting session cookie...");
    const sessionResult = await setSessionCookie(idToken);
    if (!sessionResult.success) {
      console.error("Failed to set session cookie");
      return {
        success: false,
        message: "Failed to create session. Please try again.",
      };
    }

    console.log("Sign in successful");
    return {
      success: true,
      message: "Successfully signed in.",
    };
  } catch (error: any) {
    console.error("Error during sign in:", error);

    // Handle specific Firebase auth errors
    if (error.code === "auth/id-token-expired") {
      return {
        success: false,
        message: "Authentication token expired. Please try again.",
      };
    }

    if (error.code === "auth/invalid-id-token") {
      return {
        success: false,
        message: "Invalid authentication token. Please try again.",
      };
    }

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // get user info from db
    const userRecord = await db
      .collection("users")
      .doc(decodedClaims.uid)
      .get();
    if (!userRecord.exists) return null;

    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (error) {
    console.log("Error verifying session:", error);
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

// Update user profile data
export async function updateUserProfile(
  userId: string,
  profileData: Partial<User>
) {
  try {
    // Remove fields that shouldn't be updated
    const { id, createdAt, subscription, ...updateData } = profileData;

    // Add updatedAt timestamp
    const dataToUpdate = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("users").doc(userId).update(dataToUpdate);

    return {
      success: true,
      message: "Profile updated successfully.",
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      message: "Failed to update profile. Please try again.",
    };
  }
}

// Get user profile by ID
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return null;
    }

    return {
      ...userDoc.data(),
      id: userDoc.id,
    } as User;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

// Reset user password
export async function resetUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string
) {
  try {
    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) {
      return {
        success: false,
        message: "User not found.",
      };
    }

    // For Firebase Admin SDK, we can directly update the password
    // Note: In a real-world scenario, you might want to verify the current password
    // through the client-side Firebase Auth before calling this server function
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    return {
      success: true,
      message: "Password updated successfully.",
    };
  } catch (error: any) {
    console.error("Error resetting password:", error);

    if (error.code === "auth/user-not-found") {
      return {
        success: false,
        message: "User not found.",
      };
    }

    if (error.code === "auth/weak-password") {
      return {
        success: false,
        message:
          "New password is too weak. Password should be at least 6 characters.",
      };
    }

    return {
      success: false,
      message: "Failed to update password. Please try again.",
    };
  }
}

// Delete user account
export async function deleteUserAccount(userId: string) {
  try {
    // Start a batch operation for atomic deletion
    const batch = db.batch();

    // Delete user document
    const userRef = db.collection("users").doc(userId);
    batch.delete(userRef);

    // Delete user's interviews
    const interviewsSnapshot = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .get();

    interviewsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's feedback
    const feedbackSnapshot = await db
      .collection("feedback")
      .where("userId", "==", userId)
      .get();

    feedbackSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add any other collections that belong to the user
    // For example: user settings, preferences, etc.

    // Commit the batch operation to delete all Firestore data
    await batch.commit();

    // Delete user from Firebase Auth
    try {
      await auth.deleteUser(userId);
    } catch (authError) {
      console.error("Error deleting user from Firebase Auth:", authError);
      // Continue even if auth deletion fails as the Firestore data is already deleted
      // In some cases, the user might have already been deleted from Auth
    }

    // Clear the session cookie
    const cookieStore = await cookies();
    cookieStore.delete("session");

    return {
      success: true,
      message: "Account deleted successfully.",
    };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return {
      success: false,
      message: "Failed to delete account. Please try again.",
    };
  }
}

// Update user subscription data
export async function updateUserSubscription(
  userId: string,
  subscriptionData: any
) {
  try {
    await db
      .collection("users")
      .doc(userId)
      .update({
        subscription: {
          ...subscriptionData,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });

    return {
      success: true,
      message: "Subscription updated successfully.",
    };
  } catch (error) {
    console.error("Error updating subscription:", error);
    return {
      success: false,
      message: "Failed to update subscription.",
    };
  }
}

// Increment interview usage count
export async function incrementInterviewUsage(userId: string) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    const currentUsage = userData?.subscription?.interviewsUsed || 0;
    const limit = userData?.subscription?.interviewsLimit || 10;

    // Check if user has reached their limit (only for starter plan)
    if (userData?.subscription?.plan === "starter" && currentUsage >= limit) {
      return {
        success: false,
        message: "Interview limit reached. Please upgrade your plan.",
      };
    }

    // Increment usage count
    await db
      .collection("users")
      .doc(userId)
      .update({
        "subscription.interviewsUsed": currentUsage + 1,
        "subscription.updatedAt": new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return {
      success: true,
      message: "Interview usage updated.",
    };
  } catch (error) {
    console.error("Error incrementing interview usage:", error);
    return {
      success: false,
      message: "Failed to update interview usage.",
    };
  }
}

// Reset monthly interview usage (call this monthly for starter plan users)
export async function resetMonthlyInterviewUsage(userId: string) {
  try {
    await db.collection("users").doc(userId).update({
      "subscription.interviewsUsed": 0,
      "subscription.updatedAt": new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Monthly interview usage reset.",
    };
  } catch (error) {
    console.error("Error resetting interview usage:", error);
    return {
      success: false,
      message: "Failed to reset interview usage.",
    };
  }
}

// Check if user can start a new interview
export async function canStartInterview(userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    const plan = userData?.subscription?.plan;
    const currentUsage = userData?.subscription?.interviewsUsed || 0;
    const limit = userData?.subscription?.interviewsLimit || 10;

    // Pro and Premium plans have unlimited interviews
    if (plan === "pro" || plan === "premium") {
      return true;
    }

    // Starter plan has a limit
    return currentUsage < limit;
  } catch (error) {
    console.error("Error checking interview availability:", error);
    return false;
  }
}
