'use client';
// components/ui/auto-textarea.tsx
//
// A textarea that grows with what is in it, so long text (a skills list, a
// cover letter) shows in full without an inner scrollbar.
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

export default function AutoTextarea({ className = '', value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; };
    fit();
    // Width changes rewrap the text, so measure again on resize.
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== width) { width = el.clientWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return <textarea ref={ref} value={value} {...rest} className={`${className} resize-none overflow-hidden`} />;
}
