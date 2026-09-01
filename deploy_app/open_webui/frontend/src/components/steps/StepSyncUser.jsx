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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Synchronize LDAP User
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate a persistent Open WebUI account UUID for this corporate identity.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
            Account Setup Required
          </span>
        </div>

        {/* User Details Dossier Box */}
        <div className="bg-slate-50 dark:bg-[#0E1522] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            LDAP Identity Attributes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Full Name:</span>
              <span className="text-slate-900 dark:text-slate-100 font-medium ml-1">
                {selectedUser.name || selectedUser.displayName || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Account Username:</span>
              <span className="text-slate-900 dark:text-slate-100 font-mono font-medium ml-1">
                {cleanUser}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Corporate Email:</span>
              <span className="text-slate-900 dark:text-slate-100 font-mono ml-1">
                {selectedUser.email || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Department:</span>
              <span className="text-slate-900 dark:text-slate-100 ml-1">
                {selectedUser.department || 'Enterprise User'}
              </span>
            </div>
          </div>
        </div>

        {/* Why Sync Box */}
        <div className="p-4 bg-slate-50 dark:bg-[#0E1522] border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Why is Open WebUI synchronization required?</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
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
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-medium text-xs">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>User successfully registered in Open WebUI</span>
            </div>
            <div className="text-xs font-mono text-emerald-900 dark:text-emerald-200 flex items-center space-x-2">
              <span className="text-emerald-700 dark:text-emerald-400">User UUID:</span>
              <span className="font-semibold select-all">{syncedUuid}</span>
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => goToStep('select')}
            className="px-4 py-2 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={() => goToStep('params')}
            disabled={!syncSuccess}
            className={`px-5 py-2.5 btn-primary text-xs flex items-center space-x-1.5 ${
              syncSuccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            <span>Next: Parameters</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
