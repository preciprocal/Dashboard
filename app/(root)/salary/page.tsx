// app/(root)/salary/page.tsx
// Market pay: BLS wage percentiles for a job title and location, and where an
// offer sits in them. Links from the offer templates and the job tracker pass
// ?title, ?location and ?offer, read here so the first render is prefilled.

import { CircleDollarSign } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SalaryView from '@/components/salary/SalaryView';
import { SeeExampleButton } from '@/components/ServiceModal';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function SalaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return (
    <div className="space-y-4 pt-4 pb-12">
      <PageHeader
        title="Market Pay"
        description="What an occupation pays in your area, and where your offer sits."
        icon={<CircleDollarSign strokeWidth={1.75} aria-hidden="true" />}
        actions={<SeeExampleButton serviceId="salary" />}
      />
      <SalaryView
        initialTitle={one(q.title).slice(0, 200)}
        initialLocation={one(q.location).slice(0, 200)}
        initialOffer={one(q.offer).slice(0, 40)}
        initialOcc={/^\d{2}-\d{4}$/.test(one(q.occ)) ? one(q.occ) : ''}
      />
    </div>
  );
}
