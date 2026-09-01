import React from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';

export default function Header() {
  const { currentUserSession, logout, isAuthenticated } = useApp();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-[#101726] border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40">
      <div className="container mx-auto px-6 py-3.5 max-w-5xl flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-medium shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Provisioning Orchestrator
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              PocketBase &amp; Open WebUI
            </p>
          </div>
        </div>

        {/* Header Controls: Theme Toggle & Admin Profile Pill */}
        <div className="flex items-center space-x-2.5">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Toggle Light / Dark Theme"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Admin Session Profile Pill */}
          {isAuthenticated && (
            <div id="admin-badge" className="flex items-center space-x-2.5 bg-slate-50 dark:bg-[#172133] border border-slate-200/90 dark:border-slate-700/80 rounded-full pl-3 pr-1.5 py-1">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {currentUserSession?.name || 'Admin'}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign Out Session"
                className="px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
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
