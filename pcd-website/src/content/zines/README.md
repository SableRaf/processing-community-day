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

For published guides, `metadata.json` requires these fields: `id` (the folder slug, lowercase kebab-case), `title`, `topic`, `created_by`, `summary`, and a non-empty `pdfs` list. Each local PDF uses `{ "file", "label", "file_size" }`; each external http(s) download uses `{ "url", "label", "filename", "file_size" }`. The filename and human-readable size appear beside the Download button. Optional fields are `cover`, `license` (currently `CC BY-SA 4.0`), `attribution`, `activity_type`, `zine_format`, `duration`, `materials`, and an http(s) `source_url`. `activity_type` describes how the guide is intended to be used, such as a workshop or self-guided activity. `zine_format` describes the publication's physical or digital structure, such as a single-sheet folded zine, multi-sheet booklet, individual pages, or digital-only. Do not use the ambiguous legacy `format` key. A cover uses `{ "src": "cover.png", "alt": "A concise image description" }`; `src` must have a lowercase `.png`, `.jpg`, `.jpeg`, or `.webp` extension and `alt` must not be blank. PDF filenames must use lowercase `.pdf` extensions. A guide without a cover uses a grey title fallback on its library card and detail page.

Only published zines belong in `src/content/zines/`. This collection has no `draft` or placeholder state because its eager asset imports would emit unpublished cover and PDF files to the public build. Keep unfinished work in `src/content/zines-drafts/`, outside the collection and its asset globs.

## GitHub issue intake and promotion

Community submissions start in the public [New Zine issue form](https://github.com/processing/processing-community-day/issues/new?template=05-new-zine.yml). The `Zine Intake` workflow validates required metadata, HTTP(S) source URLs, both consent checkboxes, and slug uniqueness. It creates or updates a review PR on `automation/new-zine-<issue-number>` with these files only:

```
src/content/zines-drafts/<slug>/
  submission.json
  index.md
```

`submission.json` keeps the submitted metadata, including optional deduplicated `languages` and validated HTTP(S) `additional_files` arrays, `source_pdfs` with `reader-order` and `print-ready` roles, the fixed `CC BY-SA 4.0` license, source issue URL, and intake provenance. These draft files are deliberately not loaded by Astro and must never be treated as a published guide.

To promote an approved draft, verify that both stable PDF source links and any submitted additional file links work, then review the PDFs, including the reader-order PDF’s accessibility. Download and commit them with the deterministic filenames `reader-order.pdf` and `print-ready.pdf`. Replace `submission.json` with a published `metadata.json` that lists both local files using the labels `Reader-order PDF` and `Print-ready PDF` and each file’s human-readable size. Add `order: max(existing order) + 1` to `index.md`, move the folder into `src/content/zines/`, verify the Netlify preview, then merge. The form does not collect a cover image, so the existing grey title fallback is expected.

Before publishing, review PDFs for accessible, selectable (not scanned) text; logical reading order; document title and language; tagged headings where the authoring tool allows; and alt text on images. Include at least one PDF whose reading order follows the content, not only a print-imposed layout.
