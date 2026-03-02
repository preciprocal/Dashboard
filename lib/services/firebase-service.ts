// lib/services/firebase-service.ts
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { auth, db } from '@/firebase/client';
import { Resume, ResumeStatus } from '@/types/resume';

// Transcript interface
export interface Transcript {
  id: string;
  userId: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  fileUrl?: string;
  filePath?: string;
  transcriptPath?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  status: 'uploaded' | 'processing' | 'complete' | 'failed';
  [key: string]: unknown; // Index signature for flexibility
}

// Helper function to get error message from unknown error
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

// Helper function to convert string or Date to Date
function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

interface FileMetadata {
  pdfSize: number;
  pdfName: string;
  pdfType: string;
  imageSize: number;
  imageName: string;
  imageType: string;
}

interface ResumeData extends Omit<Resume, 'createdAt'> {
  createdAt: Timestamp;
  fileMetadata?: FileMetadata;
}

interface TranscriptData {
  id?: string;
  userId: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  fileUrl?: string;
  filePath?: string;
  transcriptPath?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'uploaded' | 'processing' | 'complete' | 'failed';
}

// Convert file to base64 data URL (similar to your interview form approach)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// ============ RESUME FUNCTIONS ============

// NEW: Upload resume file to Firebase Storage and create Firestore document
export async function uploadResume(userId: string, file: File): Promise<Resume> {
  try {
    console.log('📤 Uploading resume for user:', userId);
    
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    if (!auth.currentUser) {
      throw new Error('User must be authenticated to upload resume');
    }

    const storage = getStorage();
    
    // Create a unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;
    const storageRef = ref(storage, `resumes/${userId}/${fileName}`);
    
    console.log('📁 Uploading file to storage...');
    // Upload file to Firebase Storage
    await uploadBytes(storageRef, file);
    
    console.log('🔗 Getting download URL...');
    // Get download URL
    const fileUrl = await getDownloadURL(storageRef);
    
    console.log('💾 Creating Firestore document...');
    // Create resume document in Firestore
    const resumeData = {
      userId,
      fileName: file.name,
      originalFileName: file.name,
      fileUrl,
      resumePath: fileUrl,
      filePath: fileUrl,
      fileSize: file.size,
      status: 'pending' as ResumeStatus,
      companyName: '',
      jobTitle: '',
      jobDescription: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, 'resumes'), resumeData);
    
    console.log('✅ Resume uploaded successfully with ID:', docRef.id);
    
    // Return the created resume with proper ID and all required fields
    const newResume: Resume = {
      id: docRef.id,
      userId,
      fileName: file.name,
      originalFileName: file.name,
      fileUrl,
      resumePath: fileUrl,
      filePath: fileUrl,
      fileSize: file.size,
      status: 'pending',
      companyName: '',
      jobTitle: '',
      jobDescription: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return newResume;
  } catch (error: unknown) {
    console.error('❌ Error uploading resume:', error);
    throw new Error(`Failed to upload resume: ${getErrorMessage(error)}`);
  }
}

// Save resume with embedded base64 files (no external storage needed)
export async function saveResumeWithFiles(
  resume: Omit<Resume, 'imagePath' | 'resumePath'>,
  pdfFile: File,
  imageFile: File
): Promise<string> {
  try {
    console.log('💾 Saving resume with embedded files...', resume.id);
    
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    if (!auth.currentUser) {
      throw new Error('User must be authenticated to save resume');
    }

    console.log('📄 Converting PDF to base64...');
    const pdfBase64 = await fileToBase64(pdfFile);
    
    console.log('🖼️ Converting image to base64...');
    const imageBase64 = await fileToBase64(imageFile);

    const resumeRef = doc(db, 'resumes', resume.id);
    const resumeData: ResumeData = {
      ...resume,
      // Store files as base64 data URLs
      imagePath: imageBase64,
      resumePath: pdfBase64,
      createdAt: Timestamp.fromDate(toDate(resume.createdAt)),
      // Add file metadata
      fileMetadata: {
        pdfSize: pdfFile.size,
        pdfName: pdfFile.name,
        pdfType: pdfFile.type,
        imageSize: imageFile.size,
        imageName: imageFile.name,
        imageType: imageFile.type,
      }
    };
    
    console.log('📝 Resume data to save:', {
      id: resumeData.id,
      userId: resumeData.userId,
      companyName: resumeData.companyName,
      jobTitle: resumeData.jobTitle,
      hasPdfData: resumeData.resumePath?.startsWith('data:') ?? false,
      hasImageData: resumeData.imagePath?.startsWith('data:') ?? false,
      pdfSize: resumeData.fileMetadata?.pdfSize,
      imageSize: resumeData.fileMetadata?.imageSize,
    });
    
    await setDoc(resumeRef, resumeData);
    console.log('✅ Resume saved successfully to Firestore');
    
    return resume.id;
  } catch (error: unknown) {
    console.error('❌ Error saving resume:', error);
    throw new Error(`Failed to save resume: ${getErrorMessage(error)}`);
  }
}

