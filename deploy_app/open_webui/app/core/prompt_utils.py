import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def extract_system_prompt_from_text(text: str) -> str:
    """
    Extracts the inner system prompt content.
    If the entire text is wrapped inside an outer markdown code fence block (e.g. ```markdown ... ```),
    it extracts the content inside that block, stripping outer metadata and instructions.
    Otherwise returns the trimmed text.
    """
    if not text:
        return ""

    trimmed = text.strip()
    lines = trimmed.splitlines()

    # Unwrap only if the entire content is wrapped in a top-level code fence
    if len(lines) >= 2 and lines[0].strip().startswith("```") and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]).strip()

    return trimmed


def find_system_prompt_file(filename: str = "system_prompt.md") -> str:
    """
    Searches for the system prompt file in common candidate paths.
    """
    if not filename:
        return None

    app_dir = os.path.abspath(os.path.join(BASE_DIR, ".."))
    candidate_paths = [
        os.path.join(app_dir, "templates", filename),
        os.path.join(app_dir, filename),
        os.path.join(BASE_DIR, filename),
        os.path.join(app_dir, "..", filename),
        os.path.join(app_dir, "..", "..", filename),
        os.path.abspath(filename),
    ]
    for cp in candidate_paths:
        if os.path.exists(cp) and os.path.isfile(cp):
            return cp
    return None


def load_system_prompt_template(filename: str = "system_prompt.md") -> str:
    """
    Loads and extracts the system prompt template from a file.
    """
    file_path = find_system_prompt_file(filename)
    if not file_path:
        return ""

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return extract_system_prompt_from_text(content)
    except Exception as e:
        print(f"[WARNING] Error reading system prompt file '{file_path}': {e}")
        return ""


def interpolate_prompt_variables(prompt_template: str, context: dict) -> str:
    """
    Replaces placeholders like {pocketbase_url}, {fqdn}, {username}, {admin_email}
    with actual values from context dictionary.
    """
    if not prompt_template:
        return ""

    res = prompt_template
    for key, val in context.items():
        if val is not None:
            res = res.replace(f"{{{key}}}", str(val))
            res = res.replace(f"{{{{{key}}}}}", str(val))

    if "pocketbase_url" in context and context["pocketbase_url"]:
        res = res.replace("{POCKETBASE_URL}", str(context["pocketbase_url"]))
    if "fqdn" in context and context["fqdn"]:
        res = res.replace("{FQDN}", str(context["fqdn"]))
    if "username" in context and context["username"]:
        res = res.replace("{USERNAME}", str(context["username"]))
    if "admin_email" in context and context["admin_email"]:
        res = res.replace("{ADMIN_EMAIL}", str(context["admin_email"]))

    return res
