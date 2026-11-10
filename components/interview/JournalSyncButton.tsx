"use client";
// "Save to Interview Journal" on the interview results page. Copies this mock
// interview into the journal (app/api/interview/[id]/journal) and opens the
// entry there, where the journal's own analysis can use it. Once saved, the
// same button just opens the entry: the server knows whether it already
// exists, so a refresh never offers to create a duplicate.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NotebookPen, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  interviewId: string;
  /** The journal entry already made from this interview, if any. */
  initialEntryId: string | null;
}

const entryHref = (id: string) => `/debrief?entry=${encodeURIComponent(id)}`;

export default function JournalSyncButton({ interviewId, initialEntryId }: Props) {
  const router = useRouter();
  const [entryId, setEntryId] = useState(initialEntryId);
  const [saving, setSaving] = useState(false);

  if (entryId) {
    return (
      <Link href={entryHref(entryId)} className="btn-secondary w-full sm:w-auto">
        <NotebookPen />
        Open in Interview Journal
        <ArrowUpRight />
      </Link>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/interview/${interviewId}/journal`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { id?: string; created?: boolean; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error || "Could not save to your Interview Journal");
      setEntryId(body.id);
      toast.success(body.created ? "Saved to your Interview Journal" : "Already in your Interview Journal");
      router.push(entryHref(body.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save to your Interview Journal");
      setSaving(false);
    }
  };

  return (
    <button type="button" onClick={save} disabled={saving} className="btn-secondary w-full sm:w-auto disabled:opacity-60" title="Copy this practice interview into your Interview Journal for a deeper analysis alongside your real interviews">
      {saving ? <Loader2 className="animate-spin" /> : <NotebookPen />}
      {saving ? "Saving..." : "Save to Interview Journal"}
    </button>
  );
}
