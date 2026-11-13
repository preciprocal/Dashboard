'use client';
// app/(root)/contacts/page.tsx
// The networking tracker: who you reached out to, who replied, who is due a
// follow-up. The page body lives in components/contacts so it can be
// rendered on its own (for visual checks) without the auth gate.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import ContactsView from '@/components/contacts/ContactsView';

export default function ContactsPage() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();

  useEffect(() => { if (!loading && !user) router.push('/sign-in'); }, [user, loading, router]);

  if (loading || !user) return null;
  return <ContactsView />;
}
