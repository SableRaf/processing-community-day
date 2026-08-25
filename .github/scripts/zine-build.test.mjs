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

function hrefForFilename(html, filename) {
  const match = html.match(new RegExp(`<a[^>]+href="([^"]+)"[^>]+download="${filename}"`));
  assert.ok(match, `expected a download for "${filename}"`);
  return match[1];
}

test('a populated zine collection emits linked assets and renders entries in frontmatter order', () => {
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

    for (const filename of ['guide-small.pdf', 'guide-print.pdf']) {
      assert.ok(existsSync(emittedPath(hrefForFilename(page, filename))), `${filename} should resolve to an emitted PDF`);
    }
    assert.match(page, /download-list__size[^>]*>96 B</);
    const pageCover = page.match(/<img[^>]+src="([^"]+)"/);
    assert.ok(pageCover, 'the zine page should render a cover image');
    assert.ok(existsSync(emittedPath(pageCover[1])), 'the zine cover should be emitted');

    const noCoverPage = readFileSync(join(DIST, 'activity-guide/zine-making-kit/index.html'), 'utf8');
    assert.match(noCoverPage, /activity-guide__cover--placeholder[^>]*>Zine Making Kit</);
    assert.equal(
      hrefForFilename(noCoverPage, 'B230_zinemakingactivity.pdf'),
      'https://guides.loc.gov/ld.php?content_id=67687837',
    );
    assert.match(noCoverPage, /download-list__size[^>]*>519 kB</);

    const library = readFileSync(join(DIST, 'organize/activity-guides/library/index.html'), 'utf8');
    assert.match(library, /<ul class="guide-grid">\s*<li>\s*<a class="guide-card guide-card--zine" href="\/activity-guide\/zine-making-kit\/"/);
    assert.match(library, /guide-card__cover-placeholder[^>]*>Zine Making Kit</);
    assert.match(library, new RegExp(`href="/activity-guide/${SLUG}/"`));
    assert.match(library, /A compact guide to making patterns with repeated shapes\./);
    assert.ok(
      library.indexOf('/activity-guide/zine-making-kit/') < library.indexOf('<strong>Variables</strong>'),
      'order 1 should render before order 2',
    );
    assert.ok(
      library.indexOf('<strong>Randomness</strong>') < library.indexOf(`/activity-guide/${SLUG}/`),
      'order 12 should render before order 13',
    );
    assert.equal((library.match(/Guide wanted/g) ?? []).length, 11, 'each placeholder file should render a wanted card');
    assert.equal(existsSync(join(DIST, 'activity-guide/variables/index.html')), false, 'placeholders should not get detail pages');
    const grid = library.match(/<ul class="guide-grid">([\s\S]*?)<\/ul>/);
    assert.ok(grid, 'the library should render its grid');
    assert.equal((grid[1].match(/<li>/g) ?? []).length, 14, 'the grid should contain all file-backed entries plus submission');
    const gridCover = grid[1].match(/<img[^>]+src="([^"]+)"/);
    assert.ok(gridCover, 'the zine card should render a cover image');
    assert.ok(existsSync(emittedPath(gridCover[1])), 'the card cover should be emitted');
  } finally {
    if (created) rmSync(DEST, { recursive: true, force: true });
  }
});
