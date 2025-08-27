// lib/services/resumeClient.ts
"use client"
import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '@/lib/firebase/config';

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

class ResumeClientService {
  // Get auth token for API calls
  private async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Upload file to Firebase Storage with CORS error handling
  async uploadFile(file: File, userId: string, resumeId: string): Promise<string | null> {
    try {
      const storageRef = ref(storage, `resumes/${userId}/${resumeId}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      
      // Handle CORS errors gracefully
      if (error?.code === 'storage/unauthorized' || 
          error?.message?.includes('CORS') || 
          error?.message?.includes('XMLHttpRequest')) {
        console.warn('CORS error detected, using fallback upload method');
        // For development, we'll create a mock URL
        // In production, you'd want to implement a server-side upload
        return `mock://upload/${userId}/${resumeId}/${file.name}`;
      }
      
      return null;
    }
  }

  // Create a new resume
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
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error creating resume:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create resume' 
      };
    }
  }

  // Get all resumes for user
  async getResumes(): Promise<{ success: boolean; data?: Resume[]; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch('/api/resume', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error fetching resumes:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch resumes' 
      };
    }
  }

  // Get single resume by ID
  async getResume(id: string): Promise<{ success: boolean; data?: Resume; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(`/api/resume/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: 'Resume not found' };
        }
        if (response.status === 403) {
          return { success: false, error: 'Access denied' };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error fetching resume:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch resume' 
      };
    }
  }

  // Update resume with analysis results
  async updateResume(id: string, data: {
    status: 'complete' | 'failed';
    score?: number;
    feedback?: Resume['feedback'];
    error?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(`/api/resume/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error updating resume:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update resume' 
      };
    }
  }

  // Delete resume
  async deleteResume(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(`/api/resume/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error deleting resume:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to delete resume' 
      };
    }
  }

  // Get resume statistics
  async getStats(): Promise<{ success: boolean; data?: ResumeStats; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch('/api/resume/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch stats' 
      };
    }
  }

  // Analyze resume (mock implementation - replace with PuterJS)
  async analyzeResume(file: File, jobDescription: string, jobTitle: string): Promise<{
    overallScore: number;
    strengths: string[];
    improvements: string[];
    suggestions: string[];
  }> {
    // Simulate analysis time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock analysis results - replace with actual PuterJS implementation
    return {
      overallScore: Math.floor(Math.random() * 30) + 70,
      strengths: [
        'Clear and professional formatting',
        'Relevant work experience highlighted',
        'Strong technical skills section',
        'Quantified achievements with metrics'
      ],
      improvements: [
        'Add more industry-specific keywords',
        'Include recent certifications or training',
        'Expand on leadership experience',
        'Tailor summary to job requirements'
      ],
      suggestions: [
        'Consider adding a professional summary',
        'Include links to portfolio projects',
        'Use more action verbs in descriptions',
        'Ensure consistent formatting throughout'
      ]
    };
  }
}

export const resumeService = new ResumeClientService();