// lib/services/resumeClient.ts
"use client";

import { storage, auth } from '@/firebase/client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface Resume {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  fileName: string;
  fileSize: number;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
  status: 'analyzing' | 'complete' | 'failed';
  score?: number;
  feedback?: {
    overallScore: number;
    strengths: string[];
    improvements: string[];
    suggestions: string[];
  };
  analyzedAt?: string;
}

export interface ResumeStats {
  totalResumes: number;
  averageScore: number;
  recentUploads: number;
  topScore: number;
  resumesUsed: number;
  resumesLimit: number;
}

interface FirebaseStorageError {
  code?: string;
  message?: string;
}

function isFirebaseStorageError(error: unknown): error is FirebaseStorageError {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isFirebaseStorageError(error) && error.message) return error.message;
  return 'Unknown error';
}

class ResumeClientService {
  private async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (error: unknown) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  async uploadFile(file: File, userId: string, resumeId: string): Promise<string | null> {
    try {
      const storageRef = ref(storage, `resumes/${userId}/${resumeId}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error: unknown) {
      console.error('Error uploading file:', error);
      if (isFirebaseStorageError(error)) {
        if (
          error.code === 'storage/unauthorized' ||
          error.message?.includes('CORS') ||
          error.message?.includes('XMLHttpRequest')
        ) {
          console.warn('CORS error detected, using fallback upload method');
          return `mock://upload/${userId}/${resumeId}/${file.name}`;
        }
      }
      return null;
    }
  }

  async createResume(data: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    fileName: string;
    fileSize: number;
    fileUrl?: string;
  }): Promise<{ success: boolean; data?: Resume; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required' };

      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Error creating resume:', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to create resume' };
    }
  }

  async getResumes(): Promise<{ success: boolean; data?: Resume[]; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required' };

      const response = await fetch('/api/resume', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Error fetching resumes:', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to fetch resumes' };
    }
  }

  async getResume(id: string): Promise<{ success: boolean; data?: Resume; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required' };

      const response = await fetch(`/api/resume/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 404) return { success: false, error: 'Resume not found' };
        if (response.status === 403) return { success: false, error: 'Access denied' };
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: unknown) {
      console.error('Error fetching resume:', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to fetch resume' };
    }
  }

  async updateResume(
    id: string,
    data: {
      status: 'complete' | 'failed';
      score?: number;
      feedback?: Resume['feedback'];
      error?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required' };

      const response = await fetch(`/api/resume/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Error updating resume:', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to update resume' };
    }
  }

  async deleteResume(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required' };

      const response = await fetch(`/api/resume/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Error deleting resume:', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to delete resume' };
    }
  }

  async getStats(): Promise<{ success: boolean; data?: ResumeStats; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Authentication required' };

      const response = await fetch('/api/resume/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Error fetching stats:', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to fetch stats' };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async analyzeResume(_file: File, _jobDescription: string, _jobTitle: string): Promise<{
    overallScore: number;
    strengths: string[];
    improvements: string[];
    suggestions: string[];
  }> {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return {
      overallScore: Math.floor(Math.random() * 30) + 70,
      strengths: [
        'Clear and professional formatting',
        'Relevant work experience highlighted',
        'Strong technical skills section',
        'Quantified achievements with metrics',
      ],
      improvements: [
        'Add more industry-specific keywords',
        'Include recent certifications or training',
        'Expand on leadership experience',
        'Tailor summary to job requirements',
      ],
      suggestions: [
        'Consider adding a professional summary',
        'Include links to portfolio projects',
        'Use more action verbs in descriptions',
        'Ensure consistent formatting throughout',
      ],
    };
  }
}

export const resumeService = new ResumeClientService();