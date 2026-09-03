export function cleanUsername(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildPocketBaseFqdn(username, config) {
  const prefix = cleanUsername(username) || 'username';
  const tmpl = config?.pocketbase?.fqdn_template;
  if (tmpl) {
    return tmpl.replace('{username}', prefix);
  }
  const suffix = config?.pocketbase?.domain_suffix || '10.10.3.111.sslip.io';
  return `http://pb-${prefix}.${suffix}`;
}

export function buildAdminEmail(username, config) {
  const sam = cleanUsername(username) || 'user';
  const domain = config?.ldap?.default_domain || 'aapico.com';
  const pattern = config?.pocketbase?.admin_email_pattern;
  if (pattern) {
    return pattern.replace('{username}', sam).toLowerCase();
  }
  return `${sam}@${domain}`.toLowerCase();
}

export function buildAgentName(displayNameOrUser, config) {
  const pattern = config?.openwebui?.agent_name_pattern;
  if (pattern) {
    return pattern.replace('{username}', displayNameOrUser);
  }
  return `PocketBase Agent - ${displayNameOrUser}`;
}

export function generateRandomPassword(length = 14) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export function interpolatePrompt(templateStr, { username, fqdn, adminEmail, displayName }) {
  if (!templateStr) return "";
  let res = templateStr;
  res = res.replace(/\{pocketbase_url\}/g, fqdn || "");
  res = res.replace(/\{fqdn\}/g, fqdn || "");
  res = res.replace(/\{username\}/g, username || "");
  res = res.replace(/\{admin_email\}/g, adminEmail || "");
  res = res.replace(/\{user_name\}/g, displayName || username || "");
  res = res.replace(/\{user_email\}/g, adminEmail || "");
  res = res.replace(/\{POCKETBASE_URL\}/g, fqdn || "");
  res = res.replace(/\{FQDN\}/g, fqdn || "");
  res = res.replace(/\{USERNAME\}/g, username || "");
  res = res.replace(/\{ADMIN_EMAIL\}/g, adminEmail || "");
  return res;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
