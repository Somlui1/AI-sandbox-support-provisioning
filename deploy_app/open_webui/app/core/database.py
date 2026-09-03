import sqlite3
import json
import os
import time
from typing import Dict, Any, List, Optional
from open_webui.app.settings import SQLITE_DB_PATH

def get_db_connection():
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def run_migrations():
    """Create the necessary database tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create jobs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            job_uuid TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_email TEXT NOT NULL,
            user_name TEXT NOT NULL,
            status TEXT NOT NULL,
            service_name TEXT,
            fqdn TEXT,
            error_message TEXT,
            steps TEXT DEFAULT '[]',
            config TEXT DEFAULT '{}',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    # Add config column if table was created in older schema
    try:
        cursor.execute("ALTER TABLE jobs ADD COLUMN config TEXT DEFAULT '{}'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE jobs ADD COLUMN coolify_service_uuid TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE jobs ADD COLUMN agent_model_id TEXT")
    except Exception:
        pass

    # Create sandbox_requests table for persistent portal requests
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sandbox_requests (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            full_name TEXT NOT NULL,
            employee_id TEXT,
            department TEXT,
            email TEXT NOT NULL,
            approver TEXT,
            project_name TEXT NOT NULL,
            short_description TEXT,
            target_audience TEXT,
            app_type TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            deployed_job_uuid TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()

def create_job(job_uuid: str, user_id: str, user_email: str, user_name: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
    config_json = json.dumps(config or {})
    cursor.execute("""
        INSERT INTO jobs (job_uuid, user_id, user_email, user_name, status, steps, config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_uuid, user_id, user_email, user_name, 'pending', '[]', config_json, now, now))
    conn.commit()
    conn.close()
    return {
        "job_uuid": job_uuid,
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "status": "pending",
        "steps": [],
        "config": config or {},
        "created_at": now,
        "updated_at": now
    }

