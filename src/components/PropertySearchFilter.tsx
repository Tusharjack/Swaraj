import React from 'react';
import { Search, MapPin, RotateCcw } from 'lucide-react';
import type { PropertyType, ListingType } from '../types/database';

export interface FilterState {
  searchQuery: string;
  city: string;
  propertyType: PropertyType | 'all';
  listingType: ListingType | 'all';
  minPrice: number;
  maxPrice: number;
  bedrooms: number | 'any';
}

interface PropertySearchFilterProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  totalResults: number;
}

export const PropertySearchFilter: React.FC<PropertySearchFilterProps> = ({ filters, onFilterChange, totalResults }) => {
  const handleReset = () => {
    onFilterChange({
      searchQuery: '',
      city: 'all',
      propertyType: 'all',
      listingType: 'all',
      minPrice: 0,
      maxPrice: 100000000,
      bedrooms: 'any',
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-4">
      {/* Top Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Search by location, project name, landmark..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {/* Quick City Dropdown */}
        <div className="relative md:w-48">
          <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
          <select
            value={filters.city}
            onChange={(e) => onFilterChange({ ...filters, city: e.target.value })}
            className="w-full pl-9 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
          >
            <option value="all">All Cities</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Pune">Pune</option>
            <option value="Goa">Goa</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Delhi">Delhi NCR</option>
          </select>
        </div>
      </div>

      {/* Filter Options Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Listing Type Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            {(['all', 'sell', 'rent'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onFilterChange({ ...filters, listingType: type })}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  filters.listingType === type
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type === 'sell' ? 'Buy' : type}
              </button>
            ))}
          </div>

          {/* Property Type Dropdown */}
          <select
            value={filters.propertyType}
            onChange={(e) => onFilterChange({ ...filters, propertyType: e.target.value as any })}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Property Types</option>
            <option value="apartment">Apartment</option>
            <option value="villa">Luxury Villa</option>
            <option value="penthouse">Penthouse</option>
            <option value="plot">Plot / Land</option>
            <option value="commercial">Commercial Space</option>
          </select>

          {/* Bedrooms Selector */}
          <select
            value={filters.bedrooms}
            onChange={(e) => onFilterChange({ ...filters, bedrooms: e.target.value === 'any' ? 'any' : Number(e.target.value) })}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="any">Any BHK</option>
            <option value="1">1+ BHK</option>
            <option value="2">2+ BHK</option>
            <option value="3">3+ BHK</option>
            <option value="4">4+ BHK</option>
          </select>
        </div>

        {/* Results Counter & Reset */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-500">
            Showing <strong className="text-slate-900">{totalResults}</strong> properties
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};
