# Activity Guide zines

Each published guide lives in one flat directory:

```
src/content/zines/<slug>/
  metadata.json
  index.md
  cover.png
  guide.pdf
```

`index.md` contains only `id` in its frontmatter plus the guide's long description. It is deliberately named `index.md`: Astro uses that filename to make the collection entry id equal the folder slug. Event content uses `content.md` because its loader joins through `metadata.id`; zines rely on the entry id, so `content.md` would incorrectly produce `<slug>/content`.

`metadata.json` requires these fields: `id` (the folder slug, lowercase kebab-case), `title`, one of the fixed `topic` slots, `created_by`, `summary`, `cover`, a non-empty `pdfs` list (`{ "file", "label" }`), and `license` set to `CC BY-SA 4.0`. Optional fields are `attribution`, `format`, `duration`, `materials`, and an http(s) `source_url`. Covers must have lowercase `.png`, `.jpg`, `.jpeg`, or `.webp` extensions; PDFs must have lowercase `.pdf` extensions.

Only publishable zines belong in `src/content/zines/`. This collection has no `draft` state because its eager asset imports would emit a draft's cover and PDFs to the public build. Keep unfinished work in `src/content/zines-drafts/`, outside the collection and its asset globs.

Before publishing, review PDFs for accessible, selectable (not scanned) text; logical reading order; document title and language; tagged headings where the authoring tool allows; and alt text on images. Include at least one PDF whose reading order follows the content, not only a print-imposed layout.
