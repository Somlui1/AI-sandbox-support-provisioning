import React from 'react';
import { Cpu, Clock, Layers, Bot } from 'lucide-react';

export default function Sidebar({ activeMenu, onSelectMenu }) {
  const menuItems = [
    { id: 'deploy', label: 'Deploy Services', icon: Cpu },
    { id: 'agents', label: 'Deployed Agents', icon: Bot },
    { id: 'history', label: 'Deployment History', icon: Clock },
    { id: 'sandbox', label: 'Sandbox Portal', icon: Layers },
  ];

  return (
    <aside className="w-full lg:w-64 flex-shrink-0">
      <div className="saas-card bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80 p-4 rounded-2xl shadow-sm space-y-4">
        <div className="px-2 pt-1 flex items-center justify-between">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            Management
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
        </div>

        <nav className="flex lg:flex-col gap-1.5 w-full overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMenu(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 border border-white/10'
                    : 'bg-transparent text-slate-600 dark:text-gray-400 hover:bg-slate-100/80 dark:hover:bg-gray-800/60 hover:text-slate-900 dark:hover:text-gray-100 border border-transparent dark:hover:border-gray-700/50'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-gray-400'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
