import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Brain, Loader2 } from 'lucide-react';

const SignupPage = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-primary shadow-[4px_4px_0px_hsl(0,0%,15%)]">
            <Brain className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground">Check Your Email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-bold text-foreground">{email}</span>
          </p>
          <Link to="/login" className="text-sm font-bold text-primary hover:underline">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-primary shadow-[4px_4px_0px_hsl(0,0%,15%)]">
            <Brain className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground">Join AI Study Canvas</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border-2 border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border-2 border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary"
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="brutal-btn flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;