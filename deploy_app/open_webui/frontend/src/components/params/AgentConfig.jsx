import React from 'react';
import { useApp } from '../../context/AppContext';
import SystemPromptEditor from './SystemPromptEditor';
import AccessPermissions from './AccessPermissions';

export default function AgentConfig() {
  const {
    availableTemplates,
    agentTemplate,
    handleTemplateChange,
    agentName,
    setAgentName,
    availableModels,
    agentBaseModel,
    setAgentBaseModel,
    agentToolIds,
    setAgentToolIds,
  } = useApp();

  return (
    <div className="saas-card p-6 space-y-5 bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-purple-500/20">
            B
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Open WebUI Model</h3>
        </div>
        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">Agent Blueprint</span>
      </div>

      {/* Group 1: Blueprint & Model Configuration */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
              Blueprint
            </label>
            <select
              className="w-full saas-input px-3 py-2 text-xs font-mono bg-white dark:bg-gray-900/80"
              value={agentTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              {availableTemplates.map((t) => {
                const val = t.filename || t.file || t.id;
                return (
                  <option key={val} value={val}>
                    {t.name || val} ({val})
                  </option>
                );
              })}
              {availableTemplates.length === 0 && (
                <option value="pocketbase_agent.json">pocketbase_agent.json</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              className="w-full saas-input px-3 py-2 text-xs"
              placeholder="PocketBase Agent"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
              Base Model
            </label>
            <select
              className="w-full saas-input px-3 py-2 text-xs font-mono bg-white dark:bg-gray-900/80"
              value={agentBaseModel}
              onChange={(e) => setAgentBaseModel(e.target.value)}
            >
              {availableModels.length === 0 ? (
                <option value="deepseek-v4-flash">deepseek-v4-flash (Default)</option>
              ) : (
                availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id} ({m.id})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
              Tool IDs
            </label>
            <input
              type="text"
              className="w-full saas-input px-3 py-2 text-xs font-mono"
              placeholder="pocketbase"
              value={agentToolIds}
              onChange={(e) => setAgentToolIds(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Group 2: System Prompt Section */}
      <SystemPromptEditor />

      {/* Group 3: Access Permissions */}
      <AccessPermissions />
    </div>
  );
}
