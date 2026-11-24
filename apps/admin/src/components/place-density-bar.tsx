/** One Level 1 minimum as a labelled bar: how many the place has against how many it needs. */
export function PlaceDensityBar({ label, have, need }: { label: string; have: number; need: number }) {
  const met = need === 0 || have >= need;
  const pct = need === 0 ? 100 : Math.min(100, Math.round((have / need) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={met ? 'font-semibold text-green-700' : 'text-gray-500'}>{have} / {need}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${met ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
