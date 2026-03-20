import { Folder, FolderOpen } from 'lucide-react';

const groupColors: Record<string, { border: string; label: string; bg: string }> = {
  default: { border: 'border-border', label: 'text-muted-foreground', bg: 'bg-muted/5' },
  blue: { border: 'border-primary/60', label: 'text-primary', bg: 'bg-primary/5' },
  green: { border: 'border-green-500/60', label: 'text-green-500', bg: 'bg-green-500/5' },
  red: { border: 'border-red-500/60', label: 'text-red-500', bg: 'bg-red-500/5' },
  purple: { border: 'border-purple-500/60', label: 'text-purple-500', bg: 'bg-purple-500/5' },
  yellow: { border: 'border-yellow-500/60', label: 'text-yellow-500', bg: 'bg-yellow-500/5' },
  orange: { border: 'border-orange-500/60', label: 'text-orange-500', bg: 'bg-orange-500/5' },
  cyan: { border: 'border-cyan-500/60', label: 'text-cyan-500', bg: 'bg-cyan-500/5' },
};

export function GroupView({ data }: { data: any }) {
  const colorKey = data.color || 'default';
  const colors = groupColors[colorKey] || groupColors.default;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-6`}>
        <div className="flex items-center gap-3">
          {data.collapsed ? (
            <Folder className={`h-8 w-8 ${colors.label}`} />
          ) : (
            <FolderOpen className={`h-8 w-8 ${colors.label}`} />
          )}
          <div>
            <h3 className={`text-lg font-bold ${colors.label}`}>
              {data.label || 'Untitled Group'}
            </h3>
            {data.collapsed && (
              <span className="text-xs text-muted-foreground">Collapsed</span>
            )}
          </div>
        </div>
      </div>
      {data.description && (
        <p className="text-sm text-muted-foreground">{data.description}</p>
      )}
    </div>
  );
}
