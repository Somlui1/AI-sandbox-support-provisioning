import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
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
    <div className="saas-card p-6 sm:p-8 space-y-6">
      <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Deployment Pipeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Job ID: {jobUuid}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 text-[11px] font-medium rounded-full uppercase ${
            jobData.status === 'completed'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : jobData.status === 'failed'
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-pulse'
          }`}
        >
          {jobData.status}
        </span>
      </div>

      {/* Segmented Progress Track */}
      <div className="bg-slate-50 dark:bg-[#0E1522] border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {segments.map((seg) => {
            const state = jobData.status === 'completed' ? 'completed' : getStageStatus(seg.names);
            return (
              <div
                key={seg.id}
                className="bg-white dark:bg-[#131B2A] border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 space-y-2"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{seg.title}</span>
                  {state === 'completed' ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      ✓ Done
                    </span>
                  ) : state === 'failed' ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      Failed
                    </span>
                  ) : state === 'running' ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 animate-pulse">
                      Running
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Pending
                    </span>
                  )}
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 transition-all duration-300 rounded-full ${
                      state === 'completed'
                        ? 'bg-emerald-600 dark:bg-emerald-500 w-full'
                        : state === 'failed'
                        ? 'bg-rose-600 dark:bg-rose-500 w-full'
                        : state === 'running'
                        ? 'bg-blue-600 dark:bg-blue-500 w-2/3'
                        : 'bg-slate-200 dark:bg-slate-800 w-0'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
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
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
            <span>Overall Progress</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
              {jobData.status === 'completed' ? '100%' : `${jobData.progress}%`}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                jobData.status === 'completed'
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : 'bg-slate-900 dark:bg-blue-500'
              }`}
              style={{
                width: jobData.status === 'completed' ? '100%' : `${jobData.progress}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Steps Event Stream */}
      <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
        {jobData.steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={idx}
              className="flex items-start space-x-3 bg-white dark:bg-[#131B2A] p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs"
            >
              <div
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-medium text-[11px] ${
                  isCompleted
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : isFailed
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 animate-pulse'
                }`}
              >
                {isCompleted ? '✓' : isFailed ? '✕' : '•'}
              </div>
              <div className="flex-grow">
                <div
                  className={`text-xs font-semibold ${
                    isCompleted
                      ? 'text-slate-800 dark:text-slate-200'
                      : isFailed
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-blue-700 dark:text-blue-400'
                  }`}
                >
                  {step.step_name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-mono">
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Actions Box */}
      {jobData.status === 'completed' && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                Service Deployed Successfully
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                PocketBase container and Open WebUI agent are online.
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            {jobData.fqdn && (
              <a
                href={jobData.fqdn}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 btn-primary text-xs flex items-center space-x-1 cursor-pointer"
              >
                <span>Open Service →</span>
              </a>
            )}
            <button
              type="button"
              onClick={onStartFresh}
              className="px-3.5 py-1.5 btn-secondary text-xs cursor-pointer"
            >
              New Deployment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
