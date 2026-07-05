#!/usr/bin/env node

import { Command } from "commander";
import { MODELS, resolveModel, sendMessage } from "./client.js";
import { loadConfig, saveConfig, getCredentials } from "./config.js";

const program = new Command();

program
  .name("claw")
  .description("ClawSession — talk to Claude from your terminal")
  .version("1.0.0");

program
  .command("send")
  .description("Send a message to Claude")
  .argument("<message>")
  .option("-m, --model <model>", "haiku, sonnet, opus, number, or full model ID")
  .option("-n, --name <name>", "set a custom conversation title")
  .option("--no-title", "don't title the conversation")
  .action(async (message: string, opts: { model?: string; name?: string; title: boolean }) => {
    const { cookie, orgId } = getCredentials();
    const config = loadConfig();

    const model = opts.model ? resolveModel(opts.model) : config.model;
    let titleMode = config.title ?? "message";
    if (!opts.title) titleMode = "none";
    else if (opts.name) titleMode = "custom";

    const friendlyName = MODELS.find(([, id]) => id === model)?.[0] ?? model;
    process.stderr.write(`→ Sending to ${friendlyName}...\n`);

    try {
      const response = await sendMessage(cookie, message, model, orgId, titleMode, opts.name);
      console.log();
      console.log(response);
    } catch (e: any) {
      if (e.message === "rate-limited") {
        console.error("Rate limited — you've hit the 5-hour usage cap. Try again later.");
      } else {
        console.error(`Error: ${e.message}`);
      }
      process.exit(1);
    }
  });

program
  .command("start")
  .description("Run the message scheduler")
  .action(async () => {
    const { cookie, orgId } = getCredentials();
    const config = loadConfig();
    const defaultModel = config.model;
    const titleMode = config.title ?? "message";
    const schedule = config.schedule;

    const firedToday = new Set<number>();
    let currentDate = new Date().toDateString();

    console.log(
      `ClawSession started — ${schedule.length} message(s) scheduled:`
    );
    for (const entry of schedule) {
      console.log(`  ${entry.time}  ${entry.message.slice(0, 50)}`);
    }
    console.log();

    setInterval(async () => {
      const now = new Date();

      if (now.toDateString() !== currentDate) {
        firedToday.clear();
        currentDate = now.toDateString();
        console.log(`[${timeStr(now)}] New day — schedule reset.`);
      }

      const currentTime = timeStr(now);

      for (let i = 0; i < schedule.length; i++) {
        const entry = schedule[i];
        if (entry.time === currentTime && !firedToday.has(i)) {
          firedToday.add(i);
          const model = resolveModel(entry.model ?? defaultModel);
          console.log(`[${currentTime}] Sending: "${entry.message}"`);

          try {
            const response = await sendMessage(cookie, entry.message, model, orgId, titleMode);
            const preview =
              response.length > 100 ? response.slice(0, 100) + "..." : response;
            console.log(`[${currentTime}] Got: ${preview}`);
          } catch (e: any) {
            console.error(`[${currentTime}] Error: ${e.message}`);
          }
          console.log();
        }
      }
    }, 30_000);
  });

program
  .command("models")
  .description("List available models")
  .action(() => {
    const config = loadConfig();
    console.log("Available models (-m):\n");
    MODELS.forEach(([name, id], i) => {
      const marker = id === config.model ? " ← default" : "";
      console.log(`  ${i + 1}  ${name.padEnd(12)} ${id}${marker}`);
    });
    console.log();
    console.log('Use by name or number: claw send "hello" -m sonnet');
    console.log('                       claw send "hello" -m 2');
    console.log("Set default:           claw default sonnet");
  });

program
  .command("default")
  .description("Set the default model")
  .argument("<model>")
  .action((model: string) => {
    const modelId = resolveModel(model);
    const config = loadConfig();
    config.model = modelId;
    saveConfig(config);
    const name = MODELS.find(([, id]) => id === modelId)?.[0] ?? modelId;
    console.log(`Default model set to ${name} (${modelId})`);
  });

program
  .command("config")
  .description("Show current config")
  .action(() => {
    const config = loadConfig();
    console.log(`Model: ${config.model}`);
    console.log(`Title: ${config.title ?? "message"}`);
    console.log(`Schedule (${config.schedule.length} messages):`);
    for (const entry of config.schedule) {
      const m = entry.model ?? "default";
      console.log(
        `  ${entry.time}  "${entry.message.slice(0, 40)}"  (${m})`
      );
    }
  });

// If first arg isn't a known command, treat it as a message to send
const knownCommands = ["send", "start", "models", "default", "config", "help"];
const args = process.argv.slice(2);
if (args.length > 0 && !args[0].startsWith("-") && !knownCommands.includes(args[0])) {
  process.argv.splice(2, 0, "send");
}

program.parse();

function timeStr(d: Date): string {
  return d.toTimeString().slice(0, 5);
}
