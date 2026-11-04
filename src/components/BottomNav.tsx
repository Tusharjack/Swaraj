import React from 'react';
import { Compass, Coins, MessageCircle, User } from 'lucide-react';
import type { Profile } from '../types/database';
import type { AppTab } from './Navbar';

interface BottomNavProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentUser: Profile | null;
  savedCount: number;
}

// Reels icon — clean film-strip style matching Lucide outline family
const ReelsIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="4" />
    <circle cx="12" cy="12" r="3" />
    <line x1="2"  y1="7"  x2="22" y2="7" />
    <line x1="2"  y1="17" x2="22" y2="17" />
    <line x1="7"  y1="2"  x2="7"  y2="7" />
    <line x1="17" y1="2"  x2="17" y2="7" />
    <line x1="7"  y1="17" x2="7"  y2="22" />
    <line x1="17" y1="17" x2="17" y2="22" />
  </svg>
);

// The 5 fixed tabs — routes are preserved exactly
const TABS = [
  {
    id: 'properties' as AppTab,
    label: 'Explore',
    icon: <Compass size={24} strokeWidth={2} />,
    iconActive: <Compass size={24} strokeWidth={2.5} />,
  },
  {
    id: 'reels' as AppTab,
    label: 'Reels',
    icon: <ReelsIcon />,
    iconActive: <ReelsIcon />,
  },
  {
    id: 'chats' as AppTab,
    label: 'Messages',
    icon: <MessageCircle size={24} strokeWidth={2} />,
    iconActive: <MessageCircle size={24} strokeWidth={2.5} />,
  },
  {
    id: 'tokens' as AppTab,
    label: 'Tokens',
    icon: <Coins size={24} strokeWidth={2} />,
    iconActive: <Coins size={24} strokeWidth={2.5} />,
  },
  {
    id: 'professional' as AppTab,
    label: 'Profile',
    icon: <User size={24} strokeWidth={2} />,
    iconActive: <User size={24} strokeWidth={2.5} />,
  },
] as const;

// Active colour — premium purple
const ACTIVE = '#7138E8';
const INACTIVE = '#9CA3AF'; // tailwind gray-400

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  // currentUser and savedCount kept in props for API compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentUser: _currentUser,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  savedCount: _savedCount,
}) => {
  // Map Profile/Dashboard → professional tab; anything not in the 5 tabs
  // stays visually un-highlighted so other routes (admin, saved, etc.)
  // are still reachable via the Navbar "More" menu.
  const activeId = TABS.find(t => t.id === currentTab)?.id ?? null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #F1F1F1',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-end justify-around px-2 pt-2">
        {TABS.map((tab) => {
          // Hide Profile tab if not logged in — tap shows sign-in
          const isActive = activeId === tab.id;
          const color = isActive ? ACTIVE : INACTIVE;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '0 4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color,
                transition: 'color 0.18s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Icon */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.18s ease',
                }}
              >
                {isActive ? tab.iconActive : tab.icon}
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 0.2,
                  lineHeight: 1,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  whiteSpace: 'nowrap',
                  color,
                  transition: 'color 0.18s ease, font-weight 0.18s ease',
                }}
              >
                {tab.label}
              </span>

              {/* Active indicator dot */}
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: isActive ? ACTIVE : 'transparent',
                  transition: 'background 0.18s ease',
                  marginTop: 1,
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
