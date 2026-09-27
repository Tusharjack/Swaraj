import React, { useState } from 'react';
import { Smartphone, CheckCircle2, Terminal, Cpu, ShieldCheck } from 'lucide-react';

export const CapacitorView: React.FC = () => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const steps = [
    {
      num: '1',
      title: 'Capacitor CLI & Android Core Packages',
      desc: 'Installed @capacitor/core, @capacitor/cli, and @capacitor/android directly into SWARAJ React project.',
      cmd: 'npm install @capacitor/core @capacitor/cli @capacitor/android'
    },
    {
      num: '2',
      title: 'Capacitor Configuration',
      desc: 'Created capacitor.config.ts with app ID "com.swaraj.realestate" pointing to web directory "dist".',
      code: `import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.swaraj.realestate',
  appName: 'SWARAJ',
  webDir: 'dist',
  server: { androidScheme: 'https' }
};
export default config;`
    },
    {
      num: '3',
      title: 'Build Web Dist Bundle',
      desc: 'Compile production bundle into /dist directory for native web view embedding.',
      cmd: 'npm run build'
    },
    {
      num: '4',
      title: 'Add Android Native Platform & Sync',
      desc: 'Add Android project files & sync static build assets.',
      cmd: 'npx cap add android && npx cap sync'
    },
    {
      num: '5',
      title: 'Open in Android Studio / Build APK',
      desc: 'Launch Android Studio to build release APK or run directly on Android emulator / connected device.',
      cmd: 'npx cap open android'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 rounded-2xl text-white">
            <Smartphone className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold mb-1">
              <CheckCircle2 className="w-3 h-3" /> CAPACITOR 6.0 READY
            </div>
            <h2 className="text-2xl font-black">Android Capacitor Packaging</h2>
            <p className="text-xs text-slate-300 mt-1">
              Single unified codebase! The exact same React app, Supabase DB & Storage run on Web & Android.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 w-fit rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Zero Separate Backend</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Android app connects directly to the same Supabase Auth, PostgreSQL tables & Video Storage.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="p-2 bg-indigo-100 text-indigo-700 w-fit rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Native Video Performance</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Short Reels vertical feed with snap scrolling & autoplay optimized for mobile touch screens.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="p-2 bg-purple-100 text-purple-700 w-fit rounded-xl">
            <Terminal className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Capacitor Configured</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            <code className="font-mono text-indigo-600 bg-slate-100 px-1 py-0.5 rounded">capacitor.config.ts</code> is generated in root project.
          </p>
        </div>
      </div>

      {/* Build Steps Walkthrough */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-600" /> Steps to Build Android APK
        </h3>

        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.num} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                    {s.num}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">{s.title}</h4>
                </div>
                {s.cmd && (
                  <button
                    onClick={() => copyCommand(s.cmd)}
                    className="px-3 py-1 bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition"
                  >
                    {copiedCmd === s.cmd ? 'Copied!' : 'Copy Command'}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600 pl-10">{s.desc}</p>
              {s.cmd && (
                <div className="pl-10">
                  <pre className="bg-slate-950 text-emerald-400 p-3 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">
                    {s.cmd}
                  </pre>
                </div>
              )}
              {s.code && (
                <div className="pl-10">
                  <pre className="bg-slate-950 text-indigo-300 p-3 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">
                    {s.code}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
