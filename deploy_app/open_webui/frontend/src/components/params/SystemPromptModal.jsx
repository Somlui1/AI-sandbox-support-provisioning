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
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200">
      <div className="saas-card bg-white dark:bg-[#131B2A] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              System Prompt Editor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Template substitution with dynamic PocketBase URL and user context.
            </p>
          </div>

          {/* Modal Controls Toolbar */}
          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex items-center text-xs">
              <button
                type="button"
                onClick={() => setModalTab('source')}
                className={`px-3 py-1 font-medium rounded-md transition cursor-pointer ${
                  modalTab === 'source'
                    ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setModalTab('preview')}
                className={`px-3 py-1 font-medium rounded-md transition cursor-pointer ${
                  modalTab === 'preview'
                    ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setModalTab('split')}
                className={`px-3 py-1 font-medium rounded-md transition hidden sm:inline-block cursor-pointer ${
                  modalTab === 'split'
                    ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Split View
              </button>
            </div>

            <button
              type="button"
              onClick={copyToClipboard}
              className="px-3 py-1 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dynamic Context Bar */}
        <div className="px-6 py-2 bg-slate-50 dark:bg-[#0E1522] border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono gap-2">
          <div className="flex items-center space-x-2">
            <span>
              URL: <strong className="text-slate-800 dark:text-slate-200 font-normal">{fqdn}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>
              User: <strong className="text-slate-800 dark:text-slate-200 font-normal">{username}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>
              Length: <strong className="text-slate-800 dark:text-slate-200 font-normal">{agentSystemPrompt.length}</strong>
            </span>
            <span>
              Lines:{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-normal">
                {agentSystemPrompt ? agentSystemPrompt.split('\n').length : 0}
              </strong>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-grow p-4 sm:p-6 overflow-hidden flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#0B0F19]">
          <div className="flex-grow flex gap-4 min-h-0 overflow-hidden">
            {/* Source Column */}
            {(modalTab === 'source' || modalTab === 'split') && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#131B2A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1522] flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Template Source</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{'{pocketbase_url}'}, {'{username}'}</span>
                </div>
                <textarea
                  ref={textareaRef}
                  className="w-full flex-grow p-4 bg-white dark:bg-[#131B2A] text-slate-800 dark:text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto"
                  value={agentSystemPrompt}
                  onChange={(e) => setAgentSystemPrompt(e.target.value)}
                />
              </div>
            )}

            {/* Preview Column */}
            {(modalTab === 'preview' || modalTab === 'split') && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#131B2A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1522] flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Rendered Prompt</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Interpolated
                  </span>
                </div>
                <div className="w-full flex-grow p-4 text-slate-800 dark:text-slate-200 font-mono text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap break-words overflow-x-hidden select-text">
                  {renderedPrompt}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#101726] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="text-slate-400 dark:text-slate-500 mr-1">Insert:</span>
            <button
              type="button"
              onClick={() => insertPlaceholder('{pocketbase_url}')}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition cursor-pointer"
            >
              +{'{pocketbase_url}'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{username}')}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition cursor-pointer"
            >
              +{'{username}'}
            </button>
            <button
              type="button"
              onClick={() => insertPlaceholder('{admin_email}')}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition cursor-pointer"
            >
              +{'{admin_email}'}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={resetSystemPrompt}
              className="px-3 py-1.5 btn-secondary text-xs cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 btn-primary text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
