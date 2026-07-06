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
    .action(async (message, opts) => {
    const { cookie, orgId } = getCredentials();
    const config = loadConfig();
    const model = opts.model ? resolveModel(opts.model) : config.model;
    let titleMode = config.title ?? "message";
    if (!opts.title)
        titleMode = "none";
    else if (opts.name)
        titleMode = "custom";
    const friendlyName = MODELS.find(([, id]) => id === model)?.[0] ?? model;
    process.stderr.write(`→ Sending to ${friendlyName}...\n`);
    try {
        const response = await sendMessage(cookie, message, model, orgId, titleMode, opts.name);
        console.log();
        console.log(response);
    }
    catch (e) {
        if (e.message === "rate-limited") {
            console.error("Rate limited — you've hit the 5-hour usage cap. Try again later.");
        }
        else {
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
    const firedToday = new Set();
    let currentDate = new Date().toDateString();
    console.log(`ClawSession started — ${schedule.length} message(s) scheduled:`);
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
                    const preview = response.length > 100 ? response.slice(0, 100) + "..." : response;
                    console.log(`[${currentTime}] Got: ${preview}`);
                }
                catch (e) {
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
    console.log('Use by name or number: claw "hello" -m sonnet');
    console.log('                       claw "hello" -m 2');
    console.log("Set default:           claw config model sonnet");
});
const configCmd = program
    .command("config")
    .description("View or edit config")
    .action(() => {
    const config = loadConfig();
    console.log(`Model: ${config.model}`);
    console.log(`Title: ${config.title ?? "message"}`);
    console.log(`Schedule (${config.schedule.length} messages):`);
    config.schedule.forEach((entry, i) => {
        const m = entry.model ?? "default";
        console.log(`  ${i + 1}. ${entry.time}  "${entry.message.slice(0, 40)}"  (${m})`);
    });
    console.log();
    console.log("Edit config:");
    console.log("  claw config model sonnet          Set default model");
    console.log("  claw config title none             Set title mode (message, timestamp, none)");
    console.log('  claw config add 08:00 "hello"      Add a scheduled message');
    console.log("  claw config remove 1               Remove a scheduled message by number");
});
configCmd
    .command("model")
    .argument("<model>")
    .description("Set the default model")
    .action((model) => {
    const modelId = resolveModel(model);
    const config = loadConfig();
    config.model = modelId;
    saveConfig(config);
    const name = MODELS.find(([, id]) => id === modelId)?.[0] ?? modelId;
    console.log(`Default model set to ${name} (${modelId})`);
});
configCmd
    .command("title")
    .argument("<mode>")
    .description("Set title mode (message, timestamp, none)")
    .action((mode) => {
    if (!["message", "timestamp", "none"].includes(mode)) {
        console.error("Title mode must be: message, timestamp, or none");
        process.exit(1);
    }
    const config = loadConfig();
    config.title = mode;
    saveConfig(config);
    console.log(`Title mode set to ${mode}`);
});
configCmd
    .command("add")
    .argument("<time>")
    .argument("<message>")
    .option("-m, --model <model>", "model for this message")
    .description("Add a scheduled message")
    .action((time, message, opts) => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
        console.error("Time must be in HH:MM format (e.g. 08:00)");
        process.exit(1);
    }
    const config = loadConfig();
    const entry = { time, message };
    if (opts.model)
        entry.model = resolveModel(opts.model);
    config.schedule.push(entry);
    config.schedule.sort((a, b) => a.time.localeCompare(b.time));
    saveConfig(config);
    console.log(`Added: ${time}  "${message}"`);
});
configCmd
    .command("remove")
    .argument("<number>")
    .description("Remove a scheduled message by number")
    .action((num) => {
    const config = loadConfig();
    const idx = parseInt(num) - 1;
    if (idx < 0 || idx >= config.schedule.length) {
        console.error(`No message at #${num}. Run 'claw config' to see the list.`);
        process.exit(1);
    }
    const removed = config.schedule.splice(idx, 1)[0];
    saveConfig(config);
    console.log(`Removed: ${removed.time}  "${removed.message}"`);
});
// If first arg isn't a known command, treat it as a message to send
const knownCommands = ["send", "start", "models", "config", "help"];
const args = process.argv.slice(2);
if (args.length > 0 && !args[0].startsWith("-") && !knownCommands.includes(args[0])) {
    process.argv.splice(2, 0, "send");
}
program.parse();
function timeStr(d) {
    return d.toTimeString().slice(0, 5);
}
