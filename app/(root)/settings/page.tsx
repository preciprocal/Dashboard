// app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import {
  Settings,
  Bell,
  Shield,
  Eye,
  Globe,
  Database,
  Key,
  Mail,
  Moon,
  Sun,
  Monitor,
  Download,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

interface AppSettings {
  notifications: {
    email: boolean;
    push: boolean;
    interviewReminders: boolean;
    weeklyDigest: boolean;
    aiRecommendations: boolean;
    systemUpdates: boolean;
  };
  privacy: {
    shareAnalytics: boolean;
    allowDataCollection: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    fontSize: 'small' | 'medium' | 'large';
    reducedMotion: boolean;
  };
  preferences: {
    autoSave: boolean;
    soundEffects: boolean;
    defaultInterviewType: 'technical' | 'behavioral' | 'mixed';
    practiceReminders: boolean;
    emailFrequency: 'realtime' | 'daily' | 'weekly' | 'never';
  };
}

const defaultSettings: AppSettings = {
  notifications: {
    email: true,
    push: true,
    interviewReminders: true,
    weeklyDigest: true,
    aiRecommendations: true,
    systemUpdates: true,
  },
  privacy: {
    shareAnalytics: false,
    allowDataCollection: true,
  },
  appearance: {
    theme: 'dark',
    language: 'en',
    fontSize: 'medium',
    reducedMotion: false,
  },
  preferences: {
    autoSave: true,
    soundEffects: true,
    defaultInterviewType: 'mixed',
    practiceReminders: true,
    emailFrequency: 'daily',
  },
};

