import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
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

  const handleClearJobs = async () => {
    if (!window.confirm('Are you sure you want to clear all deployment logs?')) return;
    try {
      await api.clearJobs();
      setJobs([]);
    } catch (err) {
      console.error('Failed to clear jobs:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="saas-card p-6 sm:p-7 space-y-4 bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80">
      <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-gray-800/80">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Deployment History
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Audit log of deployed services and container records.
          </p>
        </div>

        <div className="flex items-center space-x-1.5">
          {jobs.length > 0 && (
            <button
              onClick={handleClearJobs}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer"
              title="Clear deployment logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={fetchJobs}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800/70 transition cursor-pointer"
            title="Refresh history"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2M7 9a7 7 0 0110.74 3.74M7 9H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
        {loading ? (
          <div className="py-8 text-center text-slate-400 dark:text-gray-500 text-xs">
            Loading records...
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-gray-500 text-xs">
            No active records found.
          </div>
        ) : (
          jobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';

            return (
              <div
                key={job.job_uuid}
                className="bg-white dark:bg-gray-800/50 hover:bg-slate-50 dark:hover:bg-gray-800/80 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-4 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    {job.user_name || 'Target User'}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : isFailed
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400 font-mono mb-2 truncate">
                  {job.fqdn ? (
                    <a
                      href={job.fqdn}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {job.fqdn}
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-gray-500">
                      Provisioning container...
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-gray-500 border-t border-slate-100 dark:border-gray-800/80 pt-2.5 mt-2">
                  <span className="font-mono">{job.service_name || 'pocketbase'}</span>
                  <button
                    onClick={() => onViewJobFlow(job.job_uuid)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition cursor-pointer"
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
