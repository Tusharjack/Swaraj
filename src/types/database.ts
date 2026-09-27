export type UserRole = 'customer' | 'professional' | 'admin';
export type ProfessionalType = 'broker' | 'builder' | 'owner';

export interface Profile {
  id: string; // UUID (Supabase auth.uid())
  created_at: string;
  updated_at: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  role: UserRole;
  professional_type?: ProfessionalType;
  agency_name?: string;
  bio?: string;
  city?: string;
  verified: boolean;
  badge?: string;
}

// Must match DB CHECK: ('flat','apartment','villa','penthouse','plot','commercial','land','farmhouse')
export type PropertyType =
  | 'flat'
  | 'apartment'
  | 'villa'
  | 'penthouse'
  | 'plot'
  | 'commercial'
  | 'land'
  | 'farmhouse';

// Must match DB CHECK: ('buy','sell','rent','lease')
export type ListingType = 'buy' | 'sell' | 'rent' | 'lease';

// Must match DB CHECK: ('active','available','pending','sold','archived')
export type PropertyStatus = 'active' | 'available' | 'pending' | 'sold' | 'archived';

export interface Property {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  price: number;
  property_type: PropertyType;
  listing_type: ListingType;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  location: string;
  city: string;
  status: PropertyStatus;
  owner_id: string;
  featured: boolean;
  views_count: number;
  amenities: string[];
  images?: string[]; // Supabase column; media[] is the joined property_media rows
  owner?: Profile;
  media?: PropertyMedia[];
}

export interface PropertyMedia {
  id: string;
  created_at: string;
  property_id: string;
  url: string;
  media_type: 'image' | 'video' | 'floorplan';
  is_cover: boolean;
  display_order: number;
}

// Must match DB CHECK: ('draft','published','archived')
export type ReelStatus = 'draft' | 'published' | 'archived';

export interface Reel {
  id: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
  property_id?: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  caption?: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  shares_count: number;
  views_count: number;
  status: ReelStatus;
  creator?: Profile;
  property?: Property;
  // Client-side flags — not stored in DB
  is_liked_by_user?: boolean;
  is_saved_by_user?: boolean;
  is_following_creator?: boolean;
}

export interface ReelComment {
  id: string;
  created_at: string;
  reel_id: string;
  user_id: string;
  content: string;
  user?: Profile;
}

export interface Enquiry {
  id: string;
  created_at: string;
  property_id?: string;
  reel_id?: string;
  sender_id?: string;
  recipient_id: string;
  recipient_email?: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'contacted' | 'closed';
  property?: Property;
  reel?: Reel;
  sender?: Profile;
}

export interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  message: string;
  type: 'enquiry' | 'like' | 'comment' | 'follow' | 'system';
  read: boolean;
  link_url?: string;
}

export interface Report {
  id: string;
  created_at: string;
  reporter_id: string;
  target_type: 'property' | 'reel' | 'user' | 'comment';
  target_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
}

export interface ChatMessage {
  id: string;
  created_at: string;
  enquiry_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  sender?: Profile;
  receiver?: Profile;
}
