import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';
import { DEFAULT_TEMPLATE_CONFIG } from '../utils/defaults';
import {
  cleanUsername,
  buildPocketBaseFqdn,
  buildAdminEmail,
  buildAgentName,
  generateRandomPassword
} from '../utils/helpers';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUserSession, setCurrentUserSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Stepper state
  const [currentStep, setCurrentStep] = useState('select');
  const [is4StepFlow, setIs4StepFlow] = useState(false);

  // Config & Metadata
  const [defaultTemplateConfig, setDefaultTemplateConfig] = useState(DEFAULT_TEMPLATE_CONFIG);
  const [ldapStatus, setLdapStatus] = useState({ status: 'checking', domain: '' });
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [openwebuiUsers, setOpenwebuiUsers] = useState([]);

  // Selected Target User
  const [selectedUser, setSelectedUser] = useState(null);

  // Parameter Configurations
  const [pbUsername, setPbUsername] = useState('');
  const [pbAdminEmail, setPbAdminEmail] = useState('');
  const [pbAdminPassword, setPbAdminPassword] = useState('');
  const [agentTemplate, setAgentTemplate] = useState('pocketbase_agent.json');
  const [agentName, setAgentName] = useState('');
  const [agentBaseModel, setAgentBaseModel] = useState('deepseek-v4-flash');
  const [agentToolIds, setAgentToolIds] = useState('pocketbase');
  const [agentSystemPrompt, setAgentSystemPrompt] = useState('');

  // Access Grants
  const [customGrants, setCustomGrants] = useState([]);

  // Active Job deployment tracker
  const [activeJobUuid, setActiveJobUuid] = useState(null);

  // Check existing session
  // Check existing session or auto-authenticate via environment admin token
  const checkSession = useCallback(async () => {
    setIsAuthChecking(true);
    const token = localStorage.getItem('openwebui_admin_token');

    try {
      // 1. Try with stored token if present
      if (token) {
        const res = await api.validateAuth(token);
        if (res.ok && res.data && (res.data.status === 'valid' || res.data.status === 'success')) {
          setCurrentUserSession(res.data.user);
          setIsAuthenticated(true);
          setIsAuthChecking(false);
          return;
        }
      }

      // 2. If no stored token or stored token invalid, try server default admin token
      const defaultRes = await api.validateAuth('');
      if (defaultRes.ok && defaultRes.data && (defaultRes.data.status === 'valid' || defaultRes.data.status === 'success')) {
        const resolvedToken = defaultRes.data.token || '';
        if (resolvedToken) {
          localStorage.setItem('openwebui_admin_token', resolvedToken);
        }
        setCurrentUserSession(defaultRes.data.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('openwebui_admin_token');
        setIsAuthenticated(false);
      }
    } catch {
      localStorage.removeItem('openwebui_admin_token');
      setIsAuthenticated(false);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  const login = (token, user) => {
    localStorage.setItem('openwebui_admin_token', token);
    setCurrentUserSession(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('openwebui_admin_token');
    setCurrentUserSession(null);
    setIsAuthenticated(false);
    setSelectedUser(null);
    setCurrentStep('select');
  };

  // Load app defaults & reference data
  const loadInitialData = useCallback(async () => {
    // 1. Fetch defaults config
    api.getDefaultTemplate().then(res => {
      if (res.ok && res.data) {
        setDefaultTemplateConfig(prev => ({ ...prev, ...res.data }));
        if (res.data?.openwebui?.system_prompt) {
          setAgentSystemPrompt(prev => prev || res.data.openwebui.system_prompt);
        }
      }
    }).catch(() => {});

    // 2. Fetch LDAP health
    api.getLdapHealth().then(res => {
      if (res.ok && res.data?.status === 'healthy') {
        setLdapStatus({ status: 'healthy', domain: res.data.domain || 'aapico.com' });
      } else {
        setLdapStatus({ status: 'offline', domain: '' });
      }
    }).catch(() => {
      setLdapStatus({ status: 'offline', domain: '' });
    });

    // 3. Fetch agent templates
    api.getAgentTemplates().then(res => {
      if (res.ok && res.data) {
        const templates = res.data.templates || (Array.isArray(res.data) ? res.data : []);
        setAvailableTemplates(templates);
        if (templates.length > 0 && templates[0].system_prompt) {
          setAgentSystemPrompt(prev => prev || templates[0].system_prompt);
        }
      }
    }).catch(() => {});

    // 4. Fetch OWU models
    api.getModels().then(res => {
      if (res.ok && Array.isArray(res.data)) {
        setAvailableModels(res.data);
      }
    }).catch(() => {});

    // 5. Fetch OWU users for RBAC grants
    api.getUsers().then(res => {
      if (res.ok && Array.isArray(res.data)) {
        setOpenwebuiUsers(res.data);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated, loadInitialData]);

  // Handle selecting a user
  const handleSelectUser = (user) => {
    const isSynced = Boolean(user.in_openwebui || user.id);
    const enrichedUser = { ...user, is_synced: isSynced };
    setSelectedUser(enrichedUser);
    setIs4StepFlow(!isSynced);

    const rawUser = user.username || user.sAMAccountName || (user.email ? user.email.split('@')[0] : 'user');
    const clean = cleanUsername(rawUser);

    setPbUsername(clean);
    setPbAdminEmail(user.email || buildAdminEmail(clean, defaultTemplateConfig));
    setPbAdminPassword(generateRandomPassword(defaultTemplateConfig?.pocketbase?.default_password_length || 14));
    setAgentName(buildAgentName(user.name || clean, defaultTemplateConfig));
    setAgentToolIds((defaultTemplateConfig?.openwebui?.tool_ids || ['pocketbase']).join(', '));
    setCustomGrants([]);
  };

  // Handle instant workflow selection from Sandbox Approval
  const handleSelectFromSandbox = (req) => {
    const sAMAccountName = (req.username || req.sAMAccountName || 'user').trim();
    const fullName = req.fullName || req.name || sAMAccountName;
    const defaultDomain = defaultTemplateConfig?.ldap?.default_domain || 'aapico.com';
    const email = req.email || `${sAMAccountName.toLowerCase()}@${defaultDomain}`;
    const projectName = req.projectName || 'AI Sandbox';

    // 1. LDAP Identity Association: Construct temporary LdapUser payload
    const ldapUser = {
      username: sAMAccountName,
      sAMAccountName: sAMAccountName,
      name: fullName,
      displayName: fullName,
      email: email,
      department: req.department || 'Digital Innovation',
      in_openwebui: true, // Marked as synced so wizard bypasses manual step 1/2 search
      is_synced: true,
      id: req.employeeId || `emp-${sAMAccountName}`,
    };

    // 2. Subdomain Prefix: lowercase alphanumeric string without spaces or special characters
    // e.g. "Factory Asset Tracker" -> "factoryassettracker"
    const cleanSubdomain = (projectName || sAMAccountName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    // 3. Agent Name: <project name> agent - <LDAP sAMAccountName>
    // e.g. "Factory Device Booking System agent - siriporn"
    const formattedAgentName = `${projectName} agent - ${sAMAccountName}`;

    setSelectedUser(ldapUser);
    setIs4StepFlow(false); // 3-step flow: Step 1 (Select User) -> Step 2 (Parameters) -> Step 3 (Deploy)
    setPbUsername(cleanSubdomain);
    setPbAdminEmail(email);
    setPbAdminPassword(generateRandomPassword(defaultTemplateConfig?.pocketbase?.default_password_length || 14));
    setAgentName(formattedAgentName);
    setAgentToolIds((defaultTemplateConfig?.openwebui?.tool_ids || ['pocketbase']).join(', '));
    setCustomGrants([]);

    // 4. Instant Redirect: set to Step 2 (Parameters Configuration)
    setCurrentStep('params');
  };

  const clearSelectedUser = () => {
    setSelectedUser(null);
    setIs4StepFlow(false);
    setCurrentStep('select');
  };

  const regeneratePassword = () => {
    setPbAdminPassword(generateRandomPassword(defaultTemplateConfig?.pocketbase?.default_password_length || 14));
  };

  // Switch template
  const handleTemplateChange = async (filename) => {
    setAgentTemplate(filename);
    try {
      const res = await api.getAgentTemplate(filename);
      if (res.ok && res.data) {
        const t = res.data;
        const prompt = t.system_prompt || t.params?.system || defaultTemplateConfig?.openwebui?.system_prompt || '';
        if (prompt) setAgentSystemPrompt(prompt);
        if (t.base_model_id) setAgentBaseModel(t.base_model_id);
        if (t.tool_ids) setAgentToolIds(Array.isArray(t.tool_ids) ? t.tool_ids.join(', ') : t.tool_ids);
      }
    } catch {}
  };

  const resetSystemPrompt = () => {
    if (defaultTemplateConfig?.openwebui?.system_prompt) {
      setAgentSystemPrompt(defaultTemplateConfig.openwebui.system_prompt);
    } else {
      handleTemplateChange(agentTemplate);
    }
  };

  const addCustomGrant = (userId, userName, permission) => {
    if (!userId) return false;
    if (customGrants.some(g => g.user_id === userId)) return false;
    setCustomGrants(prev => [...prev, { user_id: userId, user_name: userName, permission }]);
    return true;
  };

  const removeCustomGrant = (index) => {
    setCustomGrants(prev => prev.filter((_, i) => i !== index));
  };

  const goToStep = (stepId) => {
    if (stepId === 'sync' && (!selectedUser || !is4StepFlow)) return;
    if (stepId === 'params') {
      if (!selectedUser) {
        alert('Please select a target user first.');
        return;
      }
      if (is4StepFlow && !selectedUser.is_synced) {
        alert('Please sync this LDAP user to Open WebUI first.');
        setCurrentStep('sync');
        return;
      }
    }
    if (stepId === 'deploy') {
      if (!selectedUser) {
        alert('Please complete earlier steps first.');
        return;
      }
      if (is4StepFlow && !selectedUser.is_synced) {
        alert('Please sync this user to Open WebUI first.');
        setCurrentStep('sync');
        return;
      }
    }
    setCurrentStep(stepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppContext.Provider
      value={{
        currentUserSession,
        isAuthenticated,
        isAuthChecking,
        login,
        logout,
        currentStep,
        is4StepFlow,
        goToStep,
        defaultTemplateConfig,
        ldapStatus,
        availableTemplates,
        availableModels,
        openwebuiUsers,
        selectedUser,
        setSelectedUser,
        handleSelectUser,
        handleSelectFromSandbox,
        clearSelectedUser,
        // Params
        pbUsername,
        setPbUsername,
        pbAdminEmail,
        setPbAdminEmail,
        pbAdminPassword,
        setPbAdminPassword,
        regeneratePassword,
        agentTemplate,
        handleTemplateChange,
        agentName,
        setAgentName,
        agentBaseModel,
        setAgentBaseModel,
        agentToolIds,
        setAgentToolIds,
        agentSystemPrompt,
        setAgentSystemPrompt,
        resetSystemPrompt,
        customGrants,
        addCustomGrant,
        removeCustomGrant,
        activeJobUuid,
        setActiveJobUuid,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
