# Activity Guide zines

Each published guide has this final structure:

```text
src/content/zines/<slug>/
  index.md
  metadata.json
  cover.png                 # optional; PNG, JPG/JPEG, or WebP
  downloads/
    reader-order.pdf
    print-ready.pdf
    supplementary-file.zip  # optional
```

`metadata.json` requires `id`, `title`, `topic`, `created_by`, `summary`, and a non-empty `downloads` array. A local download is `{ "file", "file_size", "role"? }`; `file` is a basename resolved inside `downloads/`. A manually maintained external download is `{ "url", "filename", "file_size", "role"? }`. `role`, when present, is either `reader-order` or `print-ready`. Filenames and sizes are shown to readers; there are no download labels. `cover` is optional and has `{ "src", "alt" }`, where `src` is a root-level image filename.

The New Zine issue form accepts only GitHub file attachments: one reader-order PDF, one print-ready PDF, an optional cover (PNG, JPG/JPEG, or WebP), and optional PDF, ZIP, image, TXT, MD, CSV, or JSON supplements. It allows ten files total, 25 MB for each non-image file, 10 MB for each image, and 50 MB overall. Cover and download filenames occupy separate namespaces, so a root cover and a supplementary download may share a basename; filenames within `downloads/` must remain unique even when compared case-insensitively. Attachments are checked by extension and actual file content. External links are rejected; download the source material and attach it directly to the corresponding issue field.

The workflow downloads valid attachments, generates `metadata.json` and `index.md`, assigns the next library order, includes any maintainer notes in the PR body, validates with a production build, and creates or force-updates the automation-owned `automation/new-zine-<issue-number>` review branch. A later invalid issue edit leaves the last valid PR commit untouched and marks it as needing changes; a successful edit returns it to review. Reviewers inspect the generated files and reader-order accessibility, check metadata and the Netlify preview, then merge.
