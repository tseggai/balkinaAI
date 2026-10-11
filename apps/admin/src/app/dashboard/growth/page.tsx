import { redirect } from 'next/navigation';

// The Growth section was folded into Prospects.
export default function GrowthRedirect() {
  redirect('/dashboard/prospects');
}