// Alternative: Save resume to Firestore (existing method)
export async function saveResume(resume: Resume): Promise<void> {
  try {
    console.log('💾 Saving resume to Firestore...', resume.id);
    
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    if (!auth.currentUser) {
      throw new Error('User must be authenticated to save resume');
    }

    const resumeRef = doc(db, 'resumes', resume.id);
    const resumeData = {
      ...resume,
      createdAt: Timestamp.fromDate(toDate(resume.createdAt)),
    };
    
    await setDoc(resumeRef, resumeData);
    console.log('✅ Resume saved successfully to Firestore');
  } catch (error: unknown) {
    console.error('❌ Error saving resume:', error);
    throw new Error(`Failed to save resume: ${getErrorMessage(error)}`);
  }
}

// Get resume by ID
export async function getResume(id: string): Promise<Resume | null> {
  try {
    console.log('📖 Getting resume by ID:', id);
    
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    const resumeRef = doc(db, 'resumes', id);
    const resumeSnap = await getDoc(resumeRef);
    
    if (resumeSnap.exists()) {
      const data = resumeSnap.data();
      console.log('✅ Resume found');
      return {
        ...data,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt instanceof Date 
            ? data.createdAt 
            : new Date(data.createdAt),
      } as Resume;
    } else {
      console.log('❌ Resume not found');
      return null;
    }
  } catch (error: unknown) {
    console.error('❌ Error getting resume:', error);
    throw new Error('Failed to get resume');
  }
}

// Get all resumes for a user
export async function getUserResumes(userId: string): Promise<Resume[]> {
  try {
    console.log('📋 Getting resumes for user:', userId);
    
    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    const resumesRef = collection(db, 'resumes');
    const q = query(
      resumesRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const resumes = querySnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      return {
        ...data,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt instanceof Date 
            ? data.createdAt 
            : new Date(data.createdAt),
      };
    }) as Resume[];

    console.log('✅ Found', resumes.length, 'resumes for user');
    return resumes;
  } catch (error: unknown) {
    console.error('❌ Error getting user resumes:', error);
    throw new Error('Failed to get user resumes');
  }
}

// Delete resume
export async function deleteResume(resumeId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting resume:', resumeId);
    
    if (!db || !auth.currentUser) {
      throw new Error('Database not initialized or user not authenticated');
    }

    const resume = await getResume(resumeId);
    if (!resume) {
      throw new Error('Resume not found');
    }

    if (resume.userId !== auth.currentUser.uid) {
      throw new Error('Unauthorized: Cannot delete resume that belongs to another user');
    }

    const resumeRef = doc(db, 'resumes', resumeId);
    await setDoc(resumeRef, { deleted: true, deletedAt: new Date() }, { merge: true });
    
    console.log('✅ Resume marked as deleted');
  } catch (error: unknown) {
    console.error('❌ Error deleting resume:', error);
    throw new Error('Failed to delete resume');
  }
}

// Delete resume file from storage
export async function deleteResumeFile(resumeId: string, fileUrl: string): Promise<void> {
  try {
    console.log('🗑️ Deleting resume file from storage:', resumeId);
    
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }

    const storage = getStorage();
    
    const urlParts = fileUrl.split('/o/')[1]?.split('?')[0];
    if (!urlParts) {
      throw new Error('Invalid file URL');
    }
    
    const filePath = decodeURIComponent(urlParts);
    const fileRef = ref(storage, filePath);
    
    await deleteObject(fileRef);
    await deleteResume(resumeId);
    
    console.log('✅ Resume file deleted from storage');
  } catch (error: unknown) {
    console.error('❌ Error deleting resume file:', error);
    throw new Error('Failed to delete resume file');
  }
}

