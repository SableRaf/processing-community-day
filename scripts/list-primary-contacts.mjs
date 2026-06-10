#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const eventsDir = join(__dirname, "..", "pcd-website", "src", "content", "events");

const rows = [];
for (const entry of readdirSync(eventsDir)) {
  const metaPath = join(eventsDir, entry, "metadata.json");
  try {
    if (!statSync(metaPath).isFile()) continue;
  } catch {
    continue;
  }
  const data = JSON.parse(readFileSync(metaPath, "utf8"));
  const pc = data.primary_contact;
  if (pc?.email) {
    rows.push({ id: data.id ?? entry, name: pc.name ?? "", email: pc.email });
  }
}

rows.sort((a, b) => a.id.localeCompare(b.id));
const formatted = rows.map((r) =>
  r.name ? `"${r.name}" <${r.email}>` : r.email,
);
console.log(formatted.join(", "));
console.error(`\n${rows.length} primary contacts found.`);
