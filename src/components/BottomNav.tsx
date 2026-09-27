import React from 'react';
import { Building2, Film, Heart, User, Shield, MessageCircle } from 'lucide-react';
import type { Profile } from '../types/database';

interface BottomNavProps {
  currentTab: 'properties' | 'reels' | 'chats' | 'saved' | 'professional' | 'admin';
  onTabChange: (tab: 'properties' | 'reels' | 'chats' | 'saved' | 'professional' | 'admin') => void;
  currentUser: Profile | null;
  savedCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  savedCount
}) => {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-4 flex items-center justify-around text-[10px] font-bold text-slate-500">
      <button
        onClick={() => onTabChange('properties')}
        className={`flex flex-col items-center gap-1 transition ${
          currentTab === 'properties' ? 'text-indigo-600 font-extrabold scale-105' : 'hover:text-slate-900'
        }`}
      >
        <Building2 className="w-5 h-5" />
        <span>Properties</span>
      </button>

      <button
        onClick={() => onTabChange('reels')}
        className={`flex flex-col items-center gap-1 transition relative ${
          currentTab === 'reels' ? 'text-purple-600 font-extrabold scale-105' : 'hover:text-slate-900'
        }`}
      >
        <div className="p-1 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-xl shadow-sm">
          <Film className="w-4 h-4" />
        </div>
        <span>Reels</span>
      </button>

      <button
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center gap-1 transition relative ${
          currentTab === 'chats' ? 'text-purple-600 font-extrabold scale-105' : 'hover:text-slate-900'
        }`}
      >
        <MessageCircle className="w-5 h-5 text-purple-600" />
        <span>Messages</span>
      </button>

      <button
        onClick={() => onTabChange('saved')}
        className={`flex flex-col items-center gap-1 transition relative ${
          currentTab === 'saved' ? 'text-indigo-600 font-extrabold scale-105' : 'hover:text-slate-900'
        }`}
      >
        <div className="relative">
          <Heart className="w-5 h-5" />
          {savedCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-extrabold">
              {savedCount}
            </span>
          )}
        </div>
        <span>Saved</span>
      </button>

      {currentUser?.role === 'professional' && (
        <button
          onClick={() => onTabChange('professional')}
          className={`flex flex-col items-center gap-1 transition ${
            currentTab === 'professional' ? 'text-indigo-600 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Pro Portal</span>
        </button>
      )}

      {currentUser?.role === 'admin' && (
        <button
          onClick={() => onTabChange('admin')}
          className={`flex flex-col items-center gap-1 transition ${
            currentTab === 'admin' ? 'text-purple-700 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span>Admin</span>
        </button>
      )}
    </div>
  );
};
