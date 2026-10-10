import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Enquiry, Property, Reel } from '../types/database';
import { authService } from './authService';
import { propertyService } from './propertyService';
import { reelService } from './reelService';
import { STORAGE_KEYS, getLocalState, setLocalState } from './storage';

export const enquiryService = {
  /**
   * Send an enquiry from a customer to a publisher.
   * sender_id = auth.uid() of the logged-in customer.
   * recipient_id = owner_id of the property / user_id of the reel creator.
   */
  async sendEnquiry(enquiryData: {
    property_id?: string;
    reel_id?: string;
    recipient_id: string;
    name: string;
    email: string;
    phone: string;
    message: string;
  }): Promise<Enquiry> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Cannot send enquiry.'
      );
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to send an enquiry.');
    }

    if (!enquiryData.recipient_id) {
      throw new Error('Enquiry has no recipient. The property or reel may not have an owner set.');
    }

    // Fetch linked content for the returned object (non-fatal if missing)
    let linkedProperty: Property | undefined;
    let linkedReel: Reel | undefined;
    if (enquiryData.property_id) {
      linkedProperty = (await propertyService.getPropertyById(enquiryData.property_id)) || undefined;
    }
    if (enquiryData.reel_id) {
      linkedReel = (await reelService.getReelById(enquiryData.reel_id)) || undefined;
    }

    const { data, error } = await supabase
      .from('enquiries')
      .insert({
        property_id: enquiryData.property_id || null,
        reel_id: enquiryData.reel_id || null,
        sender_id: currentUser.id,
        recipient_id: enquiryData.recipient_id,
        name: enquiryData.name,
        email: enquiryData.email,
        phone: enquiryData.phone,
        message: enquiryData.message,
        status: 'new'
      })
      .select('*, property:properties(*), reel:reels(*), sender:profiles!sender_id(*)')
      .single();

    if (error) {
      console.error('SUPABASE ERROR sendEnquiry:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to send enquiry: ${error.message}`);
    }

    return {
      ...(data as Enquiry),
      property: (data as any).property ?? linkedProperty,
      reel: (data as any).reel ?? linkedReel,
      sender: (data as any).sender ?? currentUser
    };
  },

  /**
   * Fetch all enquiries where the current user is the sender OR the recipient.
   * RLS enforces this — no need to filter client-side.
   */
  async getEnquiriesForUser(userId: string): Promise<Enquiry[]> {
    if (!userId) return [];

    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    // RLS policy "enquiries_select_parties" already filters to
    // rows where auth.uid() = sender_id OR auth.uid() = recipient_id
    const { data, error } = await supabase
      .from('enquiries')
      .select('*, property:properties(*), reel:reels(*), sender:profiles!sender_id(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('SUPABASE ERROR getEnquiriesForUser:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to load enquiries: ${error.message}`);
    }

    return (data ?? []) as Enquiry[];
  },

  async updateEnquiryStatus(id: string, status: Enquiry['status']): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase
      .from('enquiries')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('SUPABASE ERROR updateEnquiryStatus:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to update enquiry status: ${error.message}`);
    }
  },

  async getProfessionalDashboard(ownerId: string): Promise<{
    properties: Property[];
    enquiries: Enquiry[];
    reels: any[];
    totalViews: number;
  }> {
    if (!ownerId) return { properties: [], enquiries: [], reels: [], totalViews: 0 };

    const [props, enqs, userReels] = await Promise.all([
      propertyService.getProperties({ ownerId }),
      this.getEnquiriesForUser(ownerId),
      reelService.getReelsForUser(ownerId)
    ]);

    const totalViews = props.reduce((sum, p) => sum + (p.views_count || 0), 0);
    return { properties: props, enquiries: enqs, reels: userReels, totalViews };
  },

  async getAllEnquiries(): Promise<Enquiry[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('enquiries')
      .select('*, property:properties(*), reel:reels(*), sender:profiles!sender_id(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('SUPABASE ERROR getAllEnquiries:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to load all enquiries: ${error.message}`);
    }

    return (data ?? []) as Enquiry[];
  },

  async deleteEnquiry(enquiryId: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('enquiries')
        .delete()
        .eq('id', enquiryId);

      if (error) {
        console.error('SUPABASE ERROR deleteEnquiry:', error.message);
      }
    }
    const cached = getLocalState<Enquiry[]>(STORAGE_KEYS.ENQUIRIES, []);
    const filtered = cached.filter((e: Enquiry) => e.id !== enquiryId);
    setLocalState(STORAGE_KEYS.ENQUIRIES, filtered);
  }
};
