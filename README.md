# ClawSession

Talk to Claude from your terminal. Maximize your rolling 5-hour usage window with scheduled messages.

## Setup

1. Get your session cookie and org ID from browser dev tools (Network tab → any request to `claude.ai/api` → copy `sessionKey` cookie and org ID from the URL)
2. Create a `.env` file:
   ```
   CLAUDE_COOKIE=sk-ant-...
   ORG_ID=your-org-id-here
   ```
3. Install:
   ```
   npm install
   npm run build
   npm link
   ```

Now `claw` works from anywhere:

```
claw "hello"
```

To uninstall: `npm unlink -g clawsession`

## Usage

```
claw "hello"                  # send a message (uses default model)
claw "hello" -m sonnet        # send with a specific model
claw "hello" -m 3             # or by number
claw "hello" -n "my chat"     # set a custom title
claw "hello" --no-title       # no title
claw models                   # list available models
claw start                    # run the scheduler
claw config                   # show your config
```

Just `claw "your message"` works — no need to type `claw send`. Quotes are needed when your message has spaces.

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
