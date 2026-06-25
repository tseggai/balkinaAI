import { BootSplash } from '@/lib/bootSplash';

export default function Index() {
  // Root layout handles auth-based navigation. This screen is shown only for the
  // brief moment before the redirect resolves. Paint the BootSplash bridge — a
  // frame identical to the native splash — so the boot reads as one continuous
  // splash with no flash or jarring screen swap.
  return <BootSplash />;
}
