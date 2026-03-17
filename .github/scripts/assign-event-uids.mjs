/**
 * One-time backfill script: assigns stable 7-char hex uids to all events
 * that don't have one yet.
 *
 * Usage (from repo root):
 *   node .github/scripts/assign-event-uids.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateUniqueUid } from './event-issue-helpers.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const EVENTS_DIR = path.join(REPO_ROOT, 'pcd-website/src/content/events');

const entries = await fs.readdir(EVENTS_DIR);
const metadataPaths = [];

for (const entry of entries) {
  const mpath = path.join(EVENTS_DIR, entry, 'metadata.json');
  try {
    await fs.access(mpath);
    metadataPaths.push(mpath);
  } catch {
    // not a metadata directory
  }
}

// First pass: collect existing uids
const existingUids = new Set();
const metadatas = [];
for (const mpath of metadataPaths) {
  const meta = JSON.parse(await fs.readFile(mpath, 'utf8'));
  metadatas.push({ mpath, meta });
  if (meta.uid) existingUids.add(meta.uid);
}

// Second pass: assign uids to events missing one
let assigned = 0;
let skipped = 0;

for (const { mpath, meta } of metadatas) {
  if (meta.uid) {
    skipped++;
    continue;
  }

  const uid = generateUniqueUid(existingUids);

  // Insert uid as the second field (after id) to keep it near the top
  const { id, ...rest } = meta;
  const updated = { id, uid, ...rest };

  await fs.writeFile(mpath, `${JSON.stringify(updated, null, 2)}\n`);

  // Also write uid into content.md frontmatter
  const contentPath = path.join(path.dirname(mpath), 'content.md');
  try {
    const content = await fs.readFile(contentPath, 'utf8');
    // Insert uid line after the id line in the frontmatter
    const updated_content = content.replace(
      /^(---\nid: [^\n]+\n)/m,
      `$1uid: ${uid}\n`
    );
    await fs.writeFile(contentPath, updated_content);
  } catch {
    // content.md may not exist for some events — skip
  }

  console.log(`  assigned uid ${uid} to ${meta.id}`);
  assigned++;
}

console.log(`\nDone. Assigned ${assigned} uid(s), skipped ${skipped} already-assigned.`);
