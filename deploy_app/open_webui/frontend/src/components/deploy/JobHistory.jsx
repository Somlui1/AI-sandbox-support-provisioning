import React, { useState, useEffect } from 'react';
import * as api from '../../api/client';

export default function JobHistory({ onViewJobFlow }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.getJobs();
      if (res.ok && Array.isArray(res.data)) {
        setJobs(res.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="saas-card p-6 space-y-4">
      <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Deployment History
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit log of deployed services and container records.
          </p>
        </div>

        <button
          onClick={fetchJobs}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Refresh history"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2M7 9a7 7 0 0110.74 3.74M7 9H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
        {loading ? (
          <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
            Loading records...
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
            No active records found.
          </div>
        ) : (
          jobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';

            return (
              <div
                key={job.job_uuid}
                className="bg-white dark:bg-[#131B2A] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                    {job.user_name || 'Target User'}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                      isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : isFailed
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 animate-pulse'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-2 truncate">
                  {job.fqdn ? (
                    <a
                      href={job.fqdn}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {job.fqdn}
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">
                      Provisioning container...
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                  <span>{job.service_name || 'pocketbase'}</span>
                  <button
                    onClick={() => onViewJobFlow(job.job_uuid)}
                    className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition cursor-pointer"
                  >
                    View Flow →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
