// @security-smoke
// Runs an isolated production Express build and real headless Chromium.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { before, after, test } from 'node:test';
import { inspectChromeApp } from './chrome_cdp.mjs';

const ROOT = resolve('.');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'http://127.0.0.1:39821';
const PROBE_HTML = join(DIST, '__archelens_security_probe__.html');
const PROBE_JS = join(DIST, '__archelens_security_probe__.js');
let server;
let chromeProfileRoot;

async function availableChrome() {
  for (const binary of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', 'google-chrome', 'chromium'].filter(Boolean)) {
    try {
      const child = spawn(binary, ['--version'], { stdio: 'ignore' });
      const code = await new Promise((done) => {
        child.once('error', () => done(-1));
        child.once('exit', (value) => done(value ?? -1));
      });
      if (code === 0) return binary;
    } catch { /* try the next browser */ }
  }
  throw new Error('No Chrome or Chromium available on this runner');
}
async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (server?.exitCode !== null || server?.signalCode) throw new Error('Express exited before health check');
    try {
      const response = await fetch(ORIGIN + '/api/health', { signal: AbortSignal.timeout(650) });
      if (response.ok) return;
    } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error('Production Express server did not start on 127.0.0.1');
}
async function dumpDom(chrome, url) {
  const profile = await mkdtemp(join(chromeProfileRoot, 'chrome-'));
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-networking',
    '--enable-logging=stderr',
    '--log-level=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--virtual-time-budget=12000',
    '--user-data-dir=' + profile,
    '--dump-dom',
    url,
  ];
  const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 40000 });
  let html = '', stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (data) => { html += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  const code = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('close', (value, signal) => {
      if (signal) reject(new Error('Chrome was terminated by ' + signal + ': ' + stderr.slice(-2500)));
      else done(value);
    });
  });
  await rm(profile, { recursive: true, force: true });
  assert.equal(code, 0, 'Chrome failed: ' + stderr.slice(-3000));
  assert.ok(html.includes('<html'), 'Chrome returned no HTML: ' + stderr.slice(-3000));
  if (url.endsWith('/') && html.includes('<div id="root"></div>')) {
    console.error('CHROME_STARTUP_DIAGNOSTICS', stderr.slice(-11000));
  }
  return html;
}

let chrome;
before(async () => {
  await access(join(ROOT, 'dist-server', 'server.cjs'));
  await access(join(DIST, 'index.html'));
  chrome = await availableChrome();
  chromeProfileRoot = await mkdtemp(join(tmpdir(), 'archelens-browser-'));
  const probeJs = [
    "document.addEventListener('securitypolicyviolation', function(e) {",
    "  if (e.effectiveDirective === 'script-src-elem' || e.effectiveDirective === 'script-src') {",
    "    if (e.blockedURI === 'inline') document.documentElement.dataset.inlineBlocked = 'yes';",
    "  }",
    "  if (e.effectiveDirective === 'img-src' && e.blockedURI.includes('tracker.invalid')) document.documentElement.dataset.imageBlocked = 'yes';",
    "});",
    "window.addEventListener('load', function() {",
    "  const img = new Image();",
    "  img.src = 'https://tracker.invalid/csp-smoke.png';",
    "  document.body.appendChild(img);",
    "});",
  ].join('\n');
  const probeHtml = [
    '<!doctype html><html><head><title>CSP probe</title>',
    '<script src="/__archelens_security_probe__.js"></script>',
    "<script>document.documentElement.dataset.inlineExecuted = 'yes';</script>",
    '</head><body><h1>Security fixture</h1></body></html>',
  ].join('\n');
  await writeFile(PROBE_JS, probeJs);
  await writeFile(PROBE_HTML, probeHtml);
  server = spawn(process.execPath, [join(ROOT, 'dist-server', 'server.cjs')], {
    cwd: ROOT,
    env: {
      ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}),
      AUTH_MODE: 'local',
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      STATIC_DIR: 'dist',
      PORT: '39821',
      CLIENT_URL: ORIGIN,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverErrors = '';
  server.stderr.on('data', (b) => { serverErrors += b.toString(); });
  try { await waitForServer(); }
  catch (err) { throw new Error(String(err) + ' ' + serverErrors.slice(-1000)); }
});
after(async () => {
  if (server && server.exitCode === null) server.kill('SIGTERM');
  await Promise.all([
    rm(PROBE_HTML, { force: true }),
    rm(PROBE_JS, { force: true }),
    chromeProfileRoot ? rm(chromeProfileRoot, { recursive: true, force: true }) : Promise.resolve(),
  ]);
});

test('Express delivers enforced production CSP for the SPA', async () => {
  const response = await fetch(ORIGIN + '/');
  assert.equal(response.status, 200);
  const policy = response.headers.get('content-security-policy') || '';
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /img-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /'unsafe-eval'/);
  const page = await response.text();
  assert.doesNotMatch(page, /<script>\s*(?:\/\/ Register Service Worker)/);
  assert.doesNotMatch(page, /href="\/manifest\.json"/);
  assert.match(page, /href="\/manifest\.webmanifest"/);
  const entry = page.match(/<script\s[^>]*\bsrc="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(entry, 'Built page must reference its JavaScript entry');
  const moduleResponse = await fetch(ORIGIN + entry, { headers: { Origin: ORIGIN } });
  assert.equal(moduleResponse.status, 200, 'Serve the entry module to the configured browser origin');
  assert.match(moduleResponse.headers.get('content-type') || '', /javascript/);
  await moduleResponse.body?.cancel();
  const manifestResponse = await fetch(ORIGIN + '/manifest.webmanifest');
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, 'ArcheLens Open Source');
});

test('Chrome renders the compiled application under production CSP', async () => {
  const state = await inspectChromeApp(chrome, ORIGIN + '/', chromeProfileRoot);
  assert.ok(state.root?.length > 0, 'React must render real DOM');
  assert.deepEqual(state.exceptions, [], 'Uncaught browser JS exceptions');
});

test('Chrome rejects inline script and third-party tracker image via CSP', async () => {
  const html = await dumpDom(chrome, ORIGIN + '/__archelens_security_probe__.html');
  assert.match(html, /data-inline-blocked="yes"/);
  assert.match(html, /data-image-blocked="yes"/);
  assert.doesNotMatch(html, /data-inline-executed="yes"/);
});
