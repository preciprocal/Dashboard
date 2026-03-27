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
  deleteDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

// ── Import the SAME app instances that were configured with
//    experimentalForceLongPolling in firebase/client.ts.
//    Previously this file called getStorage() with no argument which
//    caused Firebase to create a second default app instance that
//    bypassed the long-polling config and opened its own WebChannel,
//    producing the CORS wildcard error on every Firestore operation.
import { auth, db, storage } from '@/firebase/client';
import { Resume, ResumeStatus } from '@/types/resume';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  [key: string]: unknown;
}

interface ResumeData extends Omit<Resume, 'createdAt'> {
  createdAt: Timestamp;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function toDate(value: string | Date | Timestamp): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date)      return value;
  return new Date(value);
}

function normalizeCreatedAt(value: unknown): Date {
  if (value instanceof Timestamp)           return value.toDate();
  if (value instanceof Date)                return value;
  if (typeof value === 'string')            return new Date(value);
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate();
  }
  return new Date();
}

// ─── Resume Functions ─────────────────────────────────────────────────────────

export async function uploadResume(userId: string, file: File): Promise<Resume> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');
    if (!auth.currentUser) throw new Error('User must be authenticated to upload resume');

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `resumes/${userId}/${timestamp}_${sanitizedFileName}`;
    const storageRef = ref(storage, storagePath);

    console.log('📤 Uploading resume to Storage:', storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const fileUrl = await getDownloadURL(storageRef);
    console.log('✅ Storage upload complete');

    const resumeData = {
      userId,
      fileName: file.name,
      originalFileName: file.name,
      fileUrl,
      resumePath: fileUrl,
      filePath: storagePath,
      fileSize: file.size,
      status: 'pending' as ResumeStatus,
      companyName: '',
      jobTitle: '',
      jobDescription: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'resumes'), resumeData);
    console.log('✅ Firestore record created:', docRef.id);

    return {
      id: docRef.id,
      userId,
      fileName: file.name,
      originalFileName: file.name,
      fileUrl,
      resumePath: fileUrl,
      filePath: storagePath,
      fileSize: file.size,
      status: 'pending',
      companyName: '',
      jobTitle: '',
      jobDescription: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error uploading resume:', error);
    throw new Error(`Failed to upload resume: ${getErrorMessage(error)}`);
  }
}

export async function saveResumeWithFiles(
  resume: Omit<Resume, 'imagePath' | 'resumePath'>,
  pdfFile: File,
): Promise<string> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');
    if (!auth.currentUser) throw new Error('User must be authenticated to save resume');

    const { id, userId } = resume;

    const pdfPath = `resumes/${userId}/${id}/resume.pdf`;
    const pdfRef  = ref(storage, pdfPath);
    console.log('📤 Uploading PDF to Storage:', pdfPath);
    await uploadBytes(pdfRef, pdfFile, { contentType: 'application/pdf' });
    const resumePath = await getDownloadURL(pdfRef);
    console.log('✅ PDF uploaded');

    const resumeRef  = doc(db, 'resumes', id);
    const resumeData: ResumeData = {
      ...resume,
      resumePath,
      imagePath: '',
      filePath: pdfPath,
      createdAt: Timestamp.fromDate(toDate(resume.createdAt as string | Date | Timestamp)),
    };

    await setDoc(resumeRef, resumeData);
    console.log('✅ Resume saved to Firestore:', id);

    return id;
  } catch (error) {
    console.error('❌ Error saving resume:', error);
    throw new Error(`Failed to save resume: ${getErrorMessage(error)}`);
  }
}

export async function saveResumeOnly(
  resume: Omit<Resume, 'imagePath' | 'resumePath'>,
): Promise<string> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');
    if (!auth.currentUser) throw new Error('User must be authenticated');

    const resumeRef  = doc(db, 'resumes', resume.id);
    const resumeData = {
      ...resume,
      resumePath: '',
      imagePath:  '',
      createdAt: Timestamp.fromDate(toDate(resume.createdAt as string | Date | Timestamp)),
    };

    await setDoc(resumeRef, resumeData);
    console.log('✅ Resume saved (Firestore-only, no PDF):', resume.id);
    return resume.id;
  } catch (error) {
    console.error('❌ Error in saveResumeOnly:', error);
    throw new Error(`Failed to save resume: ${getErrorMessage(error)}`);
  }
}

