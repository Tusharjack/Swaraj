import { supabase, isSupabaseConfigured, uploadFileToSupabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';

// ---------------------------------------------------------------------------
// initAuthStorage
// Called once from api.ts on startup. When Supabase is configured we rely
// entirely on Supabase for user data, so we only clear any stale local-only
// session that could cause phantom logins.
// ---------------------------------------------------------------------------
export function initAuthStorage() {
  if (isSupabaseConfigured) {
    // Do nothing — Supabase session is the authority.
    // We deliberately do NOT pre-populate localStorage with seed profiles
    // because those fake IDs (user-broker-1 etc.) break RLS checks.
    return;
  }
  // Non-Supabase dev mode: nothing to initialise either.
}

// ---------------------------------------------------------------------------
// AUTH SERVICE
// ---------------------------------------------------------------------------

export const authService = {
  /**
   * Returns the currently authenticated user profile, or null if not signed in.
   *
   * When Supabase is configured:
   *   - Returns the profile from the `profiles` table matching auth.uid()
   *   - Creates the profile row if missing (e.g. first login after email confirm)
   *   - Returns null (does NOT fall back to localStorage) if there is no
   *     active Supabase session, so the UI correctly shows "not logged in"
   *
   * When Supabase is NOT configured:
   *   - Falls back to the CURRENT_USER key in localStorage for dev/demo use
   */
  async getCurrentUser(): Promise<Profile | null> {
    if (isSupabaseConfigured) {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[Auth] getSession error:', sessionError.message);
        return null;
      }

      if (!session?.user) {
        // No active session — clear any stale cached user
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[Auth] Failed to load profile:', profileError.message);
        return null;
      }

      if (profile) {
        // Cache the profile locally for fast synchronous reads (e.g. sidebar)
        setLocalState(STORAGE_KEYS.CURRENT_USER, profile as Profile);
        return profile as Profile;
      }

      // Profile row is missing — create it from auth metadata (first login after trigger miss)
      const um = session.user.user_metadata || {};
      const newProfile: Profile = {
        id: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email: session.user.email!,
        full_name: um.full_name || um.name || session.user.email!.split('@')[0],
        role: (um.role as UserRole) || 'customer',
        professional_type: um.professional_type,
        agency_name: um.agency_name,
        phone: um.phone,
        city: um.city || 'Mumbai',
        verified: false,
        avatar_url:
          um.avatar_url ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
        badge:
          um.role === 'professional' && um.professional_type
            ? `${String(um.professional_type).toUpperCase()} PRO`
            : undefined
      };

      const { error: insertError } = await supabase.from('profiles').insert(newProfile);
      if (insertError && insertError.code !== '23505') {
        // 23505 = unique_violation (profile already exists, harmless race condition)
        console.error('[Auth] Failed to create profile row:', insertError.message);
      }

      setLocalState(STORAGE_KEYS.CURRENT_USER, newProfile);
      return newProfile;
    }

    // Supabase not configured — return locally stored session (dev/demo only)
    return getLocalState<Profile | null>(STORAGE_KEYS.CURRENT_USER, null);
  },

  async login(
    email: string,
    password?: string,
    _role?: UserRole
  ): Promise<{ profile: Profile; error?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || 'password123'
      });

      if (error) {
        return { profile: null as any, error: error.message };
      }

      if (data?.user) {
        const profile = await this.getCurrentUser();
        if (profile) return { profile };
        return { profile: null as any, error: 'Login succeeded but profile could not be loaded.' };
      }

      return { profile: null as any, error: 'Unexpected login response from Supabase.' };
    }

    // Non-Supabase fallback (dev/demo without credentials)
    const stored = getLocalState<Profile | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (stored && stored.email.toLowerCase() === email.toLowerCase()) {
      return { profile: stored };
    }
    return {
      profile: null as any,
      error: 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    };
  },

  async signUp(data: {
    email: string;
    password?: string;
    fullName: string;
    role: UserRole;
    professionalType?: string;
    agencyName?: string;
    phone?: string;
    city?: string;
  }): Promise<{ profile: Profile; error?: string; needsEmailConfirmation?: boolean }> {
    if (!isSupabaseConfigured) {
      return {
        profile: null as any,
        error:
          'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      };
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password || 'password123',
      options: {
        data: {
          full_name: data.fullName,
          role: data.role,
          professional_type: data.professionalType,
          agency_name: data.agencyName,
          phone: data.phone,
          city: data.city || 'Mumbai'
        }
      }
    });

    if (error) {
      return { profile: null as any, error: error.message };
    }

    if (!authData?.user?.id) {
      return {
        profile: null as any,
        error: 'Sign-up failed: no user returned. Please try again.'
      };
    }

    const badge =
      data.role === 'professional' && data.professionalType
        ? `${data.professionalType.toUpperCase()} PRO`
        : undefined;

    const newProfile: Profile = {
      id: authData.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email: data.email,
      full_name: data.fullName,
      role: data.role,
      professional_type: data.professionalType as Profile['professional_type'],
      agency_name: data.agencyName,
      phone: data.phone,
      city: data.city || 'Mumbai',
      verified: false,
      badge,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`
    };

    // Upsert the profile row — the DB trigger may have already created it
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(newProfile, { onConflict: 'id' });

    if (upsertError) {
      console.error('[Auth] Failed to upsert profile on sign-up:', upsertError.message);
      // Non-fatal — the trigger may have created it already
    }

    setLocalState(STORAGE_KEYS.CURRENT_USER, newProfile);
    return { profile: newProfile };
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch((err) =>
        console.error('[Auth] signOut error:', err.message)
      );
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  async uploadAvatar(imageFile: File): Promise<string> {
    return uploadFileToSupabase('avatars', imageFile);
  },

  async updateProfile(profileId: string, updates: Partial<Profile>): Promise<Profile> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    const updated = data as Profile;
    setLocalState(STORAGE_KEYS.CURRENT_USER, updated);
    return updated;
  },

  async getAllUsers(): Promise<Profile[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to load users: ${error.message}`);
      }
      return (data ?? []) as Profile[];
    }
    return [];
  },

  async toggleUserVerification(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('verified')
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    const nextVerified = !existing.verified;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ verified: nextVerified })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update verification: ${updateError.message}`);
    }
    return nextVerified;
  },

  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  },

  async resetPlatformData(): Promise<void> {
    // Clear the local session cache
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.SAVED_PROPERTIES);
    localStorage.removeItem(STORAGE_KEYS.REEL_LIKES);
    localStorage.removeItem(STORAGE_KEYS.REEL_SAVES);
    localStorage.removeItem(STORAGE_KEYS.FOLLOWERS);
    localStorage.removeItem(STORAGE_KEYS.REEL_COMMENTS);
    // Note: we do NOT truncate Supabase tables here — that would wipe all
    // real production data. This reset only clears the local interaction cache.
  }
};
