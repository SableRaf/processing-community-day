import { visit } from 'unist-util-visit';
import Slugger from 'github-slugger';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const ANCHORED_HEADING_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);
const rawNodeTypes = new Set(['text', 'raw', 'mdxTextExpression']);

// bi:link-45deg (Bootstrap Icons), inlined so the anchor needs no icon font/JS framework.
const LINK_ICON_PATHS = [
  'M4.715 6.542L3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199a2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z',
  'M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z',
];

/**
 * Prepend a permalink anchor to each heading. This runs before Astro's own
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

      node.children.unshift({
        type: 'element',
        tagName: 'a',
        properties: {
          href: `#${slug}`,
          className: ['docs-heading-anchor'],
          ariaLabel: 'Link to this section',
        },
        children: [
          {
            type: 'element',
            tagName: 'svg',
            properties: { viewBox: '0 0 16 16', width: '0.8em', height: '0.8em', ariaHidden: 'true' },
            children: LINK_ICON_PATHS.map((d) => ({
              type: 'element',
              tagName: 'path',
              properties: { fill: 'currentColor', d },
              children: [],
            })),
          },
        ],
      });
    });
  };
}
