import os
import time
import requests
import json
from typing import Dict, Any, List, Optional

class OpenWebUIClient:
    def __init__(self, base_url: str, token: str):
        """
        Initialize the Open WebUI API Client.
        
        :param base_url: The base URL of Open WebUI, e.g. http://aico.aapico.com:8080
        :param token: JWT Token or API Key
        """
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }

    def _request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, files: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Helper to send HTTP requests to Open WebUI with Postman-style logging and HTML validation."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        headers = self.headers.copy()
        if data and not files:
            headers["Content-Type"] = "application/json"
            
        # Mask Authorization header for security in console output
        logged_headers = headers.copy()
        if "Authorization" in logged_headers:
            auth_val = logged_headers["Authorization"]
            if auth_val.startswith("Bearer ") and len(auth_val) > 25:
                logged_headers["Authorization"] = f"{auth_val[:15]}...{auth_val[-10:]}"
                
        # 1. Print Request Details (Postman Style)
        print("\n" + "="*80)
        print(f" >>> REQUEST: {method} {url}")
        print("="*80)
        print("HEADERS:")
        for k, v in logged_headers.items():
            print(f"  {k}: {v}")
        if params:
            print(f"QUERY PARAMETERS:\n  {json.dumps(params, indent=2)}")
        if data:
            print("BODY (application/json):")
            print(json.dumps(data, indent=2))
        elif files:
            print("BODY (multipart/form-data):")
            for k in files.keys():
                print(f"  {k}: <file data>")
        print("="*80)
            
        try:
            start_time = time.time()
            response = requests.request(
                method, 
                url, 
                headers=headers, 
                json=data if not files else None, 
                files=files, 
                params=params, 
                timeout=15
            )
            elapsed_ms = (time.time() - start_time) * 1000
            
            # 2. Print Response Details (Postman Style)
            print("\n" + "="*80)
            print(f" <<< RESPONSE: {response.status_code} {response.reason} | Time: {elapsed_ms:.1f}ms")
            print("="*80)
            print("HEADERS:")
            for k, v in response.headers.items():
                print(f"  {k}: {v}")
                
            # Check for HTML content indicating wrong URL/proxy fallback
            content_type = response.headers.get("Content-Type", "")
            if "text/html" in content_type:
                print(f"BODY:\n{response.text[:500]}...")
                print("="*80)
                raise Exception(
                    f"Received HTML instead of JSON. "
                    f"This usually means the BASE_URL ({self.base_url}) is incorrect (e.g. missing port 8080 or routing to a landing page)."
                )
                
            response.raise_for_status()
            res_json = response.json()
            print("BODY (JSON):")
            print(json.dumps(res_json, indent=2))
            print("="*80)
            return res_json
            
        except requests.exceptions.JSONDecodeError:
            print(f"BODY (RAW):\n{response.text[:500]}...")
            print("="*80)
            raise Exception(
                f"Failed to decode JSON response from Open WebUI (URL: {url}). "
                f"Response body: {response.text[:200]}"
            )
        except requests.HTTPError as http_err:
            try:
                err_detail = response.json()
            except Exception:
                err_detail = response.text
            print(f"BODY (ERROR):\n{err_detail}")
            print("="*80)
            raise Exception(f"HTTP error occurred: {http_err} - Details: {err_detail}")
        except Exception as err:
            print(f"ERROR: {err}")
            print("="*80)
            raise err

    def get_current_user(self) -> Dict[str, Any]:
        """
        Get the current user details.
        
        Queries GET /api/v1/auths/ (the Open WebUI session user endpoint).
        """
        return self._request("GET", "api/v1/auths/")

    def get_users(self) -> List[Dict[str, Any]]:
        """
        Get all users in Open WebUI. (Requires Admin permissions).
        
        Queries GET /api/v1/users/.
        """
        res = self._request("GET", "api/v1/users/")
        if isinstance(res, list):
            return res
        if isinstance(res, dict):
            return res.get("data") or res.get("users") or []
        return []

    def create_model(self, model_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a custom model in Open WebUI.
        
        Queries POST /api/v1/models/create.
        """
        return self._request("POST", "api/v1/models/create", data=model_data)

    def update_model(self, model_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing custom model in Open WebUI.
        
        Queries POST /api/v1/models/model/update.
        """
        return self._request("POST", "api/v1/models/model/update", data=model_data)

    def upload_file(self, file_path: str) -> Dict[str, Any]:
        """
        Upload a file to Open WebUI.
        
        :param file_path: Local path to the file to upload
        :return: JSON response containing file details (including 'id')
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        with open(file_path, 'rb') as f:
            files = {'file': f}
            return self._request("POST", "api/v1/files/", files=files)

    def get_file_status(self, file_id: str) -> Dict[str, Any]:
        """
        Check the processing status of an uploaded file.
        
        :param file_id: The ID of the file
        :return: JSON response with status detail e.g., {'status': 'completed'}
        """
        return self._request("GET", f"api/v1/files/{file_id}/process/status")

    def wait_for_file_processing(self, file_id: str, timeout: int = 300, poll_interval: float = 2.0) -> Dict[str, Any]:
        """
        Wait until the file finishes processing.
        
        :param file_id: File ID
        :param timeout: Maximum time in seconds to wait
        :param poll_interval: Time interval in seconds between polls
        :return: Final status JSON
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            status_data = self.get_file_status(file_id)
            status = status_data.get("status")
            if status == "completed":
                return status_data
            elif status == "failed":
                raise Exception(f"File processing failed: {status_data.get('error')}")
            time.sleep(poll_interval)
        raise TimeoutError(f"File processing did not complete within {timeout} seconds")

    def add_file_to_knowledge(self, knowledge_id: str, file_id: str) -> Dict[str, Any]:
        """
        Add a processed file to a specific knowledge collection.
        
        :param knowledge_id: The ID of the knowledge collection
        :param file_id: The ID of the processed file
        :return: JSON response
        """
        payload = {"file_id": file_id}
        return self._request("POST", f"api/v1/knowledge/{knowledge_id}/file/add", data=payload)

    def process_web_url(self, url: str, collection_name: Optional[str] = None, overwrite: bool = True) -> Dict[str, Any]:
        """
        Fetch a webpage, extract its content, and store it in a knowledge collection.
        
        :param url: Webpage URL to process
        :param collection_name: Optional custom collection name
        :param overwrite: If True, replaces existing vectors in the collection
        :return: JSON response
        """
        params = {
            "process": "true",
            "overwrite": str(overwrite).lower()
        }
        payload = {"url": url}
        if collection_name:
            payload["collection_name"] = collection_name
            
        return self._request("POST", "api/v1/retrieval/process/web", data=payload, params=params)

    def chat_with_file(self, model: str, query: str, file_id: str, messages: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Send a chat completion query referencing a specific file.
        
        :param model: Model ID in Open WebUI
        :param query: The user message/prompt
        :param file_id: File ID
        :param messages: Optional previous conversation history
        :return: JSON response
        """
        chat_messages = messages.copy() if messages else []
        chat_messages.append({"role": "user", "content": query})
        
        payload = {
            "model": model,
            "messages": chat_messages,
            "files": [{"type": "file", "id": file_id}]
        }
        return self._request("POST", "api/chat/completions", data=payload)

    def chat_with_collection(self, model: str, query: str, collection_id: str, messages: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Send a chat completion query referencing a knowledge collection.
        
        :param model: Model ID in Open WebUI
        :param query: The user message/prompt
        :param collection_id: Knowledge collection ID
        :param messages: Optional previous conversation history
        :return: JSON response
        """
        chat_messages = messages.copy() if messages else []
        chat_messages.append({"role": "user", "content": query})
        
        payload = {
            "model": model,
            "messages": chat_messages,
            "files": [{"type": "collection", "id": collection_id}]
        }
        return self._request("POST", "api/chat/completions", data=payload)

if __name__ == "__main__":
    import sys
    import argparse
    import json
    
    # Try importing config from parent folder
    try:
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
        from config import OPENWEBUI_BASE_URL, OPENWEBUI_ADMIN_TOKEN
    except Exception:
        OPENWEBUI_BASE_URL = os.getenv("OPENWEBUI_BASE_URL", "http://aico.aapico.com:8080")
        OPENWEBUI_ADMIN_TOKEN = os.getenv("OPENWEBUI_ADMIN_TOKEN", "")

    parser = argparse.ArgumentParser(description="Open WebUI API CLI Client")
    parser.add_argument("--base-url", default=OPENWEBUI_BASE_URL, help="Base URL of Open WebUI")
    parser.add_argument("--token", default=OPENWEBUI_ADMIN_TOKEN, help="JWT Token or API Key")
    
    subparsers = parser.add_subparsers(dest="command", required=True, help="Command to run")
    
    # get-user
    subparsers.add_parser("get-user", help="Get details of current authenticated user")

    # get-users
    users_parser = subparsers.add_parser("get-users", help="Get list of all users (Admin required)")
    users_parser.add_argument("--name", help="Filter users by name, username or email (case-insensitive)")

    # get-users-summary
    summary_parser = subparsers.add_parser("get-users-summary", help="Get customizable summary list of all users")
    summary_parser.add_argument("--name", help="Filter users by name, username or email (case-insensitive)")
    summary_parser.add_argument("--keys", nargs="+", help="Additional keys to include in the summary output")
    
    # upload
    upload_parser = subparsers.add_parser("upload", help="Upload a file to Open WebUI")
    upload_parser.add_argument("file_path", help="Path to the local file to upload")
    
    # status
    status_parser = subparsers.add_parser("status", help="Get processing status of an uploaded file")
    status_parser.add_argument("file_id", help="File ID")
    
    # wait
    wait_parser = subparsers.add_parser("wait", help="Wait for file processing to complete")
    wait_parser.add_argument("file_id", help="File ID")
    wait_parser.add_argument("--timeout", type=int, default=300, help="Wait timeout in seconds")
    
    # add-to-knowledge
    add_parser = subparsers.add_parser("add-to-knowledge", help="Add a processed file to a knowledge collection")
    add_parser.add_argument("knowledge_id", help="Knowledge base collection ID")
    add_parser.add_argument("file_id", help="File ID")
    
    # process-web
    web_parser = subparsers.add_parser("process-web", help="Extract webpage content into a collection")
    web_parser.add_argument("url", help="Webpage URL to fetch")
    web_parser.add_argument("--collection", help="Target collection name")
    web_parser.add_argument("--no-overwrite", action="store_false", dest="overwrite", help="Do not overwrite collection")
    
    # chat-file
    cf_parser = subparsers.add_parser("chat-file", help="Query a model referencing a specific file")
    cf_parser.add_argument("model", help="Model ID")
    cf_parser.add_argument("query", help="Prompt / Question")
    cf_parser.add_argument("file_id", help="File ID")
    
    # chat-collection
    cc_parser = subparsers.add_parser("chat-collection", help="Query a model referencing a knowledge collection")
    cc_parser.add_argument("model", help="Model ID")
    cc_parser.add_argument("query", help="Prompt / Question")
    cc_parser.add_argument("collection_id", help="Collection ID")
    
    args = parser.parse_args()
    
    if not args.token:
        print("[ERROR] Token must be provided via --token or OPENWEBUI_ADMIN_TOKEN environment variable/config file.")
        sys.exit(1)
        
    client = OpenWebUIClient(base_url=args.base_url, token=args.token)
    
    try:
        if args.command == "get-user":
            res = client.get_current_user()
            print(json.dumps(res, indent=2))
        elif args.command == "get-users":
            res = client.get_users()
            if args.name:
                search_term = args.name.lower()
                filtered = []
                for user in res:
                    name = user.get("name", "") or ""
                    email = user.get("email", "") or ""
                    username = user.get("username", "") or ""
                    if search_term in name.lower() or search_term in email.lower() or search_term in username.lower():
                        filtered.append({
                            "id": user.get("id"),
                            "name": user.get("name"),
                            "email": user.get("email"),
                            "role": user.get("role")
                        })
                print(json.dumps(filtered, indent=2))
            else:
                print(json.dumps(res, indent=2))
        elif args.command == "get-users-summary":
            res = client.get_users()
            
            # Default keys
            fields = {"id", "name", "email", "role"}
            if args.keys:
                fields.update(args.keys)
                
            filtered = []
            search_term = args.name.lower() if args.name else None
            
            for user in res:
                name = user.get("name", "") or ""
                email = user.get("email", "") or ""
                username = user.get("username", "") or ""
                
                if search_term:
                    if not (search_term in name.lower() or search_term in email.lower() or search_term in username.lower()):
                        continue
                        
                user_summary = {}
                for field in fields:
                    if field in user:
                        user_summary[field] = user[field]
                filtered.append(user_summary)
                
            print(json.dumps(filtered, indent=2))
        elif args.command == "upload":
            res = client.upload_file(args.file_path)
            print(json.dumps(res, indent=2))
        elif args.command == "status":
            res = client.get_file_status(args.file_id)
            print(json.dumps(res, indent=2))
        elif args.command == "wait":
            res = client.wait_for_file_processing(args.file_id, timeout=args.timeout)
            print(json.dumps(res, indent=2))
        elif args.command == "add-to-knowledge":
            res = client.add_file_to_knowledge(args.knowledge_id, args.file_id)
            print(json.dumps(res, indent=2))
        elif args.command == "process-web":
            res = client.process_web_url(args.url, collection_name=args.collection, overwrite=args.overwrite)
            print(json.dumps(res, indent=2))
        elif args.command == "chat-file":
            res = client.chat_with_file(args.model, args.query, args.file_id)
            print(json.dumps(res, indent=2))
        elif args.command == "chat-collection":
            res = client.chat_with_collection(args.model, args.query, args.collection_id)
            print(json.dumps(res, indent=2))
    except Exception as e:
        print(f"[ERROR] Command '{args.command}' failed: {e}")
        sys.exit(1)
