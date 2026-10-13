import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { toHtml } from 'hast-util-to-html';
import type { Root, Element, RootContent } from 'hast';

/** Changes to parser pins, bounds or output require a policy-version change. */
export const contentPolicyVersion = 'hyperbug-content-1';
export const textProjectionVersion = 'hyperbug-text-1';
export const markdownLimits = Object.freeze({
  codePoints: 32768,
  bytes: 131072,
  depth: 32,
  nodes: 8192,
  syntaxCharacters: 8192,
  htmlTags: 2048,
  projectionCodePoints: 4096,
  previewCodePoints: 280,
});

export class MarkdownPolicyError extends Error {
  constructor() {
    super('Invalid or over-complex Markdown');
  }
}

const tags = [
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
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'input',
];
// Deliberately do not spread defaultSchema: upgrades cannot widen Core policy.
const schema: NonNullable<Parameters<typeof rehypeSanitize>[0]> = {
  tagNames: tags,
  attributes: {
    '*': [],
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    code: [['className', /^language-[a-zA-Z0-9_-]{1,32}$/]],
    input: [
      ['type', 'checkbox'],
      ['disabled', true],
      ['checked', true],
    ],
    ul: [['className', 'contains-task-list']],
    ol: ['start', ['className', 'contains-task-list']],
    li: [['className', 'task-list-item']],
    th: [['align', 'left', 'right', 'center']],
    td: [['align', 'left', 'right', 'center']],
  },
  ancestors: {
    thead: ['table'],
    tbody: ['table'],
    tr: ['table'],
    th: ['table'],
    td: ['table'],
  },
  protocols: { href: ['http', 'https', 'mailto'], src: ['https'] },
  clobber: ['id', 'name'],
  clobberPrefix: 'hyperbug-content-',
  required: { input: { disabled: true, type: 'checkbox' } },
  strip: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'svg',
    'math',
    'template',
    'form',
    'textarea',
    'select',
    'button',
  ],
  allowComments: false,
  allowDoctypes: false,
};
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(() => (tree) => {
    checkTree(tree);
  })
  .use(rehypeSanitize, schema)
  .freeze();

/** Conservative lexical limits run BEFORE any recursive parser. */
function checkSource(body: string): void {
  if (
    typeof body !== 'string' ||
    body.length > markdownLimits.bytes ||
    new TextDecoder().decode(new TextEncoder().encode(body)) !== body ||
    body.includes('\0') ||
    [...body].length > markdownLimits.codePoints ||
    new TextEncoder().encode(body).length > markdownLimits.bytes
  )
    throw new MarkdownPolicyError();
  let syntax = 0;
  let brackets = 0;
  for (const character of body) {
    if (
      '[]<>*_~`|\\'.includes(character) &&
      ++syntax > markdownLimits.syntaxCharacters
    )
      throw new MarkdownPolicyError();
    if (character === '[' && ++brackets > markdownLimits.depth)
      throw new MarkdownPolicyError();
    if (character === ']') brackets = Math.max(0, brackets - 1);
  }
  const stack: string[] = [];
  let count = 0;
  for (const match of body.matchAll(/<\s*(\/?)\s*([a-zA-Z][\w:-]*)\b[^>]*>/g)) {
    if (++count > markdownLimits.htmlTags) throw new MarkdownPolicyError();
    const name = match[2]!.toLowerCase();
    if (match[1]) {
      const index = stack.lastIndexOf(name);
      if (index >= 0) stack.length = index;
    } else if (
      !/\/\s*>$/.test(match[0]) &&
      ![
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
      ].includes(name)
    ) {
      stack.push(name);
      if (stack.length > markdownLimits.depth) throw new MarkdownPolicyError();
    }
  }
  for (const line of body.split('\n')) {
    if (
      (line.match(/^\s*(?:>\s*)+/)?.[0].match(/>/g)?.length ?? 0) >
      markdownLimits.depth
    )
      throw new MarkdownPolicyError();
    // List indentation can provoke recursive block parsing; fenced code is
    // conservatively subject to this same bound.
    if (/^[ \t]{129}/.test(line)) throw new MarkdownPolicyError();
  }
}

function checkTree(tree: unknown): void {
  let count = 0;
  const pending = [{ node: tree, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++count > markdownLimits.nodes || depth > markdownLimits.depth)
      throw new MarkdownPolicyError();
    if (
      node &&
      typeof node === 'object' &&
      'children' in node &&
      Array.isArray(node.children)
    )
      for (const child of node.children)
        pending.push({ node: child, depth: depth + 1 });
  }
}

export type ImageSource =
  | { readonly kind: 'external'; readonly url: string }
  | { readonly kind: 'attachment'; readonly id: string };
export type SafeNode =
  | { readonly type: 'text'; readonly value: string }
  | {
      readonly type: 'element';
      readonly tagName: string;
      readonly properties: Readonly<
        Record<string, string | number | boolean | readonly string[]>
      >;
      readonly children: readonly SafeNode[];
    }
  | {
      readonly type: 'image';
      readonly source: ImageSource;
      readonly alt: string;
      readonly title: string | null;
    };
