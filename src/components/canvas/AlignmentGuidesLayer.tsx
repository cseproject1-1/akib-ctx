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
      {guides.map((g, i) =>
        g.type === 'v' ? (
          <line
            key={i}
            x1={g.pos}
            x2={g.pos}
            y1={g.start}
            y2={g.end}
            stroke="hsl(52, 100%, 50%)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        ) : (
          <line
            key={i}
            x1={g.start}
            x2={g.end}
            y1={g.pos}
            y2={g.pos}
            stroke="hsl(52, 100%, 50%)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        )
      )}
    </svg>
  );
});
