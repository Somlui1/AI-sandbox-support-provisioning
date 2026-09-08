import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';

export default function LoginModal() {
  const { isAuthenticated, isAuthChecking, login } = useApp();

  // Auth Mode: 'credentials' (Username/Password) or 'token' (Direct JWT)
  const [authMode, setAuthMode] = useState('credentials');

  // Credential Inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(true);

  // Direct Token Input
  const [tokenInput, setTokenInput] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [quickAdminLoading, setQuickAdminLoading] = useState(false);
  const [error, setError] = useState('');

  // Load saved username if remembered
  useEffect(() => {
    const saved = localStorage.getItem('portal_remembered_username');
    if (saved) {
      setUsername(saved);
    }
  }, []);

  if (isAuthChecking || isAuthenticated) {
    return null;
  }

  // Handle Username / Password Login
  const handleCredentialLogin = async (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.loginWithCredentials(cleanUser, password);
      if (res.ok && res.data && (res.data.status === 'valid' || res.data.status === 'success')) {
        if (rememberUser) {
          localStorage.setItem('portal_remembered_username', cleanUser);
        } else {
          localStorage.removeItem('portal_remembered_username');
        }
        login(res.data.token, res.data.user);
      } else {
        setError(res.data?.detail || 'Invalid username or password. Please verify credentials.');
      }
    } catch (err) {
      setError('Authentication server connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Server Admin Login (1-Click)
  const handleQuickAdminLogin = async () => {
    setQuickAdminLoading(true);
    setError('');

    try {
      const res = await api.loginWithServerAdmin();
      if (res.ok && res.data && (res.data.status === 'valid' || res.data.status === 'success')) {
        login(res.data.token, res.data.user);
      } else {
        setError(res.data?.detail || 'Server admin token is not configured or has expired.');
      }
    } catch (err) {
      setError('Failed to connect with server admin credentials: ' + err.message);
    } finally {
      setQuickAdminLoading(false);
    }
  };

  // Handle Direct JWT Token Submit
  const handleTokenSubmit = async (e) => {
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
        <div className="relative rounded-3xl p-7 sm:p-9 bg-white/95 dark:bg-gray-900/85 backdrop-blur-2xl border border-slate-200/90 dark:border-gray-800/90 shadow-2xl shadow-black/60 text-slate-900 dark:text-white">
          
          {/* Header Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">AI Sandbox Portal</h2>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Provisioning & Management</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">System Ready</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6 text-left">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Sign In to Provisioning
            </h2>
            <p className="text-xs text-slate-600 dark:text-gray-300 mt-1 leading-relaxed">
              Use your corporate Active Directory credentials or Open WebUI account to log in.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-gray-800/70 border border-slate-200 dark:border-gray-700/60 mb-5">
            <button
              type="button"
              onClick={() => { setAuthMode('credentials'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'credentials'
                  ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-gray-700'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Username & Password
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('token'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'token'
                  ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-gray-700'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Direct JWT Token
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 text-left font-medium">{error}</div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          {/* MODE 1: Username & Password Form */}
          {authMode === 'credentials' && (
            <form onSubmit={handleCredentialLogin} className="space-y-4 text-left">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                  Username or Corporate Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="wajeepradit.p or name@aapico.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={loading || quickAdminLoading}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                    Password
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">
                    AD / OpenWebUI Password
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-10 py-2.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading || quickAdminLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-gray-400 select-none">
                  <input
                    type="checkbox"
                    checked={rememberUser}
                    onChange={(e) => setRememberUser(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Remember username</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || quickAdminLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>

              {/* Quick Admin Option */}
              <div className="pt-3 border-t border-slate-100 dark:border-gray-800/80">
                <div className="relative flex py-1 items-center justify-center mb-2">
                  <span className="text-[11px] text-slate-400 dark:text-gray-500 font-medium">
                    or connect with server profile
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickAdminLogin}
                  disabled={loading || quickAdminLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-gray-200 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800/70 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700/80 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {quickAdminLoading ? (
                    <>
                      <svg className="animate-spin size-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Connecting as Server Admin...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-500 font-bold">⚡</span>
                      <span>Quick Connect as Server Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: Direct JWT Token Form */}
          {authMode === 'token' && (
            <form onSubmit={handleTokenSubmit} className="space-y-4 text-left">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5 block">
                  Open WebUI Admin JWT Token
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 text-xs font-mono rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Paste your JWT Bearer token here..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  required
                  disabled={loading}
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
                    <span>Authenticating Token...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate Token</span>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Info */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Encrypted Corporate Auth
            </span>
            <span className="font-mono text-[10px]">OpenWebUI &bull; Active Directory &bull; Coolify</span>
          </div>
        </div>
      </div>
    </div>
  );
}
