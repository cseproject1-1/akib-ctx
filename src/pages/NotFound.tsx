import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Search, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border-2 border-border bg-card p-8 shadow-[8px_8px_0px_hsl(0,0%,15%)] text-center animate-brutal-pop">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-xl border-2 border-border bg-primary/10 shadow-[4px_4px_0px_hsl(var(--primary)/0.3)]">
          <Search className="h-12 w-12 text-primary" />
        </div>
        
        <h1 className="mb-2 text-6xl font-black tracking-widest text-foreground">
          404
        </h1>
        <h2 className="mb-6 text-xl font-bold uppercase tracking-wider text-muted-foreground">
          Page Not Found
        </h2>
        
        <p className="mb-8 text-sm font-semibold text-muted-foreground">
          The page you are looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => navigate(-1)}
            className="brutal-btn flex flex-1 items-center justify-center gap-2 rounded-lg bg-card border-2 border-border px-4 py-3 text-sm font-bold uppercase tracking-wider text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="brutal-btn flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary border-2 border-border px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            <Home className="h-4 w-4" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
