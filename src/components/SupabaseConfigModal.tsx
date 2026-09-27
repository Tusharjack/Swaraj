import React, { useState } from 'react';
import { Database, CheckCircle2, AlertCircle, Copy, ExternalLink, Key, Code2, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { api } from '../services/api';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState(localStorage.getItem('SWARAJ_SUPABASE_URL') || '');
  const [key, setKey] = useState(localStorage.getItem('SWARAJ_SUPABASE_KEY') || '');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'schema'>('status');
  const [lastError, setLastError] = useState<string | null>(api.getLastApiError());

  if (!isOpen) return null;

  const isDisabled = typeof window !== 'undefined' && localStorage.getItem('SWARAJ_SUPABASE_DISABLED') === 'true';

  const handleSave = () => {
    localStorage.removeItem('SWARAJ_SUPABASE_DISABLED');
    if (url) localStorage.setItem('SWARAJ_SUPABASE_URL', url);
    if (key) localStorage.setItem('SWARAJ_SUPABASE_KEY', key);
    window.location.reload();
  };

  const handleReset = () => {
    localStorage.removeItem('SWARAJ_SUPABASE_URL');
    localStorage.removeItem('SWARAJ_SUPABASE_KEY');
    localStorage.removeItem('SWARAJ_SUPABASE_DISABLED');
    window.location.reload();
  };

  const handleDisableServer = () => {
    localStorage.setItem('SWARAJ_SUPABASE_DISABLED', 'true');
    window.location.reload();
  };

  const handleEnableServer = () => {
    localStorage.removeItem('SWARAJ_SUPABASE_DISABLED');
    window.location.reload();
  };

  const handleClearError = () => {
    api.setLastApiError(null);
    setLastError(null);
  };

  const sqlSchemaSnippet = `-- Run this in Supabase SQL Editor:
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'professional', 'admin')),
  verified BOOLEAN DEFAULT FALSE
);
CREATE TABLE properties (...);
CREATE TABLE reels (...);
CREATE TABLE enquiries (...);
-- Complete script saved in /supabase/schema.sql`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchemaSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Supabase Connection & Schema</h3>
              <p className="text-xs text-slate-300">PostgreSQL + Auth + Storage + Realtime</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-semibold px-2 py-1 rounded-md hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-sm font-medium">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 bg-white font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4" /> Connection Credentials
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'schema'
                ? 'border-indigo-600 text-indigo-600 bg-white font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" /> SQL Schema & Migration
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {activeTab === 'status' ? (
            <>
              {/* Connection Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                isDisabled
                  ? 'bg-purple-50 border-purple-200 text-purple-900'
                  : isSupabaseConfigured 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-start gap-3">
                  {isDisabled ? (
                    <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                  ) : isSupabaseConfigured ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-semibold text-sm">
                      {isDisabled
                        ? 'High-Speed Local Storage Mode Active (Cloud Quota Exceeded)'
                        : isSupabaseConfigured 
                          ? 'Connected to Live Supabase Backend' 
                          : 'Interactive Local Mode Active (No Cloud Credentials Set)'}
                    </h4>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">
                      {isDisabled
                        ? 'Cloud database is bypassed. All messages, leads, views, and properties work 100% reliably in local state.'
                        : isSupabaseConfigured
                          ? 'Your application is querying your live Supabase PostgreSQL database and Storage.'
                          : 'SWARAJ is currently running with local state storage so you can instantly preview all Customer, Professional, Reels, and Admin features. Input your Supabase credentials below to connect to live cloud DB.'}
                    </p>
                  </div>
                </div>

                {isSupabaseConfigured && !isDisabled && (
                  <button
                    onClick={handleDisableServer}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shrink-0 shadow-sm transition"
                  >
                    Switch to Local (Fix Quota)
                  </button>
                )}

                {isDisabled && (
                  <button
                    onClick={handleEnableServer}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg shrink-0 shadow-sm transition"
                  >
                    Re-enable Cloud Server
                  </button>
                )}
              </div>

              {/* Latest Database Error Monitor */}
              {lastError && (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-rose-700 text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-rose-600" /> Recent Database Sync Exception
                    </div>
                    <button
                      onClick={handleClearError}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
                    >
                      Clear Log
                    </button>
                  </div>
                  <pre className="bg-white/90 p-3 rounded-lg border border-rose-200 text-xs font-mono text-rose-900 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {lastError}
                  </pre>
                  <p className="text-[11px] text-rose-700">
                    If this error mentions a constraint violation or table mismatch, execute the complete SQL setup in the "SQL Schema & Migration" tab in your Supabase SQL Editor.
                  </p>
                </div>
              )}

              {/* Input Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Quick links */}
              <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-900">How to get your credentials:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Go to your Supabase Project Dashboard &gt; Project Settings &gt; API</li>
                  <li>Copy Project URL and <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">anon</code> <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">public</code> key.</li>
                </ol>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium pt-1"
                >
                  Open Supabase Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Database Schema SQL Script</h4>
                <button
                  onClick={copySql}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy Script'}
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The database schema is saved in <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono">supabase/schema.sql</code> with all 12 tables: <code className="text-slate-800 font-mono">profiles, properties, property_media, reels, reel_likes, reel_comments, reel_saves, saved_properties, followers, enquiries, notifications, reports</code>.
              </p>
              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 max-h-60">
                {sqlSchemaSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
          >
            Clear Credentials
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Close
            </button>
            {activeTab === 'status' && (
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-200 transition"
              >
                Save & Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
