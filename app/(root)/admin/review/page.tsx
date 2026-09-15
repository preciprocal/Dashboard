// app/(root)/admin/review/page.tsx
// The review queue: detector flags (Task 2 duplicate resumes, Task 5 device
// spread) and refund requests needing a human decision, in one list.
//
// Server component so the is_admin check happens before any markup is sent.
// notFound() rather than a redirect or a 403 screen - an admin-only surface
// should not confirm it exists to someone who isn't one, which is the same
// reasoning as the 404 in app/api/admin/review/route.ts.
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import ReviewQueue from "./ReviewQueue";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  return (
    <div className="w-full px-4 py-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-2">
          Admin
        </p>
        <h1 className="text-2xl font-bold text-white">Review queue</h1>
        <p className="text-sm text-slate-400 mt-1">
          Flagged accounts and refund requests. Nothing here has been actioned
          automatically - every item is waiting on a decision.
        </p>
      </div>

      <ReviewQueue />
    </div>
  );
}
