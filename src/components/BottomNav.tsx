import React, { useState } from 'react';
import { Building2, Heart, User, Shield, MessageCircle, Landmark, Coins, Gift, Menu, X } from 'lucide-react';
import type { Profile } from '../types/database';
import type { AppTab } from './Navbar';

interface BottomNavProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentUser: Profile | null;
  savedCount: number;
}

// Instagram Clapperboard Reel Icon
const InstagramReelsIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : ''}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={active ? "2.5" : "2"}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M2 9.5h20" />
    <path d="M2 14.5h20" />
    <path d="M7 2v20" />
    <path d="M17 2v20" />
    <polygon points="10,10 15,12 10,14" fill="currentColor" />
  </svg>
);

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  savedCount
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleSelect = (tab: AppTab) => {
    onTabChange(tab);
    setIsMoreOpen(false);
  };

  const isMoreActive = ['chats', 'saved', 'referral', 'professional', 'admin'].includes(currentTab);

  return (
    <>
      {/* Mobile More Sheet Modal */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-extrabold text-sm text-slate-900">Explore IndoProperty</span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => handleSelect('referral')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                  currentTab === 'referral' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-xs">Refer & Earn</p>
                  <p className="text-[10px] text-slate-500">+50 Tokens</p>
                </div>
              </button>

              <button
                onClick={() => handleSelect('chats')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                  currentTab === 'chats' ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-xs">Messages</p>
                  <p className="text-[10px] text-slate-500">Direct Chat</p>
                </div>
              </button>

              <button
                onClick={() => handleSelect('saved')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                  currentTab === 'saved' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="p-2 bg-rose-100 rounded-xl text-rose-700">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-xs">Saved Items</p>
                  <p className="text-[10px] text-slate-500">{savedCount} Bookmarks</p>
                </div>
              </button>

              {currentUser && (
                <button
                  onClick={() => handleSelect('professional')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                    currentTab === 'professional' ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Dashboard</p>
                    <p className="text-[10px] text-slate-500">Post & Leads</p>
                  </div>
                </button>
              )}

              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => handleSelect('admin')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition sm:col-span-2 ${
                    currentTab === 'admin' ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="p-2 bg-purple-100 rounded-xl text-purple-700">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Admin Console</p>
                    <p className="text-[10px] text-slate-500">Loans & Tokens</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] px-3 flex items-center justify-around text-[10px] font-bold text-slate-500">
        <button
          onClick={() => onTabChange('properties')}
          className={`flex flex-col items-center gap-1 transition ${
            currentTab === 'properties' ? 'text-indigo-600 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span>Properties</span>
        </button>

        {/* INSTAGRAM REELS TAB */}
        <button
          onClick={() => onTabChange('reels')}
          className={`flex flex-col items-center gap-1 transition relative ${
            currentTab === 'reels' ? 'text-purple-600 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <div className={`p-1 rounded-xl transition ${
            currentTab === 'reels' ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}>
            <InstagramReelsIcon active={currentTab === 'reels'} />
          </div>
          <span>Reels</span>
        </button>

        {/* HOME LOAN TAB */}
        <button
          onClick={() => onTabChange('homeloan')}
          className={`flex flex-col items-center gap-1 transition ${
            currentTab === 'homeloan' ? 'text-indigo-700 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <Landmark className="w-5 h-5" />
          <span>Home Loan</span>
        </button>

        {/* TOKEN WALLET TAB */}
        <button
          onClick={() => onTabChange('tokens')}
          className={`flex flex-col items-center gap-1 transition ${
            currentTab === 'tokens' ? 'text-amber-600 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <Coins className="w-5 h-5" />
          <span>Tokens</span>
        </button>

        {/* MORE POPUP MENU */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center gap-1 transition ${
            isMoreActive ? 'text-indigo-600 font-extrabold scale-105' : 'hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <Menu className="w-5 h-5" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-extrabold">
                {savedCount}
              </span>
            )}
          </div>
          <span>More</span>
        </button>
      </div>
    </>
  );
};
