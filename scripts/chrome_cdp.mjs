// Minimal DevTools Protocol browser inspector using Node 24's native WebSocket.
// It waits for real React hydration/render, and captures actual JS/network errors.
// No Playwright installation, paid browser service or remote test target is used.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function inspectChromeApp(chrome, url, profileRoot) {
  const profile = await mkdtemp(join(profileRoot, 'cdp-'));
  let socket;
  let process;
  let stderr = '';
  const exceptions = [], networkErrors = [], consoleErrors = [];
  try {
    process = spawn(chrome, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-background-networking',
      '--no-first-run', '--no-default-browser-check',
      '--remote-allow-origins=*', '--remote-debugging-port=0',
      '--user-data-dir=' + profile, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    process.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-5000); });
    let port;
    for (let i = 0; i < 100; i++) {
      try {
        const lines = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
        port = Number(lines[0]);
        if (port > 0) break;
      } catch { /* browser startup */ }
      if (process.exitCode !== null) throw new Error('Chrome exited before opening CDP: ' + stderr);
      await sleep(100);
    }
    if (!port) throw new Error('Chrome did not open a DevTools port: ' + stderr);
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = targets.find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome has no page target');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(item.timeout);
        if (message.error) item.reject(new Error(JSON.stringify(message.error)));
        else item.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const e = message.params?.exceptionDetails;
        exceptions.push(e?.exception?.description || e?.text || JSON.stringify(e));
      }
      if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') {
        consoleErrors.push(message.params.entry.text);
      }
      if (message.method === 'Network.loadingFailed') {
        networkErrors.push({
          reason: message.params?.blockedReason || message.params?.errorText,
          canceled: message.params?.canceled,
        });
      }
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 7000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await Promise.all([
      command('Page.enable'), command('Runtime.enable'),
      command('Network.enable'), command('Log.enable'),
    ]);
    await command('Page.navigate', { url });
    let snapshot = {};
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const output = await command('Runtime.evaluate', {
        expression: "({ ready: document.readyState, root: document.querySelector('#root')?.innerHTML.slice(0, 600), title: document.title, scriptUrls: [...document.scripts].map(s => s.src).filter(Boolean) })",
        returnByValue: true,
      });
      snapshot = output.result?.value || {};
      if (snapshot.root && snapshot.root.length > 0) {
        return { ...snapshot, exceptions, networkErrors, consoleErrors };
      }
    }
    throw new Error('React app did not render after 12s real time: ' + JSON.stringify({ snapshot, exceptions: exceptions.slice(-10), networkErrors: networkErrors.slice(-10), consoleErrors: consoleErrors.slice(-10), chromeStderr: stderr.slice(-1200) }));
  } finally {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (process && process.exitCode === null) {
      const close = new Promise((done) => process.once('close', done));
      process.kill('SIGTERM');
      await Promise.race([close, sleep(2500)]);
      if (process.exitCode === null) process.kill('SIGKILL');
    }
    // Chromium may still close its profile files after receiving SIGTERM.
    // Cleanup errors must not hide the actual browser assertion/exception.
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }).catch(() => {});
  }
}
