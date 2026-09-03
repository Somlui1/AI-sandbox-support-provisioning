import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { buildPocketBaseFqdn, cleanUsername, interpolatePrompt } from '../../utils/helpers';

export default function SystemPromptModal({ isOpen, onClose }) {
  const {
    agentSystemPrompt,
    setAgentSystemPrompt,
    resetSystemPrompt,
    pbUsername,
    pbAdminEmail,
    selectedUser,
    defaultTemplateConfig,
  } = useApp();

  const [modalTab, setModalTab] = useState('source'); // 'source' | 'preview' | 'split'
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

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

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const insertPlaceholder = (placeholder) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + placeholder + text.substring(end);
    setAgentSystemPrompt(newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
      textarea.focus();
    }, 0);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(renderedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-[#030712]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-200">
      <div className="saas-card bg-white/95 dark:bg-gray-900/90 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200/90 dark:border-gray-800/90 relative rounded-3xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              System Prompt Editor
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Template substitution with dynamic PocketBase URL and user context.
            </p>
          </div>

          {/* Modal Controls Toolbar */}
          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 dark:bg-gray-800/80 p-0.5 rounded-xl flex items-center text-xs border border-transparent dark:border-gray-700/60">
              <button
                type="button"
                onClick={() => setModalTab('source')}
                className={`px-3 py-1 font-semibold rounded-lg transition cursor-pointer ${
                  modalTab === 'source'
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setModalTab('preview')}
                className={`px-3 py-1 font-semibold rounded-lg transition cursor-pointer ${
                  modalTab === 'preview'
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setModalTab('split')}
                className={`px-3 py-1 font-semibold rounded-lg transition hidden sm:inline-block cursor-pointer ${
                  modalTab === 'split'
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Split View
              </button>
            </div>

            <button
              type="button"
              onClick={copyToClipboard}
              className="px-3 py-1.5 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer font-medium"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dynamic Context Bar */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-gray-900/80 border-b border-slate-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono gap-2">
          <div className="flex items-center space-x-2">
            <span>
              URL: <strong className="text-indigo-600 dark:text-indigo-300 font-medium">{fqdn}</strong>
            </span>
            <span className="text-slate-300 dark:text-gray-600">&bull;</span>
            <span>
              User: <strong className="text-slate-800 dark:text-gray-200 font-medium">{username}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>
              Length: <strong className="text-slate-800 dark:text-gray-200 font-semibold">{agentSystemPrompt.length}</strong>
            </span>
            <span>
              Lines:{' '}
              <strong className="text-slate-800 dark:text-gray-200 font-semibold">
                {agentSystemPrompt ? agentSystemPrompt.split('\n').length : 0}
              </strong>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-grow p-4 sm:p-6 overflow-hidden flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#030712]/50">
          <div className="flex-grow flex gap-4 min-h-0 overflow-hidden">
            {/* Source Column */}
            {(modalTab === 'source' || modalTab === 'split') && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/60 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-gray-200">Template Source</span>
                  <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-mono">{'{pocketbase_url}'}, {'{username}'}</span>
                </div>
                <textarea
                  ref={textareaRef}
                  className="w-full flex-grow p-4 bg-white dark:bg-gray-900/80 text-slate-800 dark:text-gray-200 font-mono text-xs leading-relaxed resize-none focus:outline-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto"
                  value={agentSystemPrompt}
                  onChange={(e) => setAgentSystemPrompt(e.target.value)}
                />
              </div>
            )}

            {/* Preview Column */}
            {(modalTab === 'preview' || modalTab === 'split') && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/60 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-gray-200">Rendered Prompt</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Interpolated
                  </span>
                </div>
                <div className="w-full flex-grow p-4 text-slate-800 dark:text-gray-200 font-mono text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap break-words overflow-x-hidden select-text">
                  {renderedPrompt}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-gray-800/80 bg-white dark:bg-gray-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 font-mono">
            <span className="text-slate-400 dark:text-gray-500 mr-1 font-sans">Insert placeholder:</span>
            <button
              type="button"
              onClick={() => insertPlaceholder('{pocketbase_url}')}
              className="px-2.5 py-1 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg transition cursor-pointer text-[11px]"
            >
              +{'{pocketbase_url}'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{username}')}
              className="px-2.5 py-1 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg transition cursor-pointer text-[11px]"
            >
              +{'{username}'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{admin_email}')}
              className="px-2.5 py-1 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg transition cursor-pointer text-[11px]"
            >
              +{'{admin_email}'}
            </button>
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={resetSystemPrompt}
              className="px-4 py-2 btn-secondary text-xs cursor-pointer font-medium"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 btn-primary text-xs cursor-pointer font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
