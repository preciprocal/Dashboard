// app/resume/recruiter-eye/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import { Resume } from '@/types/resume';
import RecruiterEyeSimulation from '@/components/resume/RecruiterEyeSimulation';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import { AlertCircle, ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';

const loadingSteps: LoadingStep[] = [
  { name: 'Authenticating user...', weight: 1 },
  { name: 'Loading profile data...', weight: 2 },
  { name: 'Fetching resume...', weight: 2 },
  { name: 'Preparing analysis...', weight: 1 }
];

export default function RecruiterEyePage() {
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const loadProfileResume = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setLoadingStep(0);

        console.log('=== RECRUITER EYE PAGE DEBUG ===');
        console.log('User ID:', user.uid);

        // Step 1: Get user profile
        setLoadingStep(1);
        const idToken = await user.getIdToken();
        const profileResponse = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!profileResponse.ok) {
          throw new Error('Failed to load profile');
        }

        const { user: profileData } = await profileResponse.json();
        console.log('Profile data:', profileData);
        console.log('Current resume ID from profile:', profileData.currentResume);
        
        // Step 2: Check if user has a resume set
        setLoadingStep(2);
        if (!profileData.currentResume) {
          setError('No resume selected in your profile. Please go to your profile and select a resume first.');
          setDebugInfo(`Profile loaded but currentResume is: ${profileData.currentResume}`);
          setIsLoading(false);
          return;
        }

        // Step 3: Fetch the resume
        setLoadingStep(3);
        console.log('Fetching resume with ID:', profileData.currentResume);
        const resumeData = await FirebaseService.getResume(profileData.currentResume);
        console.log('Resume data received:', resumeData);

        if (!resumeData) {
          // Try to fetch all user resumes to debug
          const allResumes = await FirebaseService.getUserResumes(user.uid);
          console.log('All user resumes:', allResumes);
          console.log('Total resumes found:', allResumes.length);
          
          setError('Resume not found. Please select a valid resume in your profile.');
          setDebugInfo(`Resume ID: ${profileData.currentResume}, Found ${allResumes.length} total resumes for user`);
          setIsLoading(false);
          return;
        }

        console.log('✅ Resume loaded successfully:', resumeData.fileName);
        setResume(resumeData);
        setLoadingStep(4);
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (err) {
        console.error('Error loading profile resume:', err);
        setError(err instanceof Error ? err.message : 'Failed to load resume');
        setDebugInfo(err instanceof Error ? err.stack || err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadProfileResume();
    }
  }, [user, router]);

  if (authLoading || isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your resume for analysis..."
        showNavigation={false}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Please log in to use recruiter analysis</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Resume Not Found</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-4">{error}</p>
            {debugInfo && (
              <details className="text-left mb-6">
                <summary className="text-xs text-slate-500 cursor-pointer mb-2">Debug Info</summary>
                <pre className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded overflow-auto max-h-32">
                  {debugInfo}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <Link 
                href="/profile"
                className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
              >
                Go to Profile
              </Link>
              <Link 
                href="/resume"
                className="glass-button hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white"
              >
                View Resumes
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">No Resume Selected</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">
              Please select a resume in your profile to use this feature
            </p>
            <Link 
              href="/profile"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              Go to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass-card hover-lift mb-6">
        <div className="p-6">
          <Link 
            href="/resume" 
            className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resumes
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center shadow-glass">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Recruiter Analysis</h1>
              <p className="text-sm text-slate-400">For: {resume.fileName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Simulation Component */}
      <RecruiterEyeSimulation 
        resumeId={resume.id} 
        imageUrl={resume.imagePath || ''} 
      />
    </div>
  );
}