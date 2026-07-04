import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import click
from dotenv import load_dotenv

from .client import MODELS, resolve_model, send_message

RESERVED_WORDS = {"help", "send", "start", "config", "models", "default"}


def get_config_path():
    return Path(__file__).parent.parent / "config.json"


def load_config():
    with open(get_config_path()) as f:
        return json.load(f)


def get_credentials():
    load_dotenv()
    cookie = os.environ.get("CLAUDE_COOKIE")
    org_id = os.environ.get("ORG_ID")
    if not cookie or not org_id:
        click.echo("Error: Set CLAUDE_COOKIE and ORG_ID in your .env file first.", err=True)
        sys.exit(1)
    return cookie, org_id


class ClawCLI(click.Group):
    """Custom group that treats unknown args as a message to send."""

    def parse_args(self, ctx, args):
        # If no args match a known command or --help, assume it's a send
        if args and "--help" not in args and not any(a in RESERVED_WORDS for a in args):
            args = ["send"] + args
        return super().parse_args(ctx, args)


@click.group(cls=ClawCLI, invoke_without_command=True)
@click.pass_context
def cli(ctx):
    """ClawSession — talk to Claude from your terminal.

    \b
    Usage:
      claw "hello"                  Send a message
      claw "hello" -m sonnet        Use a specific model
      claw "hello" -n "my chat"     Set a custom title
      claw "hello" --no-title       No title
      claw start                    Run the scheduler
      claw config                   Show config
    """
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@cli.command(name="help", hidden=True)
def help_cmd():
    """Show help."""
    ctx = click.get_current_context().parent
    click.echo(ctx.get_help())


@cli.command()
@click.argument("message")
@click.option("--model", "-m", default=None, help="haiku, sonnet, opus, or full model ID")
@click.option("--no-title", is_flag=True, help="Don't title the conversation")
@click.option("--name", "-n", default=None, help="Set a custom conversation title")
def send(message, model, no_title, name):
    """Send a message to Claude."""
    cookie, org_id = get_credentials()
    config = load_config()

    if model:
        model = resolve_model(model)
    else:
        model = config.get("model", "claude-haiku-4-5-20251001")

    if no_title:
        title_mode = "none"
    elif name:
        title_mode = "custom"
    else:
        title_mode = config.get("title", "message")

    click.echo(f"→ Sending to {model.split('-')[1]}...", err=True)
    try:
        response = send_message(cookie, message, model, org_id, title_mode=title_mode, custom_title=name)
    except Exception as e:
        if "429" in str(e):
            click.echo("Rate limited — you've hit the 5-hour usage cap. Try again later.", err=True)
        else:
            click.echo(f"Error: {e}", err=True)
        sys.exit(1)
    click.echo()
    click.echo(response)


@cli.command()
def start():
    """Run the message scheduler."""
    cookie, org_id = get_credentials()
    config = load_config()
    default_model = config.get("model", "claude-haiku-4-5-20251001")
    title_mode = config.get("title", "message")
    schedule = config["schedule"]

    fired_today = set()
    current_date = datetime.now().date()

    click.echo(f"ClawSession started — {len(schedule)} message(s) scheduled:")
    for entry in schedule:
        click.echo(f"  {entry['time']}  {entry['message'][:50]}")
    click.echo()

    while True:
        now = datetime.now()

        if now.date() != current_date:
            fired_today = set()
            current_date = now.date()
            click.echo(f"[{now.strftime('%H:%M')}] New day — schedule reset.")

        current_time = now.strftime("%H:%M")

        for i, entry in enumerate(schedule):
            if entry["time"] == current_time and i not in fired_today:
                fired_today.add(i)
                model = resolve_model(entry.get("model", default_model))
                msg = entry["message"]

                click.echo(f"[{now.strftime('%H:%M')}] Sending: \"{msg}\"")

                try:
                    response = send_message(cookie, msg, model, org_id, title_mode=title_mode)
                    preview = response[:100] + "..." if len(response) > 100 else response
                    click.echo(f"[{now.strftime('%H:%M')}] Got: {preview}")
                except Exception as e:
                    click.echo(f"[{now.strftime('%H:%M')}] Error: {e}", err=True)

                click.echo()

        time.sleep(30)


@cli.command()
def models():
    """List available models."""
    config = load_config()
    default = config.get("model", "")
    click.echo("Available models (-m):\n")
    for i, (name, model_id) in enumerate(MODELS, 1):
        marker = " ← default" if model_id == default else ""
        click.echo(f"  {i}  {name:12} {model_id}{marker}")
    click.echo()
    click.echo("Use by name or number: claw \"hello\" -m sonnet")
    click.echo("                       claw \"hello\" -m 2")
    click.echo("Set default:           claw default sonnet")


@cli.command(name="default", hidden=True)
@click.argument("model")
def set_default(model):
    """Set the default model."""
    model_id = resolve_model(model)
    config = load_config()
    config["model"] = model_id
    with open(get_config_path(), "w") as f:
        json.dump(config, f, indent=2)
        f.write("\n")
    # find the friendly name if there is one
    name = next((n for n, mid in MODELS if mid == model_id), model_id)
    click.echo(f"Default model set to {name} ({model_id})")


@cli.command()
def config():
    """Show current config."""
    cfg = load_config()
    click.echo(f"Model: {cfg.get('model', 'not set')}")
    click.echo(f"Title: {cfg.get('title', 'message')}")
    click.echo(f"Schedule ({len(cfg.get('schedule', []))} messages):")
    for entry in cfg.get("schedule", []):
        m = entry.get("model", "default")
        click.echo(f"  {entry['time']}  \"{entry['message'][:40]}\"  ({m})")
