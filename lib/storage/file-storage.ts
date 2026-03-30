// lib/storage/file-storage.ts

import { storage } from '@/firebase/admin';

const bucket = storage.bucket();

export type FileType = 'resume' | 'transcript';

/**
 * Get the storage path for a user file
 */
function getFilePath(userId: string, fileType: FileType): string {
  return `users/${userId}/${fileType}.pdf`;
}

/**
 * Upload a PDF file to Firebase Storage
 * Accepts either a base64 data URL or a raw Buffer
 */
export async function uploadUserFile(
  userId: string,
  fileType: FileType,
  fileData: string | Buffer,
  fileName: string
): Promise<string> {
  const filePath = getFilePath(userId, fileType);
  const file = bucket.file(filePath);

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

  await file.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        originalFileName: fileName,
        uploadedAt: new Date().toISOString(),
        userId,
        fileType,
      },
    },
  });

  console.log(`✅ Uploaded ${fileType} for user ${userId} (${buffer.length} bytes)`);

  // Return the storage path (not a public URL — we read via admin SDK)
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
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      console.log(`📭 No ${fileType} found for user ${userId}`);
      return null;
    }

    const [buffer] = await file.download();
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
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) return true;

    await file.delete();
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
    const filePath = getFilePath(userId, fileType);
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    return exists;
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
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) return null;

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return url;
  } catch (error) {
    console.error(`❌ Failed to get signed URL for ${fileType}:`, error);
    return null;
  }
}