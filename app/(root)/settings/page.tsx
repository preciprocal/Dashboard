// app/(root)/settings/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  updateEmail, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '@/firebase/client';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import ExtensionConnection from '@/components/ExtensionConnection';
import {
  Bell, User, Shield, CreditCard, Chrome, ArrowLeft, Loader2,
  AlertTriangle, Check, Eye, EyeOff, Trash2, Mail, Lock, Zap,
  Star, AlertCircle, RefreshCw, ExternalLink, Building2, Link2,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationSettings {
  email: boolean;
  interviewReminders: boolean;
  systemUpdates: boolean;
}
interface AppSettings {
  notifications: NotificationSettings;
}
const defaultSettings: AppSettings = {
  notifications: { email: true, interviewReminders: true, systemUpdates: true },
};
interface PlanInfo {
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  interviewsUsed: number;
  interviewsLimit: number;
  resumesUsed: number;
  resumesLimit: number;
}

// ─── Design-system primitives ─────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon, iconColor, iconBg, title, subtitle,
}: {
  icon: React.ElementType; iconColor: string; iconBg: string; title: string; subtitle: string;
}) {
  return (
    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Toggle({
  checked, onChange, disabled, color = 'emerald',
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'peer-checked:bg-emerald-600',
    blue:    'peer-checked:bg-blue-600',
    purple:  'peer-checked:bg-purple-600',
  };
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        disabled={disabled} className="sr-only peer" />
      <div className={`w-10 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-disabled:opacity-50 ${colorMap[color] ?? colorMap.emerald}`} />
    </label>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white
                  placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/30
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all ${props.className ?? ''}`}
    />
  );
}

// ─── Billing newsletter block ─────────────────────────────────────────────────

function BillingNewsletterBlock() {
  const [user] = useAuthState(auth);
  const [email,        setEmail]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checking,     setChecking]     = useState(true);

  useEffect(() => {
    if (!user?.email) { setChecking(false); return; }
    setEmail(user.email);
    (async () => {
      try {
        const res  = await fetch('/api/newsletter/check-subscription', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        const data = await res.json();
        if (data.subscribed) setIsSubscribed(true);
      } catch { /* non-critical */ }
      setChecking(false);
    })();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setSubmitStatus('idle');
    try {
      const res  = await fetch('/api/newsletter/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to subscribe');
      setSubmitStatus('success');
      setIsSubscribed(true);
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch (err) {
      setSubmitStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to subscribe.');
      setTimeout(() => { setSubmitStatus('idle'); setErrorMessage(''); }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) return (
    <div className="p-5 flex items-center justify-center gap-2 text-slate-500 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking subscription…
    </div>
  );

  if (isSubscribed) return (
    <div className="p-5 flex flex-col items-center gap-3 text-center">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <Check className="w-5 h-5 text-emerald-400" />
      </div>
      <div>
        <p className="text-white text-sm font-medium">You&apos;re on the list!</p>
        <p className="text-slate-500 text-xs mt-1">We&apos;ll notify you at <span className="text-slate-300">{email}</span> when premium plans launch.</p>
      </div>
    </div>
  );

  return (
    <div className="p-5 space-y-3">
      <p className="text-xs text-slate-400 text-center">Get notified when we launch — no spam, ever.</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com" required
          disabled={isSubmitting || submitStatus === 'success'}
          className="flex-1 px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white text-sm
                     placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 disabled:opacity-50 transition-all"
        />
        <button type="submit" disabled={isSubmitting || submitStatus === 'success'}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                     bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap cursor-pointer">
          {isSubmitting         ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Subscribing…</>
            : submitStatus === 'success' ? <><Check className="w-3.5 h-3.5" />Subscribed!</>
            : <><Bell className="w-3.5 h-3.5" />Notify Me</>}
        </button>
      </form>
      {submitStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 text-xs">You&apos;re on the list! We&apos;ll notify you when premium plans launch.</p>
        </div>
      )}
      {submitStatus === 'error' && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-xs">{errorMessage || 'Something went wrong. Please try again.'}</p>
        </div>
      )}
      <p className="text-center text-slate-600 text-[10px]">No credit card required. Unsubscribe anytime.</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [activeSection,   setActiveSection]   = useState('account');
  const [pageLoading,     setPageLoading]     = useState(true);
  const [savingEmail,     setSavingEmail]     = useState(false);
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [savingNotifKey,  setSavingNotifKey]  = useState<string | null>(null);
  const [settings,        setSettings]        = useState<AppSettings>(defaultSettings);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Email form
  const [newEmail,          setNewEmail]          = useState('');
  const [emailPassword,     setEmailPassword]     = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw,   setShowCurrentPw]   = useState(false);
  const [showNewPw,       setShowNewPw]       = useState(false);

  // Usage stats
  const [plan, setPlan] = useState<PlanInfo>({
    name: 'Free Plan', tier: 'free',
    interviewsUsed: 0, interviewsLimit: 5,
    resumesUsed: 0,    resumesLimit: 2,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Danger zone
  const [deletionReason, setDeletionReason] = useState('');

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) { setNewEmail(user.email ?? ''); loadSettings(); loadStats(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const { FirebaseService } = await import('@/lib/services/firebase-service');
      const token = await user.getIdToken();
      const [resumes, interviewsRes, userRes] = await Promise.all([
        FirebaseService.getUserResumes(user.uid).catch(() => []),
        fetch('/api/interviews', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/user',       { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const interviews = interviewsRes.ok ? await interviewsRes.json() : [];
      const userData   = userRes.ok       ? await userRes.json()       : null;
      const sub        = userData?.subscription;
      const planKey    = sub?.plan ?? 'free';
      // FIXED: added "free" as primary key, kept "starter" as legacy fallback
      const tierMap: Record<string, PlanInfo['tier']> = { free: 'free', pro: 'pro', premium: 'enterprise', starter: 'free' };
      const tier       = tierMap[planKey] ?? 'free';
      const tierNames: Record<PlanInfo['tier'], string> = { free: 'Free Plan', pro: 'Pro Plan', enterprise: 'Premium Plan' };
      setPlan({
        name: tierNames[tier], tier,
        interviewsUsed:  Array.isArray(interviews) ? interviews.length : (interviews?.data?.length ?? 0),
        interviewsLimit: userData?.interviewsLimit ?? (tier === 'free' ? 5 : 999),
        resumesUsed:     resumes.length,
        resumesLimit:    userData?.resumesLimit    ?? (tier === 'free' ? 2 : 999),
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch (err) { console.error(err); }
    finally { setPageLoading(false); }
  };

  const handleUpdateEmail = async () => {
    if (!user || !user.email) return;
    if (!newEmail.trim() || newEmail === user.email) { toast.info('Enter a different email address'); return; }
    if (!emailPassword) { toast.error('Enter your current password to confirm'); return; }
    setSavingEmail(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail.trim());
      toast.success('Email updated — please verify your new address');
      setEmailPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password')      toast.error('Incorrect password');
      else if (code === 'auth/email-already-in-use') toast.error('Email already in use');
      else toast.error('Failed to update email');
    } finally { setSavingEmail(false); }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;
    if (newPassword.length < 8)         { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password') toast.error('Current password is incorrect');
      else toast.error('Failed to update password');
    } finally { setSavingPassword(false); }
  };

  const toggleNotification = useCallback(async (key: keyof NotificationSettings, value: boolean) => {
    if (!user) return;
    const applyUpdate = (prev: AppSettings): AppSettings => ({
      ...prev, notifications: { ...prev.notifications, [key]: value },
    });
    setSettings(applyUpdate);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setSavingNotifKey(key);
    notifTimer.current = setTimeout(async () => {
      try {
        const token = await user.getIdToken();
        setSettings(prev => {
          const next = applyUpdate(prev);
          (async () => {
            const res = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ settings: next }),
            });
            if (res.ok) toast.success('Saved', { duration: 1200 });
            else {
              setSettings(p => ({ ...p, notifications: { ...p.notifications, [key]: !value } }));
              toast.error('Failed to save');
            }
            setSavingNotifKey(null);
          })();
          return prev;
        });
      } catch {
        setSettings(p => ({ ...p, notifications: { ...p.notifications, [key]: !value } }));
        toast.error('Failed to save');
        setSavingNotifKey(null);
      }
    }, 400);
  }, [user]);

  const handleRequestDeletion = () => {
    if (!user) return;
    const subject = encodeURIComponent('Account Closure Request');
    const body    = encodeURIComponent(
      `Hi Preciprocal Support,\n\nI would like to request the closure of my account and deletion of all associated data.\n\nAccount details:\n- Name: ${user.displayName ?? 'N/A'}\n- Email: ${user.email}\n- Account ID: ${user.uid}\n- Sign-in method: ${isGoogleUser ? 'Google OAuth' : 'Email & Password'}\n- Member since: ${user.metadata.creationTime ?? 'N/A'}\n\nReason for closing:\n${deletionReason.trim() || 'Not provided'}\n\nPlease confirm once my account and all associated data have been fully removed.\n\nThank you.`
    );
    window.open(`mailto:support@preciprocal.com?subject=${subject}&body=${body}`, '_blank');
  };

  const isGoogleUser  = user?.providerData?.some(p => p.providerId === 'google.com') ?? false;
  const avatarUrl     = user?.photoURL;
  const userInitials  = (user?.displayName ?? user?.email ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const usagePct      = (used: number, limit: number) => Math.min(100, Math.round((used / limit) * 100));

  if (loading || pageLoading) return <AnimatedLoader isVisible loadingText="Loading settings…" showNavigation />;
  if (!user) return null;

  const sections = [
    { id: 'account',       label: 'Account',          icon: User,          danger: false, badge: null },
    { id: 'notifications', label: 'Notifications',    icon: Bell,          danger: false, badge: null },
    { id: 'security',      label: 'Security',         icon: Shield,        danger: false, badge: null },
    { id: 'billing',       label: 'Plan & Billing',   icon: CreditCard,    danger: false, badge: plan.tier === 'free' ? 'Upgrade' : null },
    { id: 'extension',     label: 'Extension',        icon: Chrome,        danger: false, badge: null },
    { id: 'danger',        label: 'Danger Zone',      icon: AlertTriangle, danger: true,  badge: null },
  ];

  return (
    <div className="space-y-5 px-4 sm:px-0 pb-12">

      {/* ── Page Header ── */}
      <div className="glass-card p-5">
        <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-300 mb-4 transition-colors gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" width={52} height={52} className="rounded-xl object-cover" />
            ) : (
              <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                {userInitials}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#090d1a]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-white truncate">{user.displayName || 'Your Account'}</h1>
            <p className="text-slate-500 text-xs truncate mt-0.5">{user.email}</p>
            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium border ${
                plan.tier === 'free'
                  ? 'bg-slate-800/60 text-slate-400 border-slate-700/50'
                  : plan.tier === 'pro'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}>
                {plan.tier === 'pro'        && <Star      className="w-3 h-3" />}
                {plan.tier === 'enterprise' && <Building2 className="w-3 h-3" />}
                {plan.name}
              </span>
              {isGoogleUser && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/50 font-medium">Google</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="glass-card overflow-hidden">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {sections.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`relative flex-shrink-0 flex items-center gap-2 px-4 py-3.5 text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? s.danger ? 'text-red-400' : 'text-white'
                    : s.danger ? 'text-slate-500 hover:text-red-400' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <s.icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive && !s.danger ? 'text-indigo-400' : ''}`} />
                <span>{s.label}</span>
                {s.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold leading-none">{s.badge}</span>
                )}
                {isActive && (
                  <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${s.danger ? 'bg-red-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="space-y-4">

        {/* ════ ACCOUNT ════ */}
        {activeSection === 'account' && (
          <SectionCard>
            <SectionHeader icon={User} iconColor="text-blue-400" iconBg="bg-blue-500/10 border-blue-500/20"
              title="Account Overview" subtitle="Your profile and account details" />
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4 pb-5 border-b border-white/[0.06]">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" width={56} height={56} className="rounded-xl flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {userInitials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{user.displayName || 'No name set'}</p>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                      plan.tier === 'free'
                        ? 'bg-slate-800/60 text-slate-400 border-slate-700/50'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {plan.tier === 'pro' && <Star className="w-2.5 h-2.5" />}
                      {plan.name}
                    </span>
                  </div>
                </div>
                <Link href="/profile"
                  className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white
                             border border-white/[0.06] hover:border-white/10 px-3 py-2 rounded-xl transition-all">
                  <Link2 className="w-3.5 h-3.5" /> Edit Profile
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Account ID',    value: user.uid.slice(0, 20) + '…', mono: true },
                  {
                    label: 'Sign-in method', value: isGoogleUser ? 'Google' : 'Email & Password',
                    badge: isGoogleUser
                      ? { text: 'Google', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' }
                      : { text: 'Email',  color: 'bg-slate-700/50 border-slate-600/40 text-slate-300' },
                  },
                  {
                    label: 'Email verified', value: user.emailVerified ? 'Verified' : 'Not verified',
                    badge: user.emailVerified
                      ? { text: 'Verified',   color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' }
                      : { text: 'Unverified', color: 'bg-orange-500/10 border-orange-500/20 text-orange-400'   },
                  },
                  {
                    label: 'Member since', value: user.metadata.creationTime
                      ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
                  },
                  {
                    label: 'Last sign-in', value: user.metadata.lastSignInTime
                      ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
                  },
                ].map(({ label, value, mono, badge }) => (
                  <div key={label} className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-800/30 border border-white/[0.05] hover:border-white/[0.08] transition-colors">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
                    {badge ? (
                      <span className={`self-start inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border ${badge.color}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{badge.text}
                      </span>
                    ) : (
                      <span className={`text-sm text-slate-200 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ════ NOTIFICATIONS ════ */}
        {activeSection === 'notifications' && (
          <SectionCard>
            <SectionHeader icon={Bell} iconColor="text-emerald-400" iconBg="bg-emerald-500/10 border-emerald-500/20"
              title="Notification Preferences" subtitle="Changes are saved automatically" />
            <div className="p-5 space-y-2">
              {(
                [
                  { key: 'email'              as const, label: 'Email Notifications', desc: 'Interview results, resume analysis, and account updates sent to your inbox' },
                  { key: 'interviewReminders' as const, label: 'Interview Reminders',  desc: 'Get reminded before a scheduled mock interview session' },
                  { key: 'systemUpdates'      as const, label: 'Product Updates',      desc: 'New features, maintenance notices, and important platform announcements' },
                ] satisfies { key: keyof NotificationSettings; label: string; desc: string }[]
              ).map(item => {
                const isSaving = savingNotifKey === item.key;
                return (
                  <div key={item.key}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.05] bg-slate-800/20 hover:bg-slate-800/40 transition-colors gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-medium">{item.label}</h4>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSaving && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
                      <Toggle checked={settings.notifications[item.key]} onChange={v => toggleNotification(item.key, v)} disabled={isSaving} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* ════ SECURITY ════ */}
        {activeSection === 'security' && (
          <div className="space-y-4">
            {isGoogleUser ? (
              <SectionCard>
                <SectionHeader icon={Shield} iconColor="text-orange-400" iconBg="bg-orange-500/10 border-orange-500/20"
                  title="Security" subtitle="Your account security settings" />
                <div className="p-5">
                  <div className="flex items-start gap-3 p-4 bg-blue-500/[0.05] border border-blue-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-blue-300 text-sm font-medium">Managed by Google</p>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Your account is signed in with Google. Password and email changes are managed through your Google account settings.
                      </p>
                      <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors">
                        Manage Google security <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <>
                <SectionCard>
                  <SectionHeader icon={Mail} iconColor="text-blue-400" iconBg="bg-blue-500/10 border-blue-500/20"
                    title="Email Address" subtitle="Update your sign-in email" />
                  <div className="p-5 space-y-3">
                    <FieldRow label="Current email">
                      <Input type="email" value={user.email ?? ''} readOnly className="opacity-40 cursor-not-allowed" />
                    </FieldRow>
                    <FieldRow label="New email address">
                      <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" />
                    </FieldRow>
                    <FieldRow label="Confirm with current password">
                      <div className="relative">
                        <Input type={showEmailPassword ? 'text' : 'password'} value={emailPassword}
                          onChange={e => setEmailPassword(e.target.value)} placeholder="Your current password" className="pr-9" />
                        <button type="button" onClick={() => setShowEmailPassword(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                          {showEmailPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </FieldRow>
                    <div className="flex justify-end">
                      <button onClick={handleUpdateEmail} disabled={savingEmail}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                                   disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer">
                        {savingEmail ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Updating…</> : <><Check className="w-3.5 h-3.5" />Update Email</>}
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHeader icon={Lock} iconColor="text-orange-400" iconBg="bg-orange-500/10 border-orange-500/20"
                    title="Password" subtitle="Use a strong, unique password" />
                  <div className="p-5 space-y-3">
                    {[
                      { label: 'Current password',     value: currentPassword,  setter: setCurrentPassword, show: showCurrentPw, toggle: () => setShowCurrentPw(p => !p), ph: 'Enter current password'  },
                      { label: 'New password',         value: newPassword,      setter: setNewPassword,     show: showNewPw,     toggle: () => setShowNewPw(p => !p),     ph: 'Min. 8 characters'       },
                      { label: 'Confirm new password', value: confirmPassword,  setter: setConfirmPassword, show: showNewPw,     toggle: () => setShowNewPw(p => !p),     ph: 'Re-enter new password'   },
                    ].map(field => (
                      <FieldRow key={field.label} label={field.label}>
                        <div className="relative">
                          <Input type={field.show ? 'text' : 'password'} value={field.value}
                            onChange={e => field.setter(e.target.value)} placeholder={field.ph} className="pr-9" />
                          <button type="button" onClick={field.toggle}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                            {field.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </FieldRow>
                    ))}

                    {newPassword && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(n => (
                            <div key={n} className={`h-1 flex-1 rounded-full transition-all ${
                              newPassword.length >= n * 3
                                ? newPassword.length >= 12 ? 'bg-emerald-500' : 'bg-amber-500'
                                : 'bg-slate-700'
                            }`} />
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">
                          {newPassword.length < 8 ? 'Too short' : newPassword.length < 12 ? 'Fair — consider longer' : 'Strong password'}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button onClick={handleUpdatePassword} disabled={savingPassword}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500
                                   disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer">
                        {savingPassword ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Updating…</> : <><Lock className="w-3.5 h-3.5" />Update Password</>}
                      </button>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        )}

        {/* ════ BILLING ════ */}
        {activeSection === 'billing' && (
          <div className="space-y-4">
            <SectionCard>
              <SectionHeader icon={CreditCard} iconColor="text-purple-400" iconBg="bg-purple-500/10 border-purple-500/20"
                title="Current Plan" subtitle="Your subscription and usage" />
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    {statsLoading ? (
                      <div className="space-y-1.5">
                        <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
                        <div className="h-3 w-48 bg-slate-800 rounded animate-pulse" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold text-sm">{plan.name}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            plan.tier === 'free'
                              ? 'bg-slate-700/60 text-slate-400 border-slate-600/50'
                              : plan.tier === 'pro'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          }`}>
                            {plan.tier === 'pro'        && <Star      className="w-2.5 h-2.5" />}
                            {plan.tier === 'enterprise' && <Building2 className="w-2.5 h-2.5" />}
                            {plan.tier === 'free' ? 'Free' : plan.tier === 'pro' ? 'Pro' : 'Premium'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-1">
                          {plan.tier === 'free'
                            ? `${plan.interviewsLimit} interviews · ${plan.resumesLimit} resumes per month`
                            : 'Unlimited interviews and advanced analytics'}
                        </p>
                      </>
                    )}
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1.5 bg-slate-700/50 border border-white/[0.06] text-slate-300 text-[10px] font-medium px-3 py-1.5 rounded-full ml-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Monthly Usage</p>
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map(n => (
                        <div key={n}>
                          <div className="flex justify-between mb-1.5">
                            <div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
                            <div className="h-3 w-10 bg-slate-800 rounded animate-pulse" />
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: 'Mock Interviews', used: plan.interviewsUsed, limit: plan.interviewsLimit, color: 'from-blue-600 to-purple-600'   },
                        { label: 'Resume Analyses', used: plan.resumesUsed,    limit: plan.resumesLimit,    color: 'from-emerald-600 to-teal-600'  },
                      ].map(m => {
                        const pct = usagePct(m.used, m.limit);
                        return (
                          <div key={m.label}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-slate-400">{m.label}</span>
                              <span className={pct >= 80 ? 'text-orange-400 font-medium' : 'text-slate-500'}>{m.used} / {m.limit}</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${m.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5 text-center border-b border-white/[0.06]">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-900/30">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">Premium Plans Coming Soon</h3>
                <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                  We&apos;re launching premium tiers with exclusive features. Subscribe to get early access pricing.
                </p>
              </div>

              <div className="p-5 border-b border-white/[0.06]">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">What&apos;s coming</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Unlimited mock interviews',
                    'Advanced AI feedback & scoring',
                    'Unlimited resume analyses',
                    'D-ID avatar video interviews',
                    'Priority question banks',
                    'Early-bird pricing — locked in forever',
                  ].map(feature => (
                    <div key={feature} className="flex items-center gap-2 text-slate-300 text-xs">
                      <div className="w-4 h-4 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-blue-400" />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <BillingNewsletterBlock />
            </SectionCard>
          </div>
        )}

        {/* ════ CHROME EXTENSION ════ */}
        {activeSection === 'extension' && (
          <div className="space-y-4">
            <ExtensionConnection />
            <SectionCard>
              <SectionHeader icon={AlertCircle} iconColor="text-blue-400" iconBg="bg-blue-500/10 border-blue-500/20"
                title="Setup Guide" subtitle="Get started in 5 steps" />
              <div className="p-5">
                <ol className="space-y-3">
                  {[
                    { step: 1, text: <span>Click <strong className="text-white">&quot;Connect Extension&quot;</strong> above to generate your auth token</span> },
                    { step: 2, text: <span>Install the <strong className="text-white">Preciprocal Chrome Extension</strong> from the Chrome Web Store</span> },
                    { step: 3, text: <span>Token auto-syncs to your extension — or paste it manually in the extension popup</span> },
                    { step: 4, text: <span>Navigate to any <strong className="text-white">LinkedIn job posting</strong></span> },
                    { step: 5, text: <span>Click the <strong className="text-white">Preciprocal icon</strong> in your toolbar to analyze the job</span> },
                  ].map(({ step, text }) => (
                    <li key={step} className="flex items-start gap-3 text-xs text-slate-400">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold mt-0.5">{step}</span>
                      <span className="leading-relaxed pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </SectionCard>
            <SectionCard>
              <SectionHeader icon={Chrome} iconColor="text-emerald-400" iconBg="bg-emerald-500/10 border-emerald-500/20"
                title="Extension Features" subtitle="What the extension can do for you" />
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: '🎯', title: 'Job Match Score',    desc: 'See your fit % for any LinkedIn job instantly' },
                  { icon: '📊', title: 'ATS Check',          desc: 'Verify your resume passes tracking systems' },
                  { icon: '💡', title: 'Skills Gap',         desc: 'Identify what to learn before applying' },
                  { icon: '⚡', title: 'One-click Analysis', desc: 'Real-time results without leaving LinkedIn' },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-3 p-3 bg-slate-800/30 border border-white/[0.05] rounded-xl">
                    <span className="text-lg flex-shrink-0">{f.icon}</span>
                    <div>
                      <p className="text-white text-xs font-semibold">{f.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ════ DANGER ZONE ════ */}
        {activeSection === 'danger' && (
          <div className="space-y-4">
            <SectionCard>
              <SectionHeader icon={RefreshCw} iconColor="text-blue-400" iconBg="bg-blue-500/10 border-blue-500/20"
                title="Export Your Data" subtitle="Download everything Preciprocal stores about you" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Request a full data export including your interview history, resume analyses, session transcripts, and account metadata. You will receive a download link via email within 24 hours.
                    </p>
                    <p className="text-slate-500 text-xs mt-2">Your right under GDPR / CCPA.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!user) return;
                      try {
                        const token = await user.getIdToken();
                        const res = await fetch('/api/settings/export-data', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                        if (res.ok) toast.success('Export requested — check your email within 24 hours.', { duration: 5000 });
                        else throw new Error();
                      } catch {
                        toast.error('Failed to request export. Please try again.');
                      }
                    }}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-white/[0.06] hover:border-white/10 text-slate-300 text-xs px-3 py-2 rounded-xl transition-all cursor-pointer">
                    <ExternalLink className="w-3.5 h-3.5" /> Request
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader icon={Trash2} iconColor="text-red-400" iconBg="bg-red-500/10 border-red-500/20"
                title="Close Account" subtitle="Request account closure and data removal" />
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3 p-3.5 bg-orange-500/[0.05] border border-orange-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-orange-300 text-sm font-medium">Manual review required</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      Because your account may have an active subscription, we handle closure requests manually to ensure billing is correctly resolved and all your data is fully removed per GDPR / CCPA.
                    </p>
                  </div>
                </div>

                <FieldRow label="Reason for closing (optional)">
                  <textarea
                    value={deletionReason}
                    onChange={e => setDeletionReason(e.target.value)}
                    placeholder="e.g. No longer job searching, switching to a different tool, missing a feature…"
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white
                               placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:border-red-500/20
                               transition-all resize-none"
                  />
                  <p className="text-slate-600 text-xs mt-1">Your feedback helps us improve Preciprocal.</p>
                </FieldRow>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-slate-500 text-xs">Clicking will open your email client with a pre-filled request.</p>
                  <button onClick={handleRequestDeletion}
                    className="flex-shrink-0 inline-flex items-center gap-2 bg-slate-800/60 hover:bg-red-600/15
                               border border-white/[0.06] hover:border-red-500/30
                               text-slate-300 hover:text-red-400 text-xs font-medium px-4 py-2 rounded-xl transition-all cursor-pointer">
                    <Mail className="w-3.5 h-3.5" /> Request Account Closure
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

      </div>
    </div>
  );
}