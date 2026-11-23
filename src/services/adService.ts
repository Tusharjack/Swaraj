import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Ad } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';

/**
 * Ad banner service.
 * Uses the `ads` table in Supabase when configured; falls back to localStorage
 * for local dev. Admins create / delete ads; the home feed only shows active ones.
 */
export const adService = {
  /** Returns only active ads, ordered by display_order then created_at. */
  async getActiveAds(): Promise<Ad[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('ads')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) {
          console.warn('[adService] getActiveAds error:', error.message);
          return [];
        }
        return (data ?? []) as Ad[];
      } catch (e) {
        console.warn('[adService] getActiveAds exception:', e);
        return [];
      }
    }
    const all = getLocalState<Ad[]>(STORAGE_KEYS.ADS, []);
    return all
      .filter(a => a.is_active)
      .sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
  },

  /** Admin: list every ad (active + inactive). */
  async getAllAds(): Promise<Ad[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('ads')
          .select('*')
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        return (data ?? []) as Ad[];
      } catch (e: any) {
        throw new Error(`Failed to load ads: ${e?.message || e}`);
      }
    }
    const all = getLocalState<Ad[]>(STORAGE_KEYS.ADS, []);
    return [...all].sort(
      (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at)
    );
  },

  /** Admin: create a new ad. */
  async createAd(ad: {
    title: string;
    image_url: string;
    link_url?: string;
    is_active?: boolean;
    display_order?: number;
  }): Promise<Ad> {
    if (!ad.title || !ad.image_url) {
      throw new Error('Ad title and image are required.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('ads')
        .insert({
          title: ad.title,
          image_url: ad.image_url,
          link_url: ad.link_url || null,
          is_active: ad.is_active ?? true,
          display_order: ad.display_order ?? 0,
        })
        .select('*')
        .single();
      if (error) throw new Error(`Failed to create ad: ${error.message}`);
      return data as Ad;
    }

    const all = getLocalState<Ad[]>(STORAGE_KEYS.ADS, []);
    const newAd: Ad = {
      id: `ad-${Date.now()}`,
      created_at: new Date().toISOString(),
      title: ad.title,
      image_url: ad.image_url,
      link_url: ad.link_url,
      is_active: ad.is_active ?? true,
      display_order: ad.display_order ?? 0,
    };
    all.push(newAd);
    setLocalState(STORAGE_KEYS.ADS, all);
    return newAd;
  },

  /** Admin: toggle an ad's active state. */
  async toggleAdActive(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { data: existing } = await supabase.from('ads').select('is_active').eq('id', id).maybeSingle();
      const next = !(existing?.is_active ?? false);
      const { error } = await supabase.from('ads').update({ is_active: next }).eq('id', id);
      if (error) throw new Error(`Failed to update ad: ${error.message}`);
      return;
    }
    const all = getLocalState<Ad[]>(STORAGE_KEYS.ADS, []);
    const idx = all.findIndex(a => a.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], is_active: !all[idx].is_active };
      setLocalState(STORAGE_KEYS.ADS, all);
    }
  },

  /** Admin: delete an ad. */
  async deleteAd(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('ads').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete ad: ${error.message}`);
      return;
    }
    const all = getLocalState<Ad[]>(STORAGE_KEYS.ADS, []);
    setLocalState(
      STORAGE_KEYS.ADS,
      all.filter(a => a.id !== id)
    );
  },
};
