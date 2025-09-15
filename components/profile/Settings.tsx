import React, { useState } from "react";
import Link from "next/link";
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
  Share,
} from "lucide-react";

interface ProfileSettingsProps {
  userProfile: any;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  handleUpdateProfile: (profile: any) => void;
  handleLogout: () => void;
  isLoggingOut: boolean;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  userProfile,
  isEditing,
  setIsEditing,
  handleUpdateProfile,
  handleLogout,
  isLoggingOut,
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col space-y-6">
      {/* Professional Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex-shrink-0 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                Account Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Manage your profile, preferences, and account security
              </p>
            </div>
          </div>

          {/* Profile Completion */}
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <svg
                  className="w-10 h-10 transform -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <path
                    d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="2"
                  />
                  <path
                    d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeDasharray="85, 100"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    85%
                  </span>
                </div>
              </div>
              <div>
                <div className="text-gray-900 dark:text-white font-medium text-sm">
                  Profile Complete
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">
                  Add skills to reach 100%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Layout with Fixed Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Fixed Settings Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-fit lg:sticky lg:top-0 shadow-lg">
            <nav className="space-y-2">
              {[
                {
                  id: "profile",
                  label: "Profile",
                  icon: User,
                  description: "Personal information",
                },
                {
                  id: "preferences",
                  label: "Preferences",
                  icon: Settings,
                  description: "App settings",
                },
                {
                  id: "notifications",
                  label: "Notifications",
                  icon: Bell,
                  description: "Alert settings",
                },
                {
                  id: "privacy",
                  label: "Privacy",
                  icon: Shield,
                  description: "Security options",
                },
                {
                  id: "appearance",
                  label: "Appearance",
                  icon: Eye,
                  description: "Theme & display",
                },
              ].map((item) => {
                const isActive = activeSettingsTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSettingsTab(item.id);
                      if (item.id !== "profile") setIsEditing(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4" />
                      <div>
                        <div className="font-medium text-sm">{item.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Settings Content */}
        <div className="lg:col-span-3 overflow-y-auto pr-2">
          <div className="space-y-6 pb-6">
            {/* Profile Information */}
            {activeSettingsTab === "profile" && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600/20 dark:bg-blue-600/30 rounded-lg flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Profile Information
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          Update your personal details and professional information
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        if (isEditing) {
                          handleUpdateProfile({});
                          setIsEditing(false);
                          toast.success("Profile updated successfully!");
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      size="sm"
                      className={`${
                        isEditing
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      } text-white transition-colors`}
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
                  {isEditing ? (
                    <div className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex items-center space-x-6">
                        <div className="relative">
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                            {userProfile.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                          </div>
                          <button
                            onClick={() =>
                              toast.success("Avatar upload feature coming soon!")
                            }
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-medium mb-1">
                            Profile Picture
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                            Update your avatar to personalize your profile
                          </p>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() =>
                                toast.success("File upload dialog would open here")
                              }
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Upload
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() =>
                                toast.success("AI avatar generation started!")
                              }
                            >
                              Generate AI
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                          {
                            label: "Full Name",
                            type: "text",
                            value: userProfile.name,
                            icon: User,
                            field: "name",
                          },
                          {
                            label: "Email Address",
                            type: "email",
                            value: userProfile.email,
                            icon: Mail,
                            field: "email",
                          },
                          {
                            label: "Phone Number",
                            type: "tel",
                            value: userProfile.phone || "",
                            icon: Phone,
                            field: "phone",
                          },
                          {
                            label: "Location",
                            type: "text",
                            value: userProfile.location || "",
                            icon: MapPin,
                            field: "location",
                          },
                          {
                            label: "Job Title",
                            type: "text",
                            value: userProfile.targetRole || "",
                            icon: Briefcase,
                            field: "targetRole",
                          },
                          {
                            label: "Company",
                            type: "text",
                            value: "",
                            icon: Building,
                            field: "company",
                          },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {field.label}
                            </label>
                            <div className="relative">
                              <field.icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                              <input
                                type={field.type}
                                defaultValue={field.value}
                                className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                                placeholder={`Enter your ${field.label.toLowerCase()}`}
                                onChange={(e) => {
                                  console.log(`${field.label}: ${e.target.value}`);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Skills Section */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Technical Skills
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(
                            userProfile.preferredTech || [
                              "JavaScript",
                              "React",
                              "Node.js",
                              "Python",
                            ]
                          ).map((skill: string) => (
                            <span
                              key={skill}
                              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg text-sm border border-gray-300 dark:border-gray-600 flex items-center group hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              {skill}
                              <button
                                onClick={() =>
                                  toast.success(`Removed ${skill} from skills`)
                                }
                                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Add a skill..."
                            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                const skill = e.currentTarget.value;
                                if (skill) {
                                  toast.success(`Added ${skill} to skills`);
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              const input = document.querySelector(
                                'input[placeholder="Add a skill..."]'
                              ) as HTMLInputElement;
                              if (input && input.value) {
                                toast.success(`Added ${input.value} to skills`);
                                input.value = "";
                              }
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Save/Cancel Actions */}
                      <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          onClick={() => {
                            handleUpdateProfile({});
                            setIsEditing(false);
                            toast.success("Profile changes saved successfully!");
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button
                          onClick={() => {
                            setIsEditing(false);
                            toast.info("Changes discarded");
                          }}
                          variant="outline"
                          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="space-y-6">
                      {/* Profile Summary */}
                      <div className="flex items-start space-x-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                          {userProfile.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                            {userProfile.name}
                          </h4>
                          <p className="text-blue-600 dark:text-blue-400 font-medium mb-2">
                            {userProfile.targetRole || "Software Engineer"}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
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
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3 block">
                          Technical Skills
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(
                            userProfile.preferredTech || [
                              "JavaScript",
                              "React",
                              "Node.js",
                              "Python",
                              "TypeScript",
                              "AWS",
                            ]
                          ).map((skill: string) => (
                            <span
                              key={skill}
                              className="px-3 py-1 bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium"
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

            {/* Notification Settings */}
            {activeSettingsTab === "notifications" && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-600/20 dark:bg-green-600/30 rounded-lg flex items-center justify-center">
                      <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Notification Preferences
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Control how and when you receive updates
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    {[
                      {
                        name: "Interview Reminders",
                        description:
                          "Get notified about upcoming practice sessions and scheduled interviews",
                        enabled: true,
                        type: "email",
                      },
                      {
                        name: "Performance Insights",
                        description:
                          "Weekly progress reports and analytics summaries",
                        enabled: true,
                        type: "both",
                      },
                      {
                        name: "AI Recommendations",
                        description:
                          "Personalized study suggestions and improvement tips",
                        enabled: true,
                        type: "push",
                      },
                      {
                        name: "Community Updates",
                        description:
                          "New blog posts, templates, and community content",
                        enabled: false,
                        type: "email",
                      },
                      {
                        name: "Weekly Digest",
                        description:
                          "Weekly summary of your progress and achievements",
                        enabled: true,
                        type: "email",
                      },
                      {
                        name: "System Maintenance",
                        description:
                          "Important system updates and maintenance notifications",
                        enabled: true,
                        type: "both",
                      },
                    ].map((notification) => (
                      <div
                        key={notification.name}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-gray-900 dark:text-white font-medium">
                              {notification.name}
                            </h4>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                notification.type === "email"
                                  ? "bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400"
                                  : notification.type === "push"
                                  ? "bg-green-600/20 dark:bg-green-600/30 text-green-700 dark:text-green-400"
                                  : "bg-purple-600/20 dark:bg-purple-600/30 text-purple-700 dark:text-purple-400"
                              }`}
                            >
                              {notification.type === "both"
                                ? "Email + Push"
                                : notification.type
                                    .charAt(0)
                                    .toUpperCase() + notification.type.slice(1)}
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                            {notification.description}
                          </p>
                        </div>
                        <div className="ml-4">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked={notification.enabled}
                              onChange={(e) => {
                                toast.success(
                                  `${notification.name} ${
                                    e.target.checked ? "enabled" : "disabled"
                                  }`
                                );
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy & Security */}
            {activeSettingsTab === "privacy" && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-600/20 dark:bg-orange-600/30 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Privacy & Security
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          Manage your account security and privacy settings
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Two-Factor Authentication */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-600/20 dark:bg-green-600/30 rounded-lg flex items-center justify-center">
                          <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-medium">
                            Two-Factor Authentication
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => toast.success("2FA setup would begin here")}
                      >
                        Enable 2FA
                      </Button>
                    </div>

                    {/* Password Update */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-600/20 dark:bg-blue-600/30 rounded-lg flex items-center justify-center">
                          <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-medium">
                            Password
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Last updated 3 months ago
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() =>
                          toast.success("Password update form would open")
                        }
                      >
                        Update Password
                      </Button>
                    </div>

                    {/* Active Sessions */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h4 className="text-gray-900 dark:text-white font-medium mb-4">
                        Active Sessions
                      </h4>
                      <div className="space-y-3">
                        {[
                          {
                            device: "MacBook Pro",
                            location: "San Francisco, CA",
                            lastActive: "Active now",
                            current: true,
                          },
                          {
                            device: "iPhone 14",
                            location: "San Francisco, CA",
                            lastActive: "2 hours ago",
                            current: false,
                          },
                          {
                            device: "Chrome (Windows)",
                            location: "New York, NY",
                            lastActive: "1 week ago",
                            current: false,
                          },
                        ].map((session, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <Monitor className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                              <div>
                                <h5 className="text-gray-900 dark:text-white font-medium text-sm">
                                  {session.device}
                                </h5>
                                <p className="text-gray-600 dark:text-gray-400 text-xs">
                                  {session.location} • {session.lastActive}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {session.current && (
                                <span className="px-2 py-1 bg-green-600/20 dark:bg-green-600/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                  Current
                                </span>
                              )}
                              {!session.current && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-600/50 text-red-600 dark:text-red-400 hover:bg-red-600/10 dark:hover:bg-red-600/20 text-xs px-2 py-1"
                                  onClick={() => toast.success("Session terminated")}
                                >
                                  Terminate
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
            {activeSettingsTab === "appearance" && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-600/20 dark:bg-purple-600/30 rounded-lg flex items-center justify-center">
                      <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Appearance & Display
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Customize the look and feel of your interface
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Theme Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "light", label: "Light", icon: Sun },
                        { value: "dark", label: "Dark", icon: Moon },
                        { value: "auto", label: "Auto", icon: Monitor },
                      ].map((theme) => (
                        <button
                          key={theme.value}
                          onClick={() =>
                            toast.success(`Theme changed to ${theme.label}`)
                          }
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center space-y-2 transition-colors hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <theme.icon className="h-6 w-6" />
                          <span className="text-sm font-medium">{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Display Options */}
                  <div className="space-y-4">
                    {[
                      {
                        key: "compactMode",
                        label: "Compact Mode",
                        description: "Reduce spacing for more content",
                      },
                      {
                        key: "animations",
                        label: "Animations",
                        description: "Enable smooth transitions and effects",
                      },
                      {
                        key: "soundEffects",
                        label: "Sound Effects",
                        description: "Play sounds for notifications and actions",
                      },
                    ].map((setting) => (
                      <div
                        key={setting.key}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-medium">
                            {setting.label}
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {setting.description}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={setting.key === "animations"}
                            onChange={(e) => {
                              toast.success(
                                `${setting.label} ${
                                  e.target.checked ? "enabled" : "disabled"
                                }`
                              );
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Settings */}
            {activeSettingsTab === "preferences" && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-600/20 dark:bg-indigo-600/30 rounded-lg flex items-center justify-center">
                      <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        General Preferences
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Configure your app experience and defaults
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* System Preferences */}
                  <div className="space-y-4">
                    <h4 className="text-gray-900 dark:text-white font-medium">
                      System Settings
                    </h4>

                    {[
                      {
                        key: "autoSave",
                        label: "Auto-save Progress",
                        description: "Automatically save your interview progress",
                        defaultChecked: true,
                      },
                      {
                        key: "practiceReminders",
                        label: "Practice Reminders",
                        description: "Send reminders to practice regularly",
                        defaultChecked: true,
                      },
                      {
                        key: "dataBackup",
                        label: "Data Backup",
                        description: "Backup your data to cloud storage",
                        defaultChecked: true,
                      },
                      {
                        key: "analyticsSharing",
                        label: "Analytics Sharing",
                        description:
                          "Share anonymized usage data to improve the platform",
                        defaultChecked: false,
                      },
                      {
                        key: "betaFeatures",
                        label: "Beta Features",
                        description: "Get early access to new features",
                        defaultChecked: false,
                      },
                    ].map((setting) => (
                      <div
                        key={setting.key}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div>
                          <h5 className="text-gray-900 dark:text-white font-medium">
                            {setting.label}
                          </h5>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {setting.description}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={setting.defaultChecked}
                            onChange={(e) => {
                              toast.success(
                                `${setting.label} ${
                                  e.target.checked ? "enabled" : "disabled"
                                }`
                              );
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Danger Zone */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-red-600 dark:text-red-400 font-medium mb-4 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Danger Zone
                    </h4>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="text-red-800 dark:text-red-300 font-medium mb-1">
                            Delete Account
                          </h5>
                          <p className="text-red-700 dark:text-red-400 text-sm">
                            Permanently remove your account and all associated data. This
                            action cannot be undone.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white ml-4"
                          onClick={() =>
                            toast.error("Account deletion requires confirmation")
                          }
                        >
                          Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Logout Section */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <LogOut className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-medium">
                            Sign Out
                          </h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Sign out from your account on this device
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="bg-gray-600 hover:bg-gray-700 text-white"
                      >
                        {isLoggingOut ? "Signing out..." : "Sign Out"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Share className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Need Help?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  Contact our support team or check out our documentation
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => toast.success("Help center opened")}
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Help Center
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => toast.success("Documentation opened")}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Documentation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;