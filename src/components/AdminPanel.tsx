import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Building, Film, AlertTriangle, ShieldCheck, RefreshCw, Trash2, Key, RotateCcw, Mail } from 'lucide-react';
import type { Profile, Property, Reel, Report, Enquiry, UserRole } from '../types/database';
import { api, SEED_PROFILES } from '../services/api';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'properties' | 'reels' | 'reports' | 'enquiries' | 'credentials'>('enquiries');
  const [users, setUsers] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [allUsers, allProps, allReels, allReports, allEnqs] = await Promise.all([
        api.getAllUsers(),
        api.getProperties(),
        api.getReels(),
        api.getReports(),
        api.getAllEnquiries(),
      ]);
      setUsers(allUsers);
      setProperties(allProps);
      setReels(allReels);
      setReports(allReports);
      setEnquiries(allEnqs);
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

  const handleDeleteProperty = async (propId: string) => {
    if (confirm('Admin Action: Delete this property listing permanently?')) {
      await api.deleteProperty(propId);
      loadAdminData();
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    if (confirm('Admin Action: Delete this video reel permanently?')) {
      await api.deleteReel(reelId);
      loadAdminData();
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
      await api.deleteEnquiry(enquiryId);
      loadAdminData();
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
            <h2 className="text-xl font-bold">SWARAJ Platform Governance & Admin Moderation</h2>
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
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3.5 px-4 text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'reports'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Moderation Reports ({reports.length})
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
                  <p className="text-xs text-purple-700">Pre-seeded login accounts for testing every user persona on SWARAJ.</p>
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
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleToggleVerification(u.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            u.verified 
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {u.verified ? 'Revoke Badge' : 'Grant Verified Badge'}
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
        </div>
      </div>
    </div>
  );
};
