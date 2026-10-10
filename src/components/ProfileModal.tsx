import React, { useState, useEffect } from 'react';
import { Camera, User, Phone, MapPin, Building2, LogOut, CheckCircle2, Trash2, AlertTriangle, X } from 'lucide-react';
import { api } from '../services/api';
import type { Profile } from '../types/database';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  onProfileUpdated: (updated: Profile) => void;
  onLogout: () => void;
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────
interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
  deleteError: string | null;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmProps> = ({
  onConfirm,
  onCancel,
  deleting,
  deleteError,
}) => {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toUpperCase() === 'DELETE';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-rose-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-600 to-red-600 text-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Delete Account Permanently</h3>
              <p className="text-xs text-rose-100 mt-0.5">This cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="text-white/70 hover:text-white transition mt-0.5 shrink-0"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning list */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              The following will be permanently deleted:
            </p>
            <ul className="text-xs text-rose-700 space-y-1.5">
              {[
                'Your profile and account credentials',
                'All properties and listings you created',
                'All video reels you uploaded',
                'Your enquiries and chat history',
                'Saved properties and liked reels',
                'All uploaded photos and videos',
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <span className="text-rose-400 mt-0.5 shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Typed confirmation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type <span className="font-extrabold text-rose-600 tracking-widest">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={deleting}
              placeholder="Type DELETE here"
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono
                         focus:ring-2 focus:ring-rose-500 focus:border-rose-500
                         disabled:opacity-50 disabled:bg-slate-50"
            />
          </div>

          {/* Error banner */}
          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              {deleteError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold
                         hover:bg-slate-200 transition disabled:opacity-50"
            >
              Cancel — Keep Account
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!confirmed || deleting}
              className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs
                         font-bold shadow-md shadow-rose-200 transition
                         disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {deleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete My Account
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Profile Modal ─────────────────────────────────────────────────────────────
export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  onLogout,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setPhone(currentUser.phone || '');
      setCity(currentUser.city || 'Mumbai');
      setAgencyName(currentUser.agency_name || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(
        currentUser.avatar_url ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
      );
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingAvatar(true);
      try {
        const uploadedUrl = await api.uploadAvatar(file);
        setAvatarUrl(uploadedUrl);
      } catch (err) {
        console.error(err);
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await api.updateProfile(currentUser.id, {
        full_name: fullName,
        phone,
        city,
        agency_name: agencyName,
        bio,
        avatar_url: avatarUrl,
      });
      onProfileUpdated(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      // Success — close everything, sign out, redirect to home
      setShowDeleteConfirm(false);
      onClose();
      onLogout(); // clears currentUser in App state → shows login screen
      // Small delay so the logout state propagates before showing the toast
      setTimeout(() => {
        window.alert('Your account has been permanently deleted. We\'re sorry to see you go.');
      }, 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Account deletion failed. Please try again.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-xl">Profile Settings</h3>
              <p className="text-xs text-slate-300">Update photo, phone, city & professional bio</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-xl">
              ✕
            </button>
          </div>

          {/* Scrollable Form Body */}
          <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
            {savedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Profile updated successfully!
              </div>
            )}

            {/* Avatar upload */}
            <div className="flex flex-col items-center justify-center text-center space-y-2 py-2">
              <div className="relative group cursor-pointer">
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500/20 shadow-md group-hover:opacity-90 transition"
                />
                <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 shadow-md transition">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-indigo-600 font-bold">
                {uploadingAvatar ? 'Uploading new photo...' : 'Click camera icon to change profile pic'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {currentUser.role === 'professional' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Agency / Brand Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Skyline Luxury Realty"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Bio / Tagline
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Senior Real Estate Consultant specializing in luxury properties..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* ── Footer ── */}
            <div className="pt-3 border-t space-y-3">
              {/* Top row: Sign Out + Save */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { onLogout(); onClose(); }}
                  className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>

              {/* Delete Account — danger zone */}
              <div className="border border-dashed border-rose-200 rounded-2xl p-3 bg-rose-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-rose-700">Danger Zone</p>
                    <p className="text-[11px] text-rose-500 mt-0.5">
                      Permanently delete your account and all associated data. This cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
                    className="shrink-0 px-3 py-1.5 bg-white border border-rose-300 text-rose-600
                               hover:bg-rose-600 hover:text-white hover:border-rose-600
                               rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Account
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Delete confirmation dialog — rendered above the profile modal */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
          deleting={deleting}
          deleteError={deleteError}
        />
      )}
    </>
  );
};
