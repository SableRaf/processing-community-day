#!/usr/bin/env node
// Start the dev server on the local network and print a QR code so a phone can
// reach it. Usage: npm run host [-- --https] [-- --port 1234]
// Extra flags are forwarded to `astro dev`.
//
// --https serves over TLS with a self-signed cert, needed for browser APIs
// that require a secure context (geolocation, clipboard, service workers).
import { spawn, execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import QRCode from 'qrcode';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Pick the LAN address a phone on the same Wi-Fi can dial. */
function lanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      // Skip macOS virtual bridges (Docker, VMs, AirDrop) — unreachable from a phone.
      if (/^(bridge|utun|llw|awdl|vmnet|vboxnet|docker)/.test(name)) continue;
      candidates.push({ name, address: addr.address });
    }
  }
  // en0 is Wi-Fi on macOS; prefer it, then any other physical interface.
  return (
    candidates.find((c) => c.name === 'en0')?.address ??
    candidates[0]?.address ??
    null
  );
}

const CERT_DIR = resolve(siteRoot, 'node_modules/.cache/host-certs');

/**
 * Generate (and cache) a self-signed cert valid for localhost and the current
 * LAN IP. The IP goes in subjectAltName because browsers ignore CN, and a cert
 * without a matching SAN entry fails outright rather than just warning.
 */
function ensureCert(ip) {
  const keyPath = resolve(CERT_DIR, 'key.pem');
  const certPath = resolve(CERT_DIR, 'cert.pem');
  const stampPath = resolve(CERT_DIR, 'issued-for');
  const stamp = `${ip ?? 'localhost'}`;

  // The cached cert pins one IP; regenerate when the machine changes network.
  if (existsSync(certPath) && existsSync(keyPath) && existsSync(stampPath)) {
    if (readFileSync(stampPath, 'utf8') === stamp) return { keyPath, certPath };
  }

  mkdirSync(CERT_DIR, { recursive: true });
  const alt = ['DNS:localhost', 'IP:127.0.0.1', ip && `IP:${ip}`]
    .filter(Boolean)
    .join(',');
  try {
    execFileSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256',
        '-days', '365',
        '-subj', '/CN=pcd-dev',
        '-addext', `subjectAltName=${alt}`,
        '-keyout', keyPath,
        '-out', certPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
  } catch (err) {
    // Leave no half-written pair behind, or the next run would trust it.
    rmSync(CERT_DIR, { recursive: true, force: true });
    const detail = err.stderr?.toString().trim() || err.message;
    console.error(`\nCould not generate a certificate with openssl:\n${detail}\n`);
    process.exit(1);
  }
  writeFileSync(stampPath, stamp);
  return { keyPath, certPath };
}

const passthrough = process.argv.slice(2);
// --https is ours, not Astro's; strip it before forwarding the rest.
const useHttps = passthrough.includes('--https');
const astroArgs = passthrough.filter((a) => a !== '--https');

const host = lanAddress();

// Astro has no --https flag, so the cert paths reach Vite's server.https
// through the config, which reads these vars.
const env = { ...process.env };
if (useHttps) {
  const { keyPath, certPath } = ensureCert(host);
  env.PCD_HTTPS_KEY = keyPath;
  env.PCD_HTTPS_CERT = certPath;
}

const child = spawn('npx', ['astro', 'dev', '--host', ...astroArgs], {
  cwd: siteRoot,
  // Pipe stdout so the real Network URL can be read from Astro's banner;
  // it is re-emitted verbatim so the output still looks normal.
  stdio: ['inherit', 'pipe', 'inherit'],
  env,
});

let qrShown = false;

/** Print the QR code for whichever URL Astro actually bound. */
async function showQr(url) {
  if (qrShown) return;
  qrShown = true;
  const qr = await QRCode.toString(url, { type: 'terminal', small: true });
  console.log(`\nScan to open on your phone (same Wi-Fi):\n${url}\n`);
  console.log(qr);
  if (useHttps) {
    console.log(
      'The cert is self-signed, so the phone will warn once —\n' +
        'tap Advanced then Proceed to accept it.\n',
    );
  }
}

let banner = '';
child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (qrShown) return;
  banner += chunk.toString();
  // Astro prints "Network  http://<ip>:<port>/" once listening. Trusting it
  // avoids guessing wrong when it falls back to another port or interface.
  const urls = [...banner.matchAll(/(https?:\/\/[\d.]+:\d+\/?)/g)].map((m) => m[1]);
  if (!urls.length) return;
  // Prefer the address matching the interface picked above; a machine can
  // expose several (link-local, VPN) and only one is the phone's route.
  const preferred = (host && urls.find((u) => u.includes(`//${host}:`))) || urls[0];
  showQr(preferred);
});

if (!host) {
  console.warn('\nNo LAN address found — is Wi-Fi connected?\n');
}

const stop = (signal) => child.kill(signal);
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
