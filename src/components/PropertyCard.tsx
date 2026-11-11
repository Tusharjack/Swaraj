import React from 'react';
import { Heart, MapPin, Bed, Bath, Maximize2, ShieldCheck, Eye, Sparkles, MessageCircle } from 'lucide-react';
import type { Property } from '../types/database';

interface PropertyCardProps {
  property: Property;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onClick: (property: Property) => void;
  onOpenDirectChat?: (recipientId: string, property: Property) => void;
}

export const formatPrice = (price: number, listingType: string): string => {
  let formatted = '';
  if (price >= 10000000) {
    formatted = `₹${(price / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  } else if (price >= 100000) {
    formatted = `₹${(price / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`;
  } else {
    formatted = `₹${price.toLocaleString('en-IN')}`;
  }
  return listingType === 'rent' || listingType === 'lease' ? `${formatted} / mo` : formatted;
};

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, isSaved, onToggleSave, onClick, onOpenDirectChat }) => {
  const coverImage = property.media?.find(m => m.is_cover)?.url || property.media?.[0]?.url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800';

  return (
    <div 
      onClick={() => onClick(property)}
      className="group card-premium bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden cursor-pointer flex flex-col justify-between"
    >
      {/* Media Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={coverImage}
          alt={property.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Overlay Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center z-10">
          <span className="px-2.5 py-1 bg-slate-900/85 backdrop-blur-md text-white font-bold text-[10px] uppercase tracking-wider rounded-lg">
            {property.listing_type}
          </span>
          <span className="px-2.5 py-1 bg-white/90 backdrop-blur-md text-slate-900 font-semibold text-[10px] uppercase tracking-wider rounded-lg border border-slate-200">
            {property.property_type}
          </span>
          {property.featured && (
            <span className="px-2 py-1 bg-amber-500 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3" /> Featured
            </span>
          )}
        </div>

        {/* Save Heart & Chat Buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {onOpenDirectChat && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDirectChat(property.owner_id, property);
              }}
              title="Chat directly with Publisher"
              className="p-2.5 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white backdrop-blur-md transition shadow-md cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(property.id);
            }}
            className={`p-2.5 rounded-full backdrop-blur-md transition shadow-md ${
              isSaved 
                ? 'bg-rose-500 text-white hover:bg-rose-600' 
                : 'bg-white/80 text-slate-700 hover:bg-white hover:text-rose-500'
            }`}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Price Overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-4 flex items-end justify-between">
          <span className="text-xl font-extrabold text-white tracking-tight">
            {formatPrice(property.price, property.listing_type)}
          </span>
          <span className="text-[11px] text-slate-200 font-medium flex items-center gap-1 bg-slate-900/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
            <Eye className="w-3 h-3" /> {property.views_count}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-indigo-600 transition">
            {property.title}
          </h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {property.location}, {property.city}
          </p>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-slate-600 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <Bed className="w-3.5 h-3.5 text-indigo-500" />
            <span>{property.bedrooms > 0 ? `${property.bedrooms} BHK` : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="w-3.5 h-3.5 text-indigo-500" />
            <span>{property.bathrooms > 0 ? `${property.bathrooms} Bath` : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>{property.area_sqft} sq.ft</span>
          </div>
        </div>

        {/* Owner & Verified Badge */}
        {property.owner && (
          <div className="mt-3 pt-2.5 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <img
                src={property.owner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={property.owner.full_name}
                className="w-5 h-5 rounded-full object-cover border"
              />
              <span className="font-medium text-slate-700 truncate max-w-[130px]">
                {property.owner.agency_name || property.owner.full_name}
              </span>
            </div>
            {property.owner.verified && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" /> Verified
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
