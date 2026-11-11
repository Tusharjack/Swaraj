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

  /**
   * Subscribe to Supabase auth state changes (login, logout, token refresh,
   * session restore across tabs).  Returns an unsubscribe function.
   *
   * This fixes session-persistence issues where a user who was logged in
   * on a previous visit sees a blank screen because the initial
   * `getSession()` call hadn't finished restoring the session from
   * storage before the component rendered.
   */
  onAuthStateChange(
    callback: (event: string, session: any) => void
  ): () => void {
    if (!isSupabaseConfigured) {
      return () => {}; // no-op in local-only mode
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Clear stale local user on explicit sign-out
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      callback(event, session);
    });

    // Return the unsubscribe function
    return () => data.subscription.unsubscribe();
  },

  // ── Two-Factor Authentication (TOTP via Supabase Auth MFA) ────────────────
  // Requires the "Authenticator app (TOTP)" MFA factor to be enabled in
  // Supabase Dashboard → Authentication → Multi-Factor Auth.

  /** Lists enrolled MFA factors (e.g. authenticator apps). */
  async listMfaFactors(): Promise<{ id: string; friendly_name?: string; status: string }[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(`Failed to load 2FA factors: ${error.message}`);
    return (data?.totp ?? []) as { id: string; friendly_name?: string; status: string }[];
  },

  /** Starts TOTP enrolment — returns the secret + QR code to scan. */
  async enrollTotp(friendlyName = 'IndoProperty Authenticator') {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
    if (error) throw new Error(`Could not start 2FA setup: ${error.message}`);
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,   // SVG data URI
      secret: data.totp.secret,    // manual entry key
    };
  },

  /** Verifies the 6-digit code scanned from the authenticator app. */
  async verifyTotp(factorId: string, code: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) throw new Error(`2FA challenge failed: ${chErr.message}`);
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code,
    });
    if (vErr) throw new Error(`Invalid code. Please try again. (${vErr.message})`);
  },

  /** Removes a 2FA factor. */
  async unenrollTotp(factorId: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(`Failed to disable 2FA: ${error.message}`);
  },

  /**
   * Returns the current vs required assurance level.
   * nextLevel 'aal2' with currentLevel 'aal1' means the user still needs to
   * complete the 2FA challenge before the session is fully elevated.
   */
  async getAssuranceLevel(): Promise<{ currentLevel: string | null; nextLevel: string | null }> {
    if (!isSupabaseConfigured) return { currentLevel: null, nextLevel: null };
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return { currentLevel: null, nextLevel: null };
    return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
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

  async deleteUser(userId: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) {
        console.error('Supabase deleteUser error:', error.message);
      }
    }
    const cached = getLocalState<Profile[]>(STORAGE_KEYS.PROFILES, []);
    const filtered = cached.filter(u => u.id !== userId);
    setLocalState(STORAGE_KEYS.PROFILES, filtered);
  },

  /**
   * Sends a password-reset email through Supabase Auth.
   * The email contains a secure link that returns the user to the app so they
   * can set a new password.
   */
  async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Password reset is only available when Supabase is configured.' };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not send the reset email. Please try again.' };
    }
  },

  /**
   * Updates the signed-in user's password.
   * Used both for the in-app "Change Password" settings section and for the
   * recovery flow after the user clicks the reset link in their email.
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Password change is only available when Supabase is configured.' };
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not update your password. Please try again.' };
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
  },

  /**
   * Permanently deletes the current user's account and all associated data.
   *
   * Flow:
   *   1. Get the user's current JWT from the active Supabase session.
   *   2. Call the `delete-account` Edge Function, passing the JWT.
   *      The Edge Function runs with the service_role key (server-side only)
   *      and handles storage cleanup + auth.admin.deleteUser().
   *   3. On success, clear all local state and sign out.
   *
   * Throws an Error with a human-readable message on any failure so the UI
   * can display it without falsely claiming success.
   */
  async deleteAccount(): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Account deletion is only available in production.');
    }

    // Get the current session JWT — required to authenticate the Edge Function call
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error('You must be signed in to delete your account. Please sign in and try again.');
    }

    // Derive the Edge Function URL from the Supabase project URL
    // Format: https://<project-ref>.supabase.co/functions/v1/delete-account
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ||
      localStorage.getItem('SWARAJ_SUPABASE_URL') || '') as string;
    const edgeFunctionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/delete-account`;

    let response: Response;
    try {
      response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (networkError) {
      throw new Error(
        'Network error — could not reach the server. Please check your internet connection and try again.'
      );
    }

    // Parse response body (always JSON from our Edge Function)
    let body: { success?: boolean; error?: string; message?: string };
    try {
      body = await response.json();
    } catch {
      throw new Error(`Server returned an unexpected response (HTTP ${response.status}). Please try again.`);
    }

    if (!response.ok || !body.success) {
      throw new Error(
        body.error ||
        `Account deletion failed (HTTP ${response.status}). Please try again or contact support.`
      );
    }

    // ── Success: clear all local state ──────────────────────────────────────
    // Sign out the Supabase session (best-effort — the auth user no longer exists)
    await supabase.auth.signOut().catch(() => {/* ignore — user is already gone */});

    // Clear every local storage key used by this app
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.SAVED_PROPERTIES);
    localStorage.removeItem(STORAGE_KEYS.REEL_LIKES);
    localStorage.removeItem(STORAGE_KEYS.REEL_SAVES);
    localStorage.removeItem(STORAGE_KEYS.FOLLOWERS);
    localStorage.removeItem(STORAGE_KEYS.REEL_COMMENTS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.ENQUIRIES);
    localStorage.removeItem(STORAGE_KEYS.REPORTS);
  },
};
