// components/profile/SettingsTab.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  User,
  Bell,
  Shield,
  Eye,
  Edit,
  CheckCircle,
  Camera,
  Upload,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  MessageSquare,
  Key,
  AlertCircle,
  Download,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  BarChart3,
  Clock,
  Zap,
  Volume2,
  Layers
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: "junior" | "mid" | "senior" | "lead" | "executive";
  preferredTech?: string[];
  careerGoals?: string;
  createdAt: Date;
  lastLogin: Date;
}

interface SettingsTabProps {
  userProfile: UserProfile;
  isEditing: boolean;
  activeSettingsTab: string;
  setActiveSettingsTab: (tab: string) => void;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  onEditToggle: () => void;
  onUpdateProfile: (profile: Partial<UserProfile>) => void;
  getInitials: (name: string) => string;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  userProfile,
  isEditing,
  activeSettingsTab,
  setActiveSettingsTab,
  setUserProfile,
  onEditToggle,
  onUpdateProfile,
  getInitials
}) => {
  const handleSave = () => {
    onUpdateProfile(userProfile);
    onEditToggle();
  };

  const settingsNavigation = [
    { id: "profile", label: "Profile", icon: User, description: "Personal information" },
    { id: "notifications", label: "Notifications", icon: Bell, description: "Alert preferences" },
    { id: "privacy", label: "Privacy & Security", icon: Shield, description: "Account security" },
    { id: "preferences", label: "Preferences", icon: Eye, description: "Display settings" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Settings Navigation */}
      <div className="lg:col-span-1">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
          <nav className="space-y-2">
            {settingsNavigation.map((item) => {
              const isActive = activeSettingsTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSettingsTab(item.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className="w-4 h-4" />
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Settings Content */}
      <div className="lg:col-span-3">
        
        {/* Profile Settings */}
        {activeSettingsTab === "profile" && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">Profile Information</h3>
                    <p className="text-gray-400 text-sm">Manage your personal details</p>
                  </div>
                </div>
                <Button
                  onClick={isEditing ? handleSave : onEditToggle}
                  className={`${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isEditing ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                
                {/* Avatar Section */}
                <div className="flex items-center space-x-6 pb-6 border-b border-gray-700">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                      {getInitials(userProfile.name)}
                    </div>
                    {isEditing && (
                      <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-700">
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Profile Picture</h4>
                    <p className="text-gray-400 text-sm mb-3">JPG, PNG or GIF. Max size 5MB.</p>
                    {isEditing && (
                      <div className="flex space-x-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <Upload className="w-3 h-3 mr-1" />
                          Upload
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-400 hover:bg-gray-700">
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Full Name</label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Email Address</label>
                    <input
                      type="email"
                      value={userProfile.email}
                      onChange={(e) => setUserProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Target Role</label>
                    <input
                      type="text"
                      value={userProfile.targetRole || ''}
                      onChange={(e) => setUserProfile(prev => prev ? { ...prev, targetRole: e.target.value } : null)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Experience Level</label>
                    <select
                      value={userProfile.experienceLevel || ''}
                      onChange={(e) => setUserProfile(prev => prev ? { ...prev, experienceLevel: e.target.value as any } : null)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select level</option>
                      <option value="junior">Junior (0-2 years)</option>
                      <option value="mid">Mid-level (2-5 years)</option>
                      <option value="senior">Senior (5-8 years)</option>
                      <option value="lead">Lead (8+ years)</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Phone Number</label>
                    <input
                      type="tel"
                      value={userProfile.phone || ''}
                      onChange={(e) => setUserProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Location</label>
                    <input
                      type="text"
                      value={userProfile.location || ''}
                      onChange={(e) => setUserProfile(prev => prev ? { ...prev, location: e.target.value } : null)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                      placeholder="City, State/Country"
                    />
                  </div>
                </div>

                {/* Bio Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Professional Bio</label>
                  <textarea
                    value={userProfile.bio || ''}
                    onChange={(e) => setUserProfile(prev => prev ? { ...prev, bio: e.target.value } : null)}
                    disabled={!isEditing}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none"
                    placeholder="Tell us about your professional background and goals..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Settings */}
        {activeSettingsTab === "notifications" && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-green-400" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Notification Preferences</h3>
                  <p className="text-gray-400 text-sm">Control how you receive updates</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { 
                    key: 'email', 
                    title: 'Email Notifications', 
                    description: 'Receive updates and summaries via email',
                    enabled: true,
                    icon: Mail
                  },
                  { 
                    key: 'push', 
                    title: 'Browser Notifications', 
                    description: 'Get instant notifications in your browser',
                    enabled: true,
                    icon: Bell
                  },
                  { 
                    key: 'weekly', 
                    title: 'Weekly Reports', 
                    description: 'Performance summaries every week',
                    enabled: true,
                    icon: BarChart3
                  },
                  { 
                    key: 'reminders', 
                    title: 'Practice Reminders', 
                    description: 'Daily reminders to maintain streak',
                    enabled: false,
                    icon: Clock
                  }
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <setting.icon className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-white font-medium text-sm">{setting.title}</div>
                        <div className="text-gray-400 text-xs">{setting.description}</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={setting.enabled}
                        onChange={(e) => toast.success(`${setting.title} ${e.target.checked ? 'enabled' : 'disabled'}`)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Privacy & Security Settings */}
        {activeSettingsTab === "privacy" && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Privacy & Security</h3>
                  <p className="text-gray-400 text-sm">Manage your account security</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Security Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <Key className="w-5 h-5 text-blue-400" />
                    <div>
                      <h4 className="text-white font-medium">Change Password</h4>
                      <p className="text-gray-400 text-xs">Last updated 3 months ago</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    onClick={() => toast.success("Password update initiated")}
                  >
                    Update Password
                  </Button>
                </div>

                <div className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <Shield className="w-5 h-5 text-green-400" />
                    <div>
                      <h4 className="text-white font-medium">Two-Factor Auth</h4>
                      <p className="text-gray-400 text-xs">Add extra security</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    onClick={() => toast.success("2FA setup initiated")}
                  >
                    Enable 2FA
                  </Button>
                </div>
              </div>

              {/* Data Management */}
              <div className="space-y-4">
                <h4 className="text-white font-medium">Data Management</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Download className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="text-white text-sm font-medium">Export Data</div>
                        <div className="text-gray-400 text-xs">Download your interview data</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-600">
                      Export
                    </Button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-red-400 font-medium mb-1">Delete Account</h4>
                    <p className="text-red-300 text-sm mb-3">
                      Permanently delete your account and all data. This action cannot be undone.
                    </p>
                    <Button 
                      size="sm"
                      className="bg-red-600 hover:bg-red-700" 
                      onClick={() => toast.error("Account deletion requires confirmation")}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preferences Settings */}
        {activeSettingsTab === "preferences" && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <Eye className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Display Preferences</h3>
                  <p className="text-gray-400 text-sm">Customize your interface</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Theme Selection */}
              <div>
                <h4 className="text-white font-medium mb-4">Theme</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "auto", label: "System", icon: Monitor },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => toast.success(`Theme set to ${theme.label}`)}
                      className="p-4 border border-gray-600 rounded-lg flex flex-col items-center space-y-2 hover:border-blue-500 hover:bg-gray-700 transition-all"
                    >
                      <theme.icon className="h-6 w-6 text-gray-400" />
                      <span className="text-white text-sm font-medium">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Options */}
              <div>
                <h4 className="text-white font-medium mb-4">Interface Options</h4>
                <div className="space-y-3">
                  {[
                    { key: "animations", title: "Animations", description: "Enable smooth transitions", icon: Zap },
                    { key: "sounds", title: "Sound Effects", description: "Audio feedback for actions", icon: Volume2 },
                    { key: "compact", title: "Compact Mode", description: "Reduce spacing for more content", icon: Layers }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <setting.icon className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-white text-sm font-medium">{setting.title}</div>
                          <div className="text-gray-400 text-xs">{setting.description}</div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={setting.key === "animations"}
                          onChange={(e) => toast.success(`${setting.title} ${e.target.checked ? 'enabled' : 'disabled'}`)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTab;