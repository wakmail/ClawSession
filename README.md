# ClawSession

Send scheduled messages to Claude via claude.ai to maximize your rolling 5-hour usage window.

## Setup

1. Get your session cookie and org ID from browser dev tools (Network tab → any request to `claude.ai/api` → copy `sessionKey` cookie and org ID from the URL)
2. Create a `.env` file:
   ```
   CLAUDE_COOKIE=sk-ant-...
   ORG_ID=your-org-id-here
   ```
3. Install:
   ```
   source .venv/bin/activate
   pip install -e .
   ```

That's it. Now `claw` works:

```
claw "hello"
```

When you're done, deactivate the virtual environment:

```
deactivate
```

Next time, just `source .venv/bin/activate` again and `claw` is back.

## Usage

```
claw "hello"                  # send a message (uses default model)
claw "hello" -m sonnet        # send with a specific model
claw "explain git" -m opus    # model shortcuts: haiku, sonnet, opus
claw start                    # run the scheduler
claw config                   # show your config
claw title <id> "msg"         # auto-title a conversation
```

You don't need to type `claw send` — just `claw "your message"` works. Quotes are needed when your message has spaces.

## Config

Edit `config.json` to set your default model and schedule:

```json
{
  "model": "claude-haiku-4-5-20251001",
  "schedule": [
    {"time": "08:00", "message": "Good morning!"},
    {"time": "18:00", "message": "Recap my day", "model": "claude-sonnet-4-6"}
  ]
}
```

Messages are spaced across the 5-hour window. Each entry can override the default model.
