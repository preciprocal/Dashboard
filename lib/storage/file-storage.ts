// lib/storage/file-storage.ts
// Profile-page resume/transcript storage (one fixed file per user).
// Ported from Firebase Storage to Supabase Storage — see the migration plan
// at C:\Users\yashv\.claude\plans\lovely-exploring-turing.md, Phase 1.

import { supabaseAdmin } from '@/supabase/admin';

const BUCKET = 'user-files';

export type FileType = 'resume' | 'transcript';

/**
 * Get the storage path for a user file
 */
function getFilePath(userId: string, fileType: FileType): string {
  return `users/${userId}/${fileType}.pdf`;
}

/**
 * Upload a PDF file to Supabase Storage.
 * Accepts either a base64 data URL or a raw Buffer.
 */
export async function uploadUserFile(
  userId: string,
  fileType: FileType,
  fileData: string | Buffer,
  fileName: string
): Promise<string> {
  const filePath = getFilePath(userId, fileType);

  let buffer: Buffer;

  if (typeof fileData === 'string') {
    // Handle base64 data URL (e.g. "data:application/pdf;base64,...")
    const base64Content = fileData.includes(',')
      ? fileData.split(',')[1]
      : fileData;
    buffer = Buffer.from(base64Content, 'base64');
  } else {
    buffer = fileData;
  }

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: 'application/pdf',
    upsert: true,
    metadata: {
      originalFileName: fileName,
      uploadedAt: new Date().toISOString(),
      userId,
      fileType,
    },
  });

  if (error) {
    console.error(`❌ Failed to upload ${fileType} for user ${userId}:`, error);
    throw error;
  }

  console.log(`✅ Uploaded ${fileType} for user ${userId} (${buffer.length} bytes)`);

  // Return the storage path (not a public URL - we read via the admin client)
  return filePath;
}

/**
 * Download a user file as a Buffer
 */
export async function downloadUserFile(
  userId: string,
  fileType: FileType
): Promise<Buffer | null> {
  try {
    const filePath = getFilePath(userId, fileType);
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(filePath);

    if (error || !data) {
      console.log(`📭 No ${fileType} found for user ${userId}`);
      return null;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    console.log(`✅ Downloaded ${fileType} for user ${userId} (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    console.error(`❌ Failed to download ${fileType} for user ${userId}:`, error);
    return null;
  }
}

/**
 * Delete a user file from Storage
 */
export async function deleteUserFile(
  userId: string,
  fileType: FileType
): Promise<boolean> {
  try {
    const filePath = getFilePath(userId, fileType);
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([filePath]);

    if (error) {
      console.error(`❌ Failed to delete ${fileType} for user ${userId}:`, error);
      return false;
    }

    console.log(`✅ Deleted ${fileType} for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete ${fileType} for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if a user file exists
 */
export async function userFileExists(
  userId: string,
  fileType: FileType
): Promise<boolean> {
  try {
    const dir = `users/${userId}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(dir, {
      search: `${fileType}.pdf`,
    });
    if (error) return false;
    return !!data?.some((f) => f.name === `${fileType}.pdf`);
  } catch {
    return false;
  }
}

/**
 * Get a signed URL for temporary access (e.g. for the user to view their file)
 * Expires in 15 minutes by default
 */
export async function getSignedUrl(
  userId: string,
  fileType: FileType,
  expiresInMinutes = 15
): Promise<string | null> {
  try {
    const filePath = getFilePath(userId, fileType);

    const exists = await userFileExists(userId, fileType);
    if (!exists) return null;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(filePath, expiresInMinutes * 60);

    if (error || !data) {
      console.error(`❌ Failed to get signed URL for ${fileType}:`, error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`❌ Failed to get signed URL for ${fileType}:`, error);
    return null;
  }
}
