# Activity Guide zines

Each library card lives in one flat directory. A published guide uses:

```
src/content/zines/<slug>/
  metadata.json
  index.md
  cover.png  # optional
  guide.pdf  # optional when metadata uses an external PDF URL
```

The library grid is built dynamically from every `*/index.md` in this directory. Each file requires `id` and a numeric `order` in frontmatter; cards are sorted by `order`, then title. Every entry must be a published guide with a sibling `metadata.json`, and the Markdown body can provide its long description. The file is deliberately named `index.md`: Astro uses that filename to make the collection entry id equal to the folder slug.

For published guides, `metadata.json` requires these fields: `id` (the folder slug, lowercase kebab-case), `title`, `topic`, `created_by`, `summary`, and a non-empty `pdfs` list. Each local PDF uses `{ "file", "label", "file_size" }`; each external http(s) download uses `{ "url", "label", "filename", "file_size" }`. The filename and human-readable size appear beside the Download button. Optional fields are `cover`, `license` (currently `CC BY-SA 4.0`), `attribution`, `format`, `duration`, `materials`, and an http(s) `source_url`. A cover uses `{ "src": "cover.png", "alt": "A concise image description" }`; `src` must have a lowercase `.png`, `.jpg`, `.jpeg`, or `.webp` extension and `alt` must not be blank. PDF filenames must use lowercase `.pdf` extensions. A guide without a cover uses a grey title fallback on its library card and detail page.

Only published zines belong in `src/content/zines/`. This collection has no `draft` or placeholder state because its eager asset imports would emit unpublished cover and PDF files to the public build. Keep unfinished work in `src/content/zines-drafts/`, outside the collection and its asset globs.

Before publishing, review PDFs for accessible, selectable (not scanned) text; logical reading order; document title and language; tagged headings where the authoring tool allows; and alt text on images. Include at least one PDF whose reading order follows the content, not only a print-imposed layout.
