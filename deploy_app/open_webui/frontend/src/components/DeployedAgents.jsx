import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  User,
  Globe,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Calendar,
  ArrowRight,
  Terminal,
  FileText
} from 'lucide-react';
import * as api from '../api/client';

export default function DeployedAgents({ onGoToDeploy, onInspectJob }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Teardown modal & terminal state
  const [targetAgent, setTargetAgent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [activeTeardownJobUuid, setActiveTeardownJobUuid] = useState(null);
  const terminalEndRef = useRef(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDeployedAgents();
      if (res.ok && Array.isArray(res.data)) {
        setAgents(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch deployed agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const handleOpenDeleteModal = (agent) => {
    setTargetAgent(agent);
    setDeleteError(null);
    setDeleteSuccess(false);
    setIsDeleting(false);
    setTerminalLogs([]);
    setActiveTeardownJobUuid(null);
  };

  const handleCloseModal = () => {
    if (isDeleting) return;
    setTargetAgent(null);
    setDeleteError(null);
    setDeleteSuccess(false);
    setTerminalLogs([]);
    setActiveTeardownJobUuid(null);
  };

  const handleConfirmDelete = async () => {
    if (!targetAgent) return;
    setIsDeleting(true);
    setDeleteError(null);
    const initialTime = new Date().toLocaleTimeString();
    setTerminalLogs([
      {
        time: initialTime,
        badge: "QUEUE",
        badgeType: "info",
        step: "Task Dispatcher",
        text: `Queueing teardown task for Agent '${targetAgent.agent_name}' (${targetAgent.agent_model_id})...`
      }
    ]);

    try {
      const res = await api.deleteDeployedAgent(targetAgent.job_uuid);
      if (!res.ok) {
        throw new Error(res.data?.detail || 'Failed to queue teardown request.');
      }

      const { delete_job_uuid } = res.data;
      setActiveTeardownJobUuid(delete_job_uuid);

      // Connect to SSE stream for live delete progress
      let eventSource = null;
      try {
        eventSource = api.createJobEventSource(delete_job_uuid);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const timeStr = data.timestamp
              ? new Date(data.timestamp * 1000).toLocaleTimeString()
              : new Date().toLocaleTimeString();

            const isCompleted = data.status === 'completed';
            const isFailed = data.status === 'failed';
            const isRetry = data.detail && (data.detail.includes('Retry') || data.detail.includes('Attempt'));

            let badge = isCompleted ? 'DONE' : (isFailed ? 'FAIL' : (isRetry ? 'RETRY' : 'RUN'));
            let badgeType = isCompleted ? 'success' : (isFailed ? 'error' : (isRetry ? 'warn' : 'info'));

            if (data.step_name) {
              setTerminalLogs((prev) => [
                ...prev,
                {
                  time: timeStr,
                  badge,
                  badgeType,
                  step: data.step_name,
                  text: data.detail || (isCompleted ? 'Step finalized successfully.' : 'Processing...')
                }
              ]);
            }

            if (isCompleted && data.step_name === 'Registry Finalization') {
              if (eventSource) eventSource.close();
              setDeleteSuccess(true);
              setIsDeleting(false);
              setAgents((prev) => prev.filter((a) => a.job_uuid !== targetAgent.job_uuid));
            } else if (isFailed) {
              if (eventSource) eventSource.close();
              setIsDeleting(false);
              setDeleteError(data.detail || 'Teardown task failed.');
            }
          } catch {
            // Ignore parse error
          }
        };
      } catch {
        // SSE fallback
      }

      // Safety timeout: ensure complete if SSE ends early
      setTimeout(async () => {
        if (eventSource) eventSource.close();
        setDeleteSuccess(true);
        setIsDeleting(false);
        setAgents((prev) => prev.filter((a) => a.job_uuid !== targetAgent.job_uuid));
        await fetchAgents();
      }, 7000);

    } catch (err) {
      setIsDeleting(false);
      setDeleteError(err.message || 'Error occurred while triggering teardown.');
      setTerminalLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          badge: "FAIL",
          badgeType: "error",
          step: "Error",
          text: err.message || 'Failed to dispatch teardown.'
        }
      ]);
    }
  };

  const filteredAgents = agents.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (a.agent_name && a.agent_name.toLowerCase().includes(q)) ||
      (a.agent_model_id && a.agent_model_id.toLowerCase().includes(q)) ||
      (a.user_name && a.user_name.toLowerCase().includes(q)) ||
      (a.user_email && a.user_email.toLowerCase().includes(q)) ||
      (a.fqdn && a.fqdn.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 flex flex-col h-full w-full">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 dark:border-gray-800/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
            <Bot className="w-3.5 h-3.5" />
            <span>OpenWebUI &bull; Deployed Agents</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Deployed Agents Registry
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Agents provisioned specifically through this portal. Teardown safely removes both OpenWebUI Model and Coolify PocketBase instances.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchAgents}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800/80 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700/80 cursor-pointer transition flex items-center space-x-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by agent name, model ID, or user..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-gray-400 font-mono self-end sm:self-center">
          Showing <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredAgents.length}</span> of{' '}
          <span className="font-bold">{agents.length}</span> deployed agents
        </div>
      </div>

      {/* Main List Area */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500" />
          <p className="text-xs text-slate-500 dark:text-gray-400 font-mono">
            Querying active agent registry from local database...
          </p>
        </div>
      ) : filteredAgents.length === 0 ? (
        /* Empty State */
        <div className="saas-card bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-12 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center mx-auto">
            <Bot className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {searchQuery ? 'No matching deployed agents found' : 'No agents deployed yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto">
              {searchQuery
                ? `No agents matched "${searchQuery}". Clear your search query to see all available agents.`
                : 'Agents deployed through the Provisioning Portal will automatically appear here for tracking and infrastructure teardown.'}
            </p>
          </div>
          {!searchQuery && onGoToDeploy && (
            <button
              type="button"
              onClick={onGoToDeploy}
              className="mt-2 px-5 py-2.5 btn-primary text-xs cursor-pointer inline-flex items-center space-x-2"
            >
              <span>Deploy New Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* Agents Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAgents.map((agent) => {
            const formattedDate = agent.created_at
              ? new Date(agent.created_at * 1000).toLocaleString()
              : 'Recently';

            return (
              <div
                key={agent.job_uuid}
                className="saas-card bg-white/90 dark:bg-gray-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/90 p-5 rounded-2xl shadow-sm hover:border-indigo-500/40 transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                {/* Card Top: Agent Name & Model ID */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-gray-800/70 pb-3.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/30 flex-shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                        {agent.agent_name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-slate-200 dark:border-gray-700">
                          {agent.agent_model_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold flex-shrink-0 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>ONLINE</span>
                  </div>
                </div>

                {/* Card Body: Details */}
                <div className="space-y-2.5 text-xs">
                  {/* PocketBase URL */}
                  {agent.fqdn && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200/60 dark:border-gray-700/60">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Globe className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="font-mono text-[11px] text-slate-700 dark:text-gray-300 truncate">
                          {agent.fqdn}
                        </span>
                      </div>
                      <a
                        href={agent.fqdn}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 p-1 rounded-md transition flex-shrink-0"
                        title="Open PocketBase in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Target User Info */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50/70 dark:bg-gray-800/30 border border-slate-200/40 dark:border-gray-800">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-slate-400 text-[9px] uppercase font-bold">Owner</div>
                        <div className="font-semibold text-slate-800 dark:text-gray-200 truncate">
                          {agent.user_name || 'System'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50/70 dark:bg-gray-800/30 border border-slate-200/40 dark:border-gray-800">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-slate-400 text-[9px] uppercase font-bold">Deployed</div>
                        <div className="text-slate-600 dark:text-gray-300 truncate font-mono text-[10px]">
                          {formattedDate}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coolify Stack Reference */}
                  {agent.coolify_service_uuid && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500 px-1 font-mono">
                      <span>Stack: {agent.service_name || 'pocketbase'}</span>
                      <span className="truncate max-w-[120px]" title={agent.coolify_service_uuid}>
                        UUID: {agent.coolify_service_uuid.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Teardown Button */}
                <div className="pt-2 border-t border-slate-100 dark:border-gray-800/70 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">
                    Project-managed service
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(agent)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-xs shadow-red-500/20 active:scale-[0.98] transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Teardown</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation & Terminal Console Teardown Modal (Centered in Viewport Screen via Portal) */}
      {targetAgent && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className={`bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 w-full shadow-2xl space-y-5 animate-fade-in my-auto transition-all duration-200 ${
            terminalLogs.length > 0 ? 'max-w-2xl' : 'max-w-md'
          }`}>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0">
                  {terminalLogs.length > 0 ? (
                    <Terminal className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {terminalLogs.length > 0 ? 'Agent Teardown Sequence' : 'Confirm Agent Teardown'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    {terminalLogs.length > 0 ? 'Real-time orchestration & sub-sequence audit log.' : 'Permanent removal of Agent and Coolify resources.'}
                  </p>
                </div>
              </div>

              {terminalLogs.length > 0 && isDeleting && (
                <div className="flex items-center space-x-2">
                  <span className="flex items-center space-x-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-mono font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>RUNNING</span>
                  </span>
                </div>
              )}
            </div>

            {terminalLogs.length === 0 ? (
              <>
                {/* Target Agent Spec Box */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700/80 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agent Name:</span>
                    <span className="font-bold text-slate-800 dark:text-white max-w-[200px] truncate">
                      {targetAgent.agent_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Model ID:</span>
                    <span className="font-mono text-indigo-500">{targetAgent.agent_model_id}</span>
                  </div>
                  {targetAgent.fqdn && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">PocketBase URL:</span>
                      <span className="font-mono text-slate-700 dark:text-gray-300 max-w-[180px] truncate">
                        {targetAgent.fqdn}
                      </span>
                    </div>
                  )}
                </div>

                {/* Warning Message */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <span>The following actions will execute simultaneously:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                    <li>Permanently unregister model from OpenWebUI.</li>
                    <li>Terminate and delete PocketBase container stack from Coolify.</li>
                    <li>Clean up audit entry from database registry.</li>
                  </ul>
                </div>
              </>
            ) : (
              /* Terminal Console Output Box */
              <div className="rounded-2xl bg-[#060a12] border border-slate-800 overflow-hidden shadow-2xl flex flex-col font-mono">
                {/* Terminal Header */}
                <div className="px-3.5 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block shadow-xs" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block shadow-xs" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block shadow-xs" />
                    <span className="text-[11px] text-slate-400 font-semibold tracking-wide ml-1.5 flex items-center space-x-1.5">
                      <span>teardown-pipeline.log</span>
                    </span>
                  </div>

                  <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    SSE STREAM
                  </span>
                </div>

                {/* Terminal Stream Body */}
                <div className="p-3.5 h-64 overflow-y-auto space-y-2 text-[11px] leading-relaxed select-text scrollbar-thin">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5">
                      <span className="text-slate-500 select-none text-[10px] pt-0.5 flex-shrink-0">
                        {log.time}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider uppercase select-none flex-shrink-0 ${
                          log.badgeType === 'success'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : log.badgeType === 'error'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : log.badgeType === 'warn'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {log.badge}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-indigo-400 font-semibold mr-1.5">[{log.step}]</span>
                        <span className={log.badgeType === 'error' ? 'text-rose-300' : 'text-slate-200'}>
                          {log.text}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            )}

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                {deleteError}
              </div>
            )}

            {deleteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-2 font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Teardown completed successfully! All resources released.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition cursor-pointer disabled:opacity-50"
              >
                {deleteSuccess ? 'Close' : 'Cancel'}
              </button>

              {deleteSuccess && onInspectJob && activeTeardownJobUuid && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseModal();
                    onInspectJob(activeTeardownJobUuid);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inspect Full Logs</span>
                </button>
              )}

              {!deleteSuccess && terminalLogs.length === 0 && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-500/25 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Tearing down...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Teardown</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
