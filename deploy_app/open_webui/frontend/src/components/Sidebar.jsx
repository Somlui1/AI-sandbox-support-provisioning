import React from 'react';
import { Cpu, Clock, Layers } from 'lucide-react';

export default function Sidebar({ activeMenu, onSelectMenu }) {
  const menuItems = [
    { id: 'deploy', label: 'Deploy Services', icon: Cpu },
    { id: 'history', label: 'Deployment History', icon: Clock },
    { id: 'sandbox', label: 'Sandbox Portal', icon: Layers },
  ];

  return (
    <aside className="w-full lg:w-64 flex-shrink-0">
      <div className="bg-white dark:bg-[#131B2A] border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-4">
        <div className="px-2 pt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Management Menu
        </div>

        <nav className="flex lg:flex-col gap-1 w-full overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMenu(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-3 transition duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
