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
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200">
      <div className="saas-card bg-white dark:bg-[#131B2A] w-full max-w-md p-8 relative shadow-2xl border border-slate-200/90 dark:border-slate-800">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-700 dark:text-slate-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Admin Authentication</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Enter your Open WebUI Admin JWT token to access orchestrator provisioning controls.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Admin Session Token
            </label>
            <textarea
              rows={3}
              className="w-full saas-input px-3.5 py-2.5 text-xs font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600"
              placeholder="Paste your Open WebUI JWT token..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 btn-primary text-sm flex items-center justify-center cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : 'Continue →'}</span>
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>Secure API Connection</span>
          <span>Port 8000</span>
        </div>
      </div>
    </div>
  );
}
