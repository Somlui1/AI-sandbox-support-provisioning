import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function AccessPermissions() {
  const {
    selectedUser,
    currentUserSession,
    openwebuiUsers,
    customGrants,
    addCustomGrant,
    removeCustomGrant,
  } = useApp();

  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [selectedAddPerm, setSelectedAddPerm] = useState('read_write');

  const handleAdd = () => {
    if (!selectedAddUserId) {
      alert('Please select a user to add a grant.');
      return;
    }

    if (customGrants.some((g) => g.user_id === selectedAddUserId)) {
      alert('This user already has a custom grant.');
      return;
    }

    if (selectedUser && selectedUser.id === selectedAddUserId) {
      alert('Target user is already granted default Read/Write permissions.');
      return;
    }

    if (currentUserSession && currentUserSession.id === selectedAddUserId) {
      alert('Admin is already granted default Read/Write permissions.');
      return;
    }

    const matched = openwebuiUsers.find((u) => u.id === selectedAddUserId);
    const userName = matched ? matched.name || matched.email : selectedAddUserId;

    addCustomGrant(selectedAddUserId, userName, selectedAddPerm);
    setSelectedAddUserId('');
  };

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Access Permissions</label>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">RBAC</span>
      </div>

      {/* Structured Table Container */}
      <div className="w-full bg-white dark:bg-[#0E1522] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <div className="col-span-7">User</div>
          <div className="col-span-3 text-center">Permissions</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {/* Rows Container */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Target User Row */}
          <div className="grid grid-cols-12 items-center px-3.5 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition text-xs">
            <div className="col-span-7 flex items-center space-x-2.5 min-w-0 pr-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] flex items-center justify-center flex-shrink-0">
                {(selectedUser?.name || 'U').substring(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 truncate">
                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {selectedUser?.name || 'Target User'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                  {selectedUser?.email || 'Target User'}
                </div>
              </div>
            </div>
            <div className="col-span-3 flex justify-center space-x-1">
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">Read</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">Write</span>
            </div>
            <div className="col-span-2 text-right">
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Locked</span>
            </div>
          </div>

          {/* Admin User Row */}
          <div className="grid grid-cols-12 items-center px-3.5 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition text-xs">
            <div className="col-span-7 flex items-center space-x-2.5 min-w-0 pr-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] flex items-center justify-center flex-shrink-0">
                A
              </div>
              <div className="min-w-0 truncate">
                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {currentUserSession?.name || 'Admin'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                  {currentUserSession?.email || 'Admin User'}
                </div>
              </div>
            </div>
            <div className="col-span-3 flex justify-center space-x-1">
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">Read</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">Write</span>
            </div>
            <div className="col-span-2 text-right">
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Locked</span>
            </div>
          </div>

          {/* Custom Grants Rows */}
          {customGrants.map((g, idx) => {
            const initial = (g.user_name || 'U').substring(0, 1).toUpperCase();
            return (
              <div
                key={g.user_id || idx}
                className="grid grid-cols-12 items-center px-3.5 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition text-xs"
              >
                <div className="col-span-7 flex items-center space-x-2.5 min-w-0 pr-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] flex items-center justify-center flex-shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0 truncate">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{g.user_name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">Custom Grant</div>
                  </div>
                </div>
                <div className="col-span-3 flex justify-center space-x-1">
                  {g.permission === 'read_write' ? (
                    <>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">Read</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">Write</span>
                    </>
                  ) : g.permission === 'read' ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">Read</span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">Write</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeCustomGrant(idx)}
                    title="Remove permission grant"
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Grant Controls */}
        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 flex items-center space-x-2 text-xs">
          <select
            className="flex-grow saas-input px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E1522]"
            value={selectedAddUserId}
            onChange={(e) => setSelectedAddUserId(e.target.value)}
          >
            <option value="">-- Add user grant --</option>
            {openwebuiUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} ({u.email || u.id})
              </option>
            ))}
          </select>
          <select
            className="w-28 saas-input px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E1522]"
            value={selectedAddPerm}
            onChange={(e) => setSelectedAddPerm(e.target.value)}
          >
            <option value="read_write">Read &amp; Write</option>
            <option value="read">Read Only</option>
            <option value="write">Write Only</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 btn-primary text-xs whitespace-nowrap cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
