import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null; // Keep a lightweight session object for compatibility
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = await currentUser.getIdToken();
        setSession({ access_token: token });
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        email: email.toLowerCase(),
        display_name: email.split('@')[0],
        created_at: serverTimestamp(),
        role: email.toLowerCase() === 'mm.adnanakib@gmail.com' ? 'admin' : 'user'
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    const { clearAllCaches } = await import('@/lib/cache/canvasCache');
    await clearAllCaches();
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // During HMR, the provider may briefly unmount — return safe defaults
    return {
      user: null,
      session: null,
      loading: true,
      signUp: async () => ({ error: new Error('Auth not ready') }),
      signIn: async () => ({ error: new Error('Auth not ready') }),
      signOut: async () => { },
    } as AuthContextType;
  }
  return context;
}
