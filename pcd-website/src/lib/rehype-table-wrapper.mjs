import { visit } from 'unist-util-visit';

/** Wrap Markdown tables so wide content scrolls within the docs column. */
export default function rehypeTableWrapper() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index == null) return;
      const classes = [].concat(parent.properties?.className ?? []);
      if (parent.type === 'element' && parent.tagName === 'div' && classes.includes('table-wrapper')) return;
      parent.children[index] = { type: 'element', tagName: 'div', properties: { className: ['table-wrapper'] }, children: [node] };
    });
  };
}
