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

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export type TokenTransactionType =
  | 'earned_referral'      // tokens earned for referring a user
  | 'earned_referred'      // tokens earned by the referred user on signup
  | 'earned_admin'         // manually awarded by admin
  | 'spent_promotion'      // spent to promote a property listing
  | 'spent_featured'       // spent to feature a reel
  | 'deducted_admin';      // manually deducted by admin

export interface TokenTransaction {
  id: string;
  created_at: string;
  user_id: string;
  amount: number;           // positive = credit, negative = debit
  type: TokenTransactionType;
  description: string;
  reference_id?: string;    // property_id, reel_id, referral_id etc.
  admin_id?: string;        // set when admin manually adjusts
  user?: Profile;
}

export interface TokenWallet {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME LOAN
// ─────────────────────────────────────────────────────────────────────────────

export type LoanApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'cancelled';

export type EmploymentType =
  | 'salaried'
  | 'self_employed'
  | 'business'
  | 'freelancer'
  | 'retired';

export interface HomeLoanApplication {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;

  // Applicant
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  pan_number: string;
  city: string;

  // Employment & Income
  employment_type: EmploymentType;
  employer_name?: string;
  monthly_income: number;
  other_income?: number;
  existing_emi?: number;

  // Loan Details
  loan_amount: number;
  tenure_years: number;
  purpose: string;           // purchase / construction / renovation

  // Property Details
  property_address?: string;
  property_city?: string;
  property_value?: number;
  property_id?: string;      // linked to existing IndoProperty listing

  // Status
  status: LoanApplicationStatus;
  admin_notes?: string;
  approved_amount?: number;
  disbursed_amount?: number;
  disbursed_at?: string;
  reviewed_by?: string;

  // Joins
  user?: Profile;
  property?: Property;
}

// ─────────────────────────────────────────────────────────────────────────────
// REFERRAL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export type ReferralStatus = 'pending' | 'completed' | 'rewarded' | 'invalid';

export interface Referral {
  id: string;
  created_at: string;
  referrer_id: string;       // user who shared the code
  referred_id?: string;      // user who signed up using the code
  referral_code: string;     // unique code generated for referrer
  status: ReferralStatus;
  reward_tokens: number;     // tokens awarded on successful referral
  rewarded_at?: string;
  referred_email?: string;   // email used during signup (for tracking)
  referrer?: Profile;
  referred?: Profile;
}

export interface ReferralConfig {
  referrer_reward: number;   // tokens given to the person who referred
  referred_reward: number;   // tokens given to the new user on signup
  min_activity_required: boolean; // must the referred user complete an action?
}
