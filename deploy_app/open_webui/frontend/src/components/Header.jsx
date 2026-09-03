import React from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';

export default function Header() {
  const { currentUserSession, logout, isAuthenticated } = useApp();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-gray-800/80 sticky top-0 z-40 transition-colors">
      <div className="container mx-auto px-4 sm:px-6 py-3 max-w-[1400px] flex justify-between items-center">
        {/* Brand Logo & Titles */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                AICO Provisioning Portal
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-[10px] font-semibold">
                AI Sandbox
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-indigo-300/80 font-medium">
              Empowered by AICO • PocketBase &amp; Open WebUI
            </p>
          </div>
        </div>

        {/* Header Controls: System Status, Theme Toggle & Admin Profile Pill */}
        <div className="flex items-center space-x-3">
          {/* System Online Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">System Online</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/80 border border-transparent dark:border-gray-800/60 transition cursor-pointer"
            title="Toggle Light / Dark Theme"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Admin Session Profile Pill */}
          {isAuthenticated && (
            <div id="admin-badge" className="flex items-center space-x-2.5 bg-slate-50 dark:bg-gray-900/80 border border-slate-200/90 dark:border-gray-800 rounded-full pl-3 pr-1.5 py-1 backdrop-blur-sm">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                  {currentUserSession?.name || 'Admin'}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign Out Session"
                className="px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-slate-200/70 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
