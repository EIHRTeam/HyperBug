import { expect, it } from 'vitest';
import {
  markdownResults,
  markdownCorpus,
  rejectedMarkdown,
} from '../fixtures/markdown-corpus.ts';
import {
  deriveMarkdownTree,
  deriveMarkdownHtml,
  projectMarkdownText,
  markdownRepresentationEtag,
} from '../../packages/security/src/markdown/index.ts';

it('sanitizes the malicious corpus and rejects over-complex bodies deterministically', async () => {
  const baseline = markdownResults();
  expect(baseline.rejected).toEqual(rejectedMarkdown.map(() => true));
  expect(
    await Promise.all(Array.from({ length: 8 }, async () => markdownResults())),
  ).toEqual(Array.from({ length: 8 }, () => baseline));
  for (const body of markdownCorpus) {
    const html = deriveMarkdownHtml(body);
    expect(html).not.toMatch(
      /<(?:script|style|svg|math|iframe|object|embed|form|img)\b|\son\w+=|\s(?:id|name|srcset|srcdoc|style)=|javascript:|data:/i,
    );
  }
  expect(baseline.etag).not.toEqual(baseline.upgradedEtag);
  expect(markdownRepresentationEtag('other', 2, 'tree')).not.toEqual(
    baseline.etag,
  );
});
it('keeps external images inert and attachments as opaque references', () => {
  expect(deriveMarkdownTree('![alt](https://tracker.example/x)')).toEqual({
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [
          {
            type: 'image',
            source: { kind: 'external', url: 'https://tracker.example/x' },
            alt: 'alt',
            title: null,
          },
        ],
      },
    ],
  });
  expect(JSON.stringify(deriveMarkdownTree(markdownCorpus[17]!))).toContain(
    '"kind":"attachment"',
  );
  expect(JSON.stringify(deriveMarkdownTree(markdownCorpus[18]!))).not.toContain(
    'signature',
  );
});
it('bounds scalar-safe stored projections without retaining markup or unsafe content', () => {
  const projection = projectMarkdownText(
    '**Hello**\n\n<script>secret</script>world ' + '🐛'.repeat(5000),
  );
  expect([...projection.text]).toHaveLength(4096);
  expect([...projection.preview]).toHaveLength(280);
  expect(projection.text.startsWith('Hello world ')).toBe(true);
  expect(projection.text).not.toContain('secret');
  expect(
    new TextDecoder().decode(new TextEncoder().encode(projection.text)),
  ).toBe(projection.text);
});
