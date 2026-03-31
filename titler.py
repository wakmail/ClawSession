import json
import os
import sys

import requests
from dotenv import load_dotenv


BASE_URL = "https://claude.ai/api"

HEADERS_BASE = {
    "content-type": "application/json",
    "anthropic-client-platform": "web_claude_ai",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
}


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


if __name__ == "__main__":
    load_dotenv()

    cookie = os.environ["CLAUDE_COOKIE"]
    org_id = os.environ["ORG_ID"]

    if len(sys.argv) < 3:
        print('Usage: python3 titler.py <conversation_id> "message content"')
        sys.exit(1)

    conversation_id = sys.argv[1]
    message_content = sys.argv[2]

    result = auto_title(cookie, org_id, conversation_id, message_content)
    print(json.dumps(result, indent=2))
