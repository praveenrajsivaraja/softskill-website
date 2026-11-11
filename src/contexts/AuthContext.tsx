
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getAuthRedirectUrl, isEmailLinkType, readEmailLinkError } from '@/lib/authEmailLink';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get('token_hash');
    const linkType = searchParams.get('type');
    if (tokenHash && isEmailLinkType(linkType) && window.location.pathname !== '/auth/confirm') {
      navigate(`/auth/confirm?${searchParams.toString()}`, { replace: true });
    }

    const emailLinkError = readEmailLinkError(window.location.hash);
    const isConfirmPage = window.location.pathname === '/auth/confirm';
    if (emailLinkError && !isConfirmPage) {
      toast({
        title: 'Could not verify email',
        description: emailLinkError,
        variant: 'destructive',
      });
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        return { error };
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });

      return { error: null };
    } catch (error) {
      console.error('Login error:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('Sign up error:', error);

        if (error.message.includes('Error sending confirmation email')) {
          return {
            error: {
              message: 'The account was created, but the confirmation email was not sent. In Supabase, reset the Confirm signup template to the default template, then try again.',
            },
          };
        }

        return { error };
      }

      const isExistingAccount = Boolean(data.user && data.user.identities?.length === 0);
      if (isExistingAccount) {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });

        if (resendError) {
          console.error('Confirmation resend error:', resendError);
          return { error: resendError };
        }

        toast({
          title: 'Confirmation email sent',
          description: 'This email is already registered. Open the newest confirmation message.',
        });
        return { error: null };
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Account created!",
          description: "Check your email and open the confirmation link.",
        });
      } else if (data.user) {
        toast({
          title: "Account created!",
          description: "Welcome to KIKI Learning Hub!",
        });
      }

      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        console.error('Google sign in error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { error };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    signUp,
    signInWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
