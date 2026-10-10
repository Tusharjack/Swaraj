import React, { useState } from 'react';
import { Heart, MapPin, Bed, Bath, Maximize2, ShieldCheck, Mail, Share2, Send, CheckCircle2, Flag, MessageCircle } from 'lucide-react';
import type { Property } from '../types/database';
import { formatPrice } from './PropertyCard';
import { ShareModal } from './ShareModal';

interface PropertyDetailModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onOpenEnquiry: (property: Property) => void;
  onOpenDirectChat?: (recipientId: string, property: Property) => void;
  onOpenReport?: (target_type: 'reel' | 'property' | 'user' | 'comment', target_id: string, target_label?: string) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  isOpen,
  onClose,
  isSaved,
  onToggleSave,
  onOpenEnquiry,
  onOpenDirectChat,
  onOpenReport,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);

  if (!isOpen || !property) return null;

  const images = property.media?.map(m => m.url) || ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200'];

  const handleShare = () => {
    setIsShareOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-2 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Sticky Top Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs uppercase rounded-lg">
              {property.listing_type}
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold text-xs uppercase rounded-lg">
              {property.property_type}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {onOpenReport && (
              <button
                onClick={() => onOpenReport('property', property.id, property.title)}
                title="Report this property"
                className="p-2 text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-full transition"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onToggleSave(property.id)}
              className={`p-2 rounded-full transition ${
                isSaved ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 hover:text-rose-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 text-xl font-bold rounded-full hover:bg-slate-100 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Media Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-sm">
              <img
                src={images[activeImageIdx]}
                alt={property.title}
                className="w-full h-full object-cover transition-all duration-300"
              />
              <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium">
                {activeImageIdx + 1} / {images.length}
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                      activeImageIdx === idx ? 'border-indigo-600 scale-95 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title & Price Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                {property.title}
              </h1>
              <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-1.5 font-medium">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                {property.location}, {property.city}{(property as any).pincode ? ` - ${(property as any).pincode}` : ''}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shrink-0 text-left md:text-right">
              <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                {property.listing_type === 'rent' ? 'Monthly Rental' : 'Listed Price'}
              </span>
              <span className="text-2xl md:text-3xl font-black text-indigo-600">
                {formatPrice(property.price, property.listing_type)}
              </span>
            </div>
          </div>

          {/* Core Specs Bar */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <Bed className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Bedrooms</span>
                <strong className="text-sm text-slate-900">{property.bedrooms > 0 ? `${property.bedrooms} BHK` : 'Studio'}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <Bath className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Bathrooms</span>
                <strong className="text-sm text-slate-900">{property.bathrooms > 0 ? `${property.bathrooms} Bath` : 'N/A'}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Carpet Area</span>
                <strong className="text-sm text-slate-900">{property.area_sqft} sq.ft</strong>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">About Property</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* Amenities Grid */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">Amenities & Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {property.amenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listed By Owner / Broker Card */}
          {property.owner && (
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={property.owner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={property.owner.full_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-indigo-400"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base">{property.owner.full_name}</h4>
                    {property.owner.verified && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    {property.owner.agency_name || `${property.owner.role.toUpperCase()} Professional`}
                  </p>
                  <p className="text-xs text-indigo-300 mt-0.5">{property.owner.phone || '+91 98765 00000'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {onOpenDirectChat && (
                  <button
                    onClick={() => onOpenDirectChat(property.owner_id, property)}
                    className="flex-1 md:flex-none px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" /> Direct Chat
                  </button>
                )}
                <button
                  onClick={() => onOpenEnquiry(property)}
                  className="flex-1 md:flex-none px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" /> Send Enquiry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer CTA */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Property ID: <span className="font-mono font-semibold text-slate-800">{property.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenDirectChat && (
              <button
                onClick={() => onOpenDirectChat(property.owner_id, property)}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" /> Direct Chat
              </button>
            )}
            <button
              onClick={() => onOpenEnquiry(property)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-4 h-4" /> Contact Representative
            </button>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={property.title}
        text={`Check out ${property.title} in ${property.location}, ${property.city}`}
        url={window.location.href}
        imageUrl={images[0]}
      />
    </div>
  );
};