def get_job(job_uuid: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE job_uuid = ?", (job_uuid,))
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res["steps"] = json.loads(res.get("steps") or "[]")
        res["config"] = json.loads(res.get("config") or "{}")
        return res
    return None

def get_all_jobs() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    results = []
    for row in rows:
        res = dict(row)
        res["steps"] = json.loads(res.get("steps") or "[]")
        res["config"] = json.loads(res.get("config") or "{}")
        results.append(res)
    return results

def delete_all_jobs() -> int:
    """Delete all job history records from SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs")
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted_count

def delete_job(job_uuid: str) -> bool:
    """Delete a single job history record by UUID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE job_uuid = ?", (job_uuid,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def update_job_status(job_uuid: str, status: str, error_message: Optional[str] = None, service_name: Optional[str] = None, fqdn: Optional[str] = None) -> None:
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Dynamically build update values
    updates = ["status = ?", "updated_at = ?"]
    params = [status, now]
    
    if error_message is not None:
        updates.append("error_message = ?")
        params.append(error_message)
    if service_name is not None:
        updates.append("service_name = ?")
        params.append(service_name)
    if fqdn is not None:
        updates.append("fqdn = ?")
        params.append(fqdn)
        
    params.append(job_uuid)
    query = f"UPDATE jobs SET {', '.join(updates)} WHERE job_uuid = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()

def add_job_step(job_uuid: str, step_name: str, step_status: str, detail: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT steps FROM jobs WHERE job_uuid = ?", (job_uuid,))
    row = cursor.fetchone()
    
    steps = []
    if row:
        steps = json.loads(row["steps"])
        
    steps.append({
        "timestamp": time.time(),
        "step_name": step_name,
        "status": step_status,
        "detail": detail or ""
    })
    
    cursor.execute("UPDATE jobs SET steps = ?, updated_at = ? WHERE job_uuid = ?", (json.dumps(steps), time.time(), job_uuid))
    conn.commit()
    conn.close()
    return steps

def save_sandbox_request(req: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    req_id = req.get("id") or f"req-{int(time.time()*1000)%100000:05d}"
    
    cursor.execute("""
        INSERT OR REPLACE INTO sandbox_requests (
            id, username, full_name, employee_id, department, email, approver,
            project_name, short_description, target_audience, app_type,
            status, deployed_job_uuid, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req_id,
        req.get("username", "user"),
        req.get("fullName") or req.get("full_name") or "User",
        req.get("employeeId") or req.get("employee_id") or "",
        req.get("department", ""),
        req.get("email", ""),
        req.get("approver", ""),
        req.get("projectName") or req.get("project_name") or "Sandbox",
        req.get("shortDescription") or req.get("short_description") or "",
        req.get("targetAudience") or req.get("target_audience") or "",
        req.get("appType") or req.get("app_type") or "other",
        req.get("status", "pending"),
        req.get("deployed_job_uuid"),
        req.get("created_at") or now_iso,
        now_iso
    ))
    conn.commit()
    conn.close()
    return get_sandbox_request(req_id)

def get_sandbox_request(req_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sandbox_requests WHERE id = ?", (req_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        r = dict(row)
        return {
            "id": r["id"],
            "username": r["username"],
            "fullName": r["full_name"],
            "employeeId": r["employee_id"],
            "department": r["department"],
            "email": r["email"],
            "approver": r["approver"],
            "projectName": r["project_name"],
            "shortDescription": r["short_description"],
            "targetAudience": r["target_audience"],
            "appType": r["app_type"],
            "status": r["status"],
            "deployed_job_uuid": r["deployed_job_uuid"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        }
    return None

def get_all_sandbox_requests() -> List[Dict[str, Any]]:
    run_migrations()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sandbox_requests ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    results = []
    for row in rows:
        r = dict(row)
        results.append({
            "id": r["id"],
            "username": r["username"],
            "fullName": r["full_name"],
            "employeeId": r["employee_id"],
            "department": r["department"],
            "email": r["email"],
            "approver": r["approver"],
            "projectName": r["project_name"],
            "shortDescription": r["short_description"],
            "targetAudience": r["target_audience"],
            "appType": r["app_type"],
            "status": r["status"],
            "deployed_job_uuid": r["deployed_job_uuid"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        })
    return results

def update_sandbox_request_status(req_id: str, status: str, deployed_job_uuid: Optional[str] = None) -> Optional[Dict[str, Any]]:
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn = get_db_connection()
    cursor = conn.cursor()
    if deployed_job_uuid:
        cursor.execute("UPDATE sandbox_requests SET status = ?, deployed_job_uuid = ?, updated_at = ? WHERE id = ?", (status, deployed_job_uuid, now_iso, req_id))
    else:
        cursor.execute("UPDATE sandbox_requests SET status = ?, updated_at = ? WHERE id = ?", (status, now_iso, req_id))
    conn.commit()
    conn.close()
    return get_sandbox_request(req_id)

def update_job_deployed_refs(job_uuid: str, coolify_service_uuid: Optional[str] = None, agent_model_id: Optional[str] = None) -> None:
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
    updates = ["updated_at = ?"]
    params = [now]
    if coolify_service_uuid is not None:
        updates.append("coolify_service_uuid = ?")
        params.append(coolify_service_uuid)
    if agent_model_id is not None:
        updates.append("agent_model_id = ?")
        params.append(agent_model_id)
    params.append(job_uuid)
    query = f"UPDATE jobs SET {', '.join(updates)} WHERE job_uuid = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()

def mark_job_deleted(job_uuid: str) -> None:
    now = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE jobs SET status = 'deleted', updated_at = ? WHERE job_uuid = ?", (now, job_uuid))
    conn.commit()
    conn.close()

def get_deployed_agents() -> List[Dict[str, Any]]:
    run_migrations()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE status = 'completed' ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        res = dict(row)
        config = json.loads(res.get("config") or "{}")
        owu_cfg = config.get("openwebui") or config.get("openwebui_agent") or {}
        
        agent_model_id = res.get("agent_model_id") or owu_cfg.get("agent_id") or config.get("agent_id")
        steps = json.loads(res.get("steps") or "[]")

        if not agent_model_id:
            for s in steps:
                detail = s.get("detail", "")
                if "Model ID:" in detail:
                    parts = detail.split("Model ID:")
                    if len(parts) > 1:
                        cand_id = parts[1].strip()
                        if cand_id:
                            agent_model_id = cand_id
                            break

        agent_name = owu_cfg.get("agent_name") or config.get("agent_name") or f"Agent - {res.get('user_name')}"
        coolify_service_uuid = res.get("coolify_service_uuid")
        
        # Also check if coolify_service_uuid was captured in steps or rollback
        if not coolify_service_uuid:
            for s in steps:
                detail = s.get("detail", "")
                if "Service created with UUID:" in detail:
                    # e.g. "Service created with UUID: abc-123. Deploy triggered."
                    parts = detail.split("Service created with UUID:")
                    if len(parts) > 1:
                        uuid_part = parts[1].split(".")[0].strip()
                        if uuid_part:
                            coolify_service_uuid = uuid_part
                            break

        if agent_model_id:
            results.append({
                "job_uuid": res["job_uuid"],
                "agent_model_id": agent_model_id,
                "agent_name": agent_name,
                "coolify_service_uuid": coolify_service_uuid,
                "service_name": res.get("service_name"),
                "fqdn": res.get("fqdn"),
                "user_id": res.get("user_id"),
                "user_name": res.get("user_name"),
                "user_email": res.get("user_email"),
                "status": res.get("status"),
                "created_at": res.get("created_at"),
                "updated_at": res.get("updated_at")
            })
    return results

