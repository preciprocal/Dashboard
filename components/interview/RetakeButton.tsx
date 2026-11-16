'use client';
// components/interview/RetakeButton.tsx
//
// Starts a new attempt at a finished interview (app/api/interview/[id]/retake)
// and opens it. The first attempt and its feedback stay as they are.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, RotateCcw } from 'lucide-react';

export default function RetakeButton({ interviewId, className = 'btn-secondary !h-9 !text-[13px]', label = 'Retake', icon = true, onDone }: {
  interviewId: string; className?: string; label?: string; icon?: boolean; onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/interview/${interviewId}/retake`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.id) throw new Error(j.error || 'Could not start the retake');
      // The session reads the behavioral half of a mixed interview from here.
      try {
        if (j.behavioralId) sessionStorage.setItem('behavioralInterviewId', j.behavioralId);
        else sessionStorage.removeItem('behavioralInterviewId');
      } catch { /* storage blocked */ }
      onDone?.();
      router.push(`/interview/${j.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start the retake');
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={go} disabled={busy} className={`${className} disabled:opacity-60`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon ? <RotateCcw className="w-4 h-4" /> : null}
      {label}
    </button>
  );
}
