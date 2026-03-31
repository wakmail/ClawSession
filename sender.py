import json
import uuid
from datetime import datetime

import requests


BASE_URL = "https://claude.ai/api"

HEADERS_BASE = {
    "content-type": "application/json",
    "anthropic-client-platform": "web_claude_ai",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
}

PERSONALIZED_STYLES = [
    {
        "type": "default",
        "key": "Default",
        "name": "Normal",
        "nameKey": "normal_style_name",
        "prompt": "Normal\n",
        "summary": "Default responses from Claude",
        "summaryKey": "normal_style_summary",
        "isDefault": True,
    }
]


def parse_sse_response(response):
    """Parse SSE stream from claude.ai and extract the full text response."""
    full_text = ""
    for line in response.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        data_str = line[len("data: "):]
        try:
            data = json.loads(data_str)
        except json.JSONDecodeError:
            continue
        if data.get("type") == "completion":
            full_text += data.get("completion", "")
    return full_text


def send_message(cookie, message, model, org_id):
    """Send a message to Claude via claude.ai and return the response text."""
    session = requests.Session()
    session.headers.update(HEADERS_BASE)
    session.cookies.set("sessionKey", cookie)

    # Step 1: Create a new conversation
    conv_uuid = str(uuid.uuid4())
    create_url = f"{BASE_URL}/organizations/{org_id}/chat_conversations"
    create_body = {
        "uuid": conv_uuid,
        "name": f"Automated Session Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",  # Change to "" for raw sending
        "model": model,
        "include_conversation_preferences": True,
        "is_temporary": False,
    }
    create_resp = session.post(create_url, json=create_body)
    create_resp.raise_for_status()
    conv_data = create_resp.json()

    # Extract parent message UUID from conversation creation response
    parent_uuid = conv_data.get("chat_messages", [{}])[0].get("uuid", "")

    # Step 2: Send the completion request
    completion_url = f"{BASE_URL}/organizations/{org_id}/chat_conversations/{conv_uuid}/completion"
    completion_body = {
        "prompt": message,
        "parent_message_uuid": parent_uuid,
        "timezone": "America/New_York",
        "model": model,
        "locale": "en-US",
        "personalized_styles": PERSONALIZED_STYLES,
        "tools": [],
        "attachments": [],
        "files": [],
        "sync_sources": [],
    }
    completion_resp = session.post(
        completion_url,
        json=completion_body,
        headers={"accept": "text/event-stream"},
        stream=True,
    )
    completion_resp.raise_for_status()

    return parse_sse_response(completion_resp)


if __name__ == "__main__":
    import sys
    import os
    from dotenv import load_dotenv

    load_dotenv()

    cookie = os.environ["CLAUDE_COOKIE"]
    org_id = os.environ["ORG_ID"]

    if len(sys.argv) < 2:
        print("Usage: python3 sender.py \"your message\"")
        sys.exit(1)

    msg = sys.argv[1]

    # Load default model from config
    with open("config.json") as f:
        config = json.load(f)
    model = config.get("model", "claude-haiku-4-5-20251001")

    response = send_message(cookie, msg, model, org_id)
    print(response)
