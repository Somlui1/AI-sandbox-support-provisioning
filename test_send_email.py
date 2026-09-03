#!/usr/bin/env python3
"""
SMTP Email Test Script for AICO AI Sandbox
Tests sending HTML/plain-text emails using an SMTP URL format.

Supported SMTP URL formats:
  - smtp://username:password@smtp.mail.com:587       (STARTTLS)
  - smtps://username:password@smtp.mail.com:465      (SSL/TLS)
  - smtp://relay.local:25                           (Internal Relay / No Auth)
  - smtp://user%40domain.com:pass@host:587           (URL-encoded username/password)
"""

import sys
import os
import smtplib
import ssl
import argparse
from urllib.parse import urlparse, unquote
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formatdate, make_msgid

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_dotenv_file(filepath: str = ".env"):
    """Load key-value pairs from .env into os.environ if not already present."""
    candidate_paths = [
        filepath,
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.getcwd(), ".env")
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            if key and key not in os.environ:
                                os.environ[key] = val
                return
            except Exception:
                pass

# Automatically load .env on import
load_dotenv_file()


def parse_smtp_url(smtp_url: str):
    """
    Parse standard or TLS/SSL SMTP URL into connection parameters.
    Also handles raw hostnames like 'aapico-com.mail.protection.outlook.com'
    """
    if not smtp_url:
        raise ValueError("SMTP URL is required.")

    # Clean quotes and extra whitespace
    smtp_url = smtp_url.strip().strip('"').strip("'")

    # If scheme is omitted (e.g. aapico-com.mail.protection.outlook.com or host:port)
    if not (smtp_url.startswith("smtp://") or smtp_url.startswith("smtps://")):
        if ":465" in smtp_url:
            smtp_url = f"smtps://{smtp_url}"
        elif ":587" in smtp_url or ":25" in smtp_url:
            smtp_url = f"smtp://{smtp_url}"
        elif "mail.protection.outlook.com" in smtp_url:
            # Microsoft 365 Exchange Online Protection MX endpoint defaults to port 25
            smtp_url = f"smtp://{smtp_url}:25"
        else:
            smtp_url = f"smtp://{smtp_url}:587"

    parsed = urlparse(smtp_url)
    scheme = parsed.scheme.lower()
    
    if scheme not in ("smtp", "smtps"):
        raise ValueError(f"Unsupported scheme '{scheme}'. Must be 'smtp' or 'smtps'.")

    host = parsed.hostname
    if not host:
        raise ValueError("SMTP host could not be determined from the URL.")

    # Determine default port based on scheme
    if parsed.port:
        port = parsed.port
    elif scheme == "smtps":
        port = 465
    elif "mail.protection.outlook.com" in host:
        port = 25
    else:
        port = 587

    # Decode username and password (handles characters like @ or special symbols)
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None

    # Check query parameters for TLS override e.g. ?tls=true or ?ssl=true
    query = parsed.query.lower()
    use_ssl = scheme == "smtps" or "ssl=true" in query or port == 465
    use_starttls = (scheme == "smtp" and not use_ssl) or "starttls=true" in query or port in (587, 25)

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "use_ssl": use_ssl,
        "use_starttls": use_starttls,
    }


def load_email_template(template_path: str, context: dict) -> str:
    """Load HTML template and replace variables."""
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at: {template_path}")

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Simple variable replacements (supports both raw and Jinja2-like default syntax)
    for key, val in context.items():
        html = html.replace(f"{{{{ {key} }}}}", str(val))
        html = html.replace(f"{{{{{key}}}}}", str(val))

    # Clean up defaults
    html = html.replace("{{ department | default('Digital Innovation') }}", context.get("department", "Digital Innovation"))
    html = html.replace("{{ project_name | default('AI Sandbox Environment') }}", context.get("project_name", "AI Sandbox Environment"))
    html = html.replace("{{ fqdn | default('https://pb-sandbox.aapico.com') }}", context.get("fqdn", "https://pb-sandbox.aapico.com"))
    html = html.replace("{{ agent_model_id | default('pocketbase-agent') }}", context.get("agent_model_id", "pocketbase-agent"))
    html = html.replace("{{ openwebui_url | default('http://10.10.3.111:3000') }}", context.get("openwebui_url", "http://10.10.3.111:3000"))
    html = html.replace("{{ job_uuid | default('AUTO-GEN') }}", context.get("job_uuid", "TEST-JOB-001"))

    return html


