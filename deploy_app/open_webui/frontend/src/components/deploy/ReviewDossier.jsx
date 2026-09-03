import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import * as api from '../../api/client';
import { buildPocketBaseFqdn, cleanUsername, interpolatePrompt } from '../../utils/helpers';

export default function ReviewDossier({ onDeploySuccess }) {
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
    goToStep,
  } = useApp();

  const [deploying, setDeploying] = useState(false);

  const cleanUser = cleanUsername(pbUsername) || (selectedUser ? cleanUsername(selectedUser.username) : 'username');
  const fqdn = buildPocketBaseFqdn(cleanUser, defaultTemplateConfig);
  const targetEmail = selectedUser?.email || pbAdminEmail || `${cleanUser}@aapico.com`;
  const targetName = selectedUser?.name || cleanUser;
  const targetUsername = selectedUser?.username || selectedUser?.sAMAccountName || cleanUser;
  const targetId = selectedUser?.id || null;
  const toolIds = agentToolIds.split(',').map((s) => s.trim()).filter(Boolean);

  const finalPrompt = interpolatePrompt(agentSystemPrompt, {
    username: cleanUser,
    fqdn,
    adminEmail: pbAdminEmail || targetEmail,
    displayName: targetName,
  });

  const handleDeploy = async () => {
    setDeploying(true);
    const payload = {
      target_user: {
        id: targetId,
        username: targetUsername,
        email: targetEmail,
        name: targetName,
      },
      user: {
        id: targetId,
        username: targetUsername,
        email: targetEmail,
        name: targetName,
      },
      user_email: targetEmail,
      user_name: targetName,
      user_id: targetId,
      username: targetUsername,
      pocketbase: {
        username: cleanUser,
        username_prefix: cleanUser,
        admin_email: pbAdminEmail || targetEmail,
        admin_password: pbAdminPassword,
        fqdn,
      },
      openwebui: {
        agent_name: agentName || `PocketBase Agent - ${cleanUser}`,
        base_model_id: agentBaseModel || 'deepseek-v4-flash',
        tool_ids: toolIds,
        system_prompt: finalPrompt,
        custom_grants: customGrants,
      },
    };

    try {
      const res = await api.createJob(payload);
      if (res.ok && res.data?.job_uuid) {
        onDeploySuccess(res.data.job_uuid);
      } else {
        alert('Provisioning failed: ' + (res.data?.detail || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="saas-card p-6 sm:p-8 space-y-6 bg-white/90 dark:bg-gray-900/65 backdrop-blur-xl border border-slate-200/80 dark:border-gray-800/80">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-gray-800/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
            <span>Step 4</span>
            <span>&bull;</span>
            <span>Pre-flight Review</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Review Configuration Dossier
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Verify parameters prior to dispatching container and AI agent deployment pipeline.
          </p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
          Ready to Deploy
        </span>
      </div>

      {/* Grid of Dossier Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Dossier Item 1: Target Identity */}
        <div className="p-4 bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800/90 rounded-2xl space-y-2">
          <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
            <span>Target User Identity</span>
          </div>
          <div className="text-slate-900 dark:text-white font-bold text-sm">
            {targetName}
          </div>
          <div className="text-slate-500 dark:text-gray-400 font-mono text-[11px]">
            {targetEmail} (@{targetUsername})
          </div>
          <div className="text-[11px] font-mono text-slate-400 dark:text-gray-500">
            {targetId ? `UUID: ${targetId}` : 'UUID: Pending Sync'}
          </div>
        </div>

        {/* Dossier Item 2: Coolify PocketBase Container */}
        <div className="p-4 bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800/90 rounded-2xl space-y-2">
          <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
            <span>PocketBase Container</span>
          </div>
          <div className="text-slate-900 dark:text-white font-mono text-[11px] truncate">
            {fqdn}
          </div>
          <div className="text-slate-500 dark:text-gray-400 text-[11px]">
            Admin: <span className="font-mono text-slate-700 dark:text-gray-300 font-medium">{pbAdminEmail || targetEmail}</span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-gray-500">
            Port: 8090 &bull; Image: {defaultTemplateConfig?.pocketbase?.docker_image || 'ghcr.io/muchobien/pocketbase:latest'}
          </div>
        </div>

        {/* Dossier Item 3: Open WebUI Agent */}
        <div className="p-4 bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800/90 rounded-2xl space-y-2">
          <div className="font-bold text-pink-600 dark:text-pink-400 flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
            <span>Open WebUI Agent</span>
          </div>
          <div className="text-slate-900 dark:text-white font-bold">
            {agentName || `PocketBase Agent - ${cleanUser}`}
          </div>
          <div className="text-slate-500 dark:text-gray-400 text-[11px] font-mono">
            Model: {agentBaseModel || 'deepseek-v4-flash'}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-gray-500 font-mono">
            Tools: {agentToolIds || 'pocketbase'}
          </div>
        </div>

        {/* Dossier Item 4: RBAC Permissions */}
        <div className="p-4 bg-slate-50 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800/90 rounded-2xl space-y-2">
          <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
            <span>Model Access Grants</span>
          </div>
          <div className="text-slate-800 dark:text-gray-200 font-semibold">
            Target User (R/W) + Admin (R/W) + {customGrants.length} Additional Grant(s)
          </div>
          <div className="text-[11px] text-slate-400 dark:text-gray-500">
            Protected endpoint permissions managed in Open WebUI.
          </div>
        </div>
      </div>

      {/* Review Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-gray-800/80">
        <button
          type="button"
          onClick={() => goToStep('params')}
          className="px-5 py-2.5 btn-secondary text-xs flex items-center space-x-1.5 cursor-pointer"
        >
          <span>Back to Edit</span>
        </button>
        <button
          type="button"
          onClick={handleDeploy}
          disabled={deploying}
          className="px-6 py-2.5 btn-primary text-xs flex items-center space-x-2 cursor-pointer"
        >
          <span>{deploying ? 'Deploying Pipeline...' : 'Deploy Service →'}</span>
        </button>
      </div>
    </div>
  );
}