export async function saveResume(resume: Resume): Promise<void> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');
    if (!auth.currentUser) throw new Error('User must be authenticated to save resume');

    const resumeRef = doc(db, 'resumes', resume.id);
    await setDoc(resumeRef, {
      ...resume,
      createdAt: Timestamp.fromDate(toDate(resume.createdAt as string | Date | Timestamp)),
    });
    console.log('✅ Resume saved:', resume.id);
  } catch (error) {
    console.error('❌ Error saving resume:', error);
    throw new Error(`Failed to save resume: ${getErrorMessage(error)}`);
  }
}

export async function getResume(id: string): Promise<Resume | null> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');

    const snap = await getDoc(doc(db, 'resumes', id));
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      ...data,
      id: snap.id,
      createdAt: normalizeCreatedAt(data.createdAt),
    } as Resume;
  } catch (error) {
    console.error('❌ Error getting resume:', error);
    throw new Error('Failed to get resume');
  }
}

export async function getUserResumes(userId: string): Promise<Resume[]> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');

    const q = query(
      collection(db, 'resumes'),
      where('userId', '==', userId),
    );

    const snapshot = await getDocs(q);

    const resumes: Resume[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: normalizeCreatedAt(data.createdAt),
      } as Resume;
    });

    resumes.sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as string).getTime();
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as string).getTime();
      return tb - ta;
    });

    return resumes;
  } catch (error) {
    console.error('❌ Error getting user resumes:', error);
    throw new Error('Failed to get user resumes');
  }
}

export async function deleteResume(resumeId: string): Promise<void> {
  try {
    if (!db || !auth.currentUser) throw new Error('Database not initialized or user not authenticated');

    const resume = await getResume(resumeId);
    if (!resume) throw new Error('Resume not found');
    if (resume.userId !== auth.currentUser.uid) throw new Error('Unauthorized');

    await setDoc(doc(db, 'resumes', resumeId), { deleted: true, deletedAt: new Date() }, { merge: true });
    console.log('✅ Resume soft-deleted:', resumeId);
  } catch (error) {
    console.error('❌ Error deleting resume:', error);
    throw new Error('Failed to delete resume');
  }
}

export async function deleteResumeFile(resumeId: string, fileUrl: string): Promise<void> {
  try {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const urlParts = fileUrl.split('/o/')[1]?.split('?')[0];
    if (!urlParts) throw new Error('Invalid file URL');

    const fileRef = ref(storage, decodeURIComponent(urlParts));
    await deleteObject(fileRef);
    await deleteResume(resumeId);
    console.log('✅ Resume file deleted from Storage');
  } catch (error) {
    console.error('❌ Error deleting resume file:', error);
    throw new Error('Failed to delete resume file');
  }
}

// ─── Transcript Functions ─────────────────────────────────────────────────────

export async function uploadTranscript(userId: string, file: File): Promise<Transcript> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');
    if (!auth.currentUser) throw new Error('User must be authenticated to upload transcript');

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `transcripts/${userId}/${timestamp}_${sanitizedFileName}`;
    const storageRef = ref(storage, storagePath);

    console.log('📄 Uploading transcript:', storagePath);
    const uploadResult = await Promise.race([
      uploadBytes(storageRef, file),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timeout — please try again')), 60000),
      ),
    ]);

    const fileUrl = await getDownloadURL(uploadResult.ref);

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

    const docRef = await addDoc(collection(db, 'transcripts'), transcriptData);
    console.log('✅ Transcript saved:', docRef.id);

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
    if (error instanceof Error) {
      if (error.message.includes('timeout'))    throw new Error('Upload timed out. Check your connection and retry.');
      if (error.message.includes('permission')) throw new Error('Permission denied. Check Firebase Storage rules.');
      if (error.message.includes('quota'))      throw new Error('Storage quota exceeded. Contact support.');
      throw error;
    }
    throw new Error(`Failed to upload transcript: ${getErrorMessage(error)}`);
  }
}

export async function getUserTranscripts(userId: string): Promise<Transcript[]> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');

    const q = query(
      collection(db, 'transcripts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        fileName: data.fileName,
        originalFileName: data.originalFileName || data.fileName,
        fileSize: data.fileSize,
        fileUrl: data.fileUrl,
        filePath: data.filePath || data.transcriptPath,
        transcriptPath: data.transcriptPath || data.filePath,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        status: data.status || 'complete',
      } as Transcript;
    });
  } catch (error) {
    console.error('❌ Error fetching transcripts:', error);
    throw new Error(`Failed to fetch transcripts: ${getErrorMessage(error)}`);
  }
}

