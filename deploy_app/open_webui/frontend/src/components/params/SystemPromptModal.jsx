import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { buildPocketBaseFqdn, cleanUsername, interpolatePrompt } from '../../utils/helpers';

export default function SystemPromptModal({ isOpen, onClose, initialTab = 'source' }) {
  const {
    agentSystemPrompt,
    setAgentSystemPrompt,
    resetSystemPrompt,
    pbUsername,
    pbAdminEmail,
    selectedUser,
    defaultTemplateConfig,
  } = useApp();

  const [modalTab, setModalTab] = useState(initialTab); // 'source' | 'preview' | 'split'
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  // Synchronize modalTab when initialTab or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setModalTab(initialTab || 'source');
      setSearchTerm('');
    }
  }, [isOpen, initialTab]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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

  if (!isOpen || typeof document === 'undefined') return null;

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

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-200 ${
        isFullscreen
          ? 'bg-[#030712] p-0 flex flex-col w-screen h-screen'
          : 'bg-[#030712]/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 w-screen h-screen'
      }`}
      style={{ width: '100vw', height: '100vh', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className={`flex flex-col overflow-hidden bg-white/95 dark:bg-[#070b14] relative transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none border-0'
            : 'saas-card w-full max-w-6xl h-[88vh] rounded-3xl border border-slate-200/90 dark:border-gray-800/90 shadow-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-3.5 sm:py-4 border-b border-slate-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {modalTab === 'preview' ? 'System Prompt Fullscreen Preview' : 'System Prompt Editor'}
                </h3>
                {isFullscreen && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-md">
                    Fullscreen Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 hidden sm:block">
                Template substitution with dynamic PocketBase URL and user context.
              </p>
            </div>
          </div>

          {/* Modal Controls Toolbar */}
          <div className="flex items-center space-x-2">
            {/* View Mode Switcher */}
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
                className={`px-3 py-1 font-semibold rounded-lg transition hidden md:inline-block cursor-pointer ${
                  modalTab === 'split'
                    ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Split View
              </button>
            </div>

            {/* Copy Button */}
            <button
              type="button"
              onClick={copyToClipboard}
              className="px-3 py-1.5 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer font-medium"
              title="Copy rendered system prompt"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Toggle Fullscreen / Windowed Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer border border-slate-200/60 dark:border-gray-700/60"
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {/* Compress / Exit Fullscreen icon */}
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9H4m0 0v5m0-5l6 6m5-6h5m0 0v5m0-5l-6 6m6 5v5m0 0h-5m5 0l-6-6m-9 6v-5m0 0H4m0 0l6-6" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {/* Expand / Enter Fullscreen icon */}
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dynamic Context Bar */}
        <div className="px-5 sm:px-7 py-2.5 bg-slate-50 dark:bg-gray-900/60 border-b border-slate-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              URL: <strong className="text-indigo-600 dark:text-indigo-300 font-medium">{fqdn}</strong>
            </span>
            <span className="text-slate-300 dark:text-gray-600 hidden sm:inline">&bull;</span>
            <span>
              User: <strong className="text-slate-800 dark:text-gray-200 font-medium">{username}</strong>
            </span>
            <span className="text-slate-300 dark:text-gray-600 hidden sm:inline">&bull;</span>
            <span>
              Admin: <strong className="text-slate-800 dark:text-gray-200 font-medium">{adminEmail}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>
              Length: <strong className="text-slate-800 dark:text-gray-200 font-semibold">{renderedPrompt.length.toLocaleString()}</strong> chars
            </span>
            <span>
              Lines:{' '}
              <strong className="text-slate-800 dark:text-gray-200 font-semibold">
                {renderedPrompt ? renderedPrompt.split('\n').length : 0}
              </strong>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-grow p-3 sm:p-6 overflow-hidden flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#030712]/50">
          <div className="flex-grow flex gap-4 min-h-0 overflow-hidden">
            {/* Source Column */}
            {(modalTab === 'source' || modalTab === 'split') && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/60 flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="font-bold text-slate-700 dark:text-gray-200">Template Source (Raw)</span>
                  </div>
                  <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-mono hidden sm:inline">{'{pocketbase_url}'}, {'{username}'}</span>
                </div>
                <textarea
                  ref={textareaRef}
                  className="w-full flex-grow p-4 sm:p-5 bg-white dark:bg-gray-900/80 text-slate-800 dark:text-gray-200 font-mono text-xs sm:text-[13px] leading-relaxed resize-none focus:outline-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto"
                  placeholder="Enter system prompt template..."
                  value={agentSystemPrompt}
                  onChange={(e) => setAgentSystemPrompt(e.target.value)}
                />
              </div>
            )}

            {/* Preview Column (Fullscreen or Split) */}
            {(modalTab === 'preview' || modalTab === 'split') && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/60 flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-bold text-slate-700 dark:text-gray-200">
                      {modalTab === 'preview' ? 'Live Rendered System Prompt' : 'Rendered Prompt'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Variables Injected
                    </span>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="w-full flex-grow p-4 sm:p-6 text-slate-800 dark:text-slate-200 font-mono text-xs sm:text-[13px] leading-relaxed overflow-y-auto whitespace-pre-wrap break-words overflow-x-hidden select-text bg-slate-50/40 dark:bg-[#030712]/90">
                  {renderedPrompt}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-3 border-t border-slate-100 dark:border-gray-800/80 bg-white dark:bg-gray-900/90 flex flex-wrap items-center justify-between gap-3">
          {modalTab !== 'preview' ? (
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
          ) : (
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-gray-400">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>This interpolated system prompt is ready to be deployed to Open WebUI.</span>
            </div>
          )}

          <div className="flex items-center space-x-2.5 ml-auto">
            {modalTab !== 'preview' && (
              <button
                type="button"
                onClick={resetSystemPrompt}
                className="px-4 py-1.5 btn-secondary text-xs cursor-pointer font-medium"
              >
                Reset Default
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 btn-primary text-xs cursor-pointer font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

