// // app/resume/[id]/page.tsx
// 'use client';

// import React, { useState, useEffect } from 'react';
// import { useParams, useRouter } from 'next/navigation';
// import Link from 'next/link';
// import { useAuthState } from 'react-firebase-hooks/auth';
// import { auth } from '@/firebase/client';
// import { FirebaseService } from '@/lib/services/firebase-service';
// import { Resume } from '@/types/resume';
// import { 
//   ArrowLeft, 
//   Download, 
//   Eye, 
//   FileText, 
//   Building2, 
//   Briefcase,
//   Target,
//   CheckCircle2,
//   Shield,
//   Edit3,
//   Star,
//   TrendingUp,
//   Calendar,
//   Loader2
// } from 'lucide-react';
// import { DetailedAnalysisSection } from '@/components/resume/DetailedAnalysisSection';
// import { ImprovementRoadmap } from '@/components/resume/ImprovementRoadmap';
// import { OverallScoreHero } from './OverallScorehero';
// import Image from 'next/image';

// export default function ResumeDetailsPage() {
//   const params = useParams();
//   const router = useRouter();
//   const [user, loading] = useAuthState(auth);
  
//   const [resume, setResume] = useState<Resume | null>(null);
//   const [loadingResume, setLoadingResume] = useState(true);
//   const [error, setError] = useState<string>('');
//   const [imageUrl, setImageUrl] = useState<string>('');

//   // Load resume data
//   useEffect(() => {
//     const loadResume = async () => {
//       if (!params.id || typeof params.id !== 'string') {
//         setError('Invalid resume ID');
//         setLoadingResume(false);
//         return;
//       }
      
//       try {
//         console.log('🔍 Loading resume:', params.id);
//         const resumeData = await FirebaseService.getResume(params.id);
        
//         if (!resumeData) {
//           setError('Resume not found');
//           setResume(null);
//         } else if (user && resumeData.userId !== user.uid) {
//           setError('You do not have permission to view this resume');
//           setResume(null);
//         } else {
//           console.log('✅ Resume loaded successfully');
//           setResume(resumeData);
          
//           // Load image preview if available
//           if (resumeData.imagePath) {
//             console.log('🖼️ Setting image URL from imagePath');
//             setImageUrl(resumeData.imagePath);
//           }
//         }
//       } catch (error) {
//         console.error('❌ Error loading resume:', error);
//         setError('Failed to load resume');
//         setResume(null);
//       } finally {
//         setLoadingResume(false);
//       }
//     };

//     if (user) {
//       loadResume();
//     } else if (!loading) {
//       setLoadingResume(false);
//     }
//   }, [params.id, user, loading]);

//   // Download PDF handler
//   const handleDownloadPdf = () => {
//     if (!resume?.resumePath) {
//       alert('PDF file not available');
//       return;
//     }

//     try {
//       if (resume.resumePath.startsWith('data:')) {
//         const downloadUrl = FirebaseService.createDownloadableUrl(
//           resume.resumePath, 
//           resume.originalFileName || `resume_${resume.id}.pdf`
//         );
        
//         const link = document.createElement('a');
//         link.href = downloadUrl;
//         link.download = resume.originalFileName || `resume_${resume.id}.pdf`;
//         document.body.appendChild(link);
//         link.click();
//         document.body.removeChild(link);
        
//         setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
//       } else {
//         const link = document.createElement('a');
//         link.href = resume.resumePath;
//         link.download = resume.originalFileName || `resume_${resume.id}.pdf`;
//         link.target = '_blank';
//         document.body.appendChild(link);
//         link.click();
//         document.body.removeChild(link);
//       }
//     } catch (error) {
//       console.error('Download failed:', error);
//       alert('Failed to download PDF');
//     }
//   };

//   // View PDF handler
//   const handleViewPdf = () => {
//     if (!resume?.resumePath) {
//       alert('PDF file not available');
//       return;
//     }

//     try {
//       if (resume.resumePath.startsWith('data:')) {
//         const viewUrl = FirebaseService.createDownloadableUrl(
//           resume.resumePath, 
//           resume.originalFileName || `resume_${resume.id}.pdf`
//         );
//         window.open(viewUrl, '_blank');
//       } else {
//         window.open(resume.resumePath, '_blank');
//       }
//     } catch (error) {
//       console.error('View failed:', error);
//       alert('Failed to view PDF');
//     }
//   };

//   // Loading state
//   if (loading || loadingResume) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
//         <div className="text-center">
//           <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
//           <p className="mt-4 text-gray-600 dark:text-gray-400">
//             Loading comprehensive analysis...
//           </p>
//         </div>
//       </div>
//     );
//   }

