"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { signOut } from "@/lib/actions/auth.action";

interface UserDropdownProps {
  user: any;
  userInitials: string;
  userStats: {
    totalInterviews: number;
    averageScore: number;
    currentStreak: number;
  };
  planBadgeInfo: {
    text: string;
    style: string;
  };
  userSubscription: any;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
  user,
  userInitials,
  userStats,
  planBadgeInfo,
  userSubscription,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsHovered(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    // When clicking, we want to override hover state
    if (!isOpen) {
      setIsHovered(false); // Ensure hover doesn't interfere when opening via click
    }
  };

  // Close dropdown when clicking on links
  const closeDropdown = () => {
    setIsOpen(false);
    setIsHovered(false);
  };

  // Handle mouse enter
  const handleMouseEnter = () => {
    // Only set hover if not already opened by click
    if (!isOpen) {
      setIsHovered(true);
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    // Only close on mouse leave if it was opened by hover (not click)
    if (!isOpen) {
      setIsHovered(false);
    }
  };

  // Determine if dropdown should be visible (either clicked or hovered)
  const isVisible = isOpen || isHovered;

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={toggleDropdown}
        className="flex items-center space-x-3 hover:bg-gray-800/50 rounded-lg px-3 py-2 transition-colors focus:outline-none"
        aria-expanded={isVisible}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white text-sm font-bold">{userInitials}</span>
        </div>
        <div className="hidden md:block text-left">
          <div className="text-white text-sm font-medium">
            {user?.name || "User"}
          </div>
          <div className="text-gray-400 text-xs">{user?.email}</div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isVisible ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Enhanced Dropdown Menu */}
      <div
        className={`absolute right-0 mt-2 w-80 bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-200 transform origin-top-right ${
          isVisible
            ? "opacity-100 visible scale-100 translate-y-0"
            : "opacity-0 invisible scale-95 -translate-y-2"
        }`}
        style={{ zIndex: 9999 }}
      >
        {/* User Info Header */}
        <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-lg font-bold">
                {userInitials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">
                {user?.name || "User"}
              </div>
              <div className="text-gray-400 text-sm truncate">
                {user?.email}
              </div>
              <div
                className={`inline-flex items-center px-2 py-1 text-xs rounded-full mt-1 ${planBadgeInfo.style}`}
              >
                <span className="w-1.5 h-1.5 bg-current rounded-full mr-1 opacity-70"></span>
                {planBadgeInfo.text}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Quick Stats */}
        <div className="p-4 border-b border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-white font-bold text-lg">
                {userStats.totalInterviews}
              </div>
              <div className="text-gray-400 text-xs">Sessions</div>
            </div>
            <div>
              <div className="text-white font-bold text-lg">
                {userStats.averageScore}%
              </div>
              <div className="text-gray-400 text-xs">Score</div>
            </div>
            <div>
              <div className="text-white font-bold text-lg">
                {userStats.currentStreak}
              </div>
              <div className="text-gray-400 text-xs">Streak</div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <Link
            href="/profile"
            onClick={closeDropdown}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group/item"
          >
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <div className="text-white font-medium">My Profile</div>
              <div className="text-gray-400 text-xs">View and edit profile</div>
            </div>
          </Link>

          <Link
            href="/subscription"
            onClick={closeDropdown}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group/item"
          >
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <div>
              <div className="text-white font-medium">
                Subscription
                {userSubscription?.plan &&
                  userSubscription?.plan !== "starter" && (
                    <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full">
                      {userSubscription?.plan === "pro" ? "Pro" : "Premium"}
                    </span>
                  )}
              </div>
              <div className="text-gray-400 text-xs">
                Manage billing & plans
              </div>
            </div>
          </Link>

          <Link
            href="/profile?tab=settings"
            onClick={closeDropdown}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group/item"
          >
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-white font-medium">Settings</div>
              <div className="text-gray-400 text-xs">Preferences & privacy</div>
            </div>
          </Link>

          <div className="border-t border-gray-700 my-2"></div>

          <Link
            href="/contact"
            onClick={closeDropdown}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group/item"
          >
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-white font-medium">Help & Support</div>
              <div className="text-gray-400 text-xs">
                Get help and tutorials
              </div>
            </div>
          </Link>

          <div className="border-t border-gray-700 my-2"></div>

          {/* Logout Button */}
          <form action={signOut}>
            <button
              type="submit"
              onClick={closeDropdown}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors group/item"
            >
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <div>
                <div className="text-red-400 font-medium">Sign Out</div>
                <div className="text-gray-500 text-xs">See you later!</div>
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserDropdown;
