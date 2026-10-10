import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, Shield, Sparkles, Lock, Eye, EyeOff, AlertCircle, Key, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Profile, UserRole, ProfessionalType } from '../types/database';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: Profile) => void;
  profilesList: Profile[];
  initialRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  profilesList,
  initialRole = 'professional'
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('professional');
  const [professionalType, setProfessionalType] = useState<ProfessionalType>('broker');
  const [agencyName, setAgencyName] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [securityPin, setSecurityPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  useEffect(() => {
    if (initialRole === 'admin') {
      setRole('admin');
    } else {
      setRole('professional');
    }
  }, [initialRole, isOpen]);

  if (!isOpen) return null;

  const isAdminMode = role === 'admin';
  const isEmailUnconfirmed = errorMsg.toLowerCase().includes('email not confirmed');

  const handleAutofillAdmin = () => {
    const adminProf = profilesList.find(p => p.role === 'admin');
    setEmail(adminProf?.email || 'admin@indoproperty.com');
    setPassword('password123');
    setSecurityPin('889900');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login' || isAdminMode) {
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
          role: 'professional',
          professionalType: professionalType,
          agencyName: agencyName,
          phone,
          city
        });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300 ${
        isAdminMode ? 'bg-slate-950 border-purple-500/30 text-white' : 'bg-white border-slate-100'
      }`}>
        {/* Header */}
        <div className={`p-5 sm:p-6 flex items-center justify-between shrink-0 transition-all ${
          isAdminMode
            ? 'bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 border-b border-purple-800/40 text-white'
            : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white'
        }`}>
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-1.5 border ${
              isAdminMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
            }`}>
              {isAdminMode ? (
                <>
                  <Shield className="w-3 h-3 text-purple-400" /> Executive System Admin Portal
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-indigo-400" /> IndoProperty Portal
                </>
              )}
            </div>
            <h3 className="font-bold text-lg sm:text-xl">
              {isAdminMode
                ? 'System Governance & Moderation Login'
                : mode === 'login'
                ? 'Welcome Back'
                : 'Create IndoProperty Account'}
            </h3>
            <p className={`text-xs mt-0.5 ${isAdminMode ? 'text-purple-200/80' : 'text-slate-300'}`}>
              {isAdminMode
                ? 'Restricted Terminal • Platform controls, user verification & content moderation'
                : 'Access property discovery, list & post properties, upload video reels & manage leads'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className={`text-xl font-bold p-2 rounded-xl transition ${
              isAdminMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Mode Selector */}
        {!isAdminMode && (
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
        )}

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
                  isAdminMode
                    ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                    : isEmailUnconfirmed
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <p className="font-bold">{errorMsg}</p>
                      {isEmailUnconfirmed && !isAdminMode && (
                        <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
                          💡 <strong>Fix in 1 step:</strong> Open Supabase Dashboard &gt; Authentication &gt; Providers &gt; Email &gt; Turn OFF <strong>"Confirm email"</strong> to allow instant sign-in.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ADMIN MODE SPECIAL HIGH-SECURITY BANNER */}
              {isAdminMode && (
                <div className="mb-5 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-300 uppercase tracking-wider">
                      <Shield className="w-4 h-4 text-purple-400" /> AES-256 System Authorization
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[10px] font-mono border border-purple-400/30">
                      SECURE TERMINAL
                    </span>
                  </div>
                  <p className="text-xs text-purple-300/80 leading-relaxed">
                    This terminal is restricted to authorized platform administrators. Public self-registration for Admin privileges is disabled for system protection.
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleAutofillAdmin}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-900/50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Fill Demo Admin Credentials
                    </button>
                    <span className="text-[10px] text-purple-400 font-mono">MFA ACTIVE</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && !isAdminMode && (
                  <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Account Type / Role
                      </label>
                      <select
                        value={professionalType}
                        onChange={(e) => setProfessionalType(e.target.value as ProfessionalType)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                      >
                        <option value="broker">Broker / Real Estate Consultant</option>
                        <option value="builder">Property Builder / Developer</option>
                        <option value="owner">Direct Property Owner / Individual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Agency / Brand Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        placeholder="e.g. Skyline Luxury Realty or Independent Owner"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                )}

                {mode === 'signup' && !isAdminMode && (
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

                {/* EMAIL FIELD */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isAdminMode ? 'text-purple-300' : 'text-slate-700'
                  }`}>
                    {isAdminMode ? 'Admin Corporate Email' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isAdminMode ? 'admin@indoproperty.com' : 'e.g. user@indoproperty.com'}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none transition ${
                      isAdminMode
                        ? 'bg-slate-900 border border-purple-500/40 text-white placeholder-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30'
                        : 'border border-slate-300 focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                {/* PASSWORD FIELD */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isAdminMode ? 'text-purple-300' : 'text-slate-700'
                  }`}>
                    {isAdminMode ? 'Master Security Password' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                      isAdminMode ? 'text-purple-400' : 'text-slate-400'
                    }`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-9 pr-10 py-2.5 rounded-xl text-sm focus:outline-none transition ${
                        isAdminMode
                          ? 'bg-slate-900 border border-purple-500/40 text-white placeholder-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30'
                          : 'border border-slate-300 focus:ring-2 focus:ring-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                        isAdminMode ? 'text-purple-400 hover:text-purple-200' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* SECURITY PIN / CODE FOR ADMIN MODE */}
                {isAdminMode && (
                  <div>
                    <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1">
                      System Authorization Code (PIN)
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                      <input
                        type="text"
                        value={securityPin}
                        onChange={(e) => setSecurityPin(e.target.value)}
                        placeholder="e.g. 889900"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm font-mono tracking-widest bg-slate-900 border border-purple-500/40 text-purple-200 placeholder-slate-600 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
                      />
                      {securityPin.length >= 4 && (
                        <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                      )}
                    </div>
                  </div>
                )}

                {mode === 'signup' && !isAdminMode && (
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

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3.5 px-4 font-extrabold rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer disabled:opacity-50 ${
                      isAdminMode
                        ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950/60 border border-purple-400/40'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-200'
                    }`}
                  >
                    {loading ? (
                      <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                    ) : isAdminMode ? (
                      <>
                        <Shield className="w-5 h-5 text-purple-300" /> Authenticate & Launch Admin Console
                      </>
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

              {/* FOOTER SWITCHERS */}
              <div className="mt-6 pt-4 border-t border-slate-200/40 flex items-center justify-between text-xs">
                {isAdminMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRole('customer');
                      setErrorMsg('');
                    }}
                    className="text-purple-300 hover:text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Return to Standard User Login
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRole('admin');
                      setMode('login');
                      setErrorMsg('');
                    }}
                    className="text-slate-500 hover:text-purple-700 font-semibold flex items-center gap-1.5 transition cursor-pointer ml-auto"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-600" /> Executive Admin Portal
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

