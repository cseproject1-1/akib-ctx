import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, MousePointer2, Box, Link2, Search as SearchIcon } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

interface Step {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector
  icon: any;
}

const steps: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to CtxNote',
    content: 'Your spatial thinking environment. Organize notes, ideas, and links on an infinite canvas with brutalist aesthetics.',
    icon: Sparkles
  },
  {
    id: 'toolbar',
    title: 'Tools of Expression',
    content: 'Add different types of nodes: stickies for quick thoughts, rich-text notes for details, or even code snippets.',
    target: '#canvas-toolbar',
    icon: Box
  },
  {
    id: 'connect',
    title: 'Connect the Dots',
    content: 'Enable Connector Mode to draw relationships between nodes. Just drag from one handle to another.',
    target: '#connector-mode-btn',
    icon: Link2
  },
  {
    id: 'search',
    title: 'Fuzzy Finder',
    content: 'Press Cmd+K anytime to search through your entire workspace with filters. It\'s fast.',
    target: '#search-btn',
    icon: SearchIcon
  }
];

export function TutorialSystem() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const hasSeen = localStorage.getItem('ctxnote-tutorial-complete');
    if (!hasSeen) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const step = steps[currentStep];

  useEffect(() => {
    if (step?.target && isVisible) {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top + rect.height + 20,
          left: rect.left + rect.width / 2
        });
      }
    } else {
      setCoords({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 });
    }
  }, [currentStep, isVisible, step]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem('ctxnote-tutorial-complete', 'true');
  };

  if (!isVisible) return null;

  const Icon = step.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Spotlight Effect (simplified) */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
          onClick={dismiss}
        />

        <motion.div
          key={step.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, top: coords.top, left: coords.left }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute -translate-x-1/2 p-1 pointer-events-auto"
          style={{ width: 320 }}
        >
          <div className="bg-card border-4 border-black dark:border-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] rounded-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <button 
                onClick={dismiss}
                className="p-1 hover:bg-accent rounded-md transition-colors"
                title="Dismiss tutorial"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 italic">
              {step.title}
            </h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-6">
              {step.content}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <button 
                    onClick={prev}
                    className="p-2 border-2 border-black dark:border-white hover:bg-accent transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <button 
                  onClick={next}
                  className="px-4 py-2 bg-primary text-primary-foreground border-2 border-black dark:border-white font-bold flex items-center gap-2 hover:-translate-y-0.5 hover:translate-x-0.5 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  {currentStep === steps.length - 1 ? 'GET STARTED' : 'NEXT'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Arrow pointing to target */}
          {step.target && (
            <div 
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[12px] border-b-black dark:border-b-white"
            />
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
