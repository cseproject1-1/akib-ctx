import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, X, Coffee, BookOpen, Settings } from 'lucide-react';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface ModeConfig {
  key: TimerMode;
  label: string;
  icon: React.ElementType;
  minutes: number;
}

function getStoredDurations(): { work: number; short: number; long: number } {
  try {
    const stored = localStorage.getItem('pomodoro-durations');
    if (stored) return JSON.parse(stored);
  } catch {}
  return { work: 25, short: 5, long: 15 };
}

function getStoredSessions(): number {
  return parseInt(localStorage.getItem('pomodoro-sessions') || '0', 10);
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 0.3;
    [800, 1000, 1200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.12);
    });
  } catch {}
}

function sendNotification(mode: TimerMode) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('Pomodoro Timer', {
      body: mode === 'work' ? '🎉 Focus session complete! Time for a break.' : '☕ Break over! Ready to focus?',
      icon: '/favicon.png',
    });
  }
}

export function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [durations, setDurations] = useState(getStoredDurations);
  const [mode, setMode] = useState<TimerMode>('work');
  const [secondsLeft, setSecondsLeft] = useState(durations.work * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(getStoredSessions);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modes: ModeConfig[] = [
    { key: 'work', label: 'Focus', icon: BookOpen, minutes: durations.work },
    { key: 'shortBreak', label: 'Short', icon: Coffee, minutes: durations.short },
    { key: 'longBreak', label: 'Long', icon: Coffee, minutes: durations.long },
  ];

  const currentMode = modes.find((m) => m.key === mode)!;

  useEffect(() => {
    if (running && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [running]);

  const reset = useCallback((newMode?: TimerMode) => {
    const m = newMode || mode;
    const mins = m === 'work' ? durations.work : m === 'shortBreak' ? durations.short : durations.long;
    setSecondsLeft(mins * 60);
    setRunning(false);
    if (newMode) setMode(newMode);
  }, [mode, durations]);

  const saveDurations = (newDurations: typeof durations) => {
    setDurations(newDurations);
    localStorage.setItem('pomodoro-durations', JSON.stringify(newDurations));
    // Reset current timer with new duration
    const mins = mode === 'work' ? newDurations.work : mode === 'shortBreak' ? newDurations.short : newDurations.long;
    setSecondsLeft(mins * 60);
    setRunning(false);
  };

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          playBeep();
          sendNotification(mode);
          if (mode === 'work') {
            const newSessions = sessions + 1;
            setSessions(newSessions);
            localStorage.setItem('pomodoro-sessions', String(newSessions));
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode, sessions]);

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = 1 - secondsLeft / (currentMode.minutes * 60);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[136px] left-6 z-[60] flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-card shadow-[4px_4px_0px_hsl(0,0%,15%)] transition-all hover:bg-accent active:scale-95"
        title="Pomodoro Timer"
      >
        <Timer className="h-5 w-5 text-primary" />
        {running && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-green animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-[136px] left-6 z-[60] w-64 rounded-xl border-2 border-border bg-card shadow-[6px_6px_0px_hsl(0,0%,15%)] animate-brutal-pop">
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Pomodoro</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Settings">
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="p-4 space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Durations (minutes)</h4>
          {([
            { label: 'Focus', key: 'work' as const, value: durations.work },
            { label: 'Short Break', key: 'short' as const, value: durations.short },
            { label: 'Long Break', key: 'long' as const, value: durations.long },
          ]).map(({ label, key, value }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{label}</span>
              <input
                type="number"
                min={1}
                max={120}
                value={value}
                onChange={(e) => saveDurations({ ...durations, [key]: Math.max(1, Math.min(120, parseInt(e.target.value) || 1)) })}
                className="w-16 rounded-md border-2 border-border bg-background px-2 py-1 text-center text-xs font-bold text-foreground outline-none focus:border-primary"
              />
            </div>
          ))}
          <button
            onClick={() => saveDurations({ work: 25, short: 5, long: 15 })}
            className="w-full rounded-md border-2 border-border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Reset to defaults
          </button>
        </div>
      ) : (
        <>
          <div className="flex border-b-2 border-border">
            {modes.map((m) => (
              <button
                key={m.key}
                onClick={() => reset(m.key)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  mode === m.key ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center py-5">
            <div className="relative mb-3">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - progress)}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-2xl font-bold text-foreground">
                  {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRunning(!running)}
                className="brutal-btn flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button
                onClick={() => reset()}
                className="brutal-btn flex h-10 w-10 items-center justify-center rounded-lg bg-card text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-t-2 border-border px-4 py-2 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Sessions today: {sessions}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
