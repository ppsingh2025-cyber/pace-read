/**
 * AuthService
 * Handles Supabase Auth with Google OAuth.
 * All methods are no-ops when Supabase is not configured, so the app
 * continues to work fully offline / without credentials.
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type AuthUser = User;
export type AuthSession = Session;

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
}

export const AuthService = {
  /**
   * Sign in with Google via Supabase OAuth redirect flow.
   */
  async signInWithGoogle(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  },

  /**
   * Sign out the current user.
   */
  async signOut(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current session (may be null if not signed in).
   */
  async getSession(): Promise<AuthSession | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Get the current user (may be null if not signed in).
   */
  async getUser(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  /**
   * Subscribe to auth state changes. Returns the unsubscribe function.
   */
  onAuthStateChange(
    callback: (user: AuthUser | null, session: AuthSession | null) => void,
  ): () => void {
    if (!isSupabaseConfigured || !supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null, session);
    });
    return () => subscription.unsubscribe();
  },

  isConfigured(): boolean {
    return isSupabaseConfigured;
  },
};
