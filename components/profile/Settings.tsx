import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Settings,
  User,
  Bell,
  Shield,
  Eye,
  CheckCircle,
  Edit,
  Camera,
  Upload,
  Plus,
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building,
  Key,
  Monitor,
  Sun,
  Moon,
  LogOut,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  targetRole?: string;
  preferredTech?: string[];
}

interface ProfileSettingsProps {
  userProfile: UserProfile;
  onLogout: () => void;
  isLoggingOut: boolean;
}

interface FormField {
  label: string;
  type: string;
  value: string;
  icon: React.ElementType;
}

interface NotificationSetting {
  name: string;
  description: string;
  enabled: boolean;
}

interface Session {
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

interface ThemeOption {
  value: string;
  label: string;
  icon: React.ElementType;
}

interface AppearanceSetting {
  key: string;
  label: string;
  description: string;
}

interface PreferenceSetting {
  key: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  userProfile,
  onLogout,
  isLoggingOut,
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);

  const formFields: FormField[] = [
    { label: "Full Name", type: "text", value: userProfile.name, icon: User },
    { label: "Email", type: "email", value: userProfile.email, icon: Mail },
    { label: "Phone", type: "tel", value: userProfile.phone || "", icon: Phone },
    { label: "Location", type: "text", value: userProfile.location || "", icon: MapPin },
    { label: "Job Title", type: "text", value: userProfile.targetRole || "", icon: Briefcase },
    { label: "Company", type: "text", value: "", icon: Building },
  ];

  const notificationSettings: NotificationSetting[] = [
    { name: "Interview Reminders", description: "Get notified about upcoming sessions", enabled: true },
    { name: "Performance Insights", description: "Weekly progress reports", enabled: true },
    { name: "AI Recommendations", description: "Personalized study suggestions", enabled: true },
    { name: "Community Updates", description: "New content and features", enabled: false },
  ];

  const sessions: Session[] = [
    { device: "MacBook Pro", location: "San Francisco", lastActive: "Active now", current: true },
    { device: "iPhone 14", location: "San Francisco", lastActive: "2 hours ago", current: false },
  ];

