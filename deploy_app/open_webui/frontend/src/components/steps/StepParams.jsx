import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import PocketBaseConfig from '../params/PocketBaseConfig';
import JsonInspector from '../params/JsonInspector';
import AgentConfig from '../params/AgentConfig';

export default function StepParams() {
  const { selectedUser, is4StepFlow, goToStep } = useApp();
  const [uuidCopied, setUuidCopied] = useState(false);

  if (!selectedUser) return null;

  const handleCopyUuid = () => {
    if (!selectedUser.id) {
      alert('Target user does not have a persistent UUID yet.');
      return;
    }
    navigator.clipboard.writeText(selectedUser.id).then(() => {
      setUuidCopied(true);
      setTimeout(() => setUuidCopied(false), 1500);
    });
  };

  const handleBack = () => {
    if (is4StepFlow) {
      goToStep('sync');
    } else {
      goToStep('select');
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Summary Banner for Selected User */}
      <div className="saas-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs bg-white dark:bg-[#131B2A]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Target:
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {selectedUser.name || selectedUser.username}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
              ({selectedUser.email || 'No email'})
            </span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-[#0E1522] border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-lg">
            <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              {selectedUser.id ? `UUID: ${selectedUser.id}` : 'UUID: Pending Sync'}
            </span>
            <button
              type="button"
              onClick={handleCopyUuid}
              title="Copy User UUID"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
            {uuidCopied && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => goToStep('select')}
          className="px-3 py-1 btn-secondary text-xs cursor-pointer"
        >
          Change User
        </button>
      </div>

      {/* Two Parallel Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Column A */}
        <div className="space-y-6">
          <PocketBaseConfig />
          <JsonInspector />
        </div>

        {/* Column B */}
        <div className="space-y-6">
          <AgentConfig />
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer"
        >
          <span>{is4StepFlow ? 'Back to Sync' : 'Back to User Selection'}</span>
        </button>
        <button
          type="button"
          onClick={() => goToStep('deploy')}
          className="px-5 py-2.5 btn-primary text-xs flex items-center space-x-1.5 cursor-pointer"
        >
          <span>Next: Review &amp; Deploy</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
