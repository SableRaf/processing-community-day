import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
const WEBSITE = join(REPO_ROOT, 'pcd-website');
const ZINES_DIR = join(WEBSITE, 'src/content/zines');
const FIXTURE = join(REPO_ROOT, '.github/scripts/fixtures/zines/zine-integration-test-fixture');
const SLUG = 'zine-integration-test-fixture';
const DEST = join(ZINES_DIR, SLUG);
const DIST = join(WEBSITE, 'dist');

function emittedPath(href) {
  assert.ok(!href.startsWith('data:'), `asset href must not be a data URI: ${href}`);
  return join(DIST, new URL(href, 'https://day.processing.org').pathname.replace(/^\//, ''));
}

function hrefForLabel(html, label) {
  const match = html.match(new RegExp(`<a[^>]+href="([^"]+)"[^>]*>${label}</a>`));
  assert.ok(match, `expected a link labelled "${label}"`);
  return match[1];
}

test('a populated zine collection emits linked assets and replaces its topic placeholder', () => {
  assert.ok(!existsSync(DEST), `${DEST} already exists — refusing to overwrite`);
  let created = true;
  try {
    cpSync(FIXTURE, DEST, { recursive: true });
    copyFileSync(join(WEBSITE, 'src/images/og-image.png'), join(DEST, 'cover.png'));
    execFileSync('npm', ['run', 'build'], { cwd: WEBSITE, stdio: 'pipe' });

    const pagePath = join(DIST, 'activity-guide', SLUG, 'index.html');
    assert.ok(existsSync(pagePath), 'the zine page should be generated');
    const page = readFileSync(pagePath, 'utf8');
    assert.match(page, /Loops with Shapes/);
    assert.match(page, /View the original submission/);

    for (const label of ['Read on screen', 'Print and fold']) {
      assert.ok(existsSync(emittedPath(hrefForLabel(page, label))), `${label} should resolve to an emitted PDF`);
    }
    const pageCover = page.match(/<img[^>]+src="([^"]+)"/);
    assert.ok(pageCover, 'the zine page should render a cover image');
    assert.ok(existsSync(emittedPath(pageCover[1])), 'the zine cover should be emitted');

    const library = readFileSync(join(DIST, 'organize/activity-guides/library/index.html'), 'utf8');
    assert.match(library, new RegExp(`href="/activity-guide/${SLUG}/"`));
    assert.match(library, /A compact guide to making patterns with repeated shapes\./);
    assert.doesNotMatch(library, /<strong>Loops<\/strong>\s*<span>Guide wanted<\/span>/);
    const grid = library.match(/<ul class="guide-grid">([\s\S]*?)<\/ul>/);
    assert.ok(grid, 'the library should render its grid');
    assert.equal((grid[1].match(/<li>/g) ?? []).length, 12, 'the grid should always have eleven topics plus submission');
    const gridCover = grid[1].match(/<img[^>]+src="([^"]+)"/);
    assert.ok(gridCover, 'the zine card should render a cover image');
    assert.ok(existsSync(emittedPath(gridCover[1])), 'the card cover should be emitted');
  } finally {
    if (created) rmSync(DEST, { recursive: true, force: true });
  }
});
