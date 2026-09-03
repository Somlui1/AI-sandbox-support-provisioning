import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import * as api from '../../api/client';

export default function StepSelectUser() {
  const {
    selectedUser,
    handleSelectUser,
    clearSelectedUser,
    is4StepFlow,
    goToStep,
    ldapStatus,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounced search
  useEffect(() => {
    const val = searchQuery.trim();
    if (val.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Try LDAP search first
        const ldapRes = await api.getLdapUsers(val);
        if (ldapRes.ok && ldapRes.data?.status === 'success' && ldapRes.data?.users?.length > 0) {
          setSuggestions(ldapRes.data.users);
          setShowDropdown(true);
        } else {
          // Fallback to OWU users
          const owuRes = await api.getUsers(val);
          if (owuRes.ok && Array.isArray(owuRes.data)) {
            setSuggestions(owuRes.data.map(u => ({ ...u, in_openwebui: true })));
            setShowDropdown(true);
          } else {
            setSuggestions([]);
            setShowDropdown(true);
          }
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onUserClick = (user) => {
    handleSelectUser(user);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleNext = () => {
    if (is4StepFlow && !selectedUser?.is_synced) {
      goToStep('sync');
    } else {
      goToStep('params');
    }
  };

  return (
    <div className="space-y-6">
      <div className="saas-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-slate-100 dark:border-gray-800/80">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
              <span>Step 1</span>
              <span>&bull;</span>
              <span>Identity Discovery</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Select Target User
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Search your enterprise Active Directory (LDAP) or existing Open WebUI user accounts.
            </p>
          </div>
          <span
            className={`self-start sm:self-auto text-[11px] font-semibold px-3 py-1 rounded-full border ${
              ldapStatus.status === 'healthy'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700'
            }`}
          >
            {ldapStatus.status === 'healthy'
              ? `LDAP: ${ldapStatus.domain || 'aapico.com'}`
              : ldapStatus.status === 'checking'
              ? 'Checking LDAP...'
              : 'LDAP Offline'}
          </span>
        </div>

        {/* User Search Input */}
        <div className="max-w-xl relative mb-6" ref={dropdownRef}>
          <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
            User Search
          </label>
          <div className="relative">
            <input
              type="text"
              autoComplete="off"
              className="w-full saas-input pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 dark:placeholder:text-gray-500"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg
              className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3.5 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isLoading && (
              <div className="absolute right-3.5 top-3">
                <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin block" />
              </div>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showDropdown && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-slate-200 dark:border-gray-700/90 rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-30 divide-y divide-slate-100 dark:divide-gray-800/80">
              {suggestions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 dark:text-gray-500 italic">
                  No matching users found.
                </div>
              ) : (
                suggestions.map((u, i) => (
                  <div
                    key={u.id || u.username || i}
                    onClick={() => onUserClick(u)}
                    className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-800/70 cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {u.name || u.username || 'Unnamed'}
                        </span>
                        {u.in_openwebui ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Synced
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            LDAP Only
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 font-mono">
                        <span>@{u.username || u.sAMAccountName || 'user'}</span>
                        {u.email && ` • ${u.email}`}
                        {u.department && ` • ${u.department}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected User Card Preview */}
        {selectedUser && (
          <div className="max-w-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800/90 rounded-2xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md shadow-indigo-500/20">
                  {(selectedUser.name || selectedUser.username || 'U').substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedUser.name || selectedUser.username}
                    </span>
                    {selectedUser.is_synced ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Synced
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Requires Sync
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 flex items-center space-x-2 mt-0.5 font-mono">
                    <span>{selectedUser.email || 'No email'}</span>
                    <span className="text-slate-300 dark:text-gray-600">&bull;</span>
                    <span>@{selectedUser.username || selectedUser.sAMAccountName || 'user'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedUser}
                className="text-xs font-semibold text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Step 1 Navigation Action */}
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-gray-800/80">
          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedUser}
            className={`px-6 py-2.5 btn-primary text-xs flex items-center space-x-2 ${
              selectedUser ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            <span>Continue</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
