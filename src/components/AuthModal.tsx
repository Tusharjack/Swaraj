import React, { useState } from 'react';
import { LogIn, UserPlus, Shield, Building2, User, Sparkles, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { Profile, UserRole, ProfessionalType } from '../types/database';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: Profile) => void;
  profilesList: Profile[];
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [professionalType, setProfessionalType] = useState<ProfessionalType>('broker');
  const [agencyName, setAgencyName] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  // BUG 4 FIX: track email-confirmation-pending state separately so we show
  // the confirmation banner instead of navigating to the authenticated app
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  if (!isOpen) return null;

  const isEmailUnconfirmed = errorMsg.toLowerCase().includes('email not confirmed');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { profile, error } = await api.login(email, password, role);
        if (error) setErrorMsg(error);
        else if (profile) {
          onAuthSuccess(profile);
          onClose();
        }
      } else if (mode === 'signup') {
        if (!fullName) {
          setErrorMsg('Please enter your full name.');
          setLoading(false);
          return;
        }
        const result = await api.signUp({
          email,
          password,
          fullName,
          role,
          professionalType: role === 'professional' ? professionalType : undefined,
          agencyName: role === 'professional' ? agencyName : undefined,
          phone,
          city
        });
        // BUG 4 FIX: email confirmation required — show banner, don't log in
        if ((result as any).needsEmailConfirmation) {
          setNeedsEmailConfirmation(true);
          return;
        }
        if (result.error) setErrorMsg(result.error);
        else if (result.profile) {
          onAuthSuccess(result.profile);
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold mb-1.5 border border-indigo-400/30">
              <Sparkles className="w-3 h-3 text-indigo-400" /> SWARAJ Authentication
            </div>
            <h3 className="font-bold text-lg sm:text-xl">
              {mode === 'login' ? 'Welcome Back' : 'Create SWARAJ Account'}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Access property discovery, professional listings, video reels & enquiries
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-2 rounded-xl hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 p-1.5 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'signup' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Register Account
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
        {/* Email confirmation pending banner */}
          {needsEmailConfirmation ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-3xl">📧</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">Check your inbox!</h4>
                <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
                  We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
                </p>
              </div>
              <button
                onClick={() => { setNeedsEmailConfirmation(false); setMode('login'); }}
                className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
          <>
          {errorMsg && (
            <div className={`mb-4 p-3 rounded-xl text-xs font-medium border ${
              isEmailUnconfirmed ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{errorMsg}</p>
                  {isEmailUnconfirmed && (
                    <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
                      💡 <strong>Fix in 1 step:</strong> Open Supabase Dashboard &gt; Authentication &gt; Providers &gt; Email &gt; Turn OFF <strong>"Confirm email"</strong> to allow instant sign-in.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection Tabs */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Account Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  className={`p-2.5 border rounded-xl flex flex-col items-center gap-1 transition cursor-pointer ${
                    role === 'customer'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="text-xs">Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('professional')}
                  className={`p-2.5 border rounded-xl flex flex-col items-center gap-1 transition cursor-pointer ${
                    role === 'professional'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-xs">Professional</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-2.5 border rounded-xl flex flex-col items-center gap-1 transition cursor-pointer ${
                    role === 'admin'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-xs">Admin</span>
                </button>
              </div>
            </div>

            {role === 'professional' && (
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Professional Role Type
                  </label>
                  <select
                    value={professionalType}
                    onChange={(e) => setProfessionalType(e.target.value as ProfessionalType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="broker">Broker / Real Estate Consultant</option>
                    <option value="builder">Property Builder / Developer</option>
                    <option value="owner">Direct Property Owner</option>
                  </select>
                </div>
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Agency / Brand Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="e.g. Skyline Luxury Realty"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. user@swaraj.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* PASSWORD FIELD */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai / Pune / Goa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* BIG PROMINENT REGISTER / LOGIN BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-98 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-5 h-5" /> Sign In to Account
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" /> Register Account Now
                  </>
                )}
              </button>
            </div>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
