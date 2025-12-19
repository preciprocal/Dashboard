// import React, { useState } from "react";
// import Link from "next/link";
// import { Button } from "@/components/ui/button";
// import ProfileInterviewCard from "@/components/ProfileInterviewCard";
// import {
//   FileText,
//   TrendingUp,
//   Calendar,
//   Award,
//   Target,
//   BarChart3,
//   BookOpen,
//   Clock,
//   Filter,
// } from "lucide-react";

// interface Interview {
//   id: string;
//   type: string;
//   status?: string;
//   score?: number;
//   createdAt: Date | string;
//   feedback?: Record<string, unknown>;
// }

// interface Stats {
//   averageScore?: number;
// }

// interface ProfileInterviewsProps {
//   interviews: Interview[];
//   stats: Stats;
// }

// interface StatConfig {
//   icon: React.ElementType;
//   value: number | string;
//   label: string;
//   color: string;
// }

// const ProfileInterviews: React.FC<ProfileInterviewsProps> = ({
//   interviews,
//   stats,
// }) => {
//   const [interviewFilters, setInterviewFilters] = useState({
//     type: "all",
//     status: "all",
//     sortBy: "date",
//   });

//   const filteredInterviews = interviews
//     .filter((interview) => {
//       if (
//         interviewFilters.type !== "all" &&
//         interview.type !== interviewFilters.type
//       )
//         return false;
//       if (
//         interviewFilters.status !== "all" &&
//         (interview.status || "completed") !== interviewFilters.status
//       )
//         return false;
//       return true;
//     })
//     .sort((a, b) => {
//       if (interviewFilters.sortBy === "date") {
//         const dateA =
//           a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
//         const dateB =
//           b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
//         return dateB.getTime() - dateA.getTime();
//       } else if (interviewFilters.sortBy === "score") {
//         return (b.score || 0) - (a.score || 0);
//       }
//       return 0;
//     });

//   const hasInterviews = interviews.length > 0;
//   const totalInterviews = interviews.length;
//   const thisMonthInterviews = interviews.filter((interview) => {
//     const interviewDate =
//       interview.createdAt instanceof Date
//         ? interview.createdAt
//         : new Date(interview.createdAt);
//     const currentDate = new Date();
//     return (
//       interviewDate.getMonth() === currentDate.getMonth() &&
//       interviewDate.getFullYear() === currentDate.getFullYear()
//     );
//   }).length;
//   const lastInterviewDate =
//     interviews.length > 0
//       ? interviews[0]?.createdAt instanceof Date
//         ? interviews[0].createdAt
//         : new Date(interviews[0].createdAt)
//       : null;
//   const averageScore = stats?.averageScore || 0;

//   const statsConfig: StatConfig[] = [
//     {
//       icon: FileText,
//       value: totalInterviews,
//       label: "Total Interviews",
//       color: "blue",
//     },
//     {
//       icon: TrendingUp,
//       value: thisMonthInterviews,
//       label: "This Month",
//       color: "emerald",
//     },
//     {
//       icon: Calendar,
//       value: lastInterviewDate
//         ? lastInterviewDate.toLocaleDateString("en-US", {
//             month: "short",
//             day: "numeric",
//           })
//         : "N/A",
//       label: "Last Interview",
//       color: "purple",
//     },
//     {
//       icon: Award,
//       value: averageScore,
//       label: "Average Score",
//       color: "amber",
//     },
//   ];

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="glass-card hover-lift">
//         <div className="p-6">
//           <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
//             <div>
//               <h1 className="text-3xl font-semibold text-white mb-2">
//                 Interview History
//               </h1>
//               <p className="text-slate-400">
//                 Track your progress and analyze performance
//               </p>
//             </div>
//             <div className="flex gap-3">
//               <Button className="bg-white/5 hover:bg-white/10 text-white border border-white/10">
//                 <BarChart3 className="h-4 w-4 mr-2" />
//                 Analytics
//               </Button>
//               <Button
//                 asChild
//                 className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
//               >
//                 <Link href="/createinterview">
//                   <Target className="h-4 w-4 mr-2" />
//                   New Interview
//                 </Link>
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Key Metrics */}
//       {hasInterviews && (
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//           {statsConfig.map((stat, index) => (
//             <div key={index} className="glass-card hover-lift">
//               <div className="p-5">
//                 <div className="flex items-center justify-between mb-3">
//                   <div className={`w-10 h-10 bg-${stat.color}-500/10 rounded-lg flex items-center justify-center`}>
//                     <stat.icon className={`h-5 w-5 text-${stat.color}-400`} />
//                   </div>
//                   <div className="text-right">
//                     <div className="text-2xl font-semibold text-white">
//                       {stat.value}
//                     </div>
//                   </div>
//                 </div>
//                 <div className="text-sm text-slate-400">{stat.label}</div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       {/* Interview Management */}
//       <div className="glass-card">
//         <div className="p-6 border-b border-white/5">
//           <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
//             <div className="flex items-center gap-4">
//               <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
//                 <Clock className="h-5 w-5 text-blue-400" />
//               </div>
//               <div>
//                 <h2 className="text-lg font-semibold text-white mb-1">
//                   Interview Sessions
//                 </h2>
//                 <p className="text-slate-400 text-sm">
//                   {hasInterviews
//                     ? `${interviews.length} interview${
//                         interviews.length !== 1 ? "s" : ""
//                       } completed`
//                     : "No interviews yet"}
//                 </p>
//               </div>
//             </div>
//             {hasInterviews && (
//               <span className="text-sm text-slate-400">
//                 {filteredInterviews.length} of {interviews.length} shown
//               </span>
//             )}
//           </div>
//         </div>

