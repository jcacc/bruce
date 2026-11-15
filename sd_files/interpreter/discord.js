// discord.js - post to a Discord channel through a webhook.
//
// Setup:
//   1. In Discord: channel settings > Integrations > Webhooks > New Webhook > Copy Webhook URL.
//   2. Save that URL as the only line of /discord_webhook.txt on the SD card (or LittleFS).
//      Anyone holding the URL can post to the channel, so treat the file like a password.
//   3. Copy this script to /BruceJS/ and run it from the JS Interpreter menu.
//
// The device must be on WiFi; if it is not, the WiFi connect menu opens on the first send.

var wifi = require("wifi");
var dialog = require("dialog");
var keyboard = require("keyboard");
var storage = require("storage");
var device = require("device");

var CONFIG_PATH = "/discord_webhook.txt";
var USERNAME = "shareBruce";
var MAX_CONTENT = 2000; // Discord rejects longer messages
var MAX_MESSAGE_INPUT = 200;

function trim(text) {
  var start = 0;
  var end = text.length;
  while (start < end && text.charCodeAt(start) <= 32) start++;
  while (end > start && text.charCodeAt(end - 1) <= 32) end--;
  return text.substring(start, end);
}

function startsWith(text, prefix) {
  return text.substring(0, prefix.length) === prefix;
}

function replaceAll(text, search, replacement) {
  return text.split(search).join(replacement);
}

function baseName(path) {
  return path.substring(path.lastIndexOf("/") + 1);
}

// Returns the webhook URL, or "" after telling the user what is wrong.
function loadWebhook() {
  var raw;
  try {
    raw = storage.read(CONFIG_PATH);
  } catch (e) {
    dialog.error("Put webhook URL in " + CONFIG_PATH, true);
    return "";
  }
  var url = trim(String(raw).split("\n")[0]);
  if (
    !startsWith(url, "https://discord.com/api/webhooks/") &&
    !startsWith(url, "https://discordapp.com/api/webhooks/")
  ) {
    dialog.error(CONFIG_PATH + " is not a Discord webhook URL", true);
    return "";
  }
  return url;
}

function sendToDiscord(webhook, content) {
  if (content.length > MAX_CONTENT) {
    content = content.substring(0, MAX_CONTENT - 4) + "\n...";
  }
  // wait=true makes Discord answer with the created message instead of an empty 204
  var url = webhook + (webhook.indexOf("?") < 0 ? "?" : "&") + "wait=true";
  dialog.info("Sending to Discord...");
  try {
    var response = wifi.httpFetch(url, {
      method: "POST",
      headers: ["Content-Type", "application/json"],
      body: JSON.stringify({ username: USERNAME, content: content }),
    });
    if (response.ok) {
      dialog.success("Sent to Discord", true);
      return true;
    }
    dialog.error("Discord said HTTP " + response.status, true);
  } catch (e) {
    dialog.error("Send failed: " + e, true);
  }
  return false;
}

function sendMessage(webhook) {
  var message = keyboard.keyboard("", MAX_MESSAGE_INPUT, "Discord message");
  // the on-screen keyboard returns ESC (0x1B) when cancelled
  if (!message || message.charCodeAt(0) === 27) return;
  message = trim(message);
  if (message.length === 0) return;
  sendToDiscord(webhook, message);
}

function megabytes(kilobytes) {
  return Math.round(kilobytes / 1024) + " MB";
}

function sendStatus(webhook) {
  var lines = ["**" + USERNAME + " status**"];
  lines.push("Board: " + device.getBoard());
  lines.push("Version: " + device.getBruceVersion());
  lines.push("IP: " + (wifi.getIPAddress() || "not connected"));
  lines.push("Battery: " + device.getBatteryCharge() + "%");
  var heap = device.getFreeHeapSize();
  lines.push("Free RAM: " + Math.round(heap.ram_free / 1024) + " kB");
  var sd = storage.spaceSDCard();
  if (sd && sd.total > 0) {
    lines.push("SD: " + megabytes(sd.used) + " used of " + megabytes(sd.total));
  }
  var littleFs = storage.spaceLittleFS();
  if (littleFs && littleFs.total > 0) {
    lines.push("LittleFS: " + littleFs.used + " kB used of " + littleFs.total + " kB");
  }
  sendToDiscord(webhook, lines.join("\n"));
}

function sendTextFile(webhook) {
  var path = dialog.pickFile("/", "*");
  if (!path) return;
  var text;
  try {
    text = String(storage.read(path));
  } catch (e) {
    dialog.error("Could not read " + path, true);
    return;
  }
  // keep the file from closing the code block early
  text = replaceAll(text, "```", "'''");
  var header = "`" + baseName(path) + "`";
  var note = "";
  var room = MAX_CONTENT - header.length - 10; // 10 = code fence + newlines
  if (text.length > room) {
    note = "\n(truncated, " + text.length + " chars total)";
    text = text.substring(0, room - note.length);
  }
  sendToDiscord(webhook, header + "\n```\n" + text + "\n```" + note);
}

function main() {
  var webhook = loadWebhook();
  if (!webhook) return;

  while (true) {
    var choice = dialog.choice([
      ["Send message", "message"],
      ["Device status", "status"],
      ["Send text file", "file"],
      ["Exit", "exit"],
    ]);
    if (choice === "message") sendMessage(webhook);
    else if (choice === "status") sendStatus(webhook);
    else if (choice === "file") sendTextFile(webhook);
    else return; // "exit", or the menu was dismissed
  }
}

main();
