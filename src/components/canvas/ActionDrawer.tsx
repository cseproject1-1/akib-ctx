import { useCanvasStore } from '@/store/canvasStore';
import { 
  Palette, 
  Timer, 
  Star, 
  BarChart3, 
  ChevronRight,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function ActionDrawer() {
  const activePanel = useCanvasStore((s) => s.activePanel);
  const setActivePanel = useCanvasStore((s) => s.setActivePanel);
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { id: 'theme', label: 'Aesthetics', icon: Palette, color: 'text-primary' },
    { id: 'timer', label: 'Pomodoro', icon: Timer, color: 'text-orange-500' },
    { id: 'pinned', label: 'Pinned', icon: Star, color: 'text-yellow-400' },
    { id: 'stats', label: 'Statistics', icon: BarChart3, color: 'text-blue-400' },
  ] as const;

  const handleActionClick = (id: typeof actions[number]['id']) => {
    setActivePanel(activePanel === id ? null : id);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed left-6 bottom-6 z-[60] h-12 w-12 rounded-2xl border-2 border-border bg-card shadow-[4px_4px_0px_rgba(0,0,0,0.1)] transition-all hover:bg-accent active:scale-95 group"
          title="Open Toolbox"
        >
          <Settings2 className="h-6 w-6 text-primary group-hover:rotate-90 transition-transform duration-300" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 glass-morphism-strong border-r border-white/10 p-0">
        <SheetHeader className="p-6 border-b border-white/5">
          <SheetTitle className="text-xs font-black uppercase tracking-[0.3em] text-primary/60">
            Toolbox
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 p-4">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.id)}
              className={cn(
                "group flex items-center gap-4 rounded-2xl px-4 py-4 transition-all hover:bg-white/5 active:scale-95",
                activePanel === action.id ? "bg-primary/10 border border-primary/20" : "border border-transparent"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 group-hover:bg-primary/20 transition-colors",
                action.color
              )}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold tracking-tight text-foreground">
                  {action.label}
                </span>
                <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60">
                   Action Tool
                </span>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
        <div className="absolute bottom-6 left-0 right-0 px-6">
          <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
             <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 text-center">
               CtxNote v2.0 • Pro Tools
             </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
