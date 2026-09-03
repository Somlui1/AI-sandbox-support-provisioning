import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  RotateCw,
  User,
  Globe,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
  Database,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { ProvisioningJob } from "../types";
import { API_BASE } from "../api/client";

interface DeploymentHistoryProps {
  token: string;
  initialJobUuid?: string | null;
}

export default function DeploymentHistory({ token, initialJobUuid }: DeploymentHistoryProps) {
  const [pastJobs, setPastJobs] = useState<ProvisioningJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedJobUuid, setSelectedJobUuid] = useState<string | null>(initialJobUuid || null);
  const [activeJob, setActiveJob] = useState<ProvisioningJob | null>(null);

  // Clear History Modal State
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<any>(null);

  useEffect(() => {
    fetchJobsHistory();
    if (initialJobUuid) {
      startLiveStream(initialJobUuid);
    }
    return () => {
      cleanStreamConnections();
    };
  }, [token, initialJobUuid]);

  const cleanStreamConnections = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const fetchJobsHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setPastJobs(data);
      }
    } catch (err) {
      console.warn("Failed to retrieve jobs history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleClearAllHistory = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPastJobs([]);
        setClearSuccess(true);
        setTimeout(() => {
          setShowClearModal(false);
          setClearSuccess(false);
        }, 1000);
      }
    } catch (err) {
      console.error("Failed to clear jobs history:", err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteSingleJob = async (jobUuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobUuid}/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPastJobs((prev) => prev.filter((j) => j.job_uuid !== jobUuid));
        if (selectedJobUuid === jobUuid) {
          handleBackToList();
        }
      }
    } catch (err) {
      console.error("Failed to delete job log:", err);
    }
  };

  const startLiveStream = (uuid: string) => {
    cleanStreamConnections();
    setSelectedJobUuid(uuid);

    const sseUrl = `${API_BASE}/api/jobs/${uuid}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(sseUrl);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const job: ProvisioningJob = JSON.parse(event.data);
        setActiveJob(job);

        if (job.status === "completed" || job.status === "failed") {
          source.close();
          eventSourceRef.current = null;
          fetchJobsHistory();
        }
      } catch (e) {
        console.error("SSE JSON parsing error:", e);
      }
    };

    source.onerror = (err) => {
      console.warn("SSE connection closed or failed. Falling back to active HTTP polling...", err);
      source.close();
      eventSourceRef.current = null;
      startPollingFallback(uuid);
    };
  };

  const startPollingFallback = (uuid: string) => {
    if (pollingIntervalRef.current) return;

    const pollOnce = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${uuid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const job: ProvisioningJob = await res.json().catch(() => null);
        if (res.ok && job && job.job_uuid) {
          setActiveJob(job);
          if (job.status === "completed" || job.status === "failed") {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            fetchJobsHistory();
          }
        }
      } catch (err) {
        console.warn("Job polling fetch error:", err);
      }
    };

    pollOnce();
    pollingIntervalRef.current = setInterval(pollOnce, 2000);
  };

  const handleOpenJob = (job: ProvisioningJob) => {
    setActiveJob(job);
    startLiveStream(job.job_uuid);
  };

  const handleCloseJob = () => {
    cleanStreamConnections();
    setSelectedJobUuid(null);
    setActiveJob(null);
    fetchJobsHistory();
  };

  const formatDate = (val: any) => {
    if (!val) return "Date unknown";
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      const ms = num < 1e12 ? num * 1000 : num;
      return new Date(ms).toLocaleString();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  };

  const getSegmentState = (stageNames: string[]) => {
    if (!activeJob) return "pending";
    const steps = activeJob.steps || [];

    const matchedSteps = steps.filter((s) => stageNames.includes(s.step_name));
    if (matchedSteps.length === 0) return "pending";

    const hasFailed = matchedSteps.some((s) => s.status === "failed");
    const hasRunning = matchedSteps.some((s) => s.status === "running");
    const allCompleted = matchedSteps.every((s) => s.status === "completed");

    if (hasFailed || activeJob.status === "failed") return "failed";
    if (activeJob.status === "completed" || allCompleted) return "completed";
    if (hasRunning) return "running";
    return "pending";
  };

  const isTeardown = activeJob?.service_name?.includes("[Teardown]") || (activeJob as any)?.config?.job_type === "teardown";

  const provisionSegments = [
    { id: 1, label: "Identity", names: ["Initializing", "Syncing User to Open WebUI"], desc: "Sync Profile" },
    { id: 2, label: "Container", names: ["Deploying PocketBase"], desc: "Docker Build" },
    { id: 3, label: "Health/Auth", names: ["Waiting for Health", "Verifying Admin"], desc: "Endpoint Probes" },
    { id: 4, label: "Model Reg", names: ["Registering Agent"], desc: "Agent RBAC" }
  ];

  const teardownSegments = [
    { id: 1, label: "Pre-flight", names: ["Pre-flight Checks"], desc: "Verify Target" },
    { id: 2, label: "OWU Model", names: ["OpenWebUI Agent Removal"], desc: "Unregister & Retry" },
    { id: 3, label: "Coolify Stack", names: ["Coolify Stack Teardown"], desc: "Purge Container" },
    { id: 4, label: "Registry", names: ["Registry Finalization"], desc: "Audit Archive" }
  ];

  const segments = isTeardown ? teardownSegments : provisionSegments;

  return (
    <div className="space-y-6 flex flex-col h-full w-full">
      {selectedJobUuid && activeJob ? (
        <div className="space-y-6 flex flex-col h-full" id="history-job-detail">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-200/80 dark:border-gray-800/80 gap-4">
            <div className="flex items-center space-x-3.5">
              <button
                type="button"
                onClick={handleCloseJob}
                className="p-2 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center justify-center transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
                  <span>{isTeardown ? "Agent Teardown Audit" : "Deployment Log Audit"}</span>
                  {isTeardown && (
                    <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider rounded-md border uppercase font-bold bg-rose-500/10 text-rose-500 border-rose-500/20">
                      TEARDOWN
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-indigo-400/80 font-mono mt-0.5">
                  JOB: {activeJob.job_uuid}
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 text-xs font-mono tracking-wider rounded-full border uppercase font-bold ${
                activeJob.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : activeJob.status === "failed"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                  : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse"
              }`}
            >
              {activeJob.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 rounded-2xl p-4 space-y-1 shadow-xs">
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Target User</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{activeJob.user_name}</div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono truncate">Active Directory Account</div>
            </div>
            <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 rounded-2xl p-4 space-y-1 shadow-xs">
              <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Service Endpoint</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {activeJob.fqdn ? (
                  <a href={activeJob.fqdn} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1">
                    <span>Open Endpoint</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Not available</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono truncate">{activeJob.service_name || "pocketbase"}</div>
            </div>
            <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 rounded-2xl p-4 space-y-1 shadow-xs">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Deployment Date</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {formatDate(activeJob.created_at)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono truncate">Timeline Record</div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-6 rounded-3xl space-y-5 shadow-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {segments.map((seg) => {
                const segState = getSegmentState(seg.names);
                let tagText = "Pending";
                let badgeClass = "bg-slate-50 dark:bg-gray-800 text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-gray-700";
                let barPct = "0%";
                let barColor = "bg-slate-200 dark:bg-gray-800";

                if (segState === "completed") {
                  tagText = "Done";
                  badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                  barPct = "100%";
                  barColor = "bg-emerald-500";
                } else if (segState === "failed") {
                  tagText = "Failed";
                  badgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
                  barPct = "100%";
                  barColor = "bg-rose-500";
                } else if (segState === "running") {
                  tagText = "Running";
                  badgeClass = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse";
                  barPct = "65%";
                  barColor = "bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse";
                }

                return (
                  <div key={seg.id} className="bg-slate-50/50 dark:bg-gray-800/40 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800 dark:text-gray-200">{seg.label}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${badgeClass}`}>{tagText}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} transition-all duration-300 rounded-full`} style={{ width: barPct }} />
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-gray-500 font-mono truncate">{seg.desc}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800/80 pb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Pipeline Execution Steps
              </span>
              <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-bold">
                AUDIT LOGS
              </span>
            </div>

            <div className="space-y-4 flex-grow overflow-y-auto pr-1 max-h-96">
              {activeJob.steps.map((step, idx) => {
                let badgeStyle = "border-slate-200 bg-slate-50 text-slate-400 dark:border-gray-700 dark:bg-gray-800";
                let badgeText = "Pending";
                let dotBorderColor = "border-slate-300 dark:border-gray-700";

                if (step.status === "completed") {
                  badgeStyle = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                  badgeText = "Success";
                  dotBorderColor = "border-emerald-500 bg-emerald-500";
                } else if (step.status === "failed") {
                  badgeStyle = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
                  badgeText = "Failed";
                  dotBorderColor = "border-rose-500 bg-rose-500";
                } else if (step.status === "running") {
                  badgeStyle = "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse";
                  badgeText = "Running";
                  dotBorderColor = "border-indigo-500 bg-indigo-500";
                }

                return (
                  <div key={idx} className="flex gap-4 relative pl-5 border-l-2 border-slate-200 dark:border-gray-800 ml-2.5 pb-2 last:border-l-0 last:pb-0">
                    <span className={`absolute -left-[6px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-gray-900 ${dotBorderColor}`} />
                    {step.status === "running" && (
                      <span className="absolute -left-[6px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    )}

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold font-mono">
                            STAGE {idx + 1}
                          </span>
                          <span className="text-slate-300 dark:text-gray-700">&bull;</span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-gray-200">
                            {step.step_name}
                          </h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-mono tracking-wide rounded border uppercase font-bold ${badgeStyle}`}>
                          {badgeText}
                        </span>
                      </div>

                      <div className="bg-slate-50/60 dark:bg-gray-800/40 border border-slate-200/80 dark:border-gray-700/80 p-3.5 rounded-xl text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-mono break-all shadow-xs">
                        {step.detail || "Waiting to initialize this stage..."}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 rounded-3xl shadow-xs p-6 sm:p-8 space-y-6 flex-grow flex flex-col">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-gray-800/80">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
                <span>Audit Logs</span>
                <span>&bull;</span>
                <span>Historical Runs</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Deployment Registry Logs
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-normal">
                Audit trail of orchestrated PocketBase server containers and synced AI model agents.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                disabled={loadingHistory || pastJobs.length === 0}
                className="px-3 py-2 rounded-xl border border-red-200/50 dark:border-red-500/20 bg-red-50/60 hover:bg-red-100/80 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear all historical deployment logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>

              <button
                type="button"
                onClick={fetchJobsHistory}
                disabled={loadingHistory}
                className="p-2.5 rounded-xl border border-slate-200/60 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                title="Refresh history"
              >
                <RotateCw className={`w-4 h-4 ${loadingHistory ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto max-h-[600px] pr-1 space-y-4" id="history-list-container">
            {loadingHistory && pastJobs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-gray-500 text-xs font-mono">
                Querying historical registry records...
              </div>
            ) : pastJobs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-gray-500 text-xs font-mono">
                No deployment records found in database registry.
              </div>
            ) : (
              pastJobs.map((job) => {
                const dateStr = formatDate(job.created_at);
                return (
                  <div
                    key={job.job_uuid}
                    className="bg-slate-50/60 dark:bg-gray-800/40 hover:bg-slate-100/60 dark:hover:bg-gray-800/70 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 transition-all duration-150 flex flex-col gap-4 shadow-xs"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1.5">
                          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                            <User className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                            <span>{job.user_name}</span>
                          </div>
                          {job.service_name?.includes("[Teardown]") || (job.config as any)?.job_type === "teardown" ? (
                            <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-wide rounded-full border uppercase font-bold bg-rose-500/15 text-rose-500 border-rose-500/30">
                              TEARDOWN
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-[10px] font-mono tracking-wide rounded-full border uppercase font-bold bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                              PROVISION
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-mono tracking-wide rounded-full border uppercase font-bold ${
                              job.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : job.status === "failed"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse"
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-gray-400 font-mono flex items-center space-x-2">
                          <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {job.fqdn ? (
                            <a
                              href={job.fqdn}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
                            >
                              <span className="truncate">{job.fqdn}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500 italic">Deploying container...</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2.5 text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                          <Database className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{job.service_name || "pocketbase"}</span>
                          <span>&bull;</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSingleJob(job.job_uuid, e)}
                          className="p-2 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl text-xs border border-slate-200 dark:border-gray-700 transition cursor-pointer"
                          title="Delete this history record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenJob(job)}
                          className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-gray-700 transition cursor-pointer flex items-center space-x-1.5 active:scale-[0.98]"
                        >
                          <span>Inspect Log</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="w-full pt-3 border-t border-slate-200/60 dark:border-gray-700/60 space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-gray-400">
                        <span>Overall Pipeline Progress</span>
                        <span className="font-mono text-slate-800 dark:text-gray-200 font-bold">
                          {job.progress}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            job.progress === 100
                              ? "bg-emerald-500"
                              : job.status === "failed"
                              ? "bg-rose-500"
                              : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600"
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Clear All Logs Confirmation Modal */}
      {showClearModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-fade-in my-auto">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Clear Deployment Logs?
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  This will remove all historical deployment log entries from database.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700/80 text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to delete all <span className="font-bold text-indigo-500">{pastJobs.length}</span> historical deployment logs? This will clean up the audit records.
            </div>

            {clearSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-2 font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>All deployment logs cleared successfully!</span>
              </div>
            )}

            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isClearing || clearSuccess}
                onClick={handleClearAllHistory}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-500/25 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Clear</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