def send_test_email(
    smtp_url: str,
    to_email: str,
    from_email: str = None,
    subject: str = None,
    template_path: str = None,
    debug: bool = False,
    dry_run: bool = False
):
    print("\n" + "=" * 70)
    print(" [AICO] SMTP EMAIL DISPATCH TESTER")
    print("=" * 70)

    # 1. Parse SMTP URL
    params = parse_smtp_url(smtp_url)
    sender_user = params["username"]
    
    # Auto-resolve from_email if not provided
    if not from_email:
        if sender_user and "@" in sender_user:
            from_email = sender_user
        else:
            from_email = "aico-sandbox@aapico.com"

    if not subject:
        subject = "[AICO AI Sandbox] คำขอใช้งานได้รับการอนุมัติแล้ว - Environment Ready"

    print(f" [SMTP Host]    : {params['host']}")
    print(f" [Port]         : {params['port']}")
    print(f" [Encryption]   : {'SSL/TLS (smtps)' if params['use_ssl'] else ('STARTTLS' if params['use_starttls'] else 'Plaintext')}")
    print(f" [Auth User]    : {params['username'] or '(None - Anonymous Relay)'}")
    print(f" [Auth Password]: {'*' * len(params['password']) if params['password'] else '(None)'}")
    print(f" [From]         : {from_email}")
    print(f" [To]           : {to_email}")
    print(f" [Subject]      : {subject}")
    print("-" * 70)

    # 2. Prepare Context & HTML Template
    if not template_path:
        # Default to email_approval_template.html in deploy_app/open_webui
        base_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(base_dir, "deploy_app", "open_webui", "email_approval_template.html")

    context = {
        "user_name": "Wajeepradit Prompan (AH)",
        "user_email": to_email,
        "department": "Digital Innovation",
        "project_name": "Smart Factory AI Copilot (Sandbox)",
        "fqdn": "http://pb-wajeepraditp.10.10.3.111.sslip.io",
        "agent_model_id": "pocketbase-agent-wajeepraditp",
        "openwebui_url": "http://10.10.3.111:3000",
        "job_uuid": "AICO-TEST-VERIFY-001"
    }

    if os.path.exists(template_path):
        print(f" [Template] Using HTML Template: {template_path}")
        html_body = load_email_template(template_path, context)
    else:
        print(" [WARN] Template file not found, falling back to built-in basic HTML.")
        html_body = f"""
        <html>
        <body style="font-family: sans-serif; background-color: #030712; color: #f3f4f6; padding: 20px;">
            <h2 style="color: #818cf8;">AICO AI Sandbox Approved</h2>
            <p>Hello <b>{context['user_name']}</b>,</p>
            <p>Your sandbox environment has been approved!</p>
            <ul>
                <li>PocketBase: <a href="{context['fqdn']}" style="color: #a5b4fc;">{context['fqdn']}</a></li>
                <li>Agent Model: <code>{context['agent_model_id']}</code></li>
            </ul>
        </body>
        </html>
        """

    text_body = (
        f"AICO AI Sandbox Request Approved\n"
        f"================================\n\n"
        f"Recipient  : {context['user_name']} ({context['user_email']})\n"
        f"Department : {context['department']}\n"
        f"Project    : {context['project_name']}\n"
        f"Endpoint   : {context['fqdn']}\n"
        f"Agent Model: {context['agent_model_id']}\n\n"
        f"OpenWebUI  : {context['openwebui_url']}\n"
    )

    # 3. Construct MIME Message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"AICO AI Sandbox <{from_email}>"
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="aapico.com")

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if dry_run:
        print("\n [DRY RUN] Inspection complete. No emails were sent.")
        print(f" [HTML Body Length]: {len(html_body)} bytes")
        print("=" * 70 + "\n")
        return True

    # 4. Connect to SMTP Server and Send
    print("\n [CONNECTING] Connecting to SMTP server...")
    server = None
    try:
        if params["use_ssl"]:
            ssl_context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(params["host"], params["port"], context=ssl_context, timeout=15)
        else:
            server = smtplib.SMTP(params["host"], params["port"], timeout=15)

        if debug:
            server.set_debuglevel(1)

        server.ehlo()

        if params["use_starttls"] and not params["use_ssl"]:
            if server.has_extn("STARTTLS"):
                print(" [STARTTLS] Upgrading connection with STARTTLS...")
                ssl_context = ssl.create_default_context()
                server.starttls(context=ssl_context)
                server.ehlo()
            else:
                print(" [INFO] Server does not advertise STARTTLS, proceeding in plain text.")

        if params["username"] and params["password"]:
            print(f" [AUTH] Authenticating as '{params['username']}'...")
            server.login(params["username"], params["password"])
            print(" [AUTH OK] Authentication successful.")
        else:
            print(" [INFO] Proceeding without authentication (Open Relay / Internal IP whitelist / Direct Send).")

        print(f" [SENDING] Sending email to '{to_email}'...")
        server.sendmail(from_email, [to_email], msg.as_string())
        print("\n" + "=" * 70)
        print(" [SUCCESS] Email was successfully accepted by SMTP server.")
        print("=" * 70 + "\n")
        return True

    except smtplib.SMTPAuthenticationError as auth_err:
        print(f"\n [SMTP AUTH ERROR]: Authentication failed. Check username and password/app password.")
        print(f"   Detail: {auth_err}")
        return False
    except smtplib.SMTPConnectError as conn_err:
        print(f"\n [SMTP CONNECT ERROR]: Could not connect to {params['host']}:{params['port']}.")
        print(f"   Detail: {conn_err}")
        return False
    except smtplib.SMTPRecipientsRefused as rec_err:
        print(f"\n [SMTP RECIPIENTS REFUSED]: Recipient '{to_email}' was refused by the server.")
        print(f"   Detail: {rec_err}")
        return False
    except Exception as e:
        print(f"\n [ERROR]: An unexpected error occurred while sending email:")
        print(f"   Type  : {type(e).__name__}")
        print(f"   Detail: {e}")
        return False
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(
        description="AICO SMTP Email Dispatch Tester",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_send_email.py --smtp-url "smtp://user:pass@smtp.gmail.com:587" --to user@aapico.com
  python test_send_email.py --smtp-url "smtps://apikey:SG.xxx@smtp.sendgrid.net:465" --to user@aapico.com
  python test_send_email.py --smtp-url "smtp://10.10.1.50:25" --to user@aapico.com --dry-run
        """
    )
    parser.add_argument(
        "--smtp-url",
        default=os.environ.get("SMTP_URL"),
        help="SMTP URL in format: smtp://user:pass@host:port (or set SMTP_URL in .env)"
    )
    parser.add_argument(
        "--to",
        default=os.environ.get("SMTP_TO_EMAIL", "wajeepradit.p@aapico.com"),
        help="Recipient email address (default: from .env or wajeepradit.p@aapico.com)"
    )
    parser.add_argument(
        "--from-email",
        default=os.environ.get("SMTP_FROM_EMAIL", "AIVA@aapico.com"),
        help="Sender email address (default: from .env or AIVA@aapico.com)"
    )
    parser.add_argument(
        "--subject",
        default=os.environ.get("SMTP_SUBJECT"),
        help="Custom email subject (or set SMTP_SUBJECT in .env)"
    )
    parser.add_argument(
        "--template",
        default=None,
        help="Path to custom HTML template file (default: email_approval_template.html)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable detailed SMTP debug logs (set_debuglevel 1)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse URL and render HTML template without connecting to SMTP server"
    )

    args = parser.parse_args()

    # Prompt interactively if not provided
    smtp_url = args.smtp_url
    if not smtp_url:
        print("\nNo --smtp-url provided or found in SMTP_URL in .env.")
        try:
            smtp_url = input("Enter SMTP URL (e.g. smtp://user:pass@host:587): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if not smtp_url:
        print(" [ERROR] SMTP URL cannot be empty.")
        sys.exit(1)

    success = send_test_email(
        smtp_url=smtp_url,
        to_email=args.to,
        from_email=args.from_email,
        subject=args.subject,
        template_path=args.template,
        debug=args.debug,
        dry_run=args.dry_run
    )

    sys.exit(0 if success else 1)


def test_send_email(
    smtp_url: str = None,
    to_email: str = None,
    from_email: str = None,
    subject: str = None,
    debug: bool = False,
    dry_run: bool = False
):
    """
    Convenience function that reads configuration from .env and executes send_test_email.
    """
    load_dotenv_file()
    url = smtp_url or os.environ.get("SMTP_URL")
    recipient = to_email or os.environ.get("SMTP_TO_EMAIL", "wajeepradit.p@aapico.com")
    sender = from_email or os.environ.get("SMTP_FROM_EMAIL", "AIVA@aapico.com")
    subj = subject or os.environ.get("EMAIL_SUBJECT","Test Email")

    return send_test_email(
        smtp_url=url,
        to_email=recipient,
        from_email=sender,
        subject=subj,
        debug=debug,
        dry_run=dry_run
    )


if __name__ == "__main__":
    main()
