import { formatError } from './event-issue-helpers.mjs';

export const ZINE_TEMPLATE_HEADING = '### Reader-order PDF URL';

export function hasCheckedConsent(value) {
  return /^\s*-\s*\[x\]/im.test(value ?? '');
}

export function zineValidationComment(errors) {
  const count = errors.length;
  return [
    'Thanks for submitting an Activity Guide zine to Processing Community Day!',
    '',
    `We couldn't create a review pull request yet because **${count} ${count === 1 ? 'field needs' : 'fields need'} attention**:`,
    '',
    ...errors.map(formatError),
    '',
    'Please edit and save this issue with the corrected information. The check will run again automatically.',
  ].join('\n');
}

export function yamlScalar(value) {
  return JSON.stringify(String(value));
}

export function makeDraftMarkdown(slug, description) {
  return ['---', `id: ${yamlScalar(slug)}`, '---', '', description.trim(), ''].join('\n');
}

export function makeZinePrBody({ issueNumber, title, submitterLogin, submission }) {
  const submittedBy = submitterLogin ? `@${submitterLogin}` : 'the submitter';
  const optional = [
    ['Tags', submission.tags?.join(', ')], ['Creator URL', submission.created_by_url], ['Format', submission.format], ['Duration', submission.duration], ['Materials', submission.materials], ['Preferred attribution', submission.attribution],
  ].filter(([, value]) => value);
  return [
    `Closes #${issueNumber}`,
    '',
    `This draft was generated from the "New Zine" issue form for **${title}**. Submitted by ${submittedBy}.`,
    '',
    '### Submitted metadata',
    '',
    '| Field | Value |', '|---|---|',
    `| Topic | ${submission.topic.replace(/\|/g, '\\|')} |`,
    `| Creator(s) | ${submission.created_by.replace(/\|/g, '\\|')} |`,
    `| Short summary | ${submission.summary.replace(/\|/g, '\\|')} |`,
    `| Reader-order PDF | [source](${submission.source_pdfs[0].url}) |`,
    `| Print-ready PDF | [source](${submission.source_pdfs[1].url}) |`,
    ...optional.map(([label, value]) => `| ${label} | ${String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>')} |`),
    '',
    '### Submitted description',
    '',
    submission.description,
    '',
    '### Reviewer promotion checklist',
    '',
    '- [ ] Verify both stable source links and review both PDFs, including reader-order accessibility.',
    '- [ ] Download and commit them as `reader-order.pdf` and `print-ready.pdf`.',
    '- [ ] Convert `submission.json` to published `metadata.json`, with downloads labelled `Reader-order PDF` and `Print-ready PDF` and each local file’s human-readable size.',
    '- [ ] Add `order: max(existing order) + 1` to `index.md` and move the folder into `src/content/zines/`.',
    '- [ ] Verify the Netlify preview, then merge. No cover was collected; the existing title fallback is expected.',
  ].join('\n');
}
