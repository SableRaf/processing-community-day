#!/usr/bin/env node
// Start the dev server on the local network and print a QR code so a phone can
// reach it. Usage: npm run host [-- --port 1234]
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
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

const passthrough = process.argv.slice(2);
const portFlag = passthrough.findIndex((a) => a === '--port' || a === '-p');
const port = portFlag !== -1 ? passthrough[portFlag + 1] : '4321';

const host = lanAddress();
const child = spawn('npx', ['astro', 'dev', '--host', ...passthrough], {
  cwd: siteRoot,
  stdio: 'inherit',
  env: process.env,
});

if (host) {
  const url = `http://${host}:${port}/`;
  // Wait past Astro's ready banner (and any dep re-optimization) so the QR
  // code is the last thing on screen rather than being scrolled away.
  setTimeout(async () => {
    const qr = await QRCode.toString(url, { type: 'terminal', small: true });
    console.log(`\nScan to open on your phone (same Wi-Fi):\n${url}\n`);
    console.log(qr);
  }, 4000);
} else {
  console.warn('\nNo LAN address found — is Wi-Fi connected? Skipping QR code.\n');
}

const stop = (signal) => child.kill(signal);
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