export interface SafeTree {
  readonly type: 'root';
  readonly children: readonly SafeNode[];
}

const attachmentPattern =
  /^\/attachments\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
/** No base URL, request host, environment, bearer query or URL normalization. */
function safeUrl(value: unknown, image: boolean): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) <= 32 ||
        character.charCodeAt(0) === 127 ||
        character === '\\',
    ) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)
  )
    return null;
  if (image && attachmentPattern.test(value)) return value;
  if (!image && (/^#[\w-]*$/.test(value) || /^\/(?!\/)/.test(value)))
    return value;
  if (!image && /^mailto:[^?]+$/i.test(value)) return value;
  if (!new RegExp(image ? '^https://' : '^https?://', 'i').test(value))
    return null;
  try {
    const parsed = new URL(value);
    return parsed.hostname && !parsed.username && !parsed.password
      ? value
      : null;
  } catch {
    return null;
  }
}

function safeNodes(nodes: readonly RootContent[]): SafeNode[] {
  const output: SafeNode[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      output.push({ type: 'text', value: node.value });
      continue;
    }
    if (node.type !== 'element') continue;
    if (node.tagName === 'img') {
      const url = safeUrl(node.properties.src, true);
      const alt =
        typeof node.properties.alt === 'string' ? node.properties.alt : '';
      if (!url) {
        if (alt) output.push({ type: 'text', value: alt });
        continue;
      }
      const attachment = url.match(attachmentPattern);
      output.push({
        type: 'image',
        source: attachment
          ? { kind: 'attachment', id: attachment[1]! }
          : { kind: 'external', url },
        alt,
        title:
          typeof node.properties.title === 'string'
            ? node.properties.title
            : null,
      });
      continue;
    }
    const properties: Record<
      string,
      string | number | boolean | readonly string[]
    > = {};
    for (const key of Object.keys(node.properties).sort()) {
      const value = node.properties[key];
      if (key === 'href') {
        const url = safeUrl(value, false);
        if (url) properties.href = url;
      } else if (key === 'start') {
        const number = Number(value);
        if (Number.isInteger(number) && number >= 1 && number <= 1000000)
          properties.start = number;
      } else if (
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        typeof value === 'number'
      )
        properties[key] = value;
      else if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
      )
        properties[key] = value as string[];
    }
    if (node.tagName === 'a' && properties.href)
      properties.rel = ['nofollow', 'ugc', 'noreferrer', 'noopener'];
    output.push({
      type: 'element',
      tagName: node.tagName,
      properties,
      children: safeNodes(node.children),
    });
  }
  return output;
}

export function deriveMarkdownTree(body: string): SafeTree {
  checkSource(body);
  const parsed = processor.parse(body);
  checkTree(parsed);
  const sanitized = processor.runSync(parsed) as Root;
  checkTree(sanitized);
  return { type: 'root', children: safeNodes(sanitized.children) };
}

function htmlNodes(nodes: readonly SafeNode[]): RootContent[] {
  return nodes.map((node): RootContent => {
    if (node.type === 'text') return { type: 'text', value: node.value };
    if (node.type === 'image') {
      // Non-browser consumers also get a link: rendering never contacts an
      // external host and cannot embed a reusable private capability.
      return {
        type: 'element',
        tagName: 'a',
        properties: {
          href:
            node.source.kind === 'external'
              ? node.source.url
              : `/attachments/${node.source.id}`,
          rel: ['nofollow', 'ugc', 'noreferrer', 'noopener'],
        },
        children: [{ type: 'text', value: node.alt || 'Image' }],
      };
    }
    return {
      type: 'element',
      tagName: node.tagName,
      properties: { ...node.properties },
      children: htmlNodes(node.children),
    } as Element;
  });
}

/** Internal non-browser consumer only. Never include this in a public DTO. */
export function deriveMarkdownHtml(body: string): string {
  return toHtml({
    type: 'root',
    children: htmlNodes(deriveMarkdownTree(body).children),
  });
}

function plainText(nodes: readonly SafeNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? node.value
        : node.type === 'image'
          ? node.alt
          : `${['p', 'li', 'br', 'hr', 'pre', 'tr', 'td', 'th', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName) ? ' ' : ''}${plainText(node.children)}`,
    )
    .join('');
}
/** Only call for body-changing writes or bounded explicit backfill. */
export function projectMarkdownText(body: string): {
  text: string;
  preview: string;
  version: string;
} {
  const text = [
    ...plainText(deriveMarkdownTree(body).children)
      .replace(/\s+/gu, ' ')
      .trim(),
  ]
    .slice(0, markdownLimits.projectionCodePoints)
    .join('');
  return {
    text,
    preview: [...text].slice(0, markdownLimits.previewCodePoints).join(''),
    version: textProjectionVersion,
  };
}

/** Resource identity prevents collisions between distinct revision-1 rows. */
export function markdownRepresentationEtag(
  id: string,
  revision: number,
  kind: 'tree' | 'html',
  policy = contentPolicyVersion,
): string {
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(policy)
  )
    throw new MarkdownPolicyError();
  return `"${id}.${revision}.${kind}.${policy}"`;
}
