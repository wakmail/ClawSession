# ClawSession Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:subagent-driven-development (if subagents available) or superpowers-extended-cc:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python script that sends scheduled messages to Claude via claude.ai using a browser session cookie and prints responses to stdout.

**Architecture:** Two-module design — `sender.py` handles HTTP communication with claude.ai (conversation creation + message completion via SSE), `scheduler.py` runs a loop that triggers the sender at configured times.

**Tech Stack:** Python 3, requests, python-dotenv

---

## File Structure

```
ClawSession/
├── .env              # CLAUDE_COOKIE, ORG_ID (user creates manually)
├── config.json       # model + schedule
├── sender.py         # standalone message sender
├── scheduler.py      # long-running scheduler
├── requirements.txt  # python-dotenv, requests
├── todo.md           # (already exists)
└── README.md         # (already exists)
```

- `sender.py` — one responsibility: send a single message to claude.ai and return the response
- `scheduler.py` — one responsibility: read config, watch the clock, call sender at the right times

---

### Task 0: Project Setup

**Files:**
- Create: `requirements.txt`
- Create: `config.json`
- Create: `.env.example`

- [ ] **Step 1: Create `requirements.txt`**

```
python-dotenv==1.1.0
requests==2.32.3
```

- [ ] **Step 2: Create `config.json`**

```json
{
  "model": "claude-haiku-4-5-20251001",
  "schedule": [
    {"time": "01:11", "message": "Say Hi and only Hi"},
    {"time": "06:20", "message": "Say Hi and only Hi"},
    {"time": "14:22", "message": "Say Hi and only Hi"},
    {"time": "20:23", "message": "Say Hi and only Hi"}
  ]
}
```

- [ ] **Step 3: Create `.env.example`** (template — user copies to `.env` and fills in)

```
CLAUDE_COOKIE=sessionKey=sk-ant-...
ORG_ID=your-org-id-here
```

- [ ] **Step 4: Add `.env` to `.gitignore`**

Create `.gitignore`:
```
.env
__pycache__/
```

- [ ] **Step 5: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: Both packages install successfully.

---

### Task 1: Sender — SSE Parser

**Files:**
- Create: `sender.py`

Build the SSE response parser first since everything depends on being able to read Claude's responses.

- [ ] **Step 1: Write the SSE parsing function**

In `sender.py`, write a function that takes a `requests.Response` (streaming) and extracts Claude's text from the SSE event stream.

The SSE stream from claude.ai sends events as lines like:
```
event: completion
data: {"type": "completion", "completion": "Hi"}
```

```python
import json


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
```

- [ ] **Step 2: Test the parser manually**

We'll validate this works end-to-end in Task 2. For now, verify the file has no syntax errors:

Run: `python3 -c "import sender; print('OK')"`
Expected: `OK`

---

### Task 2: Sender — HTTP Communication

**Files:**
- Modify: `sender.py`

- [ ] **Step 1: Write the `send_message` function**

Add the main function that creates a conversation and sends a message:

```python
import json
import uuid

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
        "name": "",
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
```

- [ ] **Step 2: Add standalone CLI entry point**

At the bottom of `sender.py`:

```python
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
```

- [ ] **Step 3: Test end-to-end with a real request**

Make sure `.env` is populated with real values, then:

Run: `python3 sender.py "Say Hi and only Hi"`
Expected: Claude responds with "Hi" (or similar short response). If it errors, check:
- Is the cookie still valid? (rotate if needed)
- Is the org ID correct?
- Check the HTTP status code in the error message

This is the critical validation step — if this works, the sender is done.

**Debugging note:** If the SSE parser returns empty text, the event format may differ from what we expect. Add a temporary `print(line)` inside `parse_sse_response` to inspect the raw SSE stream and adjust the parsing logic accordingly.

---

### Task 3: Scheduler

**Files:**
- Create: `scheduler.py`

- [ ] **Step 1: Write the scheduler**

```python
import json
import os
import time
from datetime import datetime

from dotenv import load_dotenv

from sender import send_message


def load_config():
    """Load schedule configuration from config.json."""
    with open("config.json") as f:
        return json.load(f)


def run():
    """Main scheduler loop."""
    load_dotenv()
    cookie = os.environ["CLAUDE_COOKIE"]
    org_id = os.environ["ORG_ID"]
    config = load_config()
    default_model = config.get("model", "claude-haiku-4-5-20251001")
    schedule = config["schedule"]

    fired_today = set()
    current_date = datetime.now().date()

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ClawSession started.")
    print(f"Scheduled {len(schedule)} message(s):")
    for entry in schedule:
        print(f"  {entry['time']} — {entry['message'][:50]}")
    print()

    while True:
        now = datetime.now()

        # Reset fired set at midnight
        if now.date() != current_date:
            fired_today = set()
            current_date = now.date()
            print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] New day — schedule reset.")

        current_time = now.strftime("%H:%M")

        for i, entry in enumerate(schedule):
            if entry["time"] == current_time and i not in fired_today:
                fired_today.add(i)
                model = entry.get("model", default_model)
                msg = entry["message"]

                print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Sending: \"{msg}\" (model: {model})")

                try:
                    response = send_message(cookie, msg, model, org_id)
                    print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Response: {response}")
                except Exception as e:
                    print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Error: {e}")

                print()

        time.sleep(30)


if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Test the scheduler**

Temporarily add an entry to `config.json` with the current time (e.g., if it's 3:45pm, add `{"time": "15:45", "message": "Test message"}`), then:

Run: `python3 scheduler.py`
Expected: Within 30 seconds, the scheduler fires the test message, prints the response, and continues looping. Ctrl+C to stop.

Remove the test entry from `config.json` after verifying.

- [ ] **Step 3: Verify duplicate prevention**

Run the scheduler again with the same test time. It should fire once and not repeat on subsequent loop iterations within the same minute.

---

### Task 4: Final Validation

- [ ] **Step 1: Verify standalone sender works**

Run: `python3 sender.py "What is 2+2?"`
Expected: Claude responds with "4" or a sentence containing 4.

- [ ] **Step 2: Verify scheduler starts cleanly**

Run: `python3 scheduler.py`
Expected: Prints startup message with all 4 scheduled entries listed, then enters the loop without errors.

- [ ] **Step 3: Update README if needed**

Verify `README.md` still matches the actual implementation. Update if any details changed during implementation.