// ============ TRANSCRIPT FUNCTIONS ============

/**
 * Upload a transcript file to Firebase Storage and save metadata to Firestore
 */
export async function uploadTranscript(
  userId: string, 
  file: File
): Promise<Transcript> {
  try {
    console.log('📄 Uploading transcript for user:', userId);
    console.log('   File:', file.name, '-', (file.size / 1024).toFixed(2), 'KB');

    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    if (!auth.currentUser) {
      throw new Error('User must be authenticated to upload transcript');
    }

    const storage = getStorage();
    
    // Create a unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;
    const storagePath = `transcripts/${userId}/${fileName}`;
    
    console.log('📁 Uploading file to storage path:', storagePath);
    
    // Upload file to Storage with timeout
    const storageRef = ref(storage, storagePath);
    
    console.log('⏳ Starting upload...');
    const uploadResult = await Promise.race([
      uploadBytes(storageRef, file),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout - please try again')), 60000)
      )
    ]);
    console.log('✅ File uploaded to storage');

    console.log('🔗 Getting download URL...');
    const fileUrl = await getDownloadURL(uploadResult.ref);
    console.log('✅ Download URL obtained:', fileUrl);

    console.log('💾 Creating Firestore document...');
    // Create transcript document
    const transcriptData: TranscriptData = {
      userId,
      fileName: file.name,
      originalFileName: file.name,
      fileSize: file.size,
      fileUrl,
      filePath: storagePath,
      transcriptPath: storagePath,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      status: 'complete',
    };

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'transcripts'), transcriptData);
    console.log('✅ Transcript metadata saved to Firestore with ID:', docRef.id);

    return {
      id: docRef.id,
      userId,
      fileName: file.name,
      originalFileName: file.name,
      fileSize: file.size,
      fileUrl,
      filePath: storagePath,
      transcriptPath: storagePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'complete',
    };
  } catch (error) {
    console.error('❌ Error uploading transcript:', error);
    
    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Upload timed out. Please check your internet connection and try again.');
      }
      if (error.message.includes('permission')) {
        throw new Error('Permission denied. Please check your Firebase Storage rules.');
      }
      if (error.message.includes('quota')) {
        throw new Error('Storage quota exceeded. Please contact support.');
      }
      throw error;
    }
    
    throw new Error(`Failed to upload transcript: ${getErrorMessage(error)}`);
  }
}

/**
 * Get all transcripts for a user
 */
export async function getUserTranscripts(userId: string): Promise<Transcript[]> {
  try {
    console.log('📋 Fetching transcripts for user:', userId);

    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    const transcriptsRef = collection(db, 'transcripts');
    const q = query(
      transcriptsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const transcripts: Transcript[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      transcripts.push({
        id: docSnapshot.id,
        userId: data.userId,
        fileName: data.fileName,
        originalFileName: data.originalFileName || data.fileName,
        fileSize: data.fileSize,
        fileUrl: data.fileUrl,
        filePath: data.filePath || data.transcriptPath,
        transcriptPath: data.transcriptPath || data.filePath,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp 
          ? data.updatedAt.toDate().toISOString() 
          : data.updatedAt,
        status: data.status || 'complete',
      });
    });

    console.log(`✅ Found ${transcripts.length} transcripts`);
    return transcripts;
  } catch (error) {
    console.error('❌ Error fetching transcripts:', error);
    throw new Error(`Failed to fetch transcripts: ${getErrorMessage(error)}`);
  }
}

/**
 * Get a specific transcript by ID
 */
export async function getTranscript(transcriptId: string): Promise<Transcript | null> {
  try {
    console.log('📄 Fetching transcript:', transcriptId);

    if (!db) {
      throw new Error('Firebase Firestore is not initialized');
    }

    const transcriptRef = doc(db, 'transcripts', transcriptId);
    const transcriptDoc = await getDoc(transcriptRef);

    if (!transcriptDoc.exists()) {
      console.log('❌ Transcript not found');
      return null;
    }

    const data = transcriptDoc.data();
    return {
      id: transcriptDoc.id,
      userId: data.userId,
      fileName: data.fileName,
      originalFileName: data.originalFileName || data.fileName,
      fileSize: data.fileSize,
      fileUrl: data.fileUrl,
      filePath: data.filePath || data.transcriptPath,
      transcriptPath: data.transcriptPath || data.filePath,
      createdAt: data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate().toISOString() 
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp 
        ? data.updatedAt.toDate().toISOString() 
        : data.updatedAt,
      status: data.status || 'complete',
    };
  } catch (error) {
    console.error('❌ Error fetching transcript:', error);
    throw new Error(`Failed to fetch transcript: ${getErrorMessage(error)}`);
  }
}

