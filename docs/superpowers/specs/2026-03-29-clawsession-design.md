# ClawSession Design Spec

## Overview

A Python script that sends scheduled messages to Claude via claude.ai using a browser session cookie. The script runs as a long-running process, reading a config file for scheduled times and messages, and printing Claude's responses to stdout.

## Architecture

Two-module design (Approach B):

- **`sender.py`** — standalone module that handles HTTP communication with claude.ai
- **`scheduler.py`** — long-running process that reads config and triggers the sender at scheduled times

## API Flow

Communication with claude.ai requires two sequential HTTP requests:

### 1. Create Conversation

```
POST https://claude.ai/api/organizations/{org_id}/chat_conversations
```

**Headers:**
- `content-type: application/json`
- `cookie: sessionKey=...`
- `anthropic-client-platform: web_claude_ai`

**Body:**
```json
{
  "uuid": "<generated-uuid>",
  "name": "",
  "model": "claude-haiku-4-5-20251001",
  "include_conversation_preferences": true,
  "is_temporary": false
}
```

**Returns:** Conversation object including the conversation UUID and initial parent message UUID.

### 2. Send Message (Completion)

```
POST https://claude.ai/api/organizations/{org_id}/chat_conversations/{conv_id}/completion
```

**Headers:**
- `accept: text/event-stream`
- `content-type: application/json`
- `cookie: sessionKey=...`

**Body:**
```json
{
  "prompt": "Say Hi and only Hi",
  "parent_message_uuid": "<from-conversation-creation>",
  "timezone": "America/New_York",
  "model": "claude-haiku-4-5-20251001",
  "locale": "en-US",
  "personalized_styles": [{"type": "default", "key": "Default", "name": "Normal", "nameKey": "normal_style_name", "prompt": "Normal\n", "summary": "Default responses from Claude", "summaryKey": "normal_style_summary", "isDefault": true}],
  "tools": [],
  "attachments": [],
  "files": [],
  "sync_sources": []
}
```

**Returns:** Server-Sent Events (SSE) stream containing Claude's response in chunks. Must be parsed to extract the full text response.

## Configuration

### `.env`
```
CLAUDE_COOKIE=sessionKey=sk-ant-...
ORG_ID=535a71cd-ded6-4f72-acee-0507c1b301e2
```

### `config.json`
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

- `model` — global default model, used unless overridden per entry
- Each schedule entry can include `"model": "claude-sonnet-4-6"` to override the default

## Module Design

### `sender.py`

**Main function:**
```python
def send_message(cookie: str, message: str, model: str, org_id: str) -> str
```

**Responsibilities:**
1. Generate a UUID for the new conversation
2. POST to create the conversation
3. Extract the parent message UUID from the response
4. POST to the completion endpoint with the prompt
5. Parse the SSE stream to extract Claude's full text response
6. Return the response string

**Standalone usage:** Can be run directly to send a one-off message using the global model from config.

### `scheduler.py`

**Responsibilities:**
1. Load `CLAUDE_COOKIE` and `ORG_ID` from `.env` via `python-dotenv`
2. Read `config.json` for default model and schedule
3. Enter a loop, checking every 30 seconds if current time (HH:MM) matches a scheduled entry
4. On match, call `sender.send_message()` with the appropriate message and model
5. Print response to stdout with a timestamp
6. Track which entries have fired today to prevent duplicate sends
7. Reset the tracker at midnight

## File Structure

```
ClawSession/
├── .env              # CLAUDE_COOKIE, ORG_ID
├── config.json       # model + schedule
├── sender.py         # standalone message sender
├── scheduler.py      # long-running scheduler
├── requirements.txt  # python-dotenv, requests
├── todo.md           # future features
└── README.md         # usage instructions
```

## Dependencies

- `python-dotenv` — load `.env` file
- `requests` — HTTP requests
- `uuid` (stdlib) — generate conversation UUIDs
- `json` (stdlib) — parse config and responses
- `time`, `datetime` (stdlib) — scheduling loop

## Future Enhancements

See `todo.md`:
- Send responses to external services (Slack, email, macOS notifications)
- Refactor to asyncio-based approach for concurrent message sends
- Add `--model` flag to `sender.py` with short aliases (haiku, sonnet, opus)
