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
