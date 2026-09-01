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
    const coverIndex = page.indexOf('class="activity-guide__cover"');
    const titleIndex = page.indexOf('>Loops with Shapes</h1>');
    const descriptionIndex = page.indexOf('Use a loop to draw a playful field of shapes.');
    const metadataIndex = page.indexOf('class="activity-guide__metadata"');
    assert.ok(
      coverIndex !== -1 && coverIndex < titleIndex &&
      titleIndex < descriptionIndex && descriptionIndex < metadataIndex,
      'the cover should render before the title and description, followed by metadata',
    );

    for (const filename of ['guide-small.pdf', 'guide-print.pdf']) {
      assert.ok(existsSync(emittedPath(hrefForFilename(page, filename))), `${filename} should resolve to an emitted PDF`);
    }
    assert.match(page, /download-list__size[^>]*>96 B</);
    const pageCover = page.match(/<img[^>]+src="([^"]+)"/);
    assert.ok(pageCover, 'the zine page should render a cover image');
    assert.ok(existsSync(emittedPath(pageCover[1])), 'the zine cover should be emitted');

    const zineMakingPage = readFileSync(join(DIST, 'activity-guide/zine-making-kit/index.html'), 'utf8');
    const zineMakingCover = zineMakingPage.match(
      /<img[^>]+src="([^"]+)"[^>]+alt="Zine Making Kit"[^>]+class="activity-guide__cover"/,
    );
    assert.ok(zineMakingCover, 'the Zine Making Kit page should render its accessible cover image');
    assert.ok(existsSync(emittedPath(zineMakingCover[1])), 'the Zine Making Kit cover should be emitted');
    assert.equal(
      hrefForFilename(zineMakingPage, 'B230_zinemakingactivity.pdf'),
      'https://guides.loc.gov/ld.php?content_id=67687837',
    );
    assert.match(zineMakingPage, /download-list__size[^>]*>519 kB</);

    const library = readFileSync(join(DIST, 'organize/activity-guides/zine-library/index.html'), 'utf8');
    assert.match(library, /<ul class="guide-grid">\s*<li>\s*<a class="guide-card guide-card--zine" href="\/activity-guide\/zine-making-kit\/"/);
    assert.match(
      library,
      /guide-card__cover-frame[\s\S]*?<\/span>\s*<span class="guide-card__body">\s*<strong>Zine Making Kit<\/strong>\s*<span class="guide-card__author">by Library of Congress<\/span>/,
    );
    assert.match(library, /<img[^>]+alt="Zine Making Kit"/);
    assert.match(library, new RegExp(`href="/activity-guide/${SLUG}/"`));
    assert.match(library, /A compact guide to making patterns with repeated shapes\./);
    assert.ok(
      library.indexOf('/activity-guide/zine-making-kit/') < library.indexOf(`/activity-guide/${SLUG}/`),
      'order 1 should render before order 13',
    );
    assert.equal((library.match(/Submit a Zine/g) ?? []).length, 1, 'the grid should render one submission card');
    assert.match(
      library,
      /guide-card guide-card--add[^>]*>[\s\S]*?<svg class="guide-card__plus" aria-hidden="true" viewBox="0 0 16 16">\s*<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Z[^>]+><\/path>\s*<\/svg>\s*<span>Submit a Zine<\/span>/,
      'the submission card should render the feed-plus Octicon followed by its label',
    );
    assert.match(library, /href="https:\/\/github\.com\/processing\/processing-community-day\/issues\/new\?template=05-new-zine\.yml"/, 'the submission card should link to the public New Zine GitHub issue form');
    assert.doesNotMatch(library, /guide-card--empty|<strong>Variables<\/strong>/);
    const grid = library.match(/<ul class="guide-grid">([\s\S]*?)<\/ul>/);
    assert.ok(grid, 'the library should render its grid');
    assert.equal((grid[1].match(/<li>/g) ?? []).length, 3, 'the grid should contain published zines plus submission');
    const gridCover = grid[1].match(/<img[^>]+src="([^"]+)"/);
    assert.ok(gridCover, 'the zine card should render a cover image');
    assert.ok(existsSync(emittedPath(gridCover[1])), 'the card cover should be emitted');
  } finally {
    if (created) rmSync(DEST, { recursive: true, force: true });
  }
});
