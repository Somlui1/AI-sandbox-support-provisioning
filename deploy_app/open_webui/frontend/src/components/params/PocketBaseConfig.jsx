import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { buildPocketBaseFqdn, cleanUsername } from '../../utils/helpers';

export default function PocketBaseConfig() {
  const {
    pbUsername,
    setPbUsername,
    pbAdminEmail,
    setPbAdminEmail,
    pbAdminPassword,
    setPbAdminPassword,
    regeneratePassword,
    defaultTemplateConfig,
  } = useApp();

  const [showPassword, setShowPassword] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const cleanUser = cleanUsername(pbUsername) || 'username';
  const fqdn = buildPocketBaseFqdn(cleanUser, defaultTemplateConfig);

  const handleCopyFqdn = () => {
    navigator.clipboard.writeText(fqdn).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 1500);
    });
  };

  return (
    <div className="saas-card p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-semibold text-xs border border-slate-200 dark:border-slate-700">
            A
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">PocketBase Container</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Coolify Service</span>
      </div>

      {/* Group 1: Domain & Service Routing */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Subdomain Prefix
          </label>
          <input
            type="text"
            className="w-full saas-input px-3.5 py-2 text-xs font-mono"
            placeholder="username"
            value={pbUsername}
            onChange={(e) => setPbUsername(e.target.value)}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Naming prefix for Coolify container service and DNS routing.
          </p>
        </div>

        {/* Live URL Preview Box */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Target FQDN URL
            </label>
            <button
              type="button"
              onClick={handleCopyFqdn}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy URL</span>
            </button>
          </div>
          <div className="relative">
            <div className="w-full bg-slate-50 dark:bg-[#0E1522] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 truncate select-all">
              {fqdn}
            </div>
            {copiedToast && (
              <span className="absolute right-2.5 top-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                Copied
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Internal container port: 8090.
          </p>
        </div>
      </div>

      {/* Group 2: Admin Credentials */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            PocketBase Admin Email
          </label>
          <input
            type="email"
            className="w-full saas-input px-3.5 py-2 text-xs font-mono"
            placeholder="user@aapico.com"
            value={pbAdminEmail}
            onChange={(e) => setPbAdminEmail(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              PocketBase Admin Password
            </label>
            <button
              type="button"
              onClick={regeneratePassword}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium transition cursor-pointer"
            >
              Generate New
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full saas-input px-3.5 py-2 text-xs font-mono pr-10"
              placeholder="password"
              value={pbAdminPassword}
              onChange={(e) => setPbAdminPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
