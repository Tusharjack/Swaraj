import type { Profile, Property, Reel } from '../types/database';

export const SEED_PROFILES: Profile[] = [
  {
    id: 'user-customer-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: 'customer@swaraj.com',
    full_name: 'Rahul Sharma (Customer)',
    role: 'customer',
    phone: '+91 98200 11223',
    city: 'Mumbai',
    verified: true,
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300'
  },
  {
    id: 'user-broker-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: 'broker@swaraj.com',
    full_name: 'Vikram Mehta (Broker)',
    role: 'professional',
    professional_type: 'broker',
    agency_name: 'Apex Realty Consultancy',
    phone: '+91 98765 43210',
    city: 'Mumbai',
    verified: true,
    badge: 'BROKER PRO',
    bio: 'Certified luxury broker specializing in South Mumbai & Bandra penthouses.',
    avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300'
  },
  {
    id: 'user-builder-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: 'builder@swaraj.com',
    full_name: 'Sunita Infra (Builder)',
    role: 'professional',
    professional_type: 'builder',
    agency_name: 'Skyline Luxury Infra',
    phone: '+91 98920 55443',
    city: 'Mumbai',
    verified: true,
    badge: 'BUILDER PRO',
    bio: 'Premier real estate developers of ultra-luxury sea view residential towers.',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300'
  },
  {
    id: 'user-owner-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: 'owner@swaraj.com',
    full_name: 'Rajesh Patel (Owner)',
    role: 'professional',
    professional_type: 'owner',
    agency_name: 'Private Property Owner',
    phone: '+91 98111 22334',
    city: 'Pune',
    verified: true,
    badge: 'OWNER PRO',
    bio: 'Direct owner offering prime residential & commercial properties without broker fee.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'
  },
  {
    id: 'user-admin-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: 'admin@swaraj.com',
    full_name: 'Swaraj Super Admin',
    role: 'admin',
    agency_name: 'Swaraj Operations HQ',
    phone: '+91 1800 123 456',
    city: 'Mumbai',
    verified: true,
    badge: 'PLATFORM ADMIN',
    bio: 'System Administrator for Swaraj Real-Estate Platform.',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300'
  }
];

// No fake properties or reels — professionals create real listings
export const SEED_PROPERTIES: Property[] = [];
export const SEED_REELS: Reel[] = [];
