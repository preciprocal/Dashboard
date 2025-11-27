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
  Upload,
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
    profileVisibility: 'public' | 'private' | 'connections';
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
  data: {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    dataRetention: '30' | '90' | '365' | 'forever';
  };
}

export default function SettingsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('notifications');
  const [isSaving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    notifications: {
      email: true,
      push: true,
      interviewReminders: true,
      weeklyDigest: true,
      aiRecommendations: true,
      systemUpdates: true,
    },
    privacy: {
      profileVisibility: 'private',
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
    data: {
      autoBackup: true,
      backupFrequency: 'weekly',
      dataRetention: '365',
    },
  });

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
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        toast.success('Settings saved successfully!');
        setHasChanges(false);
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

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      loadSettings();
      setHasChanges(false);
      toast.info('Settings reset to defaults');
    }
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

  if (loading) {
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
    { id: 'data', label: 'Data Management', icon: Database },
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
                  className="glass-button-primary hover-lift px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
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
              <div className="glass-card">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <Shield className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Privacy & Security</h3>
                      <p className="text-slate-400 text-sm">Control your data and privacy</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Profile Visibility */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-3">
                      Profile Visibility
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'public', label: 'Public' },
                        { value: 'private', label: 'Private' },
                        { value: 'connections', label: 'Connections' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updateSettings('privacy', 'profileVisibility', option.value)}
                          className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                            settings.privacy.profileVisibility === option.value
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

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

                  {/* Two-Factor Auth */}
                  <div className="glass-card p-4 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                          <Key className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-sm">Two-Factor Authentication</h4>
                          <p className="text-slate-400 text-xs">Add extra security</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toast.success('2FA setup would open')}
                        className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm"
                      >
                        Enable
                      </button>
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

          {/* Data Management */}
          {activeSection === 'data' && (
            <div className="space-y-6">
              <div className="glass-card">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                      <Database className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Data Management</h3>
                      <p className="text-slate-400 text-sm">Manage your data and backups</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Backup Settings */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Backup Frequency
                    </label>
                    <select
                      value={settings.data.backupFrequency}
                      onChange={(e) => updateSettings('data', 'backupFrequency', e.target.value)}
                      className="w-full px-4 py-2.5 glass-input rounded-lg text-white text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {/* Data Retention */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Data Retention Period
                    </label>
                    <select
                      value={settings.data.dataRetention}
                      onChange={(e) => updateSettings('data', 'dataRetention', e.target.value)}
                      className="w-full px-4 py-2.5 glass-input rounded-lg text-white text-sm"
                    >
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                      <option value="365">1 Year</option>
                      <option value="forever">Forever</option>
                    </select>
                  </div>

                  {/* Auto Backup Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                    <div>
                      <h4 className="text-white font-medium text-sm">Automatic Backups</h4>
                      <p className="text-slate-400 text-xs">Backup data to cloud storage</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.data.autoBackup}
                        onChange={(e) => updateSettings('data', 'autoBackup', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Export/Import */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => toast.success('Exporting data...')}
                      className="glass-button hover-lift text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Data
                    </button>
                    <button
                      onClick={() => toast.success('Import dialog would open')}
                      className="glass-button hover-lift text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Import Data
                    </button>
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
                            Permanently remove all your interviews, resumes, and plans
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure? This action cannot be undone.')) {
                              toast.error('Data deletion would proceed here');
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium ml-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
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
                    className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm"
                  >
                    Save Now
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