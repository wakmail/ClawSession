# ClawSession

A Python script that sends scheduled messages to Claude via claude.ai using a browser cookie, to maximize your usage on the rolling 5-hour window.

## Setup

1. Copy your session cookie from browser dev tools
2. Add it to `.env`:
   ```
   CLAUDE_COOKIE=sessionKey=sk-ant-...
   ```
3. Configure your schedule in `config.json`
4. Install dependencies: `pip install -r requirements.txt`
5. Run: `python3 scheduler.py`

## Config

Set a global model and schedule messages in `config.json`:

```json
{
  "model": "claude-haiku-4-5-20251001",
  "schedule": [
    {"time": "08:00", "message": "Good morning!"},
    {"time": "18:00", "message": "Recap my day", "model": "claude-sonnet-4-6"}
  ]
}
```

Each schedule entry can override the global `model` with its own.

## Standalone Sender

You can also send a one-off message directly:

```
python3 sender.py "Hello Claude"
```

This bypasses the scheduler and sends a single message immediately.

## Conversation Naming

By default, conversations are named `Automated Session Started: YYYY-MM-DD HH:MM:SS`. To disable this and send without a name, change the `"name"` field in `sender.py` to `""`.

## Auto-Titler

Generate an auto-title for an existing conversation:

```
python3 titler.py <conversation_id> "message content"
```

The conversation ID is the UUID from the claude.ai URL (e.g., `8bec82ba-dbba-4f45-8538-fffba652abda`). The `message_content` can be any text — it doesn't have to match what was actually sent in the conversation. Requires a valid conversation ID that exists on your account.
