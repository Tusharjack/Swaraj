import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Report } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';
import { authService } from './authService';

export const reportService = {
  async submitReport(reportData: {
    target_type: 'property' | 'reel' | 'user' | 'comment';
    target_id: string;
    target_label?: string;
    reason: string;
    details?: string;
  }): Promise<Report> {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) throw new Error('Must be logged in to submit a content report.');

    const repId = `rep-${Date.now()}`;
    const newReport: Report = {
      id: repId,
      created_at: new Date().toISOString(),
      reporter_id: currentUser.id,
      target_type: reportData.target_type,
      target_id: reportData.target_id,
      reason: reportData.reason,
      status: 'pending'
    };

    const reports = getLocalState<Report[]>(STORAGE_KEYS.REPORTS, []);
    reports.unshift(newReport);
    setLocalState(STORAGE_KEYS.REPORTS, reports);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('reports').insert({
          id: repId,
          reporter_id: currentUser.id,
          target_type: reportData.target_type,
          target_id: reportData.target_id,
          reason: reportData.reason,
          details: reportData.details || reportData.target_label,
          status: 'pending'
        });
      } catch (_e) {}
    }

    return newReport;
  },

  async getAllReports(): Promise<Report[]> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (data) return data as Report[];
      } catch (_e) {}
    }
    return getLocalState<Report[]>(STORAGE_KEYS.REPORTS, []);
  },

  async updateReportStatus(id: string, status: Report['status']): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.from('reports').update({ status }).eq('id', id);
    }
    const list = getLocalState<Report[]>(STORAGE_KEYS.REPORTS, []);
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx].status = status;
      setLocalState(STORAGE_KEYS.REPORTS, list);
    }
  }
};