/**
 * Delete a transcript
 */
export async function deleteTranscript(transcriptId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting transcript:', transcriptId);

    if (!db || !auth.currentUser) {
      throw new Error('Database not initialized or user not authenticated');
    }

    // Get transcript data
    const transcriptRef = doc(db, 'transcripts', transcriptId);
    const transcriptDoc = await getDoc(transcriptRef);

    if (!transcriptDoc.exists()) {
      throw new Error('Transcript not found');
    }

    const data = transcriptDoc.data();

    // Verify ownership
    if (data.userId !== auth.currentUser.uid) {
      throw new Error('Unauthorized: Cannot delete transcript that belongs to another user');
    }

    // Delete file from Storage if it exists
    if (data.filePath || data.transcriptPath) {
      try {
        const storage = getStorage();
        const storageRef = ref(storage, data.filePath || data.transcriptPath);
        await deleteObject(storageRef);
        console.log('✅ File deleted from storage');
      } catch (storageError) {
        console.warn('⚠️ Could not delete file from storage:', storageError);
      }
    }

    // Delete Firestore document
    await deleteDoc(transcriptRef);
    console.log('✅ Transcript deleted from Firestore');
  } catch (error) {
    console.error('❌ Error deleting transcript:', error);
    throw new Error(`Failed to delete transcript: ${getErrorMessage(error)}`);
  }
}

/**
 * Update transcript metadata
 */
export async function updateTranscript(
  transcriptId: string,
  updates: Partial<Transcript>
): Promise<void> {
  try {
    console.log('📝 Updating transcript:', transcriptId);

    if (!db || !auth.currentUser) {
      throw new Error('Database not initialized or user not authenticated');
    }

    const transcriptRef = doc(db, 'transcripts', transcriptId);
    const transcriptDoc = await getDoc(transcriptRef);

    if (!transcriptDoc.exists()) {
      throw new Error('Transcript not found');
    }

    const data = transcriptDoc.data();
    if (data.userId !== auth.currentUser.uid) {
      throw new Error('Unauthorized: Cannot update transcript that belongs to another user');
    }

    await updateDoc(transcriptRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Transcript updated');
  } catch (error) {
    console.error('❌ Error updating transcript:', error);
    throw new Error(`Failed to update transcript: ${getErrorMessage(error)}`);
  }
}

// ============ UTILITY FUNCTIONS ============

// Create downloadable URL from base64 (for viewing PDFs)
export function createDownloadableUrl(base64Data: string): string {
  try {
    const [header, data] = base64Data.split(',');
    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    return URL.createObjectURL(blob);
  } catch (error: unknown) {
    console.error('Error creating downloadable URL:', error);
    return '';
  }
}

// Helper method to extract image from base64 data URL
export function getImageSrc(base64DataUrl: string): string {
  return base64DataUrl;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!auth.currentUser;
}

// Get current user ID
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

// Estimate document size
export function estimateDocumentSize(data: unknown): number {
  return JSON.stringify(data).length;
}

// Class export for backward compatibility
export class FirebaseService {
  // Resume methods
  static fileToBase64 = fileToBase64;
  static uploadResume = uploadResume;
  static saveResumeWithFiles = saveResumeWithFiles;
  static saveResume = saveResume;
  static getResume = getResume;
  static getUserResumes = getUserResumes;
  static deleteResume = deleteResume;
  static deleteResumeFile = deleteResumeFile;
  
  // Transcript methods
  static uploadTranscript = uploadTranscript;
  static getUserTranscripts = getUserTranscripts;
  static getTranscript = getTranscript;
  static deleteTranscript = deleteTranscript;
  static updateTranscript = updateTranscript;
  
  // Utility methods
  static createDownloadableUrl = createDownloadableUrl;
  static getImageSrc = getImageSrc;
  static isAuthenticated = isAuthenticated;
  static getCurrentUserId = getCurrentUserId;
  static estimateDocumentSize = estimateDocumentSize;
}

// Default export for flexibility
export default FirebaseService;