//         {/* Filters */}
//         {hasInterviews && (
//           <div className="p-6 border-b border-white/5">
//             <div className="flex items-center mb-4">
//               <Filter className="h-5 w-5 text-slate-400 mr-2" />
//               <h3 className="text-base font-semibold text-white">
//                 Filter & Sort
//               </h3>
//             </div>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               {[
//                 {
//                   label: "Interview Type",
//                   value: interviewFilters.type,
//                   onChange: (value: string) =>
//                     setInterviewFilters({
//                       ...interviewFilters,
//                       type: value,
//                     }),
//                   options: [
//                     { value: "all", label: "All Types" },
//                     { value: "technical", label: "Technical" },
//                     { value: "behavioral", label: "Behavioral" },
//                     { value: "mixed", label: "Mixed" },
//                   ],
//                 },
//                 {
//                   label: "Status",
//                   value: interviewFilters.status,
//                   onChange: (value: string) =>
//                     setInterviewFilters({
//                       ...interviewFilters,
//                       status: value,
//                     }),
//                   options: [
//                     { value: "all", label: "All Status" },
//                     { value: "completed", label: "Completed" },
//                     { value: "in-progress", label: "In Progress" },
//                     { value: "scheduled", label: "Scheduled" },
//                   ],
//                 },
//                 {
//                   label: "Sort By",
//                   value: interviewFilters.sortBy,
//                   onChange: (value: string) =>
//                     setInterviewFilters({
//                       ...interviewFilters,
//                       sortBy: value,
//                     }),
//                   options: [
//                     { value: "date", label: "Latest First" },
//                     { value: "score", label: "Highest Score" },
//                   ],
//                 },
//               ].map((filter) => (
//                 <div key={filter.label}>
//                   <label className="block text-sm text-slate-400 mb-2">
//                     {filter.label}
//                   </label>
//                   <select
//                     value={filter.value}
//                     onChange={(e) => filter.onChange(e.target.value)}
//                     className="w-full px-3 py-2 glass-input rounded-lg text-white text-sm"
//                   >
//                     {filter.options.map((option) => (
//                       <option key={option.value} value={option.value}>
//                         {option.label}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//               ))}
//             </div>
//             <div className="mt-4 flex items-center justify-between text-sm">
//               <span className="text-slate-400">
//                 Showing {filteredInterviews.length} of {interviews.length} interviews
//               </span>
//               <button
//                 onClick={() =>
//                   setInterviewFilters({
//                     type: "all",
//                     status: "all",
//                     sortBy: "date",
//                   })
//                 }
//                 className="text-blue-400 hover:text-blue-300"
//               >
//                 Clear Filters
//               </button>
//             </div>
//           </div>
//         )}

//         <div className="p-6">
//           {hasInterviews ? (
//             <div className="space-y-4">
//               {filteredInterviews.map((interview) => (
//                 <ProfileInterviewCard key={interview.id} interview={interview} />
//               ))}
//             </div>
//           ) : (
//             <div className="text-center py-16">
//               <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
//                 <FileText className="h-8 w-8 text-slate-400" />
//               </div>

//               <h3 className="text-2xl font-semibold text-white mb-3">
//                 No Interviews Yet
//               </h3>

//               <p className="text-slate-400 mb-8 max-w-md mx-auto">
//                 Start your interview preparation journey with AI-powered mock interviews
//               </p>

//               <div className="flex flex-col sm:flex-row gap-3 justify-center">
//                 <Button
//                   asChild
//                   className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
//                 >
//                   <Link href="/createinterview">
//                     <Target className="h-4 w-4 mr-2" />
//                     Start First Interview
//                   </Link>
//                 </Button>

//                 <Button
//                   asChild
//                   className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
//                 >
//                   <Link href="/templates">
//                     <BookOpen className="h-4 w-4 mr-2" />
//                     Browse Templates
//                   </Link>
//                 </Button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Quick Actions */}
//       {hasInterviews && (
//         <div className="glass-card hover-lift">
//           <div className="p-6">
//             <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
//               <div className="flex items-center gap-4">
//                 <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
//                   <Target className="w-5 h-5 text-emerald-400" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-semibold text-white mb-1">
//                     Continue Your Progress
//                   </h3>
//                   <p className="text-slate-400 text-sm">
//                     Ready for your next challenge?
//                   </p>
//                 </div>
//               </div>

//               <div className="flex gap-3">
//                 <Button className="bg-white/5 hover:bg-white/10 text-white border border-white/10">
//                   <BarChart3 className="h-4 w-4 mr-2" />
//                   Analytics
//                 </Button>
//                 <Button
//                   asChild
//                   className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
//                 >
//                   <Link href="/createinterview">
//                     <Target className="h-4 w-4 mr-2" />
//                     New Interview
//                   </Link>
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProfileInterviews;