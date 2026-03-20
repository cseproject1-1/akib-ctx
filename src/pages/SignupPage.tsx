import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { AuthBackground } from '@/components/AuthBackground';

const SignupPage = () => {
  const { signUp, signInWithGoogle, sendVerification } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleResend = async () => {
    setResending(true);
    await sendVerification();
    setResending(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 relative overflow-hidden">
        <AuthBackground />
        <div className="w-full max-w-sm space-y-6 text-center relative z-10 animate-brutal-pop">
          <img src="/logo.png" alt="ctxnote" className="mx-auto h-20 w-auto object-contain drop-shadow-[0_0_20px_hsl(0,72%,60%,0.3)]" />
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/80 backdrop-blur-xl p-8 space-y-4">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-neutral-100">Check Your Email</h1>
            <p className="text-sm text-neutral-500">
              We sent a confirmation link to <span className="font-bold text-neutral-200">{email}</span>
            </p>
            <div className="flex flex-col gap-4 pt-2">
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm font-bold text-primary hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending...' : "Didn't receive it? Resend"}
              </button>
              <Link to="/login" className="text-sm font-bold text-neutral-500 hover:text-neutral-300 hover:underline border-t border-neutral-800 pt-4">Back to sign in</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 relative overflow-hidden">
      <AuthBackground />
      <div className="w-full max-w-sm space-y-8 relative z-10 animate-brutal-pop">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="ctxnote" className="h-20 w-auto object-contain drop-shadow-[0_0_20px_hsl(0,72%,60%,0.3)]" />
          <p className="text-sm text-neutral-500 pt-2">Join AI Study Canvas</p>
        </div>

        <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/80 backdrop-blur-xl p-6 space-y-4 shadow-[0_0_40px_hsl(0,72%,60%,0.04)]">
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-700/60 bg-neutral-900 px-4 py-3 text-sm font-bold uppercase tracking-wider text-neutral-200 transition-all hover:bg-neutral-800 hover:border-neutral-600 hover:shadow-[0_0_12px_hsl(0,72%,60%,0.08)] disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-800"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-neutral-950 px-2 text-neutral-600">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-100 outline-none transition-all focus:border-primary focus:shadow-[0_0_10px_hsl(0,72%,60%,0.15)] placeholder:text-neutral-600"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-100 outline-none transition-all focus:border-primary focus:shadow-[0_0_10px_hsl(0,72%,60%,0.15)] placeholder:text-neutral-600"
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-all hover:shadow-[0_0_20px_hsl(0,72%,60%,0.3)] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Account
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-neutral-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