//   // Auth check
//   if (!user) {
//     router.push('/auth');
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="text-center">
//           <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
//           <p className="text-gray-600">Redirecting to login...</p>
//         </div>
//       </div>
//     );
//   }

//   // Error or Not Found
//   if (error || !resume) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
//         <div className="text-center max-w-md mx-auto px-6">
//           <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
//             <FileText className="w-10 h-10 text-red-600 dark:text-red-400" />
//           </div>
//           <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
//             {error || 'Resume Not Found'}
//           </h1>
//           <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
//             {error === 'You do not have permission to view this resume' 
//               ? 'This resume belongs to another user.'
//               : 'This resume analysis doesn\'t exist or has been deleted.'}
//           </p>
//           <Link 
//             href="/resume" 
//             className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
//           >
//             <ArrowLeft className="w-4 h-4 mr-2" />
//             Back to Dashboard
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   const feedback = resume.feedback;

//   return (
//     <div className="h-screen flex overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
//       {/* Resume Preview Panel - Fixed Left Side */}
//       <div className="w-2/5 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 h-screen flex flex-col">
//         <div className="p-6 flex-1 flex flex-col min-h-0">
//           {/* Preview Header */}
//           <div className="mb-6 flex-shrink-0">
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resume Preview</h2>
//               <div className="flex items-center gap-2">
//                 <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
//                 <span className="text-sm text-slate-600 dark:text-slate-400">Live Preview</span>
//               </div>
//             </div>
//           </div>

//           {/* Preview Content - Centered, No Scroll */}
//           <div className="flex-1 flex flex-col justify-center items-center min-h-0">
//             <div className="w-full max-w-md">
//               {imageUrl && imageUrl.startsWith('data:image') ? (
//                 <div className="mb-4">
//                   <Image
//                     src={imageUrl}
//                     alt="Resume preview"
//                     className="w-full rounded-2xl shadow-xl border border-slate-200 dark:border-slate-600 max-h-[calc(100vh-300px)] object-contain"
//                     onError={() => {
//                       console.error('❌ Image failed to load');
//                       setImageUrl('');
//                     }}
//                     onLoad={() => {
//                       console.log('✅ Image loaded successfully');
//                     }}
//                   />
//                 </div>
//               ) : (
//                 <div className="w-full aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 mb-4 max-h-[calc(100vh-300px)]">
//                   <div className="text-center px-4">
//                     <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
//                     <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">
//                       {resume.originalFileName || resume.fileName || 'Resume.pdf'}
//                     </p>
//                     <p className="text-xs text-slate-400 mb-2">
//                       {resume.fileSize ? `${(resume.fileSize / 1024).toFixed(1)} KB` : 'Preview not available'}
//                     </p>
//                     <p className="text-xs text-slate-400">
//                       Click &quot;View Full Document&quot; below
//                     </p>
//                   </div>
//                 </div>
//               )}
              
//               {/* Action Buttons - Fixed at bottom */}
//               <div className="flex flex-col space-y-2 w-full flex-shrink-0">
//                 <button 
//                   onClick={handleViewPdf}
//                   disabled={!resume.resumePath}
//                   className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   <Eye className="w-5 h-5 mr-2" />
//                   View Full Document
//                 </button>
//                 <button 
//                   onClick={handleDownloadPdf}
//                   disabled={!resume.resumePath}
//                   className="w-full flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   <Download className="w-5 h-5 mr-2" />
//                   Download PDF
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Main Analysis Content - Scrollable Right Panel */}
//       <div className="w-3/5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-y-auto h-screen scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
//         <div className="min-h-full">
//           <div className="p-6 lg:p-8">
//             {/* Header Section */}
//             <div className="mb-8">
//               <div className="flex items-center justify-between mb-8">
//                 <div className="flex items-center space-x-6">
//                   <Link 
//                     href="/resume" 
//                     className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
//                   >
//                     <ArrowLeft className="w-4 h-4 mr-2" />
//                     Back to Dashboard
//                   </Link>
                  
//                   <div className="h-8 border-l border-slate-300 dark:border-slate-600"></div>
                  
//                   <div className="flex-1">
//                     <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Resume Analysis Report</h1>
//                     <p className="text-sm text-slate-600 dark:text-slate-400">Comprehensive AI-powered evaluation</p>
//                   </div>
//                 </div>
                
//                 <div className="text-right">
//                   <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-700 mb-2">
//                     <CheckCircle2 className="w-4 h-4" />
//                     <span className="font-semibold text-sm">Analysis Complete</span>
//                   </div>
//                   <p className="text-xs text-slate-500 dark:text-slate-400">
//                     {new Date(resume.createdAt).toLocaleDateString('en-US', { 
//                       month: 'short', 
//                       day: 'numeric', 
//                       year: 'numeric' 
//                     })}
//                   </p>
//                 </div>
//               </div>
              
//               {/* Application Target Card */}
//               {(resume.companyName || resume.jobTitle) && (
//                 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
//                   <div className="flex items-center space-x-4">
//                     <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
//                       <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
//                     </div>
//                     <div className="flex-1">
//                       <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
//                         Application Target
//                       </h3>
//                       <div className="flex flex-wrap items-center gap-3">
//                         {resume.jobTitle && (
//                           <div className="inline-flex items-center px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30">
//                             <Briefcase className="w-4 h-4 mr-2" />
//                             {resume.jobTitle}
//                           </div>
//                         )}
//                         {resume.companyName && (
//                           <div className="inline-flex items-center px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
//                             <Building2 className="w-4 h-4 mr-2" />
//                             {resume.companyName}
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>

//             {/* Overall Score Hero - Using New Component */}
//             <OverallScoreHero score={feedback?.overallScore || 0} />

//             {/* Analysis Sections - Using New Component */}
//             {feedback && (
//               <div className="space-y-6 mb-8 mt-8">
//                 <DetailedAnalysisSection
//                   title="ATS Compatibility"
//                   description="How well your resume works with applicant tracking systems"
//                   score={feedback.ATS?.score || feedback.ats?.score || 0}
//                   tips={feedback.ATS?.tips || feedback.ats?.tips || []}
//                   sectionData={feedback.ATS || feedback.ats}
//                   icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                 />

//                 <DetailedAnalysisSection
//                   title="Content Quality"
//                   description="The relevance, depth, and impact of your resume content"
//                   score={feedback.content?.score || 0}
//                   tips={feedback.content?.tips || []}
//                   sectionData={feedback.content}
//                   icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                 />

//                 <DetailedAnalysisSection
//                   title="Structure & Format"
//                   description="The organization, layout, and visual appeal of your resume"
//                   score={feedback.structure?.score || 0}
//                   tips={feedback.structure?.tips || []}
//                   sectionData={feedback.structure}
//                   icon={<Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                 />

//                 <DetailedAnalysisSection
//                   title="Skills & Keywords"
//                   description="Relevance and presentation of your technical and soft skills"
//                   score={feedback.skills?.score || 0}
//                   tips={feedback.skills?.tips || []}
//                   sectionData={feedback.skills}
//                   icon={<Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                 />

//                 {feedback.toneAndStyle && (
//                   <DetailedAnalysisSection
//                     title="Tone & Style"
//                     description="Professional writing style and communication effectiveness"
//                     score={feedback.toneAndStyle.score}
//                     tips={feedback.toneAndStyle.tips}
//                     sectionData={feedback.toneAndStyle}
//                     icon={<Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                   />
//                 )}

//                 {feedback.impact && (
//                   <DetailedAnalysisSection
//                     title="Impact & Metrics"
//                     description="Use of quantifiable achievements and business impact"
//                     score={feedback.impact.score}
//                     tips={feedback.impact.tips}
//                     sectionData={feedback.impact}
//                     icon={<TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                   />
//                 )}

//                 {feedback.dates && (
//                   <DetailedAnalysisSection
//                     title="Date Analysis"
//                     description="Employment dates, consistency, and gap analysis"
//                     score={feedback.dates.score}
//                     tips={feedback.dates.tips}
//                     sectionData={feedback.dates}
//                     icon={<Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
//                   />
//                 )}

//                 {/* Improvement Roadmap - Using New Component */}
//                 {feedback.improvementRoadmap && (
//                   <ImprovementRoadmap roadmap={feedback.improvementRoadmap} />
//                 )}
//               </div>
//             )}

//             {/* Action Buttons */}
//             <div className="text-center pb-8">
//               <div className="inline-flex flex-col sm:flex-row items-center gap-4">
//                 <Link
//                   href="/resume/upload"
//                   className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
//                 >
//                   <FileText className="w-5 h-5 mr-2" />
//                   Analyze Another Resume
//                 </Link>
                
//                 <Link
//                   href="/resume"
//                   className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
//                 >
//                   <ArrowLeft className="w-5 h-5 mr-2" />
//                   View All Analyses
//                 </Link>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }