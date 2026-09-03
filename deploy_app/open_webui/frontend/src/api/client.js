/**
 * Centralized API Client for the Provisioning Orchestrator backend.
 * All API calls go through this module with automatic JWT token injection.
 */

export function getApiBase() {
  if (typeof window !== 'undefined') {
    // 1. Configured via .env or main.py runtime injection
    const injected = window.__APP_CONFIG__?.apiBase ?? window.__APP_CONFIG__?.basePath;
    if (typeof injected === 'string' && injected.trim() !== '') {
      return injected.trim().replace(/\/+$/, '');
    }
    // 2. Auto-detect from URL pathname if under a subpath like /sandbox
    if (window.location.pathname.startsWith('/sandbox')) {
      return '/sandbox';
    }
  }
  return '';
}

export const API_BASE = getApiBase();

function getToken() {
  return localStorage.getItem('openwebui_admin_token') || '';
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(url, options = {}) {
  const base = getApiBase();
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: authHeaders(options.headers),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ── Authentication ──────────────────────────────────────────────────────────

export async function validateAuth(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/auth/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

// ── LDAP ────────────────────────────────────────────────────────────────────

export async function getLdapHealth() {
  return request('/api/ldap/health');
}

export async function getLdapUsers(query = '') {
  return request(`/api/ldap/users?q=${encodeURIComponent(query)}`);
}

export async function syncLdapUser(userData) {
  return request('/api/users/sync-ldap', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function getUsers(query = '') {
  return request(`/api/users?q=${encodeURIComponent(query)}`);
}

export async function createUser(userData) {
  return request('/api/users/create', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

// ── Agent Templates ─────────────────────────────────────────────────────────

export async function getAgentTemplates() {
  return request('/api/agent-templates');
}

export async function getAgentTemplate(filename) {
  return request(`/api/agent-templates/${encodeURIComponent(filename)}`);
}

// ── Default Template Config ─────────────────────────────────────────────────

export async function getDefaultTemplate() {
  return request('/api/default-template');
}

// ── Models ──────────────────────────────────────────────────────────────────

export async function getModels() {
  return request('/api/models');
}

// ── Jobs ────────────────────────────────────────────────────────────────────

export async function getJobs() {
  return request('/api/jobs');
}

export async function getJob(uuid) {
  return request(`/api/jobs/${uuid}`);
}

export async function createJob(payload) {
  return request('/api/jobs/provision', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clearJobs() {
  return request('/api/jobs/clear', {
    method: 'POST',
  });
}

export async function deleteJob(jobUuid) {
  return request(`/api/jobs/${jobUuid}/delete`, {
    method: 'POST',
  });
}


/**
 * Create an SSE EventSource for real-time job tracking.
 * @param {string} jobUuid
 * @returns {EventSource}
 */
export function createJobEventSource(jobUuid) {
  const token = getToken();
  return new EventSource(`${getApiBase()}/api/jobs/${jobUuid}/stream?token=${encodeURIComponent(token)}`);
}

// ── Deployed Agents ─────────────────────────────────────────────────────────

export async function getDeployedAgents() {
  return request('/api/deployed-agents');
}

export async function deleteDeployedAgent(jobUuid) {
  return request(`/api/deployed-agents/${jobUuid}/delete`, {
    method: 'POST',
  });
}

