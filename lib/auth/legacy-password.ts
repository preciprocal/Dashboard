// lib/auth/legacy-password.ts
// Bridges Firebase-era passwords into Supabase Auth after the Phase 2 user
// import. Firebase's scrypt hashes can't be transplanted into Supabase's
// bcrypt column, so imported users start with no usable Supabase password;
// their hash+salt is held in `legacy_password_hashes` (service-role only)
// until their first successful login, at which point a real Supabase
// password is set and the legacy hash is deleted.
import { FirebaseScrypt } from "firebase-scrypt";
import { supabaseAdmin } from "@/supabase/admin";

function getScrypt(): FirebaseScrypt {
  const memCost = process.env.FIREBASE_SCRYPT_MEM_COST;
  const rounds = process.env.FIREBASE_SCRYPT_ROUNDS;
  const saltSeparator = process.env.FIREBASE_SCRYPT_SALT_SEPARATOR;
  const signerKey = process.env.FIREBASE_SCRYPT_SIGNER_KEY;

  if (!memCost || !rounds || !saltSeparator || !signerKey) {
    throw new Error(
      "❌ Firebase scrypt hash parameters are not configured. " +
      "Set FIREBASE_SCRYPT_MEM_COST, FIREBASE_SCRYPT_ROUNDS, FIREBASE_SCRYPT_SALT_SEPARATOR " +
      "and FIREBASE_SCRYPT_SIGNER_KEY in .env.local (Firebase Console -> Authentication -> " +
      "Users -> Password hash parameters)."
    );
  }

  return new FirebaseScrypt({
    memCost: Number(memCost),
    rounds: Number(rounds),
    saltSeparator,
    signerKey,
  });
}

/**
 * Verify a plaintext password against a user's still-pending Firebase hash,
 * and if it matches, set that password as their real Supabase password and
 * delete the legacy hash. Returns true if the login should be allowed to
 * proceed (i.e. a legacy hash existed and the password matched).
 */
export async function tryMigrateLegacyPassword(
  userId: string,
  password: string
): Promise<boolean> {
  const { data: row, error } = await supabaseAdmin
    .from("legacy_password_hashes")
    .select("password_hash, password_salt")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !row) return false;

  const scrypt = getScrypt();
  const isValid = await scrypt.verify(password, row.password_salt, row.password_hash);
  if (!isValid) return false;

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) {
    console.error("❌ Failed to set migrated Supabase password:", updateError);
    return false;
  }

  await supabaseAdmin.from("legacy_password_hashes").delete().eq("user_id", userId);
  console.log(`✅ Migrated legacy Firebase password for user ${userId}`);
  return true;
}
