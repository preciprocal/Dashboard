// components/profile/AchievementsTab.tsx
"use client";

import React, { useState } from "react";
import { CheckCircle, Trophy, Filter, Award } from "lucide-react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  category: string;
  progress?: number;
  maxProgress?: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

interface AchievementsTabProps {
  achievements: Achievement[];
}

const AchievementsTab: React.FC<AchievementsTabProps> = ({ achievements }) => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const categories = Array.from(new Set(achievements.map(a => a.category)));
  const earnedCount = achievements.filter(a => a.earned).length;
  const completionRate = Math.round((earnedCount / achievements.length) * 100);

  const filteredAchievements = achievements.filter(achievement => {
    const matchesCategory = filterCategory === "all" || achievement.category === filterCategory;
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "earned" && achievement.earned) ||
                         (filterStatus === "locked" && !achievement.earned);
    return matchesCategory && matchesStatus;
  });

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'text-gray-400',
      uncommon: 'text-green-400',
      rare: 'text-blue-400',
      epic: 'text-purple-400',
      legendary: 'text-yellow-400'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getRarityBg = (rarity: string) => {
    const colors = {
      common: 'bg-gray-600',
      uncommon: 'bg-green-600',
      rare: 'bg-blue-600',
      epic: 'bg-purple-600',
      legendary: 'bg-yellow-600'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Achievements</h2>
              <p className="text-gray-400">{earnedCount} of {achievements.length} unlocked ({completionRate}%)</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-400">{earnedCount}</div>
            <div className="text-gray-400 text-sm">Earned</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center space-x-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-white font-medium">Filters:</span>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Achievements</option>
              <option value="earned">Earned Only</option>
              <option value="locked">Locked Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAchievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`bg-gray-800 rounded-lg border p-6 transition-all hover:border-gray-600 ${
              achievement.earned 
                ? 'border-yellow-600 bg-gradient-to-br from-yellow-900/20 to-orange-900/20' 
                : 'border-gray-700'
            }`}
          >
            {/* Achievement Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`text-4xl ${achievement.earned ? '' : 'grayscale opacity-50'}`}>
                {achievement.icon}
              </div>
              <div className="flex flex-col items-end space-y-2">
                {achievement.earned && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRarityBg(achievement.rarity)} text-white`}>
                  {achievement.rarity.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Achievement Details */}
            <div className="mb-4">
              <h3 className={`font-semibold text-lg mb-2 ${
                achievement.earned ? 'text-white' : 'text-gray-400'
              }`}>
                {achievement.name}
              </h3>
              <p className={`text-sm ${
                achievement.earned ? 'text-gray-300' : 'text-gray-500'
              }`}>
                {achievement.description}
              </p>
            </div>

            {/* Progress or Status */}
            {achievement.earned ? (
              <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg text-center">
                <div className="text-green-400 font-medium text-sm">✓ COMPLETED</div>
              </div>
            ) : (
              <div className="space-y-2">
                {achievement.progress !== undefined && achievement.maxProgress ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white font-medium">
                        {achievement.progress}/{achievement.maxProgress}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-gray-700 rounded-lg text-center">
                    <div className="text-gray-400 font-medium text-sm">🔒 LOCKED</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State for Filtered Results */}
      {filteredAchievements.length === 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <Award className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Achievements Found</h3>
          <p className="text-gray-400 mb-4">Try adjusting your filters to see more achievements.</p>
          <button
            onClick={() => {
              setFilterCategory("all");
              setFilterStatus("all");
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Achievement Categories Summary */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Categories Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((category) => {
            const categoryAchievements = achievements.filter(a => a.category === category);
            const earnedInCategory = categoryAchievements.filter(a => a.earned).length;
            const categoryProgress = Math.round((earnedInCategory / categoryAchievements.length) * 100);
            
            return (
              <div key={category} className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-lg font-bold text-white mb-1">
                  {earnedInCategory}/{categoryAchievements.length}
                </div>
                <div className="text-gray-400 text-sm font-medium mb-2 capitalize">
                  {category}
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${categoryProgress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AchievementsTab;