export default function SettingsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('notifications');
  const [isSaving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
          setOriginalSettings(data.settings);
        }
      } else {
        console.error('Failed to load settings');
        toast.error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Error loading settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        const data = await response.json();
        setOriginalSettings(data.settings);
        setHasChanges(false);
        toast.success('Settings saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to last saved state? This will discard any unsaved changes.')) {
      return;
    }

    setSettings(originalSettings);
    setHasChanges(false);
    toast.info('Settings reset to last saved state');
  };

  const updateSettings = (section: keyof AppSettings, key: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleExportData = async () => {
    if (!user) return;

    setIsExporting(true);
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/settings/export-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      toast.success('Data report requested! You will receive your report via email within 24 hours.', {
        duration: 5000,
      });
    } catch (error) {
      console.error('Error requesting data export:', error);
      toast.error('Failed to submit data request. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!user) return;

    const confirmText = 'DELETE';
    const userInput = prompt(
      `This will permanently delete ALL your data including interviews, resumes, and plans.\n\nType "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      toast.info('Data deletion cancelled');
      return;
    }

    try {
      toast.loading('Deleting all data...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('All data would be deleted (API not implemented yet)');
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Failed to delete data');
    }
  };

  if (loading || isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading settings..."
        showNavigation={true}
      />
    );
  }

  if (!user) {
    return null;
  }

  const sections = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Eye },
    { id: 'preferences', label: 'Preferences', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Settings className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white mb-1">
                  App Settings
                </h1>
                <p className="text-slate-400 text-sm">
                  Customize your Preciprocal experience
                </p>
              </div>
            </div>

            {hasChanges && (
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="glass-button hover-lift text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="glass-button-primary hover-lift px-4 py-2 rounded-lg flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <nav className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    activeSection === section.id
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{section.label}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Bell className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Notification Settings</h3>
                    <p className="text-slate-400 text-sm">Manage how you receive updates</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {[
                  { key: 'email', label: 'Email Notifications', desc: 'Receive updates via email' },
                  { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications' },
                  { key: 'interviewReminders', label: 'Interview Reminders', desc: 'Reminders for scheduled interviews' },
                  { key: 'weeklyDigest', label: 'Weekly Progress Digest', desc: 'Summary of your weekly activity' },
                  { key: 'aiRecommendations', label: 'AI Recommendations', desc: 'Personalized study suggestions' },
                  { key: 'systemUpdates', label: 'System Updates', desc: 'Important platform announcements' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                    <div>
                      <h4 className="text-white font-medium text-sm">{item.label}</h4>
                      <p className="text-slate-400 text-xs">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                        onChange={(e) => updateSettings('notifications', item.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy & Security */}
          {activeSection === 'privacy' && (
            <div className="space-y-6">
              {/* Privacy Settings Card */}
              <div className="glass-card">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <Shield className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Privacy Settings</h3>
                      <p className="text-slate-400 text-sm">Control your data and privacy</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Privacy Toggles */}
                  {[
                    { key: 'shareAnalytics', label: 'Share Analytics', desc: 'Help improve the platform with anonymized data' },
                    { key: 'allowDataCollection', label: 'Data Collection', desc: 'Allow usage data collection for personalization' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                      <div>
                        <h4 className="text-white font-medium text-sm">{item.label}</h4>
                        <p className="text-slate-400 text-xs">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.privacy[item.key as keyof typeof settings.privacy] as boolean}
                          onChange={(e) => updateSettings('privacy', item.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Card */}
              <div className="glass-card">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <Key className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Security</h3>
                      <p className="text-slate-400 text-sm">Protect your account</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="glass-card p-4 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                          <Key className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-sm">Two-Factor Authentication</h4>
                          <p className="text-slate-400 text-xs">Add an extra layer of security</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toast.info('2FA setup coming soon')}
                        className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm"
                      >
                        Enable
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Management Card */}
              <div className="glass-card">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Database className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Your Data</h3>
                      <p className="text-slate-400 text-sm">Export or delete your data</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Export Data */}
                  <div className="glass-card p-4 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                          <Download className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-sm mb-1">
                            Request Data Report
                          </h4>
                          <p className="text-slate-400 text-xs">
                            Request a complete PDF report of all your data. You will receive it via email within 24 hours.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleExportData}
                        disabled={isExporting}
                        className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm font-medium ml-4 flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Request Report
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="border-t border-white/5 pt-6">
                    <h4 className="text-red-400 font-medium mb-4 flex items-center text-sm">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Danger Zone
                    </h4>
                    <div className="glass-card p-4 border border-red-500/20">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="text-white font-medium mb-1 text-sm">
                            Delete All Data
                          </h5>
                          <p className="text-slate-400 text-xs">
                            Permanently remove all your interviews, resumes, plans, and account data. This action cannot be undone.
                          </p>
                        </div>
                        <button
                          onClick={handleDeleteAllData}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium ml-4 flex items-center gap-2 whitespace-nowrap"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance */}
          {activeSection === 'appearance' && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Eye className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Appearance</h3>
                    <p className="text-slate-400 text-sm">Customize the interface</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Theme */}
                <div>
                  <label className="block text-sm text-slate-400 mb-3">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => updateSettings('appearance', 'theme', theme.value)}
                        className={`p-4 rounded-lg border transition-all ${
                          settings.appearance.theme === theme.value
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-purple-500/30'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10'
                        }`}
                      >
                        <theme.icon className="w-6 h-6 mx-auto mb-2" />
                        <span className="text-sm font-medium">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-sm text-slate-400 mb-3">
                    Font Size
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                    ].map((size) => (
                      <button
                        key={size.value}
                        onClick={() => updateSettings('appearance', 'fontSize', size.value)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          settings.appearance.fontSize === size.value
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Language
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <select
                      value={settings.appearance.language}
                      onChange={(e) => updateSettings('appearance', 'language', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-white text-sm"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>
                </div>

                {/* Reduced Motion */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                  <div>
                    <h4 className="text-white font-medium text-sm">Reduced Motion</h4>
                    <p className="text-slate-400 text-xs">Minimize animations</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.appearance.reducedMotion}
                      onChange={(e) => updateSettings('appearance', 'reducedMotion', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Preferences */}
          {activeSection === 'preferences' && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Settings className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">App Preferences</h3>
                    <p className="text-slate-400 text-sm">Configure default behaviors</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Default Interview Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-3">
                    Default Interview Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'technical', label: 'Technical' },
                      { value: 'behavioral', label: 'Behavioral' },
                      { value: 'mixed', label: 'Mixed' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        onClick={() => updateSettings('preferences', 'defaultInterviewType', type.value)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          settings.preferences.defaultInterviewType === type.value
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email Frequency */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Email Frequency
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <select
                      value={settings.preferences.emailFrequency}
                      onChange={(e) => updateSettings('preferences', 'emailFrequency', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-white text-sm"
                    >
                      <option value="realtime">Real-time</option>
                      <option value="daily">Daily Digest</option>
                      <option value="weekly">Weekly Summary</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                {[
                  { key: 'autoSave', label: 'Auto-Save Progress', desc: 'Automatically save your work' },
                  { key: 'soundEffects', label: 'Sound Effects', desc: 'Play sounds for actions' },
                  { key: 'practiceReminders', label: 'Practice Reminders', desc: 'Daily reminders to practice' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                    <div>
                      <h4 className="text-white font-medium text-sm">{item.label}</h4>
                      <p className="text-slate-400 text-xs">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.preferences[item.key as keyof typeof settings.preferences] as boolean}
                        onChange={(e) => updateSettings('preferences', item.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Changes Indicator */}
          {hasChanges && (
            <div className="glass-card border border-blue-500/20">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <p className="text-blue-400 text-sm font-medium">Unsaved Changes</p>
                    <p className="text-slate-400 text-xs">Remember to save your settings</p>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save Now'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}