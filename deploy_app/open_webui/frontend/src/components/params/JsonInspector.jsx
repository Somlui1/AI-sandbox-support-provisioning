import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { buildPocketBaseFqdn, cleanUsername, interpolatePrompt } from '../../utils/helpers';

export default function JsonInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    selectedUser,
    pbUsername,
    pbAdminEmail,
    pbAdminPassword,
    agentName,
    agentBaseModel,
    agentToolIds,
    agentSystemPrompt,
    customGrants,
    defaultTemplateConfig,
  } = useApp();

  const username = cleanUsername(pbUsername) || (selectedUser ? cleanUsername(selectedUser.username) : 'username');
  const fqdn = buildPocketBaseFqdn(username, defaultTemplateConfig);
  const adminEmail = pbAdminEmail || (selectedUser ? selectedUser.email : `${username}@aapico.com`);
  const toolIds = agentToolIds.split(',').map((s) => s.trim()).filter(Boolean);

  const finalPrompt = interpolatePrompt(agentSystemPrompt, {
    username,
    fqdn,
    adminEmail,
    displayName: selectedUser?.name || username,
  });

  const payload = {
    target_user: {
      name: selectedUser ? selectedUser.name : username,
      email: selectedUser ? selectedUser.email : adminEmail,
      owu_user_id: selectedUser ? selectedUser.id : null,
    },
    coolify_pocketbase: {
      service_name: `pocketbase-${username}`,
      fqdn: fqdn,
      admin_email: adminEmail,
      admin_password: pbAdminPassword ? '[CONFIGURED]' : null,
      docker_image: defaultTemplateConfig?.pocketbase?.docker_image || 'ghcr.io/muchobien/pocketbase:latest',
    },
    openwebui_agent: {
      name: agentName || `PocketBase Agent - ${username}`,
      base_model_id: agentBaseModel || 'deepseek-v4-flash',
      tool_ids: toolIds,
      grants_count: 2 + customGrants.length,
      system_prompt_length: finalPrompt.length,
      system_prompt_preview: finalPrompt.substring(0, 80) + '...',
    },
  };

  return (
    <div className="saas-card p-4 bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
      >
        <span className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span>Inspect Services Payload</span>
        </span>
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          {isOpen ? 'Hide ↑' : 'Show ↓'}
        </span>
      </button>
      {isOpen && (
        <div className="mt-3.5 fade-in">
          <pre className="bg-slate-900 dark:bg-[#030712] p-4 rounded-2xl text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-56 select-all border border-slate-800 dark:border-gray-800 shadow-inner">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
