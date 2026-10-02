// app/(root)/admin/analytics/page.tsx
// Product analytics: who is using what, for how long, what they click, and
// how the emails perform. Admin only; 404 for everyone else, same as the
// review queue.
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/actions/auth.action";
import AnalyticsDashboard from "./AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  return (
    <div className="w-full px-4 py-10 max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-2">Admin</p>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            What people use, for how long, what they click, and what the emails lead to. Time is engaged
            time: it only counts while the tab is visible and the person has been active in the last minute.
          </p>
        </div>
        <Link href="/admin/review" className="text-sm text-indigo-300 hover:text-indigo-200 whitespace-nowrap">
          Review queue &rsaquo;
        </Link>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}
