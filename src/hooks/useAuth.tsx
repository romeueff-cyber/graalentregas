import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authStorage, isOnline } from '@/lib/offline-storage';
import { isAbortErrorLike, toFriendlyAuthError } from '@/lib/abort-error';
import type { AppRole, Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  isFinanceiro: boolean;
  isVendedor: boolean;
  isEntregador: boolean;
  canApprovePedidoVenda: boolean;
  isLoading: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  restoreFromCache: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      // Set a maximum timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        console.warn('Auth initialization timeout - forcing completion');
        setIsLoading(false);
      }, 8000);

      // ALWAYS try cached auth first for instant UI
      const cachedAuth = await authStorage.get();
      const isValid = await authStorage.isValid();
      
      if (cachedAuth && isValid) {
        console.log('Using cached auth data - valid session found');
        setUser(cachedAuth.user);
        setSession(cachedAuth.session);
        setProfile(cachedAuth.profile);
        setRole(cachedAuth.role);
        
        // If completely offline, stop here with cached data
        if (!isOnline()) {
          console.log('Offline mode - using cached credentials');
          clearTimeout(timeoutId);
          setIsLoading(false);
          return;
        }
      } else if (!isOnline()) {
        // Offline without valid cache - can't do anything
        console.log('Offline without valid cache');
        clearTimeout(timeoutId);
        setIsLoading(false);
        return;
      }

      // Set up auth state listener
      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setSession(session);
          setUser(session?.user ?? null);

          // Defer profile/role fetching
          if (session?.user) {
            setTimeout(() => {
              fetchUserData(session.user.id);
            }, 0);
          } else {
            setProfile(null);
            setRole(null);
            // Only clear cache if online - protect offline cache
            if (isOnline()) {
              authStorage.clear();
            }
          }
        }
      );
      subscription = data.subscription;

      // Check for existing session with timeout
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          // No valid online session - clear stale cache if session is null (expired)
          if (!cachedAuth || !isValid) {
            await authStorage.clear();
          }
          clearTimeout(timeoutId);
          setIsLoading(false);
        }
      } catch (error) {
        // Network error or timeout - keep cached data
        console.error('Error getting session:', error);
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      clearTimeout(timeoutId);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      let fetchedProfile: Profile | null = null;
      if (profileData) {
        fetchedProfile = profileData as Profile;
        setProfile(fetchedProfile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      let fetchedRole: AppRole | null = null;
      if (roleData) {
        fetchedRole = roleData.role as AppRole;
        setRole(fetchedRole);
      }

      // Cache auth data for offline use
      const currentSession = await supabase.auth.getSession();
      if (currentSession.data.session) {
        await authStorage.save({
          user: currentSession.data.session.user,
          session: currentSession.data.session,
          profile: fetchedProfile,
          role: fetchedRole,
          cachedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Clear any stale/expired session before attempting login.
      // IMPORTANT: don't let an aborted cleanup call block login.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (cleanupErr) {
        if (!isAbortErrorLike(cleanupErr)) {
          console.warn('Pre-login cleanup signOut failed:', cleanupErr);
        }
      }

      try {
        await authStorage.clear();
      } catch (storageErr) {
        // Not critical for online login.
        console.warn('Pre-login cache clear failed:', storageErr);
      }

      const attemptLogin = () =>
        supabase.auth.signInWithPassword({
          email,
          password,
        });

      const first = await attemptLogin();
      if (!first.error) return { error: null };

      // If the request was aborted (common on flaky mobile/PWA startup), retry once.
      if (isAbortErrorLike(first.error)) {
        await new Promise((r) => setTimeout(r, 250));
        const second = await attemptLogin();
        if (!second.error) return { error: null };
        if (isAbortErrorLike(second.error)) {
          return { error: new Error('Conexão interrompida. Tente novamente.') };
        }
        return { error: new Error(toFriendlyAuthError(second.error)) };
      }

      return { error: new Error(toFriendlyAuthError(first.error)) };
    } catch (err) {
      return { error: new Error(toFriendlyAuthError(err)) };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await authStorage.clear();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const restoreFromCache = async (): Promise<boolean> => {
    const cachedAuth = await authStorage.get();
    const isValid = await authStorage.isValid();
    
    if (cachedAuth && isValid) {
      setUser(cachedAuth.user);
      setSession(cachedAuth.session);
      setProfile(cachedAuth.profile);
      setRole(cachedAuth.role);
      setIsLoading(false);
      return true;
    }
    return false;
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    role,
    isAdmin: role === 'admin',
    isLoading,
    isOffline,
    signIn,
    signUp,
    signOut,
    restoreFromCache
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
