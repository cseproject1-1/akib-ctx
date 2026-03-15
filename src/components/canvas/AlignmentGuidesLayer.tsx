import { memo } from 'react';

interface Guide {
  type: 'v' | 'h';
  pos: number;
  start: number;
  end: number;
}

interface Props {
  guides: Guide[];
}

export const AlignmentGuidesLayer = memo(function AlignmentGuidesLayer({ guides }: Props) {
  if (guides.length === 0) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible">
      <defs>
        <filter id="guide-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {guides.map((g, i) =>
        g.type === 'v' ? (
          <line
            key={`v-${i}`}
            x1={g.pos}
            x2={g.pos}
            y1={g.start}
            y2={g.end}
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.6}
            style={{ filter: 'url(#guide-glow)' }}
          />
        ) : (
          <line
            key={`h-${i}`}
            x1={g.start}
            x2={g.end}
            y1={g.pos}
            y2={g.pos}
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.6}
            style={{ filter: 'url(#guide-glow)' }}
          />
        )
      )}
    </svg>
  );
});
