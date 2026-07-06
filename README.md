# ClawSession

Talk to Claude from your terminal. Maximize your rolling 5-hour usage window with scheduled messages.

## Install / Update

```
npm install -g github:wakmail/ClawSession
```

That's it. Now `claw` works from anywhere. Run the same command again to update to the latest version.

To uninstall: `npm uninstall -g clawsession`

## Setup

1. Get your session cookie and org ID from browser dev tools (Network tab → any request to `claude.ai/api` → copy `sessionKey` cookie and org ID from the URL)
2. Create a `.env` file in the directory you'll run `claw` from:
   ```
   CLAUDE_COOKIE=sk-ant-...
   ORG_ID=your-org-id-here
   ```

## Usage

```
claw "hello"                  # send a message (uses default model)
claw "hello" -m sonnet        # send with a specific model
claw "hello" -m 3             # or by number
claw "hello" -n "my chat"     # set a custom title
claw "hello" --no-title       # no title
claw at 14:00 "hello"         # send once at a specific time (waits, then sends)
claw models                   # list available models
claw start                    # run the scheduler
claw config                   # show your config
```

`claw at` waits until the given time (today, or tomorrow if it's already passed) and sends once. Keep the terminal open while it waits.

Just `claw "your message"` works — no need to type `claw send`. Quotes are needed when your message has spaces.

## Config

```
claw config                            # show current settings
claw config model sonnet               # set default model
claw config title none                 # set title mode (message, timestamp, none)
claw config add 08:00 "Good morning!"  # add a scheduled message
claw config remove 1                   # remove a scheduled message by number
```
