import { useMemo } from 'react';

const shapeColors: Record<string, string> = {
  default: 'hsl(0 0% 25%)',
  blue: 'hsl(217, 91%, 60%)',
  green: 'hsl(142, 76%, 46%)',
  red: 'hsl(0, 84%, 60%)',
  purple: 'hsl(262, 83%, 58%)',
  yellow: 'hsl(52, 100%, 50%)',
  orange: 'hsl(25, 95%, 53%)',
  cyan: 'hsl(188, 85%, 50%)',
};

function ShapeSVG({ shapeType, color, w, h }: { shapeType: string; color: string; w: number; h: number }) {
  const fill = shapeColors[color] || shapeColors.default;
  const fillOpacity = '0.15';
  const stroke = fill;

  switch (shapeType) {
    case 'circle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 4} ry={h / 2 - 4} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={`${w / 2},4 ${w - 4},${h / 2} ${w / 2},${h - 4} 4,${h / 2}`} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={`${w / 2},4 ${w - 4},${h - 4} 4,${h - 4}`} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
    default:
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={3} y={3} width={w - 6} height={h - 6} rx={4} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={2.5} />
        </svg>
      );
  }
}

export function ShapeView({ data }: { data: any }) {
  const w = 200;
  const h = 160;

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <ShapeSVG shapeType={data.shapeType || 'rect'} color={data.color || 'default'} w={w} h={h} />
      {data.label && (
        <p className="text-lg font-bold text-foreground">{data.label}</p>
      )}
    </div>
  );
}
