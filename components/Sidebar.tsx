"use client"
import logo from "@/public/logo.png";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home,
  Video,
  BookOpen,
  BarChart3,
  Award,
  CreditCard,
  Settings,
  HelpCircle,
  User,
  LogOut,
  X,
  Menu,
  Bell
} from 'lucide-react';
import { useState } from "react";

const sidebarItems = [
  { id: 'overview', label: 'Overview', icon: Home, href: '/dashboard' },
  { id: 'interviews', label: 'My Interviews', icon: Video, href: '/dashboard/interviews' },
  { id: 'templates', label: 'Templates', icon: BookOpen, href: '/dashboard/templates' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/dashboard/analytics' },
  { id: 'achievements', label: 'Achievements', icon: Award, href: '/dashboard/achievements' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, href: '/dashboard/subscription' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  { id: 'help', label: 'Help & Support', icon: HelpCircle, href: '/dashboard/help' }
];

const userStats = {
  plan: 'Free Plan'
};

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-700 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <Image 
              src={logo} 
              alt="Preciprocal Logo" 
              width={32} 
              height={32}
              className="rounded-lg"
            />
            <span className="text-white font-bold text-lg">Preciprocal</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <div className="space-y-2">
            {sidebarItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  pathname === item.href
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-medium">Alex Johnson</div>
              <div className="text-gray-400 text-sm">{userStats.plan}</div>
            </div>
          </div>
          
          {/* Logout */}
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <div className="lg:hidden bg-gray-900 border-b border-gray-700 px-4 py-4 ml-0">
        <div className="flex items-center justify-between w-full">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-3">
            <Image 
              src={logo} 
              alt="Preciprocal Logo" 
              width={32} 
              height={32}
              className="rounded-lg"
            />
            <span className="text-white font-bold">Preciprocal</span>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-400 hover:text-white">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block bg-gray-900 border-b border-gray-700 px-8 py-4 ml-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex-1"></div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-400 hover:text-white">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}