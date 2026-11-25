import React from 'react';
import { Building2, ShieldCheck, Mail } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// IndoProperty — Public Privacy Policy Page
//
// Route: /privacy-policy
// Purpose: Provides the publicly reachable privacy policy URL required by the
//          Google Play Store for app verification / Data Safety declaration.
//          Rendered as a static SPA route, no auth or data loading required.
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORT_EMAIL = 'support@indoproperty.in';
const EFFECTIVE_DATE = '1 October 2026';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-slate-900 leading-none">IndoProperty</span>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5">Real Estate for a Better Tomorrow</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* ── Hero ── */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-3xl mx-auto">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 text-base max-w-xl mx-auto">
            How IndoProperty collects, uses, and protects your personal data.
          </p>
          <span className="inline-block bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 text-xs font-semibold text-indigo-700">
            Effective Date: {EFFECTIVE_DATE}
          </span>
        </section>

        {/* ── Intro ── */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            IndoProperty ("we", "our", "us") is committed to protecting your privacy. This Privacy
            Policy explains what personal information we collect when you use the IndoProperty mobile
            application and web services, how we use it, and your rights regarding that information.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            By using IndoProperty, you agree to the practices described in this policy.
          </p>
        </section>

        {/* ── Policy sections ── */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Information We Collect</h2>
            <h3 className="text-sm font-bold text-slate-700 pt-1">1.1 Account &amp; Profile Information</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Full name, email address, phone number (optional), city / location</li>
              <li>Professional role (customer, broker, builder, or owner)</li>
              <li>Agency or brand name (for professional accounts), profile bio (optional)</li>
              <li>Profile photo (if you choose to upload one)</li>
            </ul>
            <h3 className="text-sm font-bold text-slate-700 pt-1">1.2 Property Listings</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Property title, description, and details (type, price, area, bedrooms, etc.)</li>
              <li>Property location, city, amenities, and listing status</li>
              <li>Property images you upload</li>
            </ul>
            <h3 className="text-sm font-bold text-slate-700 pt-1">1.3 Video Reels</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Video file and thumbnail image, reel title and caption</li>
              <li>Associated property (if linked)</li>
            </ul>
            <h3 className="text-sm font-bold text-slate-700 pt-1">1.4 Enquiries &amp; Messages</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Message content and your name, email, and phone as provided in enquiry forms</li>
              <li>The property or reel the enquiry relates to</li>
              <li>Chat messages between you and other users</li>
            </ul>
            <h3 className="text-sm font-bold text-slate-700 pt-1">1.5 Interactions</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Properties you save, reels you like or save, creators you follow</li>
              <li>Comments you post on reels</li>
            </ul>
            <h3 className="text-sm font-bold text-slate-700 pt-1">1.6 Technical &amp; Device Information</h3>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Device type and operating system version, app version, internet connection type</li>
              <li>Crash reports and error logs (for debugging only)</li>
            </ul>
            <p className="text-sm text-slate-600 pt-1">
              <strong className="text-slate-800">We do not collect precise GPS/location data.</strong>{' '}
              The "city" field is entered by you voluntarily. We do not use advertising identifiers or
              track you across other apps.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li><strong className="text-slate-800">To provide the service:</strong> create and manage your account, display listings, deliver enquiries and messages.</li>
              <li><strong className="text-slate-800">To improve the platform:</strong> analyse aggregated, anonymised usage patterns.</li>
              <li><strong className="text-slate-800">To ensure safety:</strong> review reports of inappropriate content and enforce our Terms of Service.</li>
              <li><strong className="text-slate-800">To send notifications:</strong> notify you of new enquiries, likes, comments, and follows within the app.</li>
              <li><strong className="text-slate-800">To comply with law:</strong> retain certain data as required under applicable Indian law.</li>
            </ul>
            <p className="text-sm text-slate-600 pt-1">
              We do <strong className="text-slate-800">not</strong> sell your personal data. We do not
              use your data for advertising profiling or share it with third-party advertisers.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">3. Data Storage &amp; Security</h2>
            <p className="text-sm text-slate-600">
              Your data is stored on <strong className="text-slate-800">Supabase</strong>, a cloud
              database service. By using IndoProperty, you consent to cross-border transfer of data. We
              implement HTTPS encryption for all data in transit, industry-standard password hashing,
              Row Level Security (RLS) so users can only access their own data, and access-controlled
              cloud storage for media files.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. Data Retention</h2>
            <p className="text-sm text-slate-600">
              We retain your personal data for as long as your account is active. When you delete your
              account, all personally identifiable information is permanently deleted.
              Aggregated/anonymised data may be retained indefinitely. Data required under Indian law
              may be retained for the legally required period.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. Sharing of Information</h2>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li><strong className="text-slate-800">With other users:</strong> your public profile, property listings, and video reels are visible to other IndoProperty users.</li>
              <li><strong className="text-slate-800">With our service providers:</strong> Supabase (database and authentication). These providers are contractually bound to protect your data.</li>
              <li><strong className="text-slate-800">With law enforcement:</strong> if required by law, court order, or government authority.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. Your Rights</h2>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li><strong className="text-slate-800">Access:</strong> view your profile and data inside the app at any time.</li>
              <li><strong className="text-slate-800">Correction:</strong> update your profile information in Profile Settings.</li>
              <li>
                <strong className="text-slate-800">Deletion:</strong> permanently delete your account
                via Profile Settings → Danger Zone, or on our{' '}
                <a href="/delete-account" className="text-indigo-600 hover:underline font-medium">
                  account deletion page
                </a>
                .
              </li>
              <li><strong className="text-slate-800">Portability:</strong> contact us to request a copy of your data.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. Children's Privacy</h2>
            <p className="text-sm text-slate-600">
              IndoProperty is not intended for anyone under 18. We do not knowingly collect personal
              information from minors. If we become aware that a user under 18 has provided data, we
              will delete it promptly.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">8. Changes to This Policy</h2>
            <p className="text-sm text-slate-600">
              We may update this Privacy Policy from time to time. Significant changes will be
              reflected in the "Effective Date" above. Continued use of the app after a change
              constitutes acceptance of the updated policy.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">9. Contact Us</h2>
            <p className="text-sm text-slate-600">
              For privacy questions or to exercise your data rights, email us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-600 hover:underline font-medium">
                {SUPPORT_EMAIL}
              </a>
              . We will respond to privacy-related requests within 30 days.
            </p>
          </div>
        </section>

        {/* ── Contact + footer ── */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6 flex items-start gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl shrink-0">
            <Mail className="w-5 h-5 text-indigo-700" />
          </div>
          <p className="text-sm text-indigo-800">
            Questions about this policy? Contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="text-center text-xs text-slate-400 space-y-1 pb-6">
          <p>
            See also our{' '}
            <a href="/delete-account" className="text-indigo-600 hover:underline font-medium">
              Account Deletion
            </a>{' '}
            page.
          </p>
          <p>© {new Date().getFullYear()} IndoProperty. All rights reserved.</p>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
