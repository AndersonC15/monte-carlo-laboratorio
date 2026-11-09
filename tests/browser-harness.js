"use strict";

// Dependency-free Chrome DevTools Protocol helper. No npm package or server required.
const { spawn } = require("node:child_process");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

async function launchBrowser() {
  const profile = await mkdtemp(join(tmpdir(), "monte-carlo-chrome-"));
  const child = spawn(process.env.CHROME_BIN || "/usr/bin/google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--disable-background-networking", "--disable-breakpad", "--no-first-run",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chrome startup timed out: ${logs}`)), 15000);
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Chrome exited ${code}: ${logs}`)); });
    child.stderr.on("data", data => {
      logs += data.toString();
      const match = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  }).catch(async error => { child.kill(); await rm(profile, { recursive: true, force: true }); throw error; });
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id);
      if (!p) return;
      pending.delete(message.id);
      clearTimeout(p.timer);
      if (message.error) p.reject(new Error(JSON.stringify(message.error)));
      else p.resolve(message.result || {});
    } else {
      for (const listener of listeners.get(message.method) || []) listener(message.params || {});
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const pageSend = (method, params) => send(method, params, sessionId);
  await pageSend("Page.enable");
  await pageSend("Runtime.enable");
  const errors = [];
  listeners.set("Runtime.exceptionThrown", [event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text)]);
  listeners.set("Log.entryAdded", [event => { if (event.entry.level === "error") errors.push(event.entry.text); }]);
  await pageSend("Log.enable");
  async function evaluate(expression) {
    const result = await pageSend("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression, timeout = 10000) {
    const finish = Date.now() + timeout;
    while (Date.now() < finish) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }
  async function goto(path) {
    await pageSend("Page.navigate", { url: path.startsWith("http") ? path : pathToFileURL(path).href });
    await waitFor("document.readyState === 'complete'");
  }
  async function click(id) { return evaluate(`document.getElementById(${JSON.stringify(id)}).click()`); }
  async function input(id, value) {
    return evaluate(`(() => { const field=document.getElementById(${JSON.stringify(id)}); field.value=${JSON.stringify(String(value))}; field.dispatchEvent(new Event('input',{bubbles:true})); field.dispatchEvent(new Event('change',{bubbles:true})); return field.value; })()`);
  }
  async function viewport(width, height = 1000) {
    await pageSend("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  }
  async function screenshot(path, fullPage = false) {
    await mkdir(require("node:path").dirname(path), { recursive: true });
    const { data } = await pageSend("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage });
    await writeFile(path, Buffer.from(data, "base64"));
  }
  async function close() {
    try { await send("Browser.close"); } catch {}
    socket.close();
    child.kill();
    await new Promise(resolve => { if (child.exitCode !== null) resolve(); else { child.once("exit", resolve); setTimeout(resolve, 2000); } });
    await rm(profile, { recursive: true, force: true });
  }
  return { send: pageSend, evaluate, waitFor, goto, click, input, viewport, screenshot, errors, close };
}

module.exports = { launchBrowser };
