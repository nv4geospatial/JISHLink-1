import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setAuthTokenGetter } from '@workspace/api-client-react/custom-fetch';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: 'admin' | 'recruiter' | 'employee' | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'admin' | 'recruiter' | 'employee' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('role_id, roles(name)')
      .eq('id', userId)
      .single();

    const roleRow = data as unknown as { roles?: { name: string } | { name: string }[] } | null;
    let roleName: string | null = null;
    if (roleRow?.roles) {
      roleName = Array.isArray(roleRow.roles) ? roleRow.roles[0]?.name ?? null : roleRow.roles.name;
    }
    setRole((roleName as 'admin' | 'recruiter' | 'employee') ?? null);
  };

  useEffect(() => {
    // Register token getter for API client
    setAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
