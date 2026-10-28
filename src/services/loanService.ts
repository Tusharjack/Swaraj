import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { HomeLoanApplication, LoanApplicationStatus } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';

export const loanService = {

  /** Submit a new home loan application */
  async applyForLoan(data: Omit<HomeLoanApplication,
    'id' | 'created_at' | 'updated_at' | 'user_id' | 'status' |
    'admin_notes' | 'approved_amount' | 'disbursed_amount' | 'disbursed_at' |
    'reviewed_by' | 'user' | 'property'>
  ): Promise<HomeLoanApplication> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) throw new Error('You must be signed in to apply for a loan.');

    const newApp: HomeLoanApplication = {
      ...data,
      id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      status: 'submitted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && sessionUser) {
      try {
        const { data: row, error } = await supabase
          .from('loan_applications')
          .insert({
            ...data,
            user_id: sessionUser.id,
            status: 'submitted'
          })
          .select()
          .single();

        if (!error && row) {
          const apps = getLocalState<HomeLoanApplication[]>(STORAGE_KEYS.LOAN_APPLICATIONS, []);
          apps.unshift(row as HomeLoanApplication);
          setLocalState(STORAGE_KEYS.LOAN_APPLICATIONS, apps);
          return row as HomeLoanApplication;
        }
      } catch (err) {
        console.warn('[Loan] Supabase loan application insert error, saving locally:', err);
      }
    }

    // Local state fallback
    const apps = getLocalState<HomeLoanApplication[]>(STORAGE_KEYS.LOAN_APPLICATIONS, []);
    apps.unshift(newApp);
    setLocalState(STORAGE_KEYS.LOAN_APPLICATIONS, apps);
    return newApp;
  },

  /** Get all loan applications for the current user */
  async getMyApplications(): Promise<HomeLoanApplication[]> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const userId = sessionUser?.id || currentProfile?.id;
    if (!userId) return [];

    if (isSupabaseConfigured && sessionUser) {
      try {
        const { data, error } = await supabase
          .from('loan_applications')
          .select('*, property:properties(id, title, location, city, price)')
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false });

        if (!error && data) return data as HomeLoanApplication[];
      } catch (err) {
        console.warn('[Loan] Supabase getMyApplications error:', err);
      }
    }

    const apps = getLocalState<HomeLoanApplication[]>(STORAGE_KEYS.LOAN_APPLICATIONS, []);
    return apps.filter(a => a.user_id === userId);
  },

  /** Admin: get all applications */
  async getAllApplications(): Promise<HomeLoanApplication[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('loan_applications')
          .select('*, user:profiles(id, full_name, email, phone, avatar_url), property:properties(id, title, city, price)')
          .order('created_at', { ascending: false });

        if (!error && data) return data as HomeLoanApplication[];
      } catch (err) {
        console.warn('[Loan] Supabase getAllApplications error:', err);
      }
    }

    return getLocalState<HomeLoanApplication[]>(STORAGE_KEYS.LOAN_APPLICATIONS, []);
  },

  /** Admin: update loan status + optional notes / amounts */
  async updateApplicationStatus(
    applicationId: string,
    status: LoanApplicationStatus,
    opts?: {
      admin_notes?: string;
      approved_amount?: number;
      disbursed_amount?: number;
    }
  ): Promise<void> {
    let sessionUser: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user;
      } catch (_e) {}
    }

    const currentProfile = getLocalState<any>(STORAGE_KEYS.CURRENT_USER, null);
    const adminId = sessionUser?.id || currentProfile?.id || 'admin';

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      reviewed_by: adminId,
    };
    if (opts?.admin_notes !== undefined) updates.admin_notes = opts.admin_notes;
    if (opts?.approved_amount !== undefined) updates.approved_amount = opts.approved_amount;
    if (status === 'disbursed') {
      updates.disbursed_amount = opts?.disbursed_amount;
      updates.disbursed_at = new Date().toISOString();
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('loan_applications')
          .update(updates)
          .eq('id', applicationId);
      } catch (err) {
        console.warn('[Loan] Supabase update status error:', err);
      }
    }

    // Local state fallback
    const apps = getLocalState<HomeLoanApplication[]>(STORAGE_KEYS.LOAN_APPLICATIONS, []);
    const updated = apps.map(a => a.id === applicationId ? { ...a, ...updates } as HomeLoanApplication : a);
    setLocalState(STORAGE_KEYS.LOAN_APPLICATIONS, updated);
  },

  /** Admin: get loan summary stats */
  async getLoanStats(): Promise<{
    total: number;
    submitted: number;
    under_review: number;
    approved: number;
    disbursed: number;
    rejected: number;
    total_requested: number;
    total_approved: number;
    total_disbursed: number;
  }> {
    let apps: Array<{
      status: LoanApplicationStatus;
      loan_amount: number;
      approved_amount: number | null;
      disbursed_amount: number | null;
    }> = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('loan_applications')
          .select('status, loan_amount, approved_amount, disbursed_amount');

        if (!error && data) {
          apps = data as any;
        }
      } catch (_e) {}
    }

    if (apps.length === 0) {
      const localApps = getLocalState<HomeLoanApplication[]>(STORAGE_KEYS.LOAN_APPLICATIONS, []);
      apps = localApps.map(a => ({
        status: a.status,
        loan_amount: a.loan_amount || 0,
        approved_amount: a.approved_amount || null,
        disbursed_amount: a.disbursed_amount || null
      }));
    }

    return {
      total:           apps.length,
      submitted:       apps.filter(a => a.status === 'submitted').length,
      under_review:    apps.filter(a => a.status === 'under_review').length,
      approved:        apps.filter(a => a.status === 'approved').length,
      disbursed:       apps.filter(a => a.status === 'disbursed').length,
      rejected:        apps.filter(a => a.status === 'rejected').length,
      total_requested: apps.reduce((s, a) => s + (Number(a.loan_amount) || 0), 0),
      total_approved:  apps.reduce((s, a) => s + (Number(a.approved_amount) || 0), 0),
      total_disbursed: apps.reduce((s, a) => s + (Number(a.disbursed_amount) || 0), 0),
    };
  },
};
