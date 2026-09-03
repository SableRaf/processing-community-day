import { visit } from 'unist-util-visit';
import Slugger from 'github-slugger';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromHtml } from 'hast-util-from-html';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const ANCHORED_HEADING_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);
const rawNodeTypes = new Set(['text', 'raw', 'mdxTextExpression']);

// Parsed once from src/icons/link.svg. This plugin runs in Astro's config
// context rather than the Vite bundle, so it reads the file directly. Each
// heading gets a structuredClone so the shared tree isn't mutated downstream.
const linkIconSource = readFileSync(
  fileURLToPath(new URL('../icons/link.svg', import.meta.url)),
  'utf8',
).trim();
const linkIcon = fromHtml(linkIconSource, { fragment: true, space: 'svg' }).children[0];
// The <a> carries the accessible name, so the icon itself is decorative.
linkIcon.properties.ariaHidden = 'true';

/**
 * Append a permalink anchor to each heading. This runs before Astro's own
 * rehype-heading-ids plugin, so ids aren't assigned yet — slug headings the
 * same way (github-slugger) Astro does, to land on matching ids.
 */
export default function rehypeHeadingAnchors() {
  return (tree) => {
    const slugger = new Slugger();
    visit(tree, 'element', (node) => {
      if (!HEADING_TAGS.has(node.tagName)) return;
      let text = '';
      visit(node, (child) => {
        if (rawNodeTypes.has(child.type)) text += child.value;
      });
      let slug = slugger.slug(text);
      if (slug.endsWith('-')) slug = slug.slice(0, -1);

      // Reserve the h1 slug so subsequent ids stay aligned with Astro's
      // own slugger, but don't add a permalink to the h1 itself.
      if (!ANCHORED_HEADING_TAGS.has(node.tagName)) return;

      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: {
          href: `#${slug}`,
          className: ['docs-heading-anchor'],
          ariaLabel: 'Link to this section',
        },
        children: [structuredClone(linkIcon)],
      });
    });
  };
}
