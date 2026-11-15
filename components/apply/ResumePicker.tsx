// components/apply/ResumePicker.tsx
//
// Choose which resume to tailor. Each option shows enough to tell copies
// apart (students often upload the same file name twice): when it was
// uploaded, the role it was analysed for and its score.
'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, FileText, Upload } from 'lucide-react';
import Link from 'next/link';

export interface ResumeOption {
  id: string;
  fileName?: string;
  jobTitle?: string;
  companyName?: string;
  createdAt?: string;
  score?: number;
}

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

const scoreTone = (s: number) =>
  s >= 80 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  : s >= 60 ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
  : 'text-rose-300 bg-rose-500/10 border-rose-500/20';

function meta(r: ResumeOption) {
  const target = [r.jobTitle, r.companyName].filter(Boolean).join(' at ');
  return [fmt(r.createdAt) && `Uploaded ${fmt(r.createdAt)}`, target].filter(Boolean).join(' · ');
}

function Row({ r, compact = false }: { r: ResumeOption; compact?: boolean }) {
  return (
    <span className="flex items-center gap-3 min-w-0 w-full">
      <span className={`flex-shrink-0 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-indigo-200 ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}>
        <FileText className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13.5px] font-medium text-white truncate">{r.fileName || 'Resume'}</span>
        {meta(r) && <span className="block text-[11.5px] text-slate-400 truncate mt-0.5">{meta(r)}</span>}
      </span>
      {typeof r.score === 'number' && r.score > 0 && (
        <span className={`flex-shrink-0 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md border ${scoreTone(r.score)}`}>{r.score}</span>
      )}
    </span>
  );
}

export default function ResumePicker({ resumes, value, onChange }: {
  resumes: ResumeOption[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  if (resumes === null) {
    return <div className="h-[58px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] animate-pulse" />;
  }
  if (resumes.length === 0) {
    return (
      <Link href="/resume/upload" className="h-[58px] rounded-[var(--r-md)] border border-dashed border-[var(--border-hover)] flex items-center justify-center gap-2 text-sm text-slate-300 hover:text-white hover:border-[var(--accent-border)] transition-colors">
        <Upload className="w-4 h-4" /> Upload a resume first
      </Link>
    );
  }

  const selected = resumes.find(r => r.id === value);
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        aria-label="Resume to tailor"
        className="group flex h-[58px] w-full items-center gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] pl-2.5 pr-3.5 text-left
          hover:border-[var(--border-hover)] focus:outline-none focus-visible:border-[var(--accent-border)] focus-visible:shadow-[0_0_0_3px_var(--accent-subtle)]
          data-[state=open]:border-[var(--accent-border)] data-[state=open]:shadow-[0_0_0_3px_var(--accent-subtle)] transition-[border-color,box-shadow] cursor-pointer"
      >
        {selected ? <Row r={selected} /> : <span className="flex-1 text-sm text-[var(--text-5)] pl-1">Choose a resume</span>}
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[10000] w-[var(--radix-select-trigger-width)] max-h-[min(22rem,var(--radix-select-content-available-height))] overflow-hidden rounded-[var(--r-md)]
            border border-[var(--border-hover)] bg-[var(--bg-raised)] shadow-[0_16px_48px_rgba(0,0,0,0.55)]
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/[0.05]">
            Your resumes · {resumes.length}
          </div>
          <SelectPrimitive.Viewport className="p-1.5">
            {resumes.map(r => (
              <SelectPrimitive.Item key={r.id} value={r.id}
                className="relative flex items-center gap-2 rounded-lg px-2 py-2 pr-8 cursor-pointer select-none outline-none
                  data-[highlighted]:bg-white/[0.05] data-[state=checked]:bg-[var(--accent-subtle)] transition-colors">
                <SelectPrimitive.ItemText asChild><span className="hidden">{r.fileName}</span></SelectPrimitive.ItemText>
                <Row r={r} compact />
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check className="w-4 h-4 text-indigo-300" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <Link href="/resume/upload" className="flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] text-slate-400 hover:text-white border-t border-white/[0.05] transition-colors">
            <Upload className="w-3.5 h-3.5" /> Upload another resume
          </Link>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
