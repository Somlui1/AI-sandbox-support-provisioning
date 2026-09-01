import React, { useState, useEffect, useRef } from "react";
import {
  RotateCw,
  User,
  Globe,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
  Database
} from "lucide-react";
import { ProvisioningJob } from "../types";

interface DeploymentHistoryProps {
  token: string;
}

export default function DeploymentHistory({ token }: DeploymentHistoryProps) {
  const [pastJobs, setPastJobs] = useState<ProvisioningJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedJobUuid, setSelectedJobUuid] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ProvisioningJob | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<any>(null);

  useEffect(() => {
    fetchJobsHistory();
    return () => {
      cleanStreamConnections();
    };
  }, [token]);

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
      const res = await fetch("/api/jobs", {
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

  const startLiveStream = (uuid: string) => {
    cleanStreamConnections();
    setSelectedJobUuid(uuid);

    const sseUrl = `/api/jobs/${uuid}/stream?token=${encodeURIComponent(token)}`;
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
        const res = await fetch(`/api/jobs/${uuid}`, {
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

  const segments = [
    { id: 1, label: "Identity", names: ["Initializing", "Syncing User to Open WebUI"], desc: "Sync Profile" },
    { id: 2, label: "Container", names: ["Deploying PocketBase"], desc: "Docker Build" },
    { id: 3, label: "Health/Auth", names: ["Waiting for Health", "Verifying Admin"], desc: "Endpoint Probes" },
    { id: 4, label: "Model Reg", names: ["Registering Agent"], desc: "Agent RBAC" }
  ];

  return (
    <div className="space-y-6 flex flex-col h-full w-full">
      {selectedJobUuid && activeJob ? (
        <div className="space-y-6 flex flex-col h-full" id="history-job-detail">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-200/60 dark:border-slate-800 gap-4">
            <div className="flex items-center space-x-3.5">
              <button
                type="button"
                onClick={handleCloseJob}
                className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium flex items-center justify-center transition cursor-pointer shadow-3xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  Deployment Log Audit
                </h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                  JOB: {activeJob.job_uuid}
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 text-[10px] font-mono tracking-wider rounded-full border uppercase ${
                activeJob.status === "completed"
                  ? "bg-emerald-50/55 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800"
                  : activeJob.status === "failed"
                  ? "bg-red-50/55 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-800"
                  : "bg-blue-50/55 dark:bg-blue-950/45 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-800 animate-pulse"
              }`}
            >
              {activeJob.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-3xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target User</div>
              <div className="text-sm font-semibold text-slate-850 dark:text-slate-200">{activeJob.user_name}</div>
              <div className="text-[11px] text-slate-500 font-mono truncate">Active Directory Account</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-3xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Endpoint</div>
              <div className="text-sm font-semibold text-slate-850 dark:text-slate-200 truncate">
                {activeJob.fqdn ? (
                  <a href={activeJob.fqdn} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1">
                    <span>Open Endpoint</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Not available</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">{activeJob.service_name || "pocketbase"}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-3xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deployment Date</div>
              <div className="text-sm font-semibold text-slate-850 dark:text-slate-200">
                {formatDate(activeJob.created_at)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">UTC Timeline Record</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl space-y-5 shadow-2xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {segments.map((seg) => {
                const segState = getSegmentState(seg.names);
                let tagText = "Pending";
                let badgeClass = "bg-slate-50 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border border-slate-150 dark:border-slate-800";
                let barPct = "0%";
                let barColor = "bg-slate-200 dark:bg-slate-850";

                if (segState === "completed") {
                  tagText = "Done";
                  badgeClass = "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900";
                  barPct = "100%";
                  barColor = "bg-emerald-600 dark:bg-emerald-500";
                } else if (segState === "failed") {
                  tagText = "Failed";
                  badgeClass = "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200/60 dark:border-red-900";
                  barPct = "100%";
                  barColor = "bg-red-600 dark:bg-red-500";
                } else if (segState === "running") {
                  tagText = "Running";
                  badgeClass = "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900 animate-pulse";
                  barPct = "65%";
                  barColor = "bg-blue-600 dark:bg-blue-500 animate-pulse";
                }

                return (
                  <div key={seg.id} className="bg-slate-50/50 dark:bg-slate-800/10 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{seg.label}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-medium rounded ${badgeClass}`}>{tagText}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`} style={{ width: barPct }} />
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">{seg.desc}</div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
                <span>Overall Pipeline Completion</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold font-mono">
                  {activeJob.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    activeJob.progress === 100 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-slate-900 dark:bg-blue-500"
                  }`}
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-2xs flex-1 min-h-[300px] flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Pipeline Execution Steps & Details
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Detailed timeline logs of automated provisioning events.
                </p>
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/60 px-2 py-1 rounded-md">
                READONLY PIPELINE LOGS
              </span>
            </div>

            <div className="space-y-6 flex-grow overflow-y-auto pr-1">
              {activeJob.steps.map((step, idx) => {
                let badgeStyle = "border-slate-150 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-850";
                let badgeText = "Pending";
                let dotBorderColor = "border-slate-300 dark:border-slate-700";

                if (step.status === "completed") {
                  badgeStyle = "border-emerald-200 bg-emerald-50/50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400";
                  badgeText = "Success";
                  dotBorderColor = "border-emerald-500 bg-emerald-500";
                } else if (step.status === "failed") {
                  badgeStyle = "border-red-200 bg-red-50/50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400";
                  badgeText = "Failed";
                  dotBorderColor = "border-red-500 bg-red-500";
                } else if (step.status === "running") {
                  badgeStyle = "border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse";
                  badgeText = "Running";
                  dotBorderColor = "border-blue-500 bg-blue-500";
                }

                return (
                  <div key={idx} className="flex gap-4 relative pl-5 border-l-2 border-slate-100 dark:border-slate-800 ml-2.5 pb-2 last:border-l-0 last:pb-0">
                    <span className={`absolute -left-[6px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-900 ${dotBorderColor}`} />
                    {step.status === "running" && (
                      <span className="absolute -left-[6px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                    )}

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono">
                            STAGE {idx + 1}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {step.step_name}
                          </h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-mono tracking-wide rounded border uppercase font-semibold ${badgeStyle}`}>
                          {badgeText}
                        </span>
                      </div>

                      <div className="bg-slate-50/60 dark:bg-slate-800/25 border border-slate-150 dark:border-slate-850 p-3.5 rounded-xl text-xs text-slate-650 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-normal break-all shadow-3xs">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs p-6 space-y-6 flex-grow flex flex-col">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                Deployment Registry Logs
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Audit trial of orchestrated PocketBase server containers and synced AI model agents.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchJobsHistory}
              disabled={loadingHistory}
              className="p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer shadow-3xs"
            >
              <RotateCw className={`w-4 h-4 ${loadingHistory ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-grow overflow-y-auto max-h-[600px] pr-1 space-y-4" id="history-list-container">
            {loadingHistory && pastJobs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs font-mono">
                Querying historical registry records...
              </div>
            ) : pastJobs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs font-mono">
                No deployment records found in database registry.
              </div>
            ) : (
              pastJobs.map((job) => {
                const dateStr = formatDate(job.created_at);
                return (
                  <div
                    key={job.job_uuid}
                    className="bg-slate-50/40 dark:bg-slate-800/10 hover:bg-slate-100/30 dark:hover:bg-slate-850/25 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 transition-all duration-150 flex flex-col gap-4"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1.5">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>{job.user_name}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-mono tracking-wide rounded border uppercase font-semibold ${
                              job.status === "completed"
                                ? "bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-850"
                                : job.status === "failed"
                                ? "bg-red-50/50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-850"
                                : "bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-850 animate-pulse"
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center space-x-2">
                          <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {job.fqdn ? (
                            <a
                              href={job.fqdn}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1"
                            >
                              <span className="truncate">{job.fqdn}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">Deploying container...</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          <Database className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{job.service_name || "pocketbase"}</span>
                          <span>•</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenJob(job)}
                        className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 transition cursor-pointer flex items-center space-x-1.5 shadow-3xs hover:shadow-2xs self-end md:self-auto active:scale-[0.98]"
                      >
                        <span>Inspect Log</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <span>Overall Pipeline Progress</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {job.progress}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            job.progress === 100
                              ? "bg-emerald-600 dark:bg-emerald-500"
                              : job.status === "failed"
                              ? "bg-red-500"
                              : "bg-blue-600 dark:bg-blue-500"
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
    </div>
  );
}
