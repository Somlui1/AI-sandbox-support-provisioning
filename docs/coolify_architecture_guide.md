# คู่มือสถาปัตยกรรมและการทำงานกับ Coolify API ฉบับสมบูรณ์
(Complete Coolify Architecture, Lifecycle & Reverse Proxy Guide)

เอกสารนี้รวบรวมรายละเอียดเชิงลึกเกี่ยวกับโครงสร้างสถาปัตยกรรมของ Coolify, ขั้นตอนการสร้าง Project & Service ผ่าน API, การกำหนดและขอ URL Reverse Proxy อัตโนมัติ (FQDN), การจัดการ Docker Images และกฎความปลอดภัยในการบริหารจัดการทรัพยากร

---

## 1. ลำดับชั้นทรัพยากรของ Coolify (Resource Hierarchy)

Coolify จัดโครงสร้างข้อมูลในลักษณะ Hierarchical (เป็นลำดับชั้น) เพื่อรองรับการจัดการสิทธิ์และแยกสภาพแวดล้อม:

```
Server (10.10.3.222:8000) --> Docker Destination --> Traefik/Caddy Reverse Proxy
│
└── Project (เช่น "AI-Sandbox")
      └── Environment (เช่น "production", "staging", "testing")
            │
            ├── Applications (Standalone Web, Worker, API)
            ├── Services (Docker Compose Stacks เช่น WordPress + MySQL, PocketBase)
            │     └── Components (Container ย่อยภายใน Stack)
            └── Databases (Standalone DB เช่น PostgreSQL, MySQL, Redis)
```

### การเชื่อมโยงข้อมูล (Relationships):
* **Project** 1 ตัว มีได้หลาย **Environment**
* ทุกครั้งที่สร้าง Project ใหม่ Coolify จะสร้าง Environment ชื่อ `production` ให้โดยอัตโนมัติ (มี `id` เป็น integer และ `uuid` เฉพาะตัว)
* **Service / Application / Database** จะผูกกับ `environment_id` เสมอ ไม่ได้ผูกกับ Project โดยตรง

---

## 2. ขั้นตอนการสร้าง Project และ Service ผ่าน API (Step-by-Step Lifecycle)

การสร้างและ Deploy ทรัพยากรบน Coolify ผ่าน API ประกอบด้วย 5 ขั้นตอนหลัก ดังนี้:

### Step 1: เตรียมข้อมูล Server & Wildcard Domain
ก่อนสร้าง Service จะต้องทราบ Server UUID และ Wildcard Domain ของเซิร์ฟเวอร์ เช่น `http://10.10.3.222.sslip.io` เพื่อใช้ประกอบเป็น URL ปลายทาง

### Step 2: สร้าง Project ใหม่
ส่ง Request ไปที่ `POST /api/v1/projects`
```python
# Payload
{"name": "my-project", "description": "Optional description"}

# Response ตัวอย่าง
{"uuid": "9dzebby6m5ka0hyikmtbttgf", "name": "my-project"}
```

### Step 3: กำหนดค่า Docker Compose & Reverse Proxy URLs Mapping
ก่อนสร้าง Service เราจะต้องส่งข้อมูล:
1. **`docker_compose_raw`**: เนื้อหาไฟล์ `docker-compose.yml` ที่เข้ารหัสเป็น **Base64**
2. **`urls`**: รายการจับคู่ระหว่าง **ชื่อ Service ใน Compose** กับ **FQDN Domain** ที่ต้องการให้ Reverse Proxy ดักจับ

ตัวอย่างการจับคู่ URL ในโค้ด:
```python
urls_mapping = [
    {
        "name": "web", # ตรงกับชื่อ service: web ใน docker-compose
        "url": "http://my-app.10.10.3.222.sslip.io"
    }
]
```

### Step 4: ส่งคำสั่งสร้าง Service (`POST /api/v1/services`)
```python
payload = {
    "name": "my-custom-service",
    "project_uuid": "9dzebby6m5ka0hyikmtbttgf",
    "environment_name": "production",
    "server_uuid": "h6m9vagmmq4cxgqve1mtvpzl",
    "destination_uuid": "y13q0c4mt228zzmzno07c9mt", # Optional
    "docker_compose_raw": "<Base64_Encoded_Compose_Content>",
    "urls": urls_mapping,
    "instant_deploy": True # สั่งรัน/Deploy ทันทีหลังสร้างเสร็จ
}
```

