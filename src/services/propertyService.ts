import { supabase, isSupabaseConfigured, uploadFileToSupabase } from '../lib/supabase';
import type { Property, PropertyType, ListingType, Profile } from '../types/database';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';
import { authService } from './authService';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Enrich a raw DB property row with its owner profile when available. */
function enrichProperty(row: any, profiles: Profile[]): Property {
  const p = row as Property;
  if (!p.owner && p.owner_id) {
    const ownerProf = profiles.find(pr => pr.id === p.owner_id);
    if (ownerProf) return { ...p, owner: ownerProf };
  }
  // Normalise media: if DB returned an images[] column but no media join, synthesise media array
  if ((!p.media || p.media.length === 0) && (p as any).images?.length > 0) {
    return {
      ...p,
      media: (p as any).images.map((url: string, idx: number) => ({
        id: `media-${p.id}-${idx}`,
        created_at: p.created_at,
        property_id: p.id,
        url,
        media_type: 'image' as const,
        is_cover: idx === 0,
        display_order: idx + 1
      }))
    };
  }
  return p;
}

// ---------------------------------------------------------------------------
// SERVICE
// ---------------------------------------------------------------------------

export const propertyService = {
  /**
   * Fetch published properties. When Supabase is configured this is the SOLE
   * source — no localStorage merge. This ensures customers on any device see
   * the same data as the publisher.
   */
  async getProperties(filters?: {
    city?: string;
    propertyType?: PropertyType | 'all';
    listingType?: ListingType | 'all';
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number | 'any';
    searchQuery?: string;
    ownerId?: string;
    status?: string;
  }): Promise<Property[]> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }

    let query = supabase
      .from('properties')
      .select('*, owner:profiles(*), media:property_media(*)');

    // Apply server-side filters
    if (filters?.ownerId) {
      query = query.eq('owner_id', filters.ownerId);
    }
    if (filters?.city && filters.city !== 'all') {
      query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters?.propertyType && filters.propertyType !== 'all') {
      if (filters.propertyType === 'apartment' || filters.propertyType === 'flat') {
        query = query.in('property_type', ['apartment', 'flat']);
      } else if (filters.propertyType === 'penthouse' || filters.propertyType === 'villa') {
        query = query.in('property_type', ['penthouse', 'villa']);
      } else {
        query = query.eq('property_type', filters.propertyType);
      }
    }
    if (filters?.listingType && filters.listingType !== 'all') {
      if (filters.listingType === 'sell' || filters.listingType === 'buy') {
        query = query.in('listing_type', ['sell', 'buy']);
      } else {
        query = query.eq('listing_type', filters.listingType);
      }
    }
    if (filters?.status) {
      if (filters.status === 'active' || filters.status === 'available') {
        query = query.in('status', ['active', 'available']);
      } else {
        query = query.eq('status', filters.status);
      }
    }
    if (filters?.minPrice) query = query.gte('price', filters.minPrice);
    if (filters?.maxPrice) query = query.lte('price', filters.maxPrice);
    if (filters?.bedrooms && filters.bedrooms !== 'any') {
      query = query.gte('bedrooms', Number(filters.bedrooms));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load properties: ${error.message}`);
    }

    const profiles = data
      ? data.flatMap((row: any) => (row.owner ? [row.owner as Profile] : []))
      : [];

    let list: Property[] = (data ?? []).map((row: any) => enrichProperty(row, profiles));

    // Client-side text search (can't easily do full-text server-side without fts index)
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return list;
  },

  async getPropertyById(id: string): Promise<Property | null> {
    if (!id) return null;

    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }

    const { data, error } = await supabase
      .from('properties')
      .select('*, owner:profiles(*), media:property_media(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load property: ${error.message}`);
    }
    if (!data) return null;

    return enrichProperty(data, data.owner ? [data.owner as Profile] : []);
  },

  /**
   * Create a property. owner_id MUST be the authenticated Supabase auth.uid().
   * Throws if not authenticated or if Supabase insert fails.
   */
  async createProperty(
    propertyData: Omit<Property, 'id' | 'created_at' | 'updated_at' | 'views_count' | 'owner' | 'media'>,
    imageUrls: string[]
  ): Promise<Property> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Cannot create property. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to create a property.');
    }

    // Always use the authenticated user's real Supabase UUID — never a fake/local ID
    const ownerId = currentUser.id;

    const { data, error } = await supabase
      .from('properties')
      .insert({
        title: propertyData.title,
        description: propertyData.description,
        price: propertyData.price,
        property_type: propertyData.property_type,
        listing_type: propertyData.listing_type,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        area_sqft: propertyData.area_sqft,
        location: propertyData.location,
        city: propertyData.city,
        owner_id: ownerId,
        status: propertyData.status || 'available',
        amenities: propertyData.amenities ?? [],
        featured: propertyData.featured ?? false,
        // Store URLs in the images[] column too — this is the fallback
        // that PropertyCard uses if the property_media join returns nothing
        images: imageUrls.length > 0 ? imageUrls : []
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to create property: ${error.message}${error.details ? ` (${error.details})` : ''}`
      );
    }

    // Also insert into property_media for the full media join
    if (imageUrls.length > 0) {
      const { error: mediaError } = await supabase.from('property_media').insert(
        imageUrls.map((url, idx) => ({
          property_id: data.id,
          url,
          media_type: 'image',
          display_order: idx + 1
          // Note: is_cover intentionally omitted — old schema may not have it
        }))
      );
      if (mediaError) {
        // Non-fatal: images are already saved in properties.images[]
        // so they will still display via the enrichProperty fallback
        console.error('property_media insert error (non-fatal):', mediaError.message);
      }
    }

    // Return the full row with owner and media joined
    const created = await this.getPropertyById(data.id);
    return created ?? (data as Property);
  },

  async updatePropertyStatus(id: string, status: Property['status']): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase
      .from('properties')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new Error(`Failed to update property status: ${error.message}`);
    }
  },

  async toggleSaveProperty(propertyId: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      // localStorage-only fallback for saved/favourites (UI state, not published content)
      const saved = getLocalState<string[]>(STORAGE_KEYS.SAVED_PROPERTIES, []);
      const isSaved = saved.includes(propertyId);
      setLocalState(
        STORAGE_KEYS.SAVED_PROPERTIES,
        isSaved ? saved.filter((id) => id !== propertyId) : [...saved, propertyId]
      );
      return !isSaved;
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to save properties.');
    }

    const { data: existing } = await supabase
      .from('saved_properties')
      .select('id')
      .eq('property_id', propertyId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('saved_properties')
        .delete()
        .eq('property_id', propertyId)
        .eq('user_id', currentUser.id);
      // Update local cache for instant UI feedback
      const saved = getLocalState<string[]>(STORAGE_KEYS.SAVED_PROPERTIES, []);
      setLocalState(STORAGE_KEYS.SAVED_PROPERTIES, saved.filter((id) => id !== propertyId));
      return false;
    } else {
      await supabase
        .from('saved_properties')
        .insert({ property_id: propertyId, user_id: currentUser.id });
      const saved = getLocalState<string[]>(STORAGE_KEYS.SAVED_PROPERTIES, []);
      setLocalState(STORAGE_KEYS.SAVED_PROPERTIES, [...saved, propertyId]);
      return true;
    }
  },

  async getSavedPropertyIds(): Promise<string[]> {
    if (!isSupabaseConfigured) {
      return getLocalState<string[]>(STORAGE_KEYS.SAVED_PROPERTIES, []);
    }
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) return [];

    const { data, error } = await supabase
      .from('saved_properties')
      .select('property_id')
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Failed to fetch saved property IDs:', error.message);
      return getLocalState<string[]>(STORAGE_KEYS.SAVED_PROPERTIES, []);
    }

    const ids = (data ?? []).map((r: any) => r.property_id).filter(Boolean);
    setLocalState(STORAGE_KEYS.SAVED_PROPERTIES, ids);
    return ids;
  },

  async incrementPropertyViews(propertyId: string): Promise<void> {
    if (!isSupabaseConfigured || !propertyId) return;
    // Fire-and-forget view count increment; errors are non-fatal
    try {
      const { error: rpcError } = await supabase.rpc('increment_property_views', { prop_id: propertyId });
      if (rpcError) {
        // RPC may not exist — fall back to manual increment
        const { data } = await supabase
          .from('properties')
          .select('views_count')
          .eq('id', propertyId)
          .maybeSingle();
        if (data) {
          await supabase
            .from('properties')
            .update({ views_count: (data.views_count || 0) + 1 })
            .eq('id', propertyId);
        }
      }
    } catch (_err) {
      // Non-fatal — view count failures should never break the app
    }
  },

  async uploadPropertyImage(imageFile: File): Promise<string> {
    return uploadFileToSupabase('properties', imageFile);
  },

  async deleteProperty(propertyId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) {
      throw new Error(`Failed to delete property: ${error.message}`);
    }
  }
};
