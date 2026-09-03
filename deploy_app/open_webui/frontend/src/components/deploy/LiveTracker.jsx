import React, { useState, useEffect, useRef } from 'react';
import * as api from '../../api/client';

export default function LiveTracker({ jobUuid, onStartFresh }) {
  const [jobData, setJobData] = useState({
    status: 'pending',
    progress: 0,
    steps: [],
    fqdn: '',
  });

  const eventSourceRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (!jobUuid) return;

    const cleanup = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const handleJobUpdate = (job) => {
      setJobData((prev) => ({
        ...prev,
        status: job.status || prev.status,
        progress: job.progress || (job.status === 'completed' ? 100 : prev.progress),
        steps: job.steps || prev.steps,
        fqdn: job.fqdn || prev.fqdn,
      }));

      if (job.status === 'completed' || job.status === 'failed') {
        cleanup();
      }
    };

    const startPolling = () => {
      if (pollingIntervalRef.current) return;
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.getJob(jobUuid);
          if (res.ok && res.data) {
            handleJobUpdate(res.data);
          }
        } catch {}
      }, 1500);
    };

    // Start SSE stream
    try {
      const es = api.createJobEventSource(jobUuid);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleJobUpdate(data);
        } catch {}
      };

      es.onerror = () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        startPolling();
      };
    } catch {
      startPolling();
    }

    return cleanup;
  }, [jobUuid]);

  // Stage status helper
  const getStageStatus = (names) => {
    let hasRunning = false;
    let hasFailed = false;
    let allCompleted = true;
    let anyPresent = false;

    names.forEach((name) => {
      const st = jobData.steps.find((s) => s.step_name === name);
      if (st) {
        anyPresent = true;
        if (st.status === 'running') hasRunning = true;
        if (st.status === 'failed') hasFailed = true;
        if (st.status !== 'completed') allCompleted = false;
      } else {
        allCompleted = false;
      }
    });

    if (hasFailed) return 'failed';
    if (hasRunning) return 'running';
    if (anyPresent && allCompleted) return 'completed';
    if (anyPresent) return 'running';
    return 'pending';
  };

  const segments = [
    {
      id: 1,
      title: '1. Identity',
      names: ['Syncing User to Open WebUI', 'Initializing'],
      descCompleted: 'Completed',
      descRunning: 'Configuring...',
      descPending: 'Sync User',
    },
    {
      id: 2,
      title: '2. Container',
      names: ['Deploying PocketBase', 'Waiting for Container'],
      descCompleted: 'Online',
      descRunning: 'Building...',
      descPending: 'Build & Boot',
    },
    {
      id: 3,
      title: '3. Health/Auth',
      names: ['Checking Health', 'Verifying Admin'],
      descCompleted: 'Health OK',
      descRunning: 'Validating...',
      descPending: 'Auth Token',
    },
    {
      id: 4,
      title: '4. Model Reg',
      names: ['Registering Agent'],
      descCompleted: 'Registered',
      descRunning: 'Registering...',
      descPending: 'AI Model & Grants',
    },
  ];

  return (
    <div className="saas-card p-6 sm:p-8 space-y-6 bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80">
      <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-gray-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
            <span>Pipeline Active</span>
            <span>&bull;</span>
            <span>Live Stream</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Deployment Pipeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-mono mt-0.5">
            Job ID: {jobUuid}
          </p>
        </div>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
            jobData.status === 'completed'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
              : jobData.status === 'failed'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 animate-pulse'
          }`}
        >
          {jobData.status}
        </span>
      </div>

      {/* Segmented Progress Track */}
      <div className="bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800/90 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {segments.map((seg) => {
            const state = jobData.status === 'completed' ? 'completed' : getStageStatus(seg.names);
            return (
              <div
                key={seg.id}
                className="bg-white dark:bg-gray-800/60 border border-slate-200/80 dark:border-gray-700/80 rounded-xl p-3.5 space-y-2"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{seg.title}</span>
                  {state === 'completed' ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ Done
                    </span>
                  ) : state === 'failed' ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      Failed
                    </span>
                  ) : state === 'running' ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse">
                      Running
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400">
                      Pending
                    </span>
                  )}
                </div>
                <div className="w-full bg-slate-100 dark:bg-gray-700/70 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 transition-all duration-300 rounded-full ${
                      state === 'completed'
                        ? 'bg-emerald-500 w-full'
                        : state === 'failed'
                        ? 'bg-rose-500 w-full'
                        : state === 'running'
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 w-2/3'
                        : 'bg-slate-200 dark:bg-gray-700 w-0'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-400 dark:text-gray-400 truncate font-medium">
                  {state === 'completed'
                    ? seg.descCompleted
                    : state === 'running'
                    ? seg.descRunning
                    : seg.descPending}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall Master Progress Bar */}
        <div className="pt-1">
          <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 mb-1.5 font-medium">
            <span>Overall Progress</span>
            <span className="text-slate-800 dark:text-white font-bold">
              {jobData.status === 'completed' ? '100%' : `${jobData.progress}%`}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                jobData.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600'
              }`}
              style={{
                width: jobData.status === 'completed' ? '100%' : `${jobData.progress}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Steps Event Stream */}
      <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
        {jobData.steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={idx}
              className="flex items-start space-x-3 bg-white dark:bg-gray-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-xs"
            >
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  isCompleted
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : isFailed
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 animate-pulse'
                }`}
              >
                {isCompleted ? '✓' : isFailed ? '✕' : '•'}
              </div>
              <div className="flex-grow">
                <div
                  className={`text-xs font-bold ${
                    isCompleted
                      ? 'text-slate-800 dark:text-gray-200'
                      : isFailed
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {step.step_name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-relaxed font-mono">
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Actions Box */}
      {jobData.status === 'completed' && (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/30">
              ✓
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                Service Deployed Successfully
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                PocketBase container and Open WebUI agent are active &amp; ready to use.
              </div>
            </div>
          </div>
          <div className="flex space-x-2.5">
            {jobData.fqdn && (
              <a
                href={jobData.fqdn}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 btn-primary text-xs flex items-center space-x-1.5 cursor-pointer font-semibold"
              >
                <span>Open Service →</span>
              </a>
            )}
            <button
              type="button"
              onClick={onStartFresh}
              className="px-4 py-2 btn-secondary text-xs cursor-pointer font-medium"
            >
              New Deployment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
