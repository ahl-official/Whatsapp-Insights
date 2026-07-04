import { Suspense } from 'react';
import CustomersTable from '@/components/CustomersTable';
import { fetchAllProfiles, searchProfiles } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { q?: string };
}

export default async function CustomersPage({ searchParams }: Props) {
  const profiles = searchParams.q
    ? await searchProfiles(searchParams.q)
    : await fetchAllProfiles();

  return (
    <div>
      <h1 className="page-title">Customer Profiles</h1>
      <Suspense fallback={<p className="empty">Loading...</p>}>
        <CustomersTable profiles={profiles} />
      </Suspense>
    </div>
  );
}