### Step 5: ติดตามสถานะการ Deploy (Polling Status)
เมื่อสั่ง Deploy แล้ว Container จะเริ่มบูต ให้ใช้คำสั่ง `GET /api/v1/services/{service_uuid}` เพื่ออ่านสถานะของ Components:
* `exited` $\rightarrow$ กำลังดึง Image หรือเริ่มระบบ
* `running:unknown` หรือ `running:healthy` $\rightarrow$ บริการพร้อมใช้งานแล้ว

---

## 3. กลไกการขอและทำงานของ Reverse Proxy URL (FQDN & Traefik/Caddy)

### 3.1 การทำงานของ Reverse Proxy ใน Coolify
Coolify ใช้ **Traefik (v3.x)** เป็น Proxy หลัก (หรือสลับเป็น **Caddy** ได้):
1. **Dynamic Configuration:** เมื่อ Coolify สร้าง Container ขึ้นมา มันจะทำการแปะ **Docker Labels** ให้กับ Container นั้นโดยอัตโนมัติ (เช่น `traefik.http.routers...`)
2. **Auto Service Discovery:** Traefik จะคอยดักฟัง Docker Socket (`/var/run/docker.sock`) เมื่อเห็น Label ใหม่ Traefik จะสร้าง Route และผูก Domain ให้ทันทีโดยไม่ต้อง Restart Proxy
3. **Automatic SSL (Let's Encrypt):** หาก Domain ที่ระบุขึ้นต้นด้วย `https://` Traefik จะส่งคำขอใบรับรอง SSL ไปยัง Let's Encrypt ผ่าน HTTP-01 Challenge ให้ทันที

### 3.2 รูปแบบการขอ Reverse Proxy URL (FQDN Patterns)

| รูปแบบโดเมน | ตัวอย่าง | การทำงานของ Coolify |
|---|---|---|
| **Magic DNS (sslip.io / nip.io)** | `http://app-123.10.10.3.222.sslip.io` | แปลง Subdomain เป็น IP อัตโนมัติ เหมาะสำหรับ Dev/Staging ในเครือข่ายภายในโดยไม่ต้องเซ็ต DNS Server |
| **Custom Domain (HTTP)** | `http://myapp.company.com` | ชี้ A/CNAME Record ของ Domain มาที่ IP เครื่อง Coolify |
| **Custom Domain (HTTPS)** | `https://myapp.company.com` | ชี้ DNS มาที่ IP เครื่อง แล้ว Traefik จะออกใบรับรอง SSL ให้ฟรีอัตโนมัติ |
| **กำหนด Custom Port** | `http://api.domain.com:8080` | Forward Request ไปยัง Port 8080 ภายใน Container โดยตรง |

---

## 4. การจำแนกประเภทและจัดการ Docker Images

### 4.1 การแยกแยะประเภท Resource (`applications` vs `databases`)
เมื่อสร้าง Service ผ่าน Docker Compose:
1. **ฐานข้อมูล (Database)**: หาก Image เป็นฐานข้อมูลยอดนิยมที่ระบบรู้จัก เช่น `postgres`, `mysql`, `redis`, `mariadb`, `mongodb` จะถูกจัดอยู่ในหมวด `databases` (เปิดฟังก์ชันเสริม เช่น Auto-backup ใน Dashboard)
2. **แอปพลิเคชันทั่วไป (Application)**: Service อื่น ๆ รวมถึง **Custom Image** ที่ Coolify ไม่รู้จัก จะถูกจัดเข้าหมวด `applications` เสมอ (Default Safe Fallback)

### 4.2 แหล่งที่มาของ Image
* **Public Registry**: ดึงจาก Docker Hub (`docker.io`), GitHub Registry (`ghcr.io`) ได้ทันที
* **Private / Custom Registry**: ตั้งค่า Credentials ใน **Keys & Tokens > Docker Registries** (ระบุ URL, Username, Access Token) เพื่อให้สิทธิ์ Coolify Pull Image ส่วนตัว
* **Build จาก Source Code**: ชี้ไปยัง Git Repo เพื่อให้ Coolify ทำการ Build Image ผ่าน **Dockerfile** หรือ **Nixpacks** บนเซิร์ฟเวอร์

---

## 5. โครงสร้างข้อมูล JSON ของ API (API Data Structure)

### 5.1 Type Hint ใน Python: `List[Dict[str, Any]]`
* `List`: รายการข้อมูล `[...]`
* `Dict[str, Any]`: อ็อบเจกต์ `{...}` ที่มี Key เป็น `str` และ Value เป็นชนิดใดก็ได้

### 5.2 ตัวอย่าง Response สำคัญ

#### `GET /api/v1/projects/{project_uuid}`
```json
{
  "id": 1,
  "uuid": "gy6no4n83xhkomfokrmwtbww",
  "name": "AI-Sandbox",
  "environments": [
    {
      "id": 1,
      "uuid": "idm8wvklpz4irce1vpa8oj70",
      "name": "production",
      "project_id": 1
    }
  ]
}
```

#### `GET /api/v1/services`
```json
[
  {
    "id": 11,
    "uuid": "q6s3jtb4nxonlznvkvv4tjgh",
    "name": "ai-sandbox-staging",
    "environment_id": 1,
    "status": "running:healthy",
    "applications": [
      {
        "name": "pocketbase",
        "image": "ghcr.io/coollabsio/pocketbase:latest",
        "fqdn": "http://pocketbase-q6s3jtb4nxonlznvkvv4tjgh.10.10.3.222.sslip.io",
        "status": "running:healthy"
      }
    ],
    "databases": []
  }
]
```

---

## 6. กฎและข้อควรระวังในการลบ Resource (Deletion Rules)

> [!WARNING]
> **ข้อกำหนดความปลอดภัยของ API:**
> หากใน Project ยังมี Resource (Service, Application หรือ Database) ตกค้างอยู่ **API จะปฏิเสธคำสั่งลบ Project ทันที**
> `400 Bad Request: Project has resources, so it cannot be deleted.`

### ขั้นตอน Safe Deletion Workflow:
1. ดึงรายการ `environments` ของ Project เพื่อหา `environment_id` ทั้งหมด
2. ค้นหาและสั่งลบ `services`, `applications`, `databases` ที่ผูกอยู่กับ `environment_id` นั้น
3. หน่วงเวลา 3-5 วินาทีเพื่อให้ Coolify หยุดและลบ Docker Container
4. สั่งลบ `project` เป็นลำดับสุดท้าย

---

## 7. โค้ดตัวอย่างการใช้งานแบบสมบูรณ์ (Complete Python Code Examples)

### ตัวอย่างที่ 1: การสร้าง Service พร้อมขอ Reverse Proxy URL
```python
import base64
from client import CoolifyClient
from config import COOLIFY_API_URL, COOLIFY_API_TOKEN

client = CoolifyClient(COOLIFY_API_URL, COOLIFY_API_TOKEN)

# เนื้อหา Docker Compose
compose_yaml = """
version: '3.8'
services:
  web:
    image: nginx:alpine
    restart: always
"""

# สร้าง Service
service_res = client.create_service(
    name="my-web-service",
    project_uuid="<YOUR_PROJECT_UUID>",
    environment_name="production",
    server_uuid="<YOUR_SERVER_UUID>",
    docker_compose_content=compose_yaml,
    urls=[{"name": "web", "url": "http://my-web.10.10.3.222.sslip.io"}],
    instant_deploy=True
)

print(f"สร้าง Service สำเร็จ: UUID = {service_res.get('uuid')}")
print(f"เข้าใช้งานได้ที่ URL: {service_res.get('domains')}")
```

### ตัวอย่างที่ 2: ฟังก์ชัน Safe Deletion (ล้าง Resource ทั้งหมดก่อนลบ Project)
```python
import time
from client import CoolifyClient
from config import COOLIFY_API_URL, COOLIFY_API_TOKEN

client = CoolifyClient(COOLIFY_API_URL, COOLIFY_API_TOKEN)

def safe_delete_project(project_uuid: str):
    """ค้นหาและล้าง Services ทั้งหมดภายใต้ Project ก่อนลบตัว Project"""
    try:
        project = client.get_project(project_uuid)
        env_ids = [env["id"] for env in project.get("environments", [])]
        print(f"กำลังตรวจสอบ Project '{project.get('name')}' (Env IDs: {env_ids})...")

        # ลบ Services ที่อยู่ใน Environment ของโปรเจกต์นี้
        services = client.get_services()
        for svc in services:
            if svc.get("environment_id") in env_ids:
                print(f"-> กำลังลบ Service: {svc.get('name')} ({svc.get('uuid')})")
                client.delete_service(svc.get("uuid"))

        print("-> รอให้ระบบเคลียร์สถานะ Container (5 วินาที)...")
        time.sleep(5)

        # ลบ Project
        res = client.delete_project(project_uuid)
        print(f"-> ลบ Project สำเร็จ: {res}")

    except Exception as e:
        print(f"เกิดข้อผิดพลาด: {e}")
```
