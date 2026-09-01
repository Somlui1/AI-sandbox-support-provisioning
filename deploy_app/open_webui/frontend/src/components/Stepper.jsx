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
      <div className="saas-card p-3 sm:p-4">
        <div className="flex items-center justify-between w-full">
          {steps.map((step, idx) => {
            const isCompleted =
              idx < currentIdx || (step.id === 'sync' && selectedUser?.is_synced);
            const isActive = step.id === currentStep;
            const isClickable = isCompleted || isActive || (idx <= currentIdx + 1 && selectedUser);

            let badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-medium';
            let numContent = step.num;
            let textClass = 'text-slate-400 dark:text-slate-500 font-normal';

            if (isActive) {
              badgeClass = 'bg-slate-900 dark:bg-blue-600 text-white font-medium shadow-xs';
              textClass = 'text-slate-900 dark:text-slate-100 font-semibold';
            } else if (isCompleted) {
              badgeClass = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold';
              numContent = (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              );
              textClass = 'text-slate-700 dark:text-slate-300 font-medium';
            }

            const showLine = idx < steps.length - 1;
            const lineClass = idx < currentIdx ? 'bg-slate-900 dark:bg-blue-600' : 'bg-slate-200 dark:bg-slate-800';

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
