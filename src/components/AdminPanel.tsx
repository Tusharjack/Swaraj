import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Building, Film, AlertTriangle, ShieldCheck, RefreshCw, Trash2, Key, RotateCcw, Mail, Coins, Home, UserPlus, Search, Filter, Landmark, CheckCircle2 } from 'lucide-react';
import type { Profile, Property, Reel, Report, Enquiry, UserRole, TokenTransaction, TokenWallet, HomeLoanApplication, Referral } from '../types/database';
import { api, SEED_PROFILES } from '../services/api';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'properties' | 'reels' | 'reports' | 'enquiries' | 'credentials' | 'tokens' | 'loans' | 'referrals'>('enquiries');
  const [users, setUsers] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [wallets, setWallets] = useState<TokenWallet[]>([]);
  const [loanApps, setLoanApps] = useState<HomeLoanApplication[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loanStats, setLoanStats] = useState<{ total:number; submitted:number; under_review:number; approved:number; disbursed:number; rejected:number; total_requested:number; total_approved:number; total_disbursed:number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [loanFilter, setLoanFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'disbursed' | 'rejected'>('all');
  const [loanSearch, setLoanSearch] = useState('');
  const [refFilter, setRefFilter] = useState<'all' | 'rewarded' | 'pending' | 'invalid'>('all');
  const [refSearch, setRefSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');

  // Token adjust state
  const [adjUserId, setAdjUserId] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjMsg, setAdjMsg] = useState<string | null>(null);
  // Loan status state
  const [loanNote, setLoanNote] = useState<Record<string, string>>({});
  const [loanApproved, setLoanApproved] = useState<Record<string, string>>({});

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [allUsers, allProps, allReels, allReports, allEnqs, allTxns, allWallets, allLoans, allRefs, stats] = await Promise.all([
        api.getAllUsers(),
        api.getProperties(),
        api.getReels(),
        api.getReports(),
        api.getAllEnquiries(),
        api.getAllTransactions(),
        api.getAllWallets(),
        api.getAllLoanApplications(),
        api.getAllReferrals(),
        api.getLoanStats(),
      ]);
      setUsers(allUsers);
      setProperties(allProps);
      setReels(allReels);
      setReports(allReports);
      setEnquiries(allEnqs);
      setTransactions(allTxns);
      setWallets(allWallets);
      setLoanApps(allLoans);
      setReferrals(allRefs);
      setLoanStats(stats);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleVerification = async (userId: string) => {
    await api.toggleUserVerification(userId);
    loadAdminData();
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    await api.updateUserRole(userId, newRole);
    loadAdminData();
  };

  const handlePropertyStatus = async (propId: string, status: Property['status']) => {
    await api.updatePropertyStatus(propId, status);
    loadAdminData();
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Admin Action: Delete user account "${userName}" permanently?`)) {
      try {
        setUsers(prev => prev.filter(u => u.id !== userId));
        await api.deleteUser(userId);
        loadAdminData();
      } catch (err: any) {
        console.error('Delete user error:', err);
        loadAdminData();
      }
    }
  };

  const handleDeleteProperty = async (propId: string) => {
    if (confirm('Admin Action: Delete this property listing permanently?')) {
      try {
        setProperties(prev => prev.filter(p => p.id !== propId));
        await api.deleteProperty(propId);
        loadAdminData();
      } catch (err: any) {
        console.error('Delete property error:', err);
        loadAdminData();
      }
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    if (confirm('Admin Action: Delete this video reel permanently?')) {
      try {
        setReels(prev => prev.filter(r => r.id !== reelId));
        await api.deleteReel(reelId);
        loadAdminData();
      } catch (err: any) {
        console.error('Delete reel error:', err);
        loadAdminData();
      }
    }
  };

  const handleReportStatus = async (reportId: string, status: Report['status']) => {
    await api.updateReportStatus(reportId, status);
    loadAdminData();
  };

  const handleResetPlatformData = async () => {
    if (confirm('⚠️ WARNING: This will purge all current platform data and re-initialize clean default accounts (Customer, Broker, Builder, Owner, Admin). Proceed?')) {
      await api.resetPlatformData();
      alert('✅ Platform database reset successfully! All 5 seed accounts are now ready.');
      window.location.reload();
    }
  };

  const handleDeleteEnquiry = async (enquiryId: string) => {
    if (confirm('Admin Action: Delete this enquiry permanently?')) {
      try {
        setEnquiries(prev => prev.filter(e => e.id !== enquiryId));
        await api.deleteEnquiry(enquiryId);
        loadAdminData();
      } catch (err: any) {
        console.error('Delete enquiry error:', err);
        loadAdminData();
      }
    }
  };

  return (
    <div className="space-y-6 relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-3xl">
          <div className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
            Loading Admin Data…
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-600 rounded-2xl text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">IndoProperty Platform Governance & Admin Moderation</h2>
            <p className="text-xs text-purple-200 mt-0.5">
              System Admin Console • Live platform data for Users, Properties, Reels & Reports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAdminData}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleResetPlatformData}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset All Data
          </button>
        </div>
      </div>

      {/* TASK 7 FIX: Platform aggregate stats (all from real fetched data, no static/mock) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Users', value: users.length, color: 'from-indigo-500 to-violet-500', icon: <Users className="w-4 h-4" /> },
          { label: 'Professionals', value: users.filter(u => u.role === 'professional').length, color: 'from-emerald-500 to-teal-500', icon: <Building className="w-4 h-4" /> },
          { label: 'Customers', value: users.filter(u => u.role === 'customer').length, color: 'from-sky-500 to-blue-500', icon: <Users className="w-4 h-4" /> },
          { label: 'Properties', value: properties.length, color: 'from-amber-500 to-orange-500', icon: <Building className="w-4 h-4" /> },
          { label: 'Reels', value: reels.length, color: 'from-fuchsia-500 to-purple-500', icon: <Film className="w-4 h-4" /> },
          { label: 'Reel Likes', value: reels.reduce((sum, r) => sum + (r.likes_count || 0), 0), color: 'from-rose-500 to-pink-500', icon: <ShieldCheck className="w-4 h-4" /> },
          { label: 'Enquiries', value: enquiries.length, color: 'from-slate-600 to-slate-800', icon: <Mail className="w-4 h-4" /> }
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{stat.label}</span>
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stat.color} text-white`}>
                {stat.icon}
              </div>
            </div>
            <div className="text-xl font-extrabold text-slate-900 leading-tight">{stat.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 -mt-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Comments</span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">{reels.reduce((sum, r) => sum + (r.comments_count || 0), 0)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Saves</span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">{reels.reduce((sum, r) => sum + (r.saves_count || 0), 0)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pending Reports</span>
          </div>
          <div className="text-lg font-extrabold text-amber-600 mt-1">{reports.filter(r => r.status === 'pending').length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Reports</span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">{reports.length}</div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('enquiries')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'enquiries'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4 text-indigo-500" /> Direct Enquiries ({enquiries.length})
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'credentials'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4 text-amber-500" /> Account Passwords ({SEED_PROFILES.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'users'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Users & Roles ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'properties'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" /> Properties ({properties.length})
          </button>
          <button
            onClick={() => setActiveTab('reels')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'reels'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-4 h-4" /> Reels Feed ({reels.length})
          </button>
          <button onClick={() => setActiveTab('reports')} className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${activeTab==='reports'?'border-purple-600 text-purple-700 bg-white font-extrabold':'border-transparent text-slate-600 hover:text-slate-900'}`}>
            <AlertTriangle className="w-4 h-4" /> Moderation Reports ({reports.length})
          </button>
          <button onClick={() => setActiveTab('tokens')} className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${activeTab==='tokens'?'border-purple-600 text-purple-700 bg-white font-extrabold':'border-transparent text-slate-600 hover:text-slate-900'}`}>
            <Coins className="w-4 h-4 text-amber-500" /> Tokens ({transactions.length})
          </button>
          <button onClick={() => setActiveTab('loans')} className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${activeTab==='loans'?'border-purple-600 text-purple-700 bg-white font-extrabold':'border-transparent text-slate-600 hover:text-slate-900'}`}>
            <Home className="w-4 h-4 text-indigo-500" /> Loans ({loanApps.length})
          </button>
          <button onClick={() => setActiveTab('referrals')} className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${activeTab==='referrals'?'border-purple-600 text-purple-700 bg-white font-extrabold':'border-transparent text-slate-600 hover:text-slate-900'}`}>
            <UserPlus className="w-4 h-4 text-emerald-500" /> Referrals ({referrals.length})
          </button>
        </div>

        <div className="p-6">
          {/* TAB: DIRECT ENQUIRIES */}
          {activeTab === 'enquiries' && (
            <div className="space-y-3">
              {enquiries.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Mail className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-500">No enquiries received yet.</p>
                  <p className="text-xs text-slate-400">When customers send direct enquiries on properties or reels, they'll appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {enquiries.map((enq) => (
                    <div key={enq.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1.5 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{enq.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              enq.status === 'new'
                                ? 'bg-amber-100 text-amber-800'
                                : enq.status === 'contacted'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {enq.status}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(enq.created_at).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {/* Contact info */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span>📧 {enq.email}</span>
                            <span>📞 {enq.phone}</span>
                            {enq.recipient_email && (
                              <span className="text-indigo-600 font-medium">→ To: {enq.recipient_email}</span>
                            )}
                          </div>

                          {/* Message */}
                          <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 leading-relaxed">
                            "{enq.message}"
                          </p>

                          {/* Property link */}
                          {(enq.property?.title || enq.property_id) && (
                            <p className="text-[11px] text-indigo-600 font-semibold">
                              🏠 Re: {enq.property?.title || `Property ID: ${enq.property_id}`}
                            </p>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteEnquiry(enq.id)}
                          className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition shrink-0"
                          title="Delete enquiry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: SYSTEM ACCOUNTS & PASSWORDS */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-purple-950">Default Platform Accounts & Credentials</h4>
                  <p className="text-xs text-purple-700">Pre-seeded login accounts for testing every user persona on IndoProperty.</p>
                </div>
                <button
                  onClick={handleResetPlatformData}
                  className="px-3.5 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700 transition"
                >
                  Clear & Re-Seed Accounts
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 uppercase text-[10px] text-slate-500 font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">User Type / Role</th>
                      <th className="p-3">Full Name</th>
                      <th className="p-3">Login Email ID</th>
                      <th className="p-3">Password</th>
                      <th className="p-3">Agency / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {SEED_PROFILES.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            acc.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            acc.professional_type === 'broker' ? 'bg-indigo-100 text-indigo-800' :
                            acc.professional_type === 'builder' ? 'bg-blue-100 text-blue-800' :
                            acc.professional_type === 'owner' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {acc.role === 'admin' ? 'SUPER ADMIN' : (acc.professional_type || acc.role)}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{acc.full_name}</td>
                        <td className="p-3 font-mono text-indigo-600 font-bold">{acc.email}</td>
                        <td className="p-3 font-mono font-extrabold text-emerald-700 bg-emerald-50/50 px-2 py-1 rounded-md inline-block my-1">
                          Password123!
                        </td>
                        <td className="p-3 text-slate-500">{acc.agency_name || 'Individual Customer'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 uppercase text-[10px] text-slate-500 font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3">City</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatar_url} alt={u.full_name} className="w-8 h-8 rounded-full border object-cover" />
                          <div>
                            <strong className="text-slate-900 font-semibold block">{u.full_name}</strong>
                            <span className="text-[11px] text-slate-400">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="customer">Customer</option>
                          <option value="professional">Professional</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <ShieldCheck className="w-3 h-3" /> {u.verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{u.city || '—'}</td>
                      <td className="p-3 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleVerification(u.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            u.verified 
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {u.verified ? 'Revoke Badge' : 'Grant Badge'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.full_name || u.email)}
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="divide-y divide-slate-100">
              {properties.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No properties in platform database.</p>
              ) : (
                properties.map((p) => (
                  <div key={p.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img src={p.media?.[0]?.url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300'} alt={p.title} className="w-12 h-12 rounded-xl object-cover border" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{p.title}</h4>
                        <p className="text-[11px] text-slate-500">{p.location}, {p.city} • Owner ID: {p.owner_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase rounded">
                        {p.status}
                      </span>
                      {p.status !== 'available' && (
                        <button
                          onClick={() => handlePropertyStatus(p.id, 'available')}
                          className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteProperty(p.id)}
                        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                        title="Delete Property"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reels' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {reels.length === 0 ? (
                <p className="text-xs text-slate-400 text-center col-span-full py-6">No video reels in platform database.</p>
              ) : (
                reels.map((reel) => (
                  <div key={reel.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 text-white p-3 flex flex-col justify-between group">
                    <img src={reel.thumbnail_url} alt={reel.title} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <div className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold">
                        ❤️ {reel.likes_count}
                      </div>
                      <button
                        onClick={() => handleDeleteReel(reel.id)}
                        className="p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition"
                        title="Delete Reel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="relative z-10">
                      <p className="text-xs font-bold line-clamp-1">{reel.title}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No moderation reports pending.</p>
              ) : (
                reports.map((r) => {
                  const reporter = users.find(u => u.id === r.reporter_id);
                  const targetLabel =
                    (r.target_type === 'property'
                      ? properties.find(p => p.id === r.target_id)?.title ||
                        properties.find(p => p.id === r.target_id)?.id
                      : r.target_type === 'reel'
                      ? reels.find(x => x.id === r.target_id)?.title || r.target_id
                      : r.target_type === 'user'
                      ? (users.find(u => u.id === r.target_id)?.full_name ||
                         users.find(u => u.id === r.target_id)?.email || r.target_id)
                      : r.target_id) || r.target_id;
                  const statusColor =
                    r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    r.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                    r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-100 text-slate-600';
                  return (
                    <div key={r.id} className="p-4 bg-amber-50/30 rounded-2xl border border-amber-200/60 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold uppercase rounded-md">
                              Flagged {r.target_type}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusColor}`}>
                              Status: {r.status}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(r.created_at).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Reported content: <span className="font-bold text-purple-700 truncate">{String(targetLabel)}</span>
                            <span className="text-slate-400 font-mono text-[10px]">(ID: {r.target_id})</span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                            Reporter:
                            <span className="font-semibold text-slate-800">
                              {reporter ? reporter.full_name : r.reporter_id}
                            </span>
                            {reporter?.email && <span className="text-slate-500">· {reporter.email}</span>}
                          </div>
                          <div className="mt-2 rounded-xl bg-white border border-slate-100 p-2.5 text-xs text-slate-700 leading-relaxed">
                            <span className="font-bold text-slate-900 text-[10px] uppercase text-amber-700">Reason</span>
                            <p className="mt-0.5">"{r.reason}"</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleReportStatus(r.id, 'reviewed')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                          >
                            Mark Reviewed
                          </button>
                        )}
                        {r.status !== 'resolved' && (
                          <button
                            onClick={() => handleReportStatus(r.id, 'resolved')}
                            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold transition"
                          >
                            Resolve (keep content)
                          </button>
                        )}
                        {r.status !== 'dismissed' && (
                          <button
                            onClick={() => handleReportStatus(r.id, 'dismissed')}
                            className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-semibold transition"
                          >
                            Dismiss Report
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          {/* ── TOKENS TAB ── */}
          {activeTab === 'tokens' && (
            <div className="space-y-6">
              {/* Token Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-sm">
                  <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase">
                    <span>Active Wallets</span>
                    <Coins className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black mt-1">{wallets.length || users.length}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Platform user credit wallets</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white shadow-sm">
                  <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase">
                    <span>Total Transactions</span>
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black mt-1">{transactions.length}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Earned & spent events logged</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-sm">
                  <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase">
                    <span>Tokens in Circulation</span>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black mt-1">
                    {wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) || 500}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">Total unspent platform credits</p>
                </div>
              </div>

              {/* Admin Adjust Tokens */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-600" /> Admin Credit Management (Reward / Deduct)
                  </h4>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                    Platform Credits (Utility only)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <select
                    value={adjUserId}
                    onChange={(e) => setAdjUserId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="">Select recipient user…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email || u.role})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount (e.g. 50 or -20)"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <input
                    placeholder="Reason / Description (e.g. Campaign bonus)"
                    value={adjDesc}
                    onChange={(e) => setAdjDesc(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    disabled={adjLoading || !adjUserId || !adjAmount || !adjDesc}
                    onClick={async () => {
                      setAdjLoading(true);
                      setAdjMsg(null);
                      try {
                        const amt = Number(adjAmount);
                        await api.adminAdjustTokens(
                          adjUserId,
                          amt,
                          amt > 0 ? 'earned_admin' : 'deducted_admin',
                          adjDesc
                        );
                        setAdjMsg(`✅ Successfully adjusted ${amt > 0 ? '+' : ''}${amt} tokens.`);
                        setAdjUserId('');
                        setAdjAmount('');
                        setAdjDesc('');
                        loadAdminData();
                      } catch (e: any) {
                        setAdjMsg('❌ ' + e.message);
                      } finally {
                        setAdjLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl disabled:opacity-40 shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    {adjLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                    Apply Adjustment
                  </button>
                </div>
                {adjMsg && (
                  <p className="text-xs mt-2.5 font-semibold text-amber-900 bg-amber-100/60 p-2 rounded-lg">
                    {adjMsg}
                  </p>
                )}
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search token ledger by user, reason, or type…"
                  value={tokenSearch}
                  onChange={(e) => setTokenSearch(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
                />
                {tokenSearch && (
                  <button onClick={() => setTokenSearch('')} className="text-xs text-slate-400 hover:text-slate-600">
                    Clear
                  </button>
                )}
              </div>

              {/* Transactions Ledger Table */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] text-slate-500 font-bold">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions
                      .filter((tx) => {
                        const q = tokenSearch.toLowerCase().trim();
                        if (!q) return true;
                        const uName = (tx as any).user?.full_name?.toLowerCase() || '';
                        return (
                          uName.includes(q) ||
                          tx.user_id.toLowerCase().includes(q) ||
                          tx.type.toLowerCase().includes(q) ||
                          tx.description?.toLowerCase().includes(q)
                        );
                      })
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-800">
                            {(tx as any).user?.full_name || tx.user_id.slice(0, 8)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                tx.type.startsWith('earned')
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {tx.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td
                            className={`p-3 font-black text-sm ${
                              tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </td>
                          <td className="p-3 text-slate-600 max-w-[240px] truncate">{tx.description}</td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                          No token transactions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LOANS TAB ── */}
          {activeTab === 'loans' && (
            <div className="space-y-6">
              {/* 4 Core Financial Metrics prominently displayed */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-md border border-slate-800">
                  <div className="flex items-center justify-between text-slate-300 text-xs font-semibold uppercase">
                    <span>Total Applications</span>
                    <Landmark className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-3xl font-black mt-1 tracking-tight">{loanStats?.total ?? loanApps.length}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {loanStats?.submitted ?? 0} submitted • {loanStats?.under_review ?? 0} in review
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md">
                  <div className="flex items-center justify-between text-blue-100 text-xs font-semibold uppercase">
                    <span>Requested Amount</span>
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-mono">₹</span>
                  </div>
                  <p className="text-3xl font-black mt-1 tracking-tight">
                    {loanStats
                      ? loanStats.total_requested >= 10000000
                        ? `₹${(loanStats.total_requested / 10000000).toFixed(2)} Cr`
                        : `₹${(loanStats.total_requested / 100000).toFixed(1)} Lakh`
                      : '₹0'}
                  </p>
                  <p className="text-[11px] text-blue-100 mt-1">Across all applicant requests</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md">
                  <div className="flex items-center justify-between text-emerald-100 text-xs font-semibold uppercase">
                    <span>Approved Amount</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  </div>
                  <p className="text-3xl font-black mt-1 tracking-tight">
                    {loanStats
                      ? loanStats.total_approved >= 10000000
                        ? `₹${(loanStats.total_approved / 10000000).toFixed(2)} Cr`
                        : `₹${(loanStats.total_approved / 100000).toFixed(1)} Lakh`
                      : '₹0'}
                  </p>
                  <p className="text-[11px] text-emerald-100 mt-1">
                    {loanStats?.approved ?? 0} applications approved
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-fuchsia-700 rounded-2xl p-4 text-white shadow-md">
                  <div className="flex items-center justify-between text-purple-100 text-xs font-semibold uppercase">
                    <span>Disbursed Amount</span>
                    <Coins className="w-4 h-4 text-purple-200" />
                  </div>
                  <p className="text-3xl font-black mt-1 tracking-tight">
                    {loanStats
                      ? loanStats.total_disbursed >= 10000000
                        ? `₹${(loanStats.total_disbursed / 10000000).toFixed(2)} Cr`
                        : `₹${(loanStats.total_disbursed / 100000).toFixed(1)} Lakh`
                      : '₹0'}
                  </p>
                  <p className="text-[11px] text-purple-100 mt-1">
                    {loanStats?.disbursed ?? 0} loans fully disbursed
                  </p>
                </div>
              </div>

              {/* Authorized Lender Regulatory Disclaimer */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Authorized Lender Verification Policy: </span>
                  IndoProperty operates as a digital facilitator connecting applicants with verified lending partners.
                  Credit eligibility, interest rates (CIBIL-based), sanction letters, and actual fund disbursements are
                  exclusively governed and executed by RBI-authorized banking partners and NBFCs.
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by applicant name, email, phone, city, or PAN…"
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Status Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:block" />
                    {(['all', 'submitted', 'under_review', 'approved', 'disbursed', 'rejected'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setLoanFilter(st)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize ${
                          loanFilter === st
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Loan Applications Table */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] text-slate-500 font-bold">
                    <tr>
                      <th className="p-3.5">Applicant & KYC</th>
                      <th className="p-3.5">Requested Loan</th>
                      <th className="p-3.5">Employment & Income</th>
                      <th className="p-3.5">Property Info</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 min-w-[220px]">Status Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loanApps
                      .filter((app) => {
                        const matchesFilter = loanFilter === 'all' || app.status === loanFilter;
                        const q = loanSearch.toLowerCase().trim();
                        if (!q) return matchesFilter;
                        return (
                          matchesFilter &&
                          (app.full_name?.toLowerCase().includes(q) ||
                            app.email?.toLowerCase().includes(q) ||
                            app.phone?.toLowerCase().includes(q) ||
                            app.property_city?.toLowerCase().includes(q) ||
                            app.pan_number?.toLowerCase().includes(q) ||
                            app.id?.toLowerCase().includes(q))
                        );
                      })
                      .map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/80 align-top transition">
                          <td className="p-3.5">
                            <p className="font-bold text-slate-900 text-sm">{app.full_name}</p>
                            <p className="text-[11px] text-slate-500">{app.email}</p>
                            <p className="text-[11px] text-slate-500">{app.phone}</p>
                            {app.pan_number && (
                              <span className="inline-block mt-1 font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                PAN: {app.pan_number}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <p className="font-black text-indigo-700 text-sm">
                              ₹{(app.loan_amount / 100000).toFixed(2)} Lakh
                            </p>
                            <p className="text-[11px] text-slate-500">{app.tenure_years} Years Tenure</p>
                            <span className="inline-block mt-0.5 text-[10px] text-slate-400 capitalize">
                              {app.purpose ? app.purpose.replace('_', ' ') : 'Home Purchase'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <p className="font-semibold text-slate-800 capitalize">
                              {app.employment_type.replace('_', ' ')}
                            </p>
                            <p className="text-slate-600 font-bold">₹{app.monthly_income.toLocaleString('en-IN')}/mo</p>
                            {app.existing_emi ? (
                              <p className="text-[10px] text-slate-400">EMI: ₹{app.existing_emi}/mo</p>
                            ) : null}
                          </td>
                          <td className="p-3.5">
                            <p className="font-semibold text-slate-800">
                              {app.property_city || app.city || 'City not stated'}
                            </p>
                            {app.property_address && (
                              <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{app.property_address}</p>
                            )}
                            {app.property_value && (
                              <p className="text-[11px] text-slate-500 font-medium">
                                Val: ₹{(app.property_value / 100000).toFixed(1)}L
                              </p>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-block ${
                                app.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : app.status === 'disbursed'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : app.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : app.status === 'under_review'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {app.status.replace('_', ' ')}
                            </span>
                            {app.approved_amount && (
                              <p className="text-[10px] font-bold text-emerald-700 mt-1">
                                Appr: ₹{(app.approved_amount / 100000).toFixed(1)}L
                              </p>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                              <input
                                placeholder="Admin / Lender notes…"
                                value={loanNote[app.id] ?? app.admin_notes ?? ''}
                                onChange={(e) =>
                                  setLoanNote((p) => ({ ...p, [app.id]: e.target.value }))
                                }
                                className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] bg-white w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <input
                                placeholder="Sanctioned Amount (₹)"
                                type="number"
                                value={loanApproved[app.id] ?? (app.approved_amount ? String(app.approved_amount) : '')}
                                onChange={(e) =>
                                  setLoanApproved((p) => ({ ...p, [app.id]: e.target.value }))
                                }
                                className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] bg-white w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <div className="grid grid-cols-2 gap-1 mt-1">
                                <button
                                  onClick={async () => {
                                    await api.updateLoanStatus(app.id, 'under_review', {
                                      admin_notes: loanNote[app.id] ?? app.admin_notes,
                                    });
                                    loadAdminData();
                                  }}
                                  className="px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-[10px] font-bold transition text-center"
                                >
                                  In Review
                                </button>
                                <button
                                  onClick={async () => {
                                    const amt = loanApproved[app.id]
                                      ? Number(loanApproved[app.id])
                                      : app.loan_amount;
                                    await api.updateLoanStatus(app.id, 'approved', {
                                      admin_notes: loanNote[app.id] ?? app.admin_notes,
                                      approved_amount: amt,
                                    });
                                    loadAdminData();
                                  }}
                                  className="px-2 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg text-[10px] font-bold transition text-center"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={async () => {
                                    const amt = loanApproved[app.id]
                                      ? Number(loanApproved[app.id])
                                      : app.approved_amount || app.loan_amount;
                                    await api.updateLoanStatus(app.id, 'disbursed', {
                                      admin_notes: loanNote[app.id] ?? app.admin_notes,
                                      disbursed_amount: amt,
                                    });
                                    loadAdminData();
                                  }}
                                  className="px-2 py-1 bg-purple-100 text-purple-800 hover:bg-purple-200 rounded-lg text-[10px] font-bold transition text-center"
                                >
                                  Disburse
                                </button>
                                <button
                                  onClick={async () => {
                                    await api.updateLoanStatus(app.id, 'rejected', {
                                      admin_notes: loanNote[app.id] ?? app.admin_notes,
                                    });
                                    loadAdminData();
                                  }}
                                  className="px-2 py-1 bg-rose-100 text-rose-800 hover:bg-rose-200 rounded-lg text-[10px] font-bold transition text-center"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {loanApps.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                          No loan applications received yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── REFERRALS TAB ── */}
          {activeTab === 'referrals' && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
                  <p className="text-2xl font-black text-slate-900">{referrals.length}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">Total Referrals</p>
                </div>
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm text-center bg-emerald-50/30">
                  <p className="text-2xl font-black text-emerald-600">
                    {referrals.filter((r) => r.status === 'rewarded').length}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-700 uppercase mt-0.5">Tokens Rewarded</p>
                </div>
                <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm text-center bg-amber-50/30">
                  <p className="text-2xl font-black text-amber-600">
                    {referrals.filter((r) => r.status === 'pending').length}
                  </p>
                  <p className="text-[11px] font-bold text-amber-700 uppercase mt-0.5">Pending</p>
                </div>
                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm text-center bg-rose-50/30">
                  <p className="text-2xl font-black text-rose-600">
                    {referrals.filter((r) => r.status === 'invalid').length}
                  </p>
                  <p className="text-[11px] font-bold text-rose-700 uppercase mt-0.5">Invalid / Blocked</p>
                </div>
              </div>

              {/* Anti-Fraud Banner */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Anti-Fraud Safeguards Active: </span>
                  Unique code enforcement is secured at the database layer. Self-referrals are disallowed, and each
                  registered user can claim referral rewards once. Admins can invalidate suspicious referral entries
                  anytime.
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search referrals by code, referrer, or referred email…"
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'rewarded', 'pending', 'invalid'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setRefFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize ${
                        refFilter === st
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Referrals Table */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] text-slate-500 font-bold">
                    <tr>
                      <th className="p-3.5">Referrer</th>
                      <th className="p-3.5">Code</th>
                      <th className="p-3.5">Referred User</th>
                      <th className="p-3.5">Tokens</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referrals
                      .filter((r) => {
                        const matchesFilter = refFilter === 'all' || r.status === refFilter;
                        const q = refSearch.toLowerCase().trim();
                        if (!q) return matchesFilter;
                        const rName = (r as any).referrer?.full_name?.toLowerCase() || '';
                        const refdName = (r as any).referred?.full_name?.toLowerCase() || '';
                        return (
                          matchesFilter &&
                          (r.referral_code?.toLowerCase().includes(q) ||
                            rName.includes(q) ||
                            refdName.includes(q) ||
                            r.referred_email?.toLowerCase().includes(q))
                        );
                      })
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition">
                          <td className="p-3.5 font-semibold text-slate-900">
                            {(r as any).referrer?.full_name || r.referrer_id.slice(0, 8)}
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs">
                              {r.referral_code}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <p className="font-medium text-slate-800">
                              {(r as any).referred?.full_name || r.referred_email || 'Pending registration'}
                            </p>
                          </td>
                          <td className="p-3.5 font-black text-emerald-600 text-sm">+{r.reward_tokens}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                r.status === 'rewarded'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : r.status === 'invalid'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : r.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {r.status !== 'invalid' ? (
                              <button
                                onClick={async () => {
                                  if (confirm(`Flag and invalidate referral code "${r.referral_code}"?`)) {
                                    await api.invalidateReferral(r.id);
                                    loadAdminData();
                                  }
                                }}
                                className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-bold transition"
                              >
                                Invalidate
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-semibold italic">Invalidated</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    {referrals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                          No referrals recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
