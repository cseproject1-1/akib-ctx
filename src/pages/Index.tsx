import { useNavigate } from 'react-router-dom';
import { Brain, Layers, Sparkles, Share2, Presentation, PenTool, FileText, Zap, ArrowRight } from 'lucide-react';

const features = [
  { icon: Layers, title: 'Infinite Canvas', desc: 'Organize notes, images, code, and more on a freeform spatial canvas.' },
  { icon: Sparkles, title: 'AI-Powered Notes', desc: 'Generate summaries, flashcards, and study guides with built-in AI.' },
  { icon: Share2, title: 'Real-time Sharing', desc: 'Share workspaces with classmates and collaborate seamlessly.' },
  { icon: PenTool, title: 'Drawing & Sketching', desc: 'Freehand drawing tools to annotate and illustrate concepts.' },
  { icon: FileText, title: 'Rich Text Editor', desc: 'Full-featured editor with slash commands, math, tables, and more.' },
  { icon: Presentation, title: 'Presentation Mode', desc: 'Turn any canvas into a presentation with one click.' },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b-2 border-border px-6 py-4 animate-slide-down">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border bg-primary shadow-[3px_3px_0px_hsl(0,0%,15%)]">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold uppercase tracking-wider">crxnote</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="brutal-btn rounded-lg bg-card px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="brutal-btn rounded-lg bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-border bg-card px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground shadow-[2px_2px_0px_hsl(0,0%,15%)]">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Study smarter, not harder
          </div>
          <h1 className="mb-6 text-5xl font-black uppercase leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Your <span className="text-primary">Canvas</span> for
            <br />
            Thinking Big
          </h1>
          <p className="mb-10 text-lg text-muted-foreground sm:text-xl">
            An infinite spatial workspace for notes, research, and study. Combine text, images, AI, code, and drawings — all in one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="brutal-btn flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0px_hsl(0,0%,15%)] transition-transform hover:scale-105 active:scale-95"
            >
              Start for Free
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="brutal-btn flex items-center gap-2 rounded-xl border-2 border-border bg-card px-8 py-3.5 text-base font-bold uppercase tracking-wider text-foreground shadow-[4px_4px_0px_hsl(0,0%,15%)] transition-transform hover:scale-105 active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Floating mock canvas preview */}
        <div className="mt-16 w-full max-w-4xl animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-[8px_8px_0px_hsl(0,0%,15%)]">
            <div className="flex items-center gap-2 border-b-2 border-border pb-3 mb-4">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <div className="h-3 w-3 rounded-full bg-yellow" />
              <div className="h-3 w-3 rounded-full bg-green" />
              <span className="ml-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Canvas Preview</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['📝 Lecture Notes', '🤖 AI Summary', '✅ Study Checklist', '🎯 Flashcards', '💻 Code Snippet', '📐 Math Formula'].map((label, i) => (
                <div
                  key={label}
                  className="rounded-lg border-2 border-border bg-background p-3 text-left transition-all hover:border-primary hover:shadow-[3px_3px_0px_hsl(var(--primary))]"
                  style={{ animationDelay: `${300 + i * 80}ms`, animationFillMode: 'both' }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t-2 border-border bg-card px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-black uppercase tracking-tight sm:text-4xl">
            Everything You Need
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-xl border-2 border-border bg-background p-6 shadow-[4px_4px_0px_hsl(0,0%,15%)] transition-all duration-200 hover:border-primary hover:shadow-[6px_6px_0px_hsl(var(--primary))] hover:scale-[1.02] animate-fade-in"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t-2 border-border px-6 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-black uppercase tracking-tight">Ready to Get Started?</h2>
          <p className="mb-8 text-muted-foreground">Join students and researchers who think visually.</p>
          <button
            onClick={() => navigate('/signup')}
            className="brutal-btn inline-flex items-center gap-2 rounded-xl bg-primary px-10 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0px_hsl(0,0%,15%)] transition-transform hover:scale-105 active:scale-95"
          >
            Create Your First Canvas
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span>© 2026 crxnote</span>
          <div className="flex items-center gap-1">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span>Built with love</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
