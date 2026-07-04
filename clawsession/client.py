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

MODELS = [
    ("haiku", "claude-haiku-4-5-20251001"),
    ("sonnet", "claude-sonnet-4-6"),
    ("opus", "claude-opus-4-8"),
    ("sonnet-4-5", "claude-sonnet-4-5-20241022"),
    ("sonnet-4", "claude-sonnet-4-20250514"),
    ("opus-4", "claude-opus-4-20250514"),
    ("haiku-3.5", "claude-3-5-haiku-20241022"),
    ("sonnet-3.5", "claude-3-5-sonnet-20241022"),
]


def resolve_model(model_str):
    """Resolve a model shortcut, number, or return the full model ID as-is."""
    # By number: -m 1, -m 2, -m 3
    if model_str.isdigit():
        idx = int(model_str) - 1
        if 0 <= idx < len(MODELS):
            return MODELS[idx][1]
    # By name: -m haiku, -m sonnet, -m opus
    for name, model_id in MODELS:
        if model_str == name:
            return model_id
    # Full ID passthrough
    return model_str


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


def make_title(message, title_mode, custom_title=None):
    """Generate conversation title based on mode."""
    if title_mode == "custom" and custom_title:
        return custom_title
    elif title_mode == "message":
        return message[:60] + "..." if len(message) > 60 else message
    elif title_mode == "timestamp":
        return f"Automated Session Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    else:
        return ""


def send_message(cookie, message, model, org_id, title_mode="message", custom_title=None):
    """Send a message to Claude via claude.ai and return the response text."""
    session = requests.Session()
    session.headers.update(HEADERS_BASE)
    session.cookies.set("sessionKey", cookie)

    conv_uuid = str(uuid.uuid4())
    create_url = f"{BASE_URL}/organizations/{org_id}/chat_conversations"
    create_body = {
        "uuid": conv_uuid,
        "name": make_title(message, title_mode, custom_title),
        "model": model,
        "include_conversation_preferences": True,
        "is_temporary": False,
    }
    create_resp = session.post(create_url, json=create_body)
    create_resp.raise_for_status()
    conv_data = create_resp.json()

    parent_uuid = conv_data.get("chat_messages", [{}])[0].get("uuid", "")

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


def auto_title(cookie, org_id, conversation_id, message_content):
    """Call the auto-title endpoint for a conversation."""
    session = requests.Session()
    session.headers.update(HEADERS_BASE)
    session.cookies.set("sessionKey", cookie)

    url = f"{BASE_URL}/organizations/{org_id}/chat_conversations/{conversation_id}/title"
    body = {
        "message_content": message_content,
        "recent_titles": [],
    }
    resp = session.put(url, json=body)
    resp.raise_for_status()
    return resp.json()
