// lib/firebase-service.ts
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '@/firebase/client';
import { Resume } from '@/types/resume';

export class FirebaseService {
  // Convert file to base64 data URL (similar to your interview form approach)
  static async fileToBase64(file: File): Promise<string> {
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

  // Save resume with embedded base64 files (no external storage needed)
  static async saveResumeWithFiles(
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
      const pdfBase64 = await this.fileToBase64(pdfFile);
      
      console.log('🖼️ Converting image to base64...');
      const imageBase64 = await this.fileToBase64(imageFile);

      const resumeRef = doc(db, 'resumes', resume.id);
      const resumeData = {
        ...resume,
        // Store files as base64 data URLs
        imagePath: imageBase64, // data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
        resumePath: pdfBase64,   // data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8...
        createdAt: Timestamp.fromDate(resume.createdAt),
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
        hasPdfData: resumeData.resumePath.startsWith('data:'),
        hasImageData: resumeData.imagePath.startsWith('data:'),
        pdfSize: resumeData.fileMetadata.pdfSize,
        imageSize: resumeData.fileMetadata.imageSize,
      });
      
      await setDoc(resumeRef, resumeData);
      console.log('✅ Resume saved successfully to Firestore');
      
      return resume.id;
    } catch (error) {
      console.error('❌ Error saving resume:', error);
      throw new Error(`Failed to save resume: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  // Alternative: Save resume to Firestore (existing method)
  static async saveResume(resume: Resume): Promise<void> {
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
        createdAt: Timestamp.fromDate(resume.createdAt),
      };
      
      await setDoc(resumeRef, resumeData);
      console.log('✅ Resume saved successfully to Firestore');
    } catch (error) {
      console.error('❌ Error saving resume:', error);
      throw new Error(`Failed to save resume: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  // Get resume by ID
  static async getResume(id: string): Promise<Resume | null> {
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
          createdAt: data.createdAt.toDate(),
        } as Resume;
      } else {
        console.log('❌ Resume not found');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting resume:', error);
      throw new Error('Failed to get resume');
    }
  }

  // Get all resumes for a user
  static async getUserResumes(userId: string): Promise<Resume[]> {
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
      const resumes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt.toDate(),
        };
      }) as Resume[];

      console.log('✅ Found', resumes.length, 'resumes for user');
      return resumes;
    } catch (error) {
      console.error('❌ Error getting user resumes:', error);
      throw new Error('Failed to get user resumes');
    }
  }

  // Create downloadable URL from base64 (for viewing PDFs)
  static createDownloadableUrl(base64Data: string, filename: string): string {
    try {
      // Convert base64 data URL back to blob
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
    } catch (error) {
      console.error('Error creating downloadable URL:', error);
      return '';
    }
  }

  // Helper method to extract image from base64 data URL
  static getImageSrc(base64DataUrl: string): string {
    // Data URLs can be used directly as src
    return base64DataUrl;
  }

  // Delete resume (no storage cleanup needed)
  static async deleteResume(resumeId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting resume:', resumeId);
      
      if (!db || !auth.currentUser) {
        throw new Error('Database not initialized or user not authenticated');
      }

      // Verify ownership before deletion
      const resume = await this.getResume(resumeId);
      if (!resume) {
        throw new Error('Resume not found');
      }

      if (resume.userId !== auth.currentUser.uid) {
        throw new Error('Unauthorized: Cannot delete resume that belongs to another user');
      }

      const resumeRef = doc(db, 'resumes', resumeId);
      await setDoc(resumeRef, { deleted: true, deletedAt: new Date() }, { merge: true });
      
      console.log('✅ Resume marked as deleted');
    } catch (error) {
      console.error('❌ Error deleting resume:', error);
      throw new Error('Failed to delete resume');
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    return !!auth.currentUser;
  }

  // Get current user ID
  static getCurrentUserId(): string | null {
    return auth.currentUser?.uid || null;
  }

  // Estimate document size (helpful for Firestore limits)
  static estimateDocumentSize(data: any): number {
    return JSON.stringify(data).length;
  }
}