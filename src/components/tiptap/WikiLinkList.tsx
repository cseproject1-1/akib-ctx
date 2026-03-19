import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { FileText } from 'lucide-react';

export const WikiLinkList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="z-[500] flex flex-col gap-1 overflow-hidden rounded-lg border-2 border-primary bg-card p-1 shadow-[4px_4px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-100">
      {props.items.length > 0 ? (
        props.items.map((item: any, index: number) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
              index === selectedIndex ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
            }`}
          >
            <FileText className="h-3 w-3" />
            {item.title}
          </button>
        ))
      ) : (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">No nodes found</div>
      )}
    </div>
  );
});

WikiLinkList.displayName = 'WikiLinkList';
