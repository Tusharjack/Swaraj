import type { Profile } from '../types/database';

export const STORAGE_KEYS = {
  CURRENT_USER: 'SWARAJ_CURRENT_USER',
  PROFILES: 'SWARAJ_PROFILES_STATE',
  PROPERTIES: 'SWARAJ_PROPERTIES_STATE',
  REELS: 'SWARAJ_REELS_STATE',
  ENQUIRIES: 'SWARAJ_ENQUIRIES_STATE',
  SAVED_PROPERTIES: 'SWARAJ_SAVED_PROPERTIES_STATE',
  REEL_LIKES: 'SWARAJ_REEL_LIKES_STATE',
  REEL_COMMENTS: 'SWARAJ_REEL_COMMENTS_STATE',
  REEL_SAVES: 'SWARAJ_REEL_SAVES_STATE',
  REEL_SHARES: 'SWARAJ_REEL_SHARES_STATE',
  FOLLOWERS: 'SWARAJ_FOLLOWERS_STATE',
  NOTIFICATIONS: 'SWARAJ_NOTIFICATIONS_STATE',
  REPORTS: 'SWARAJ_REPORTS_STATE',
  CHAT_MESSAGES: 'SWARAJ_CHAT_MESSAGES_STATE',
  LAST_API_ERROR: 'SWARAJ_LAST_API_ERROR'
};

export function getLocalState<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (_e) {
    return defaultVal;
  }
}

export function setLocalState<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

export function getValidUuid(id?: string): string {
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  if (!id) return '00000000-0000-4000-8000-000000000000';
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (Math.abs(h1).toString(16).padStart(8, '0') + Math.abs(h2).toString(16).padStart(4, '0')).slice(0, 12);
  return `00000000-0000-4000-8000-${hex}`;
}

export function idsEqual(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.toLowerCase() === b.toLowerCase()) return true;

  const profiles = getLocalState<Profile[]>(STORAGE_KEYS.PROFILES, []);
  const profA = profiles.find(p => p.id === a || p.email?.toLowerCase() === a.toLowerCase());
  const profB = profiles.find(p => p.id === b || p.email?.toLowerCase() === b.toLowerCase());
  if (profA && profB) {
    if (profA.id === profB.id) return true;
    if (profA.email && profB.email && profA.email.toLowerCase() === profB.email.toLowerCase()) return true;
  }
  return false;
}

export function getLastError(): string | null {
  return getLocalState<string | null>(STORAGE_KEYS.LAST_API_ERROR, null);
}

export function setLastError(errorMsg: string | null): void {
  setLocalState(STORAGE_KEYS.LAST_API_ERROR, errorMsg);
}
