import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ChatMessage } from '../types/database';
import { authService } from './authService';

export const chatService = {
  /**
   * Find an existing enquiry between two users for a given property/reel,
   * or create a new one. Returns the enquiry id.
   */
  async findOrCreateConversation(
    customerId: string,
    publisherId: string,
    propertyId?: string,
    reelId?: string,
    initialMessage?: string
  ): Promise<string> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to start a conversation.');
    }

    // Try to reuse an existing enquiry between these two users for this listing
    const { data: existing } = await supabase
      .from('enquiries')
      .select('id')
      .eq('sender_id', customerId)
      .eq('recipient_id', publisherId)
      .eq('property_id', propertyId || null)
      .maybeSingle();

    if (existing?.id) return existing.id;

    // Create a new enquiry as the conversation anchor
    const { data, error } = await supabase
      .from('enquiries')
      .insert({
        property_id: propertyId || null,
        reel_id: reelId || null,
        sender_id: customerId,
        recipient_id: publisherId,
        name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        message: initialMessage || 'Started a direct chat conversation',
        status: 'new'
      })
      .select('id')
      .single();

    if (error) {
      console.error('SUPABASE ERROR findOrCreateConversation:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Fetch all chat messages for an enquiry.
   * Supabase RLS ensures only sender/receiver can read them.
   * This is the method called as api.getMessagesForEnquiry() from the UI.
   */
  async getMessagesForEnquiry(enquiryId: string): Promise<ChatMessage[]> {
    if (!enquiryId) return [];

    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('SUPABASE ERROR getMessagesForEnquiry:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to load messages: ${error.message}`);
    }

    return (data ?? []) as ChatMessage[];
  },

  /**
   * Legacy alias — some call sites use getChatMessages(enquiryId).
   */
  async getChatMessages(enquiryId: string): Promise<ChatMessage[]> {
    return this.getMessagesForEnquiry(enquiryId);
  },

  /**
   * Send a chat message.
   * This is the method called as api.sendMessage({ enquiry_id, receiver_id, message }) from the UI.
   */
  async sendMessage(payload: {
    enquiry_id: string;
    receiver_id: string;
    message: string;
  }): Promise<ChatMessage> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to send messages.');
    }

    if (!payload.receiver_id) {
      throw new Error('Cannot send message: receiver ID is missing.');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        enquiry_id: payload.enquiry_id,
        sender_id: currentUser.id,
        receiver_id: payload.receiver_id,
        message: payload.message,
        read: false
      })
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .single();

    if (error) {
      console.error('SUPABASE ERROR sendMessage:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return data as ChatMessage;
  },

  /**
   * Legacy alias — some call sites use sendChatMessage(enquiryId, receiverId, text).
   */
  async sendChatMessage(enquiryId: string, receiverId: string, messageText: string): Promise<ChatMessage> {
    return this.sendMessage({ enquiry_id: enquiryId, receiver_id: receiverId, message: messageText });
  },

  async markMessagesAsRead(enquiryId: string, userId?: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    const currentUser = userId
      ? { id: userId }
      : await authService.getCurrentUser();

    if (!currentUser) return;

    const { error } = await supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('enquiry_id', enquiryId)
      .eq('receiver_id', currentUser.id)
      .eq('read', false);

    if (error) {
      // Non-fatal — just log it
      console.error('SUPABASE ERROR markMessagesAsRead:', {
        code: error.code,
        message: error.message
      });
    }
  },

  async getUnreadCountsByEnquiry(userId: string): Promise<{ [enquiryId: string]: number }> {
    const counts: { [enquiryId: string]: number } = {};
    if (!userId || !isSupabaseConfigured) return counts;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('enquiry_id')
      .eq('receiver_id', userId)
      .eq('read', false);

    if (error) {
      console.error('SUPABASE ERROR getUnreadCountsByEnquiry:', {
        code: error.code,
        message: error.message
      });
      return counts;
    }

    (data ?? []).forEach((r: any) => {
      if (r.enquiry_id) {
        counts[r.enquiry_id] = (counts[r.enquiry_id] || 0) + 1;
      }
    });

    return counts;
  }
};