export async function getTranscript(transcriptId: string): Promise<Transcript | null> {
  try {
    if (!db) throw new Error('Firebase Firestore is not initialized');

    const snap = await getDoc(doc(db, 'transcripts', transcriptId));
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      id: snap.id,
      userId: data.userId,
      fileName: data.fileName,
      originalFileName: data.originalFileName || data.fileName,
      fileSize: data.fileSize,
      fileUrl: data.fileUrl,
      filePath: data.filePath || data.transcriptPath,
      transcriptPath: data.transcriptPath || data.filePath,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt,
      status: data.status || 'complete',
    };
  } catch (error) {
    console.error('❌ Error fetching transcript:', error);
    throw new Error(`Failed to fetch transcript: ${getErrorMessage(error)}`);
  }
}

export async function deleteTranscript(transcriptId: string): Promise<void> {
  try {
    if (!db || !auth.currentUser) throw new Error('Database not initialized or user not authenticated');

    const transcriptRef = doc(db, 'transcripts', transcriptId);
    const snap = await getDoc(transcriptRef);
    if (!snap.exists()) throw new Error('Transcript not found');

    const data = snap.data();
    if (data.userId !== auth.currentUser.uid) throw new Error('Unauthorized');

    if (data.filePath || data.transcriptPath) {
      try {
        await deleteObject(ref(storage, data.filePath || data.transcriptPath));
      } catch (storageError) {
        console.warn('⚠️ Could not delete file from storage:', storageError);
      }
    }

    await deleteDoc(transcriptRef);
    console.log('✅ Transcript deleted:', transcriptId);
  } catch (error) {
    console.error('❌ Error deleting transcript:', error);
    throw new Error(`Failed to delete transcript: ${getErrorMessage(error)}`);
  }
}

export async function updateTranscript(
  transcriptId: string,
  updates: Partial<Transcript>,
): Promise<void> {
  try {
    if (!db || !auth.currentUser) throw new Error('Database not initialized or user not authenticated');

    const transcriptRef = doc(db, 'transcripts', transcriptId);
    const snap = await getDoc(transcriptRef);
    if (!snap.exists()) throw new Error('Transcript not found');
    if (snap.data().userId !== auth.currentUser.uid) throw new Error('Unauthorized');

    await updateDoc(transcriptRef, { ...updates, updatedAt: serverTimestamp() });
    console.log('✅ Transcript updated:', transcriptId);
  } catch (error) {
    console.error('❌ Error updating transcript:', error);
    throw new Error(`Failed to update transcript: ${getErrorMessage(error)}`);
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

export function createDownloadableUrl(pathOrBase64: string): string {
  if (pathOrBase64.startsWith('https://') || pathOrBase64.startsWith('http://')) {
    return pathOrBase64;
  }
  try {
    const [header, data] = pathOrBase64.split(',');
    const mimeType    = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    const byteChars   = atob(data);
    const byteArray   = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    return URL.createObjectURL(new Blob([byteArray], { type: mimeType }));
  } catch (error) {
    console.error('Error creating downloadable URL:', error);
    return '';
  }
}

export function getImageSrc(base64DataUrl: string): string    { return base64DataUrl; }
export function isAuthenticated(): boolean                    { return !!auth.currentUser; }
export function getCurrentUserId(): string | null             { return auth.currentUser?.uid || null; }
export function estimateDocumentSize(data: unknown): number   { return JSON.stringify(data).length; }

// ─── Class export (backward compatibility) ───────────────────────────────────

export class FirebaseService {
  static uploadResume          = uploadResume;
  static saveResumeWithFiles   = saveResumeWithFiles;
  static saveResumeOnly        = saveResumeOnly;
  static saveResume            = saveResume;
  static getResume             = getResume;
  static getUserResumes        = getUserResumes;
  static deleteResume          = deleteResume;
  static deleteResumeFile      = deleteResumeFile;

  static uploadTranscript      = uploadTranscript;
  static getUserTranscripts    = getUserTranscripts;
  static getTranscript         = getTranscript;
  static deleteTranscript      = deleteTranscript;
  static updateTranscript      = updateTranscript;

  static createDownloadableUrl = createDownloadableUrl;
  static getImageSrc           = getImageSrc;
  static isAuthenticated       = isAuthenticated;
  static getCurrentUserId      = getCurrentUserId;
  static estimateDocumentSize  = estimateDocumentSize;
}

export default FirebaseService;