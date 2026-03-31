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
