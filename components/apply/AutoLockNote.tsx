// components/apply/AutoLockNote.tsx
// Shown on a step while Auto-apply is running it, in place of a silent
// disabled button: says why, and how to take over.
import { Loader2 } from 'lucide-react';

export default function AutoLockNote({ what }: { what: string }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)] bg-white/[0.03] ring-1 ring-inset ring-white/[0.07]">
      <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin flex-shrink-0 text-[var(--text-3)]" />
      <span>Auto-apply is {what}. Stop it in the panel above to make changes yourself.</span>
    </p>
  );
}
