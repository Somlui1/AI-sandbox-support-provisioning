import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { buildPocketBaseFqdn, cleanUsername, interpolatePrompt } from '../../utils/helpers';
import SystemPromptModal from './SystemPromptModal';

export default function SystemPromptEditor() {
  const {
    agentSystemPrompt,
    setAgentSystemPrompt,
    resetSystemPrompt,
    pbUsername,
    pbAdminEmail,
    selectedUser,
    defaultTemplateConfig,
  } = useApp();

  const [viewMode, setViewMode] = useState('source'); // 'source' | 'preview'
  const [modalOpen, setModalOpen] = useState(false);

  const username = cleanUsername(pbUsername) || (selectedUser ? cleanUsername(selectedUser.username) : 'username');
  const fqdn = buildPocketBaseFqdn(username, defaultTemplateConfig);
  const adminEmail = pbAdminEmail || (selectedUser ? selectedUser.email : `${username}@aapico.com`);
  const displayName = selectedUser?.name || username;

  const renderedPrompt = interpolatePrompt(agentSystemPrompt, {
    username,
    fqdn,
    adminEmail,
    displayName,
  });

  return (
    <>
      <div className="border-t border-slate-100 dark:border-gray-800/80 pt-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center space-x-2">
            <span>System Prompt</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-md font-semibold">
              {agentSystemPrompt.length} chars
            </span>
          </label>
          <div className="flex items-center space-x-1">
            {/* View Mode Switcher */}
            <div className="bg-slate-100 dark:bg-gray-800/80 p-0.5 rounded-lg flex items-center text-[11px] border border-transparent dark:border-gray-700/60">
              <button
                type="button"
                onClick={() => setViewMode('source')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  viewMode === 'source'
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  viewMode === 'preview'
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Preview
              </button>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={resetSystemPrompt}
              title="Reset to default system prompt"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Expand / Maximize Modal Button */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>Expand</span>
            </button>
          </div>
        </div>

        {/* Active URL Info Banner */}
        <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-gray-300 font-mono">
          <span className="text-slate-400 dark:text-gray-500 text-[11px] font-sans">Injected URL:</span>
          <span className="text-slate-800 dark:text-indigo-300 font-semibold truncate max-w-[240px] sm:max-w-md select-all">
            {fqdn}
          </span>
        </div>

        {/* Editor or Preview */}
        <div className="relative w-full rounded-2xl border border-slate-200 dark:border-gray-700/80 overflow-hidden bg-white dark:bg-gray-900/90">
          {viewMode === 'source' ? (
            <textarea
              rows={5}
              className="w-full bg-white dark:bg-gray-900/90 px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-gray-200 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/30 whitespace-pre-wrap break-words overflow-x-hidden min-h-[120px]"
              placeholder="Loading system prompt..."
              value={agentSystemPrompt}
              onChange={(e) => setAgentSystemPrompt(e.target.value)}
            />
          ) : (
            <div className="p-3.5 text-xs font-mono text-slate-800 dark:text-gray-200 bg-slate-50 dark:bg-[#030712] max-h-72 overflow-y-auto whitespace-pre-wrap break-words overflow-x-hidden leading-relaxed select-text min-h-[120px]">
              {renderedPrompt}
            </div>
          )}
        </div>
      </div>

      <SystemPromptModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
