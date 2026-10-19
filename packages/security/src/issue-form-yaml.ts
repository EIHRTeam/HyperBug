import { Lexer, isAlias, isMap, isScalar, isSeq, parseDocument } from 'yaml';

export const issueFormYamlLimits = Object.freeze({
  bytes: 65536,
  codePoints: 32768,
  depth: 12,
  nodes: 8192,
  tokens: 32768,
  indentation: 48,
});

export class IssueFormYamlError extends Error {
  readonly reason: 'SYNTAX' | 'LIMIT' | 'UNSUPPORTED_YAML';
  constructor(reason: 'SYNTAX' | 'LIMIT' | 'UNSUPPORTED_YAML') {
    super('Invalid Issue Form YAML');
    this.reason = reason;
  }
}

/** One bounded YAML 1.2 core document; never resolve aliases or construct tags. */
export function decodeIssueFormYaml(source: string): unknown {
  if (
    typeof source !== 'string' ||
    source.length > issueFormYamlLimits.bytes ||
    [...source].length > issueFormYamlLimits.codePoints ||
    new TextEncoder().encode(source).length > issueFormYamlLimits.bytes ||
    new TextDecoder().decode(new TextEncoder().encode(source)) !== source ||
    [...source].some((character) => {
      const point = character.codePointAt(0)!;
      return (point < 32 && ![9, 10, 13].includes(point)) || point === 127;
    })
  )
    throw new IssueFormYamlError('LIMIT');
  // Bound recursive composition before invoking the parser. Conservative
  // indentation limits also apply to block-scalar content.
  for (const line of source.split('\n')) {
    if (line.startsWith('%')) throw new IssueFormYamlError('UNSUPPORTED_YAML');
    if (/^[ ]{49}|^[ ]*(?:-[ ]+){13}/u.test(line))
      throw new IssueFormYamlError('LIMIT');
  }
  let flowDepth = 0;
  let tokens = 0;
  for (const token of new Lexer().lex(source)) {
    if (++tokens > issueFormYamlLimits.tokens)
      throw new IssueFormYamlError('LIMIT');
    if (
      (token === '[' || token === '{') &&
      ++flowDepth > issueFormYamlLimits.depth
    )
      throw new IssueFormYamlError('LIMIT');
    if (token === ']' || token === '}') flowDepth = Math.max(0, flowDepth - 1);
  }
  const doc = parseDocument(source, {
    version: '1.2',
    schema: 'core',
    strict: true,
    uniqueKeys: true,
    customTags: [],
    merge: false,
    prettyErrors: false,
  });
  if (doc.errors.length || doc.warnings.length)
    throw new IssueFormYamlError('SYNTAX');
  const pending = [{ node: doc.contents, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (
      ++nodes > issueFormYamlLimits.nodes ||
      depth > issueFormYamlLimits.depth
    )
      throw new IssueFormYamlError('LIMIT');
    if (node === null) continue;
    if (isAlias(node) || node.tag || ('anchor' in node && node.anchor))
      throw new IssueFormYamlError('UNSUPPORTED_YAML');
    if (isMap(node)) {
      for (const pair of node.items) {
        if (
          !isScalar(pair.key) ||
          typeof pair.key.value !== 'string' ||
          ['__proto__', 'constructor', 'prototype', '<<'].includes(
            pair.key.value,
          )
        )
          throw new IssueFormYamlError('UNSUPPORTED_YAML');
        pending.push(
          { node: pair.key, depth: depth + 1 },
          { node: pair.value, depth: depth + 1 },
        );
      }
    } else if (isSeq(node)) {
      for (const child of node.items)
        pending.push({ node: child, depth: depth + 1 });
    } else if (
      !isScalar(node) ||
      !(
        node.value === null ||
        ['string', 'boolean', 'number'].includes(typeof node.value)
      ) ||
      (typeof node.value === 'number' && !Number.isFinite(node.value))
    )
      throw new IssueFormYamlError('UNSUPPORTED_YAML');
  }
  // Conversion is safe only after checking the entire AST. maxAliasCount=0
  // is defense in depth; all anchors and aliases were rejected above.
  return doc.toJS({ maxAliasCount: 0 });
}
