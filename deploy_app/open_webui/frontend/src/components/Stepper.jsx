import React from 'react';
import { useApp } from '../context/AppContext';

export default function Stepper() {
  const { currentStep, is4StepFlow, selectedUser, goToStep } = useApp();

  const steps = is4StepFlow
    ? [
        { id: 'select', num: 1, title: '1. Select User', desc: 'Discover identity' },
        { id: 'sync', num: 2, title: '2. Sync User', desc: 'Generate UUID' },
        { id: 'params', num: 3, title: '3. Parameters', desc: 'Config service' },
        { id: 'deploy', num: 4, title: '4. Deploy', desc: 'Pipeline run' },
      ]
    : [
        { id: 'select', num: 1, title: '1. Select User', desc: 'Discover identity' },
        { id: 'params', num: 2, title: '2. Parameters', desc: 'Config service' },
        { id: 'deploy', num: 3, title: '3. Deploy', desc: 'Pipeline run' },
      ];

  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="mb-8">
      <div className="saas-card p-3.5 sm:p-4 bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80">
        <div className="flex items-center justify-between w-full">
          {steps.map((step, idx) => {
            const isCompleted =
              idx < currentIdx || (step.id === 'sync' && selectedUser?.is_synced);
            const isActive = step.id === currentStep;
            const isClickable = isCompleted || isActive || (idx <= currentIdx + 1 && selectedUser);

            let badgeClass = 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-500 font-medium border border-transparent dark:border-gray-700/60';
            let numContent = step.num;
            let textClass = 'text-slate-400 dark:text-gray-500 font-normal';

            if (isActive) {
              badgeClass = 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-md shadow-indigo-500/30 border border-white/20';
              textClass = 'text-slate-900 dark:text-white font-bold';
            } else if (isCompleted) {
              badgeClass = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30';
              numContent = (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              );
              textClass = 'text-slate-700 dark:text-gray-300 font-medium';
            }

            const showLine = idx < steps.length - 1;
            const lineClass = idx < currentIdx 
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600' 
              : 'bg-slate-200 dark:bg-gray-800';

            return (
              <div
                key={step.id}
                className={`flex-1 flex items-center ${idx === steps.length - 1 ? 'flex-grow-0' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center space-x-2.5 text-left transition-all ${
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } flex-shrink-0`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-150 ${badgeClass}`}>
                    {numContent}
                  </div>
                  <div className="hidden sm:block">
                    <div className={`text-xs ${textClass}`}>{step.title}</div>
                  </div>
                </button>

                {showLine && (
                  <div className={`flex-grow mx-3 sm:mx-5 h-0.5 transition-all duration-200 ${lineClass}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
