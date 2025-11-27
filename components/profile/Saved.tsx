import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  Target,
  BookOpen,
  Edit,
  FileText,
  Eye,
  Clock,
  Users,
} from "lucide-react";

interface Template {
  id: string;
  role?: string;
  title?: string;
  type?: string;
  category?: string;
  difficulty?: string;
  duration?: string;
  description?: string;
  uses?: number;
  author?: string;
  readTime?: string;
  estimatedTime?: string;
}

interface Blog {
  id: string;
  title: string;
  author?: string;
  excerpt: string;
  tags: string[];
  readTime: string;
  publishDate: string;
  views?: string;
}

interface UserCreatedContent {
  blogs: Blog[];
  templates: Template[];
  customInterviews: any[];
}

interface ProfileSavedProps {
  savedTemplates: Template[];
  bookmarkedBlogs: Blog[];
  userCreatedContent: UserCreatedContent;
}

interface CategoryItem {
  name: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

const ProfileSaved: React.FC<ProfileSavedProps> = ({
  savedTemplates,
  bookmarkedBlogs,
  userCreatedContent,
}) => {
  const [savedContentFilter, setSavedContentFilter] = useState("all");

  const categories: CategoryItem[] = [
    {
      name: "Templates",
      count: savedTemplates.length,
      icon: Target,
      color: "blue",
    },
    {
      name: "Articles",
      count: bookmarkedBlogs.length,
      icon: BookOpen,
      color: "green",
    },
    {
      name: "My Content",
      count: userCreatedContent.blogs.length,
      icon: Edit,
      color: "purple",
    },
    {
      name: "Interviews",
      count: userCreatedContent.customInterviews.length,
      icon: Users,
      color: "orange",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bookmark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                Saved Content
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Manage your bookmarked templates, articles, and custom content
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {savedTemplates.length + userCreatedContent.templates.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Templates
              </div>
            </div>
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {bookmarkedBlogs.length + userCreatedContent.blogs.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Articles
              </div>
            </div>
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
            <div className="text-center">
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {userCreatedContent.customInterviews.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Custom
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Clean & Professional */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: "all",
                  label: "All Content",
                  count:
                    savedTemplates.length +
                    bookmarkedBlogs.length +
                    userCreatedContent.blogs.length +
                    userCreatedContent.templates.length +
                    userCreatedContent.customInterviews.length,
                },
                {
                  id: "templates",
                  label: "Templates",
                  count: savedTemplates.length,
                },
                {
                  id: "blogs",
                  label: "Articles",
                  count: bookmarkedBlogs.length,
                },
                {
                  id: "my-content",
                  label: "My Content",
                  count:
                    userCreatedContent.blogs.length +
                    userCreatedContent.templates.length +
                    userCreatedContent.customInterviews.length,
                },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSavedContentFilter(filter.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    savedContentFilter === filter.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        savedContentFilter === filter.id
                          ? "bg-white/20 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search and Actions */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search content..."
                  className="w-64 pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg
                    className="w-4 h-4 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              <select className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                <option>Sort by Date</option>
                <option>Sort by Name</option>
                <option>Sort by Type</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-6">
          {/* All Content View */}
          {savedContentFilter === "all" && (
            <div className="space-y-8">
              {/* Recent Items Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Recent Items
                  </h3>
                  <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Sample recent items */}
                  {[...savedTemplates.slice(0, 3), ...bookmarkedBlogs.slice(0, 3)].map(
                    (item, index) => (
                      <div
                        key={index}
                        className="group bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            {('type' in item) ? (
                              <Target className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            ) : (
                              <BookOpen className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-gray-900 dark:text-white font-medium text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                              {('role' in item ? item.role : null) || ('title' in item ? item.title : null) || `Item ${index + 1}`}
                            </h4>
                            <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                              {('category' in item ? item.category : null) ||
                                (('author' in item && item.author) ? `By ${item.author}` : "Template")}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                {('duration' in item ? item.duration : null) || ('readTime' in item ? item.readTime : null) || "30 min"}
                              </span>
                              <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                Saved
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Quick Access Categories */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Categories
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories.map((category) => (
                    <button
                      key={category.name}
                      onClick={() =>
                        setSavedContentFilter(
                          category.name.toLowerCase().replace(" ", "-")
                        )
                      }
                      className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                          <category.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-gray-900 dark:text-white font-medium text-sm">
                            {category.name}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 text-xs">
                            {category.count} items
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Templates Section */}
          {savedContentFilter === "templates" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    Saved Templates
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {savedTemplates.length} interview templates ready for practice
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Link href="/templates">
                    <Target className="w-4 h-4 mr-2" />
                    Browse Templates
                  </Link>
                </Button>
              </div>

              {savedTemplates.length > 0 ? (
                <div className="space-y-3">
                  {savedTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 bg-blue-600/20 dark:bg-blue-600/30 rounded-lg flex items-center justify-center">
                            <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="text-gray-900 dark:text-white font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {template.role || `Template ${template.id}`}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                                  {template.difficulty || "Intermediate"}
                                </span>
                                <span className="px-2 py-1 bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
                                  {template.category || "Technical"}
                                </span>
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-1">
                              {template.description ||
                                "Professional interview template for skill assessment"}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {template.duration || "45 min"}
                              </span>
                              <span className="flex items-center">
                                <Eye className="w-3 h-3 mr-1" />
                                {template.uses || Math.floor(Math.random() * 50) + 10}{" "}
                                uses
                              </span>
                              <span className="flex items-center">
                                <Bookmark className="w-3 h-3 mr-1" />
                                Saved
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Link href={`/templates/${template.id}`}>
                              <span>Practice</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Templates Saved
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                    Start building your template library by saving interview templates
                    that match your goals.
                  </p>
                  <Button
                    asChild
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Link href="/templates">
                      <Target className="w-4 h-4 mr-2" />
                      Explore Templates
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Articles Section */}
          {savedContentFilter === "blogs" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    Bookmarked Articles
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {bookmarkedBlogs.length} articles saved for learning
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Link href="/blog">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Browse Articles
                  </Link>
                </Button>
              </div>

              {bookmarkedBlogs.length > 0 ? (
                <div className="space-y-3">
                  {bookmarkedBlogs.map((blog) => (
                    <div
                      key={blog.id}
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 bg-green-600/20 dark:bg-green-600/30 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="text-gray-900 dark:text-white font-medium group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors line-clamp-1">
                                {blog.title}
                              </h4>
                              <div className="flex items-center space-x-2">
                                {blog.tags
                                  .slice(0, 2)
                                  .map((tag: string) => (
                                    <span
                                      key={tag}
                                      className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-1 mb-2">
                              {blog.excerpt}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                              <span>By {blog.author || 'Unknown'}</span>
                              <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                              <span>{blog.readTime}</span>
                              <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                              <span>{blog.publishDate}</span>
                              <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                              <span className="flex items-center">
                                <Bookmark className="w-3 h-3 mr-1" />
                                Bookmarked
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <Bookmark className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Link href={`/blog/${blog.id}`}>
                              <span>Read</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Articles Bookmarked
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                    Save insightful articles to create your personal knowledge library.
                  </p>
                  <Button
                    asChild
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Link href="/blog">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Discover Articles
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* My Content Section */}
          {savedContentFilter === "my-content" && (
            <div className="space-y-8">
              {/* My Articles */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    My Articles
                  </h3>
                  <Button
                    asChild
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Link href="/blog/create">
                      <Edit className="w-4 h-4 mr-2" />
                      Write Article
                    </Link>
                  </Button>
                </div>

                {userCreatedContent.blogs.length > 0 ? (
                  <div className="space-y-3">
                    {userCreatedContent.blogs.map((blog: Blog) => (
                      <div
                        key={blog.id}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="w-12 h-12 bg-purple-600/20 dark:bg-purple-600/30 rounded-lg flex items-center justify-center">
                              <Edit className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3 mb-1">
                                <h4 className="text-gray-900 dark:text-white font-medium group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                                  {blog.title}
                                </h4>
                                <span className="px-2 py-1 bg-green-600/20 dark:bg-green-600/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                  Published
                                </span>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-1 mb-2">
                                {blog.excerpt}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                                <span>{blog.publishDate}</span>
                                <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                                <span>{blog.readTime}</span>
                                <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                                <span className="flex items-center">
                                  <Eye className="w-3 h-3 mr-1" />
                                  {blog.views || "0"} views
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <span>View</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <Edit className="w-10 h-10 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                    <h4 className="text-gray-900 dark:text-white font-medium mb-1">
                      No Articles Created
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      Share your knowledge with the community
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Link href="/blog/create">
                        <Edit className="w-4 h-4 mr-2" />
                        Write First Article
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* My Templates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    My Templates
                  </h3>
                  <Button
                    asChild
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Link href="/templates/create">
                      <FileText className="w-4 h-4 mr-2" />
                      Create Template
                    </Link>
                  </Button>
                </div>

                {userCreatedContent.templates.length > 0 ? (
                  <div className="space-y-3">
                    {userCreatedContent.templates.map((template: Template) => (
                      <div
                        key={template.id}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="w-12 h-12 bg-orange-600/20 dark:bg-orange-600/30 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-gray-900 dark:text-white font-medium group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors mb-1">
                                {template.title || `Template ${template.id}`}
                              </h4>
                              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-1 mb-2">
                                {template.description || "Custom template"}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                                <span>{template.category || "Custom"}</span>
                                <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                                <span>{template.difficulty || "Intermediate"}</span>
                                <span className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></span>
                                <span>{template.estimatedTime || "30 min"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700 text-white"
                            >
                              <span>Use</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <FileText className="w-10 h-10 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                    <h4 className="text-gray-900 dark:text-white font-medium mb-1">
                      No Templates Created
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      Build custom interview templates
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <Link href="/templates/create">
                        <FileText className="w-4 h-4 mr-2" />
                        Create First Template
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Professional Footer Actions */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Expand Your Knowledge Base
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-2xl mx-auto">
            Discover more high-quality content to accelerate your interview
            preparation and professional development.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Link href="/templates">
                <Target className="w-4 h-4 mr-2" />
                Browse Templates
              </Link>
            </Button>
            <Button
              asChild
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Link href="/blog">
                <BookOpen className="w-4 h-4 mr-2" />
                Read Articles
              </Link>
            </Button>
            <Button
              asChild
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Link href="/createinterview">
                <Users className="w-4 h-4 mr-2" />
                Practice Interview
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSaved;