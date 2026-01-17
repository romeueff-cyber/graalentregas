import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authStorage, isOnline } from '@/lib/offline-storage';
import type { AppRole, Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
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

    const initializeAuth = async () => {
      // ALWAYS try cached auth first for instant UI
      const cachedAuth = await authStorage.get();
      const isValid = await authStorage.isValid();
      
      if (cachedAuth && isValid) {
        setUser(cachedAuth.user);
        setSession(cachedAuth.session);
        setProfile(cachedAuth.profile);
        setRole(cachedAuth.role);
      }

      // If completely offline, stop here with cached data
      if (!isOnline()) {
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
            // Clear cached auth on logout
            authStorage.clear();
          }
        }
      );
      subscription = data.subscription;

      // Check for existing session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          // No online session - keep cached data if valid
          setIsLoading(false);
        }
      } catch (error) {
        // Network error - keep cached data
        console.error('Error getting session:', error);
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error: error as Error | null };
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
    signOut
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
