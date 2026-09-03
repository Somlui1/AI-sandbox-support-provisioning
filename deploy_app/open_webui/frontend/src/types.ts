export interface LdapUser {
  username: string;
  name: string;
  email: string;
  department?: string;
  in_openwebui: boolean;
  is_synced?: boolean;
  id?: string;
  displayName?: string;
  sAMAccountName?: string;
}

export interface OwuUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface AgentTemplate {
  filename: string;
  name: string;
  system_prompt: string;
  base_model_id?: string;
  tool_ids?: string[];
}

export interface OwuModel {
  id: string;
  name: string;
}

export interface CustomGrant {
  user_id: string;
  user_name: string;
  permission: 'read_write' | 'read' | 'write';
}

export interface JobStep {
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail: string;
}

export interface ProvisioningJob {
  job_uuid: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  fqdn?: string;
  user_name: string;
  service_name?: string;
  steps: JobStep[];
  created_at?: string;
}

export interface AppConfig {
  version: string;
  ldap: {
    default_domain: string;
  };
  pocketbase: {
    service_name_prefix: string;
    subdomain_prefix: string;
    domain_suffix: string;
    fqdn_template: string;
    admin_email_pattern: string;
    default_password_length: number;
    docker_image: string;
  };
  openwebui: {
    default_template_file: string;
    agent_name_pattern: string;
    base_model_id: string;
    tool_ids: string[];
    system_prompt: string;
    default_permission: string;
  };
  pipeline: {
    total_steps: number;
    stages: string[];
  };
}

export interface SandboxRequest {
  id: string;
  username: string;
  fullName: string;
  employeeId: string;
  department: string;
  email: string;
  approver: string;
  projectName: string;
  shortDescription: string;
  targetAudience: string;
  appType: string;
  status: 'pending' | 'approved' | 'rejected' | 'deployed';
  created_at: string;
  deployed_job_uuid?: string;
}

export interface DeployedAgent {
  job_uuid: string;
  agent_model_id: string;
  agent_name: string;
  coolify_service_uuid?: string;
  service_name?: string;
  fqdn?: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  status: string;
  created_at: number;
  updated_at?: number;
}

