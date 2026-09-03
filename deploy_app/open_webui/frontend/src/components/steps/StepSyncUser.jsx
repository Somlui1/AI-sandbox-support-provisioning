import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import * as api from '../../api/client';
import { cleanUsername } from '../../utils/helpers';

export default function StepSyncUser() {
  const { selectedUser, setSelectedUser, goToStep } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(Boolean(selectedUser?.is_synced));
  const [syncedUuid, setSyncedUuid] = useState(selectedUser?.id || '');

  if (!selectedUser) {
    return null;
  }

  const cleanUser = cleanUsername(selectedUser.username || selectedUser.sAMAccountName || selectedUser.name);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncLdapUser({
        username: selectedUser.username || selectedUser.sAMAccountName || cleanUser,
        email: selectedUser.email,
        name: selectedUser.name || selectedUser.displayName || cleanUser,
      });

      if (res.ok && res.data?.status === 'success' && res.data?.user?.id) {
        const newUuid = res.data.user.id;
        setSyncedUuid(newUuid);
        setSyncSuccess(true);
        setSelectedUser((prev) => ({
          ...prev,
          id: newUuid,
          is_synced: true,
          in_openwebui: true,
        }));
      } else {
        alert('Sync failed: ' + (res.data?.detail || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="saas-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-gray-800/80">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold tracking-wide">
              <span>Step 2</span>
              <span>&bull;</span>
              <span>Identity Sync</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Synchronize LDAP User
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Generate a persistent Open WebUI account UUID for this corporate identity.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            Account Setup Required
          </span>
        </div>

        {/* User Details Dossier Box */}
        <div className="bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800/90 rounded-2xl p-5 space-y-3">
          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            LDAP Identity Attributes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-gray-400">Full Name:</span>
              <span className="text-slate-900 dark:text-white font-semibold ml-1.5">
                {selectedUser.name || selectedUser.displayName || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-gray-400">Account Username:</span>
              <span className="text-slate-900 dark:text-white font-mono font-semibold ml-1.5">
                {cleanUser}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-gray-400">Corporate Email:</span>
              <span className="text-slate-900 dark:text-white font-mono font-semibold ml-1.5">
                {selectedUser.email || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-gray-400">Department:</span>
              <span className="text-slate-900 dark:text-white font-medium ml-1.5">
                {selectedUser.department || 'Enterprise User'}
              </span>
            </div>
          </div>
        </div>

        {/* Why Sync Box */}
        <div className="p-4 bg-slate-50 dark:bg-gray-900/60 border border-slate-200/90 dark:border-gray-800/90 rounded-2xl text-xs text-slate-600 dark:text-gray-400 space-y-1">
          <div className="font-semibold text-slate-800 dark:text-gray-200 flex items-center space-x-1.5">
            <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Why is Open WebUI synchronization required?</span>
          </div>
          <p className="text-slate-500 dark:text-gray-400 text-[11px] leading-relaxed">
            To assign model access privileges (Read &amp; Write) to the PocketBase Agent model in the next step, Open WebUI requires an immutable User UUID.
          </p>
        </div>

        {/* Sync Action */}
        {!syncSuccess && (
          <div className="text-center py-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="px-6 py-2.5 btn-primary text-xs inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>{syncing ? 'Synchronizing account...' : 'Synchronize User Account'}</span>
            </button>
          </div>
        )}

        {/* Sync Success Box */}
        {syncSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl space-y-1.5">
            <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>User successfully registered in Open WebUI</span>
            </div>
            <div className="text-xs font-mono text-emerald-800 dark:text-emerald-200 flex items-center space-x-2">
              <span className="text-emerald-600 dark:text-emerald-400">User UUID:</span>
              <span className="font-bold select-all">{syncedUuid}</span>
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-gray-800/80">
          <button
            type="button"
            onClick={() => goToStep('select')}
            className="px-5 py-2.5 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={() => goToStep('params')}
            disabled={!syncSuccess}
            className={`px-6 py-2.5 btn-primary text-xs flex items-center space-x-2 ${
              syncSuccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            <span>Next: Parameters</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
