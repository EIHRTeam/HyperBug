import {
  contentPolicyVersion,
  deriveMarkdownTree,
  deriveMarkdownHtml,
  projectMarkdownText,
  markdownRepresentationEtag,
  type SafeNode,
} from '../../packages/security/src/markdown/index.ts';

export const markdownCorpus = [
  '# Hello\n\n**bold** and ~~removed~~ [link](https://example.com/x)\n\n- [x] yes\n- [ ] no',
  '| one | two |\n| :-- | --: |\n| a | b |\n\n```typescript\nconst x = 1;\n```',
  '<script>alert(1)</script><style>body{display:none}</style><p onclick="evil()">ok</p>',
  '<a href="jAvAsCrIpT:evil()" onmouseover="evil()">bad</a>',
  '<a href="jav&#x61;script:evil()">bad</a><a href="javascript&#58;evil()">bad</a>',
  '<a href="java&#9;script:evil()">bad</a><a href="data:text/html,x">bad</a>',
  '<svg><a xlink:href="javascript:evil()"><text>bad</text></a></svg><math><mtext>x</mtext></math>',
  '<form id="location" name="document"><input name="cookie"></form><p id="__proto__" style="color:red">safe</p>',
  '<img src="https://tracker.example/pixel" onerror="evil()" alt="private" srcset="x 2x">',
  '![](data:image/svg+xml,%3Csvg%3E) ![alt](http://tracker.example/pixel)',
  '<iframe srcdoc="<script>evil()</script>"></iframe><object data="x"><embed src="x"></object>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=evil()>">',
  '<table><tr><td><a href="//evil.example/x">x</a><img src="//evil.example/x"></table>',
  '<a href="https://example.com\\@evil.example">x</a><a href="/\\evil.example">x</a>',
  '<input type="text" autofocus formaction="javascript:evil()" value="secret">',
  '<!-- comment --><!DOCTYPE html><p title="ignored" data-danger="x">fine</p>',
  '[credentials](https://user:password@example.com) [safe](/issues/1) [mail](mailto:user@example.com)',
  '![owned](/attachments/00000000-0000-4000-8000-000000000001)',
  '![expired](/attachments/00000000-0000-4000-8000-000000000001?signature=private)',
  '\u{1f41b} **你好**\n\n<div><p>raw <em>HTML</em>\n\nmarkdown</p></div>',
];
export const rejectedMarkdown = [
  'x'.repeat(32769),
  '\ud800',
  'a\0b',
  '['.repeat(33),
  '> '.repeat(33) + 'x',
  '<div>'.repeat(33) + 'x' + '</div>'.repeat(33),
  '*'.repeat(8193),
  ' '.repeat(129) + 'x',
  '<br>'.repeat(2049),
];
const allowedTags = new Set([
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'code',
  'strong',
  'em',
  'del',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'input',
]);
export function assertMarkdownSafety(nodes: readonly SafeNode[]): void {
  for (const node of nodes) {
    if (node.type === 'text') continue;
    if (node.type === 'image') {
      if (
        node.source.kind === 'external' &&
        !node.source.url.startsWith('https://')
      )
        throw new Error('Unsafe image');
      continue;
    }
    if (!allowedTags.has(node.tagName)) throw new Error('Unsafe tag');
    for (const key of Object.keys(node.properties))
      if (
        ![
          'href',
          'title',
          'rel',
          'className',
          'type',
          'checked',
          'disabled',
          'align',
          'start',
        ].includes(key)
      )
        throw new Error('Unsafe property');
    if (
      node.tagName === 'input' &&
      (node.properties.type !== 'checkbox' || node.properties.disabled !== true)
    )
      throw new Error('Interactive input');
    if (
      node.properties.href &&
      !/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(String(node.properties.href))
    )
      throw new Error('Unsafe link');
    assertMarkdownSafety(node.children);
  }
}
export function markdownResults() {
  const outputs = markdownCorpus.map((body) => {
    const tree = deriveMarkdownTree(body);
    assertMarkdownSafety(tree.children);
    return {
      tree,
      html: deriveMarkdownHtml(body),
      projection: projectMarkdownText(body),
    };
  });
  const rejected = rejectedMarkdown.map((body) => {
    try {
      deriveMarkdownTree(body);
      return false;
    } catch {
      return true;
    }
  });
  return {
    policy: contentPolicyVersion,
    outputs,
    rejected,
    etag: markdownRepresentationEtag('item', 2, 'tree'),
    upgradedEtag: markdownRepresentationEtag(
      'item',
      2,
      'tree',
      'hyperbug-content-2',
    ),
  };
}

export function markdownMeasurement() {
  const fixtures = [
    { name: 'maximum-plain', body: 'x'.repeat(32768) },
    {
      name: 'maximum-gfm',
      body: '**bold** [safe](https://example.com)\n\n'
        .repeat(600)
        .padEnd(32768, 'x'),
    },
    { name: 'maximum-unicode', body: '🐛'.repeat(32768) },
  ];
  return fixtures.map(({ name, body }) => {
    // Warm the parser; report actual wall time, not paid Workers CPU time.
    deriveMarkdownTree(body);
    const start = performance.now();
    for (let iteration = 0; iteration < 5; iteration++)
      deriveMarkdownTree(body);
    const singleMeanMs = (performance.now() - start) / 5;
    const pageStart = performance.now();
    for (let iteration = 0; iteration < 100; iteration++)
      deriveMarkdownTree(body);
    return {
      name,
      codePoints: [...body].length,
      bytes: new TextEncoder().encode(body).length,
      singleMeanMs,
      page100Ms: performance.now() - pageStart,
    };
  });
}