  const themeOptions: ThemeOption[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "auto", label: "Auto", icon: Monitor },
  ];

  const appearanceSettings: AppearanceSetting[] = [
    { key: "animations", label: "Animations", description: "Enable smooth transitions" },
    { key: "soundEffects", label: "Sound Effects", description: "Play notification sounds" },
  ];

  const preferenceSettings: PreferenceSetting[] = [
    { key: "autoSave", label: "Auto-save Progress", description: "Automatically save progress", defaultChecked: true },
    { key: "practiceReminders", label: "Practice Reminders", description: "Daily practice notifications", defaultChecked: true },
    { key: "dataBackup", label: "Data Backup", description: "Cloud backup enabled", defaultChecked: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Settings className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white mb-1">
                  Settings
                </h1>
                <p className="text-slate-400 text-sm">
                  Manage your preferences and account
                </p>
              </div>
            </div>

            {/* Profile Completion */}
            <div className="glass-card px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10">
                  <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                      fill="none"
                      stroke="currentColor"
                      className="text-slate-700"
                      strokeWidth="2"
                    />
                    <path
                      d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                      fill="none"
                      stroke="currentColor"
                      className="text-blue-500"
                      strokeWidth="2"
                      strokeDasharray="85, 100"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">85%</span>
                  </div>
                </div>
                <div>
                  <div className="text-white font-medium text-sm">Profile Complete</div>
                  <div className="text-slate-400 text-xs">Add skills to reach 100%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <nav className="space-y-2">
              {[
                { id: "profile", label: "Profile", icon: User },
                { id: "preferences", label: "Preferences", icon: Settings },
                { id: "notifications", label: "Notifications", icon: Bell },
                { id: "privacy", label: "Privacy", icon: Shield },
                { id: "appearance", label: "Appearance", icon: Eye },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSettingsTab(item.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    activeSettingsTab === item.id
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Section */}
          {activeSettingsTab === "profile" && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Profile Information</h3>
                      <p className="text-slate-400 text-sm">Update your personal details</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (isEditing) {
                        toast.success("Profile updated successfully!");
                      }
                      setIsEditing(!isEditing);
                    }}
                    size="sm"
                    className={`${
                      isEditing
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    } text-white`}
                  >
                    {isEditing ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-6">
                {isEditing ? (
                  <div className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                          {userProfile.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <button
                          onClick={() => toast.success("Avatar upload coming soon!")}
                          className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Profile Picture</h4>
                        <p className="text-slate-400 text-sm mb-3">Update your avatar</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => toast.success("Upload dialog would open")}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {formFields.map((field) => (
                        <div key={field.label}>
                          <label className="text-sm text-slate-400 mb-2 block">{field.label}</label>
                          <div className="relative">
                            <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                              type={field.type}
                              defaultValue={field.value}
                              className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Skills */}
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Technical Skills</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(userProfile.preferredTech || ["JavaScript", "React", "Node.js"]).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-3 py-1 bg-slate-800/50 text-slate-300 rounded-lg text-sm border border-white/5 flex items-center group hover:bg-slate-700/50"
                          >
                            {skill}
                            <button
                              onClick={() => toast.success(`Removed ${skill}`)}
                              className="ml-2 opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a skill..."
                          className="flex-1 px-3 py-2 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && e.currentTarget.value) {
                              toast.success(`Added ${e.currentTarget.value}`);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-6">
                    <div className="flex items-start gap-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                        {userProfile.name.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-white mb-1">{userProfile.name}</h4>
                        <p className="text-blue-400 font-medium mb-2">{userProfile.targetRole || "Software Engineer"}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          {userProfile.location && (
                            <span className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {userProfile.location}
                            </span>
                          )}
                          <span className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            {userProfile.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Skills */}
                    <div>
                      <label className="text-sm text-slate-500 mb-3 block">Technical Skills</label>
                      <div className="flex flex-wrap gap-2">
                        {(userProfile.preferredTech || ["JavaScript", "React", "Node.js", "Python"]).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSettingsTab === "notifications" && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Bell className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Notifications</h3>
                    <p className="text-slate-400 text-sm">Manage your notification preferences</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {notificationSettings.map((notification) => (
                  <div key={notification.name} className="flex items-center justify-between p-4 rounded-lg border border-white/5 hover:bg-white/5">
                    <div>
                      <h4 className="text-white font-medium text-sm">{notification.name}</h4>
                      <p className="text-slate-400 text-xs mt-1">{notification.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={notification.enabled}
                        onChange={(e) => toast.success(`${notification.name} ${e.target.checked ? "enabled" : "disabled"}`)}
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
          {activeSettingsTab === "privacy" && (
            <div className="space-y-6">
              <div className="glass-card">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <Shield className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Privacy & Security</h3>
                      <p className="text-slate-400 text-sm">Manage account security</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Two-Factor Authentication */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Two-Factor Authentication</h4>
                        <p className="text-slate-400 text-xs">Add extra security</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => toast.success("2FA setup started")}>
                      Enable
                    </Button>
                  </div>

                  {/* Password */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <Key className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Password</h4>
                        <p className="text-slate-400 text-xs">Last updated 3 months ago</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => toast.success("Password update form")}>
                      Update
                    </Button>
                  </div>

                  {/* Active Sessions */}
                  <div className="border-t border-white/5 pt-6">
                    <h4 className="text-white font-medium mb-4 text-sm">Active Sessions</h4>
                    <div className="space-y-3">
                      {sessions.map((session, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Monitor className="h-5 w-5 text-slate-400" />
                            <div>
                              <h5 className="text-white font-medium text-sm">{session.device}</h5>
                              <p className="text-slate-400 text-xs">{session.location} • {session.lastActive}</p>
                            </div>
                          </div>
                          {session.current ? (
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">Current</span>
                          ) : (
                            <Button size="sm" variant="outline" className="border-red-600/50 text-red-400 hover:bg-red-600/10 text-xs">
                              End
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance */}
          {activeSettingsTab === "appearance" && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Eye className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Appearance</h3>
                    <p className="text-slate-400 text-sm">Customize interface display</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Theme */}
                <div>
                  <label className="text-sm text-slate-400 mb-3 block">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {themeOptions.map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => toast.success(`Theme: ${theme.label}`)}
                        className="p-4 border border-white/5 rounded-lg flex flex-col items-center gap-2 hover:bg-white/5 text-slate-300"
                      >
                        <theme.icon className="h-6 w-6" />
                        <span className="text-sm">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-4">
                  {appearanceSettings.map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                      <div>
                        <h4 className="text-white font-medium text-sm">{setting.label}</h4>
                        <p className="text-slate-400 text-xs">{setting.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={setting.key === "animations"}
                          onChange={(e) => toast.success(`${setting.label} ${e.target.checked ? "enabled" : "disabled"}`)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preferences */}
          {activeSettingsTab === "preferences" && (
            <div className="glass-card">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                    <Settings className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Preferences</h3>
                    <p className="text-slate-400 text-sm">Configure app settings</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* System Settings */}
                <div className="space-y-4">
                  {preferenceSettings.map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                      <div>
                        <h5 className="text-white font-medium text-sm">{setting.label}</h5>
                        <p className="text-slate-400 text-xs">{setting.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={setting.defaultChecked}
                          onChange={(e) => toast.success(`${setting.label} ${e.target.checked ? "enabled" : "disabled"}`)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  ))}
                </div>

                {/* Logout */}
                <div className="border-t border-white/5 pt-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                        <LogOut className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Sign Out</h4>
                        <p className="text-slate-400 text-xs">Sign out from this device</p>
                      </div>
                    </div>
                    <Button
                      onClick={onLogout}
                      disabled={isLoggingOut}
                      className="bg-slate-600 hover:bg-slate-700 text-white"
                    >
                      {isLoggingOut ? "Signing out..." : "Sign Out"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="glass-card">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Need Help?</h3>
              <p className="text-slate-400 text-sm mb-6">Contact support or check documentation</p>
              <div className="flex justify-center gap-3">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => toast.success("Help center opened")}>
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help Center
                </Button>
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-white/5" onClick={() => toast.success("Docs opened")}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Docs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;