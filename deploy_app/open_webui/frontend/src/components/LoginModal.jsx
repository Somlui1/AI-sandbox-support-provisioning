import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';

export default function LoginModal() {
  const { isAuthenticated, isAuthChecking, login } = useApp();
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthChecking || isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.validateAuth(token);
      if (res.ok && res.data && (res.data.status === 'valid' || res.data.status === 'success')) {
        login(token, res.data.user);
      } else {
        setError(res.data?.detail || 'Invalid Admin JWT Token. Please verify administrative privileges.');
      }
    } catch (err) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-8 bg-[#030712]/85 backdrop-blur-md transition-all duration-300">
      <div className="w-full max-w-lg relative fade-in">
        {/* Glow behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[32px] blur-xl opacity-30 pointer-events-none" />

        {/* Main Card */}
        <div className="relative rounded-3xl p-8 sm:p-10 bg-white/95 dark:bg-gray-900/80 backdrop-blur-2xl border border-slate-200/90 dark:border-gray-800/90 shadow-2xl shadow-black/60 text-slate-900 dark:text-white">
          
          {/* Header Row */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">AI Sandbox Portal</h2>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Empowered by AICO</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">System Online</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6 text-left">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Admin Authentication
            </h2>
            <p className="text-xs text-slate-600 dark:text-gray-300 mt-1.5 leading-relaxed">
              Enter your Open WebUI Admin JWT token to access the provisioning engine, manage PocketBase instances, and oversee AI agents.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                Open WebUI Admin Token
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 text-xs font-mono rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Encrypted API Bridge
            </span>
            <span className="font-mono">Coolify &bull; OpenWebUI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
