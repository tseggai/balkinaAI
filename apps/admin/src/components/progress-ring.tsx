'use client';

/** Circular progress: a track, the completed arc, and a slowly spinning marker so a long step still looks alive. */
export function ProgressRing({ done, total, size = 56, stroke = 5, className = '' }: { done: number; total: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-label={`${done} of ${total}`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
      <g className="origin-center animate-spin" style={{ animationDuration: '1.6s' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * 0.12} ${c}`} strokeOpacity={0.9} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </g>
    </svg>
  );
}
