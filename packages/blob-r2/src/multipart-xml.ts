import {
  BlobStoreError,
  multipartAbortable,
  type MultipartDiscoveryPage,
} from '@hyperbug/application';

interface XmlNode {
  name: string;
  parts: string[];
  children: XmlNode[];
}
const unavailable = () => new BlobStoreError('BLOB_UNAVAILABLE');
const maximumBytes = 128 * 1024;

/** Bounded protocol XML only: no DTD, custom entities, processing instructions or mixed content. */
function parseXml(value: string): XmlNode {
  value = value.replace(
    /^\s*<\?xml\s+version=(["'])1\.0\1(?:\s+encoding=(["'])[Uu][Tt][Ff]-8\2)?\s*\?>/,
    '',
  );
  if (
    // XML 1.0 prohibits raw control characters independently of entity validation.
    // eslint-disable-next-line no-control-regex
    /<!|<\?|[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)
  )
    throw unavailable();
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined,
    offset = 0,
    nodes = 0;
  while (offset < value.length) {
    const opening = value.indexOf('<', offset);
    const content = value.slice(offset, opening < 0 ? value.length : opening);
    if (stack.length) stack.at(-1)!.parts.push(decodeText(content));
    else if (content.trim()) throw unavailable();
    if (opening < 0) break;
    const closing = value.indexOf('>', opening + 1);
    if (closing < 0) throw unavailable();
    const tag = value.slice(opening + 1, closing);
    if (tag.startsWith('/')) {
      const name = /^\/([A-Za-z][A-Za-z0-9]*)\s*$/.exec(tag)?.[1];
      if (!name || stack.pop()?.name !== name) throw unavailable();
    } else {
      const empty = tag.endsWith('/');
      const match = /^([A-Za-z][A-Za-z0-9]*)([\s\S]*)$/.exec(
        empty ? tag.slice(0, -1) : tag,
      );
      if (!match) throw unavailable();
      const attrs = match[2]!.trim();
      if (
        attrs &&
        (stack.length ||
          !/^xmlns=(["'])http:\/\/s3\.amazonaws\.com\/doc\/2006-03-01\/\1$/.test(
            attrs,
          ))
      )
        throw unavailable();
      if (++nodes > 1024 || stack.length >= 8) throw unavailable();
      const node: XmlNode = { name: match[1]!, parts: [], children: [] };
      if (stack.length) stack.at(-1)!.children.push(node);
      else {
        if (root) throw unavailable();
        root = node;
      }
      if (!empty) stack.push(node);
    }
    offset = closing + 1;
  }
  if (!root || stack.length) throw unavailable();
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.children.length && node.parts.join('').trim()) throw unavailable();
    pending.push(...node.children);
  }
  return root;
}
function decodeText(value: string): string {
  const entity = '(?:amp|lt|gt|quot|apos|#(?:[0-9]{1,7}|x[0-9a-fA-F]{1,6}));';
  if (new RegExp(`&(?!(?:${entity}))`).test(value)) throw unavailable();
  return value.replace(/&([^;]+);/g, (_, token: string) => {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
    };
    if (Object.hasOwn(named, token)) return named[token]!;
    const code = token.startsWith('#x')
      ? Number.parseInt(token.slice(2), 16)
      : Number.parseInt(token.slice(1), 10);
    if (
      !(
        [9, 10, 13].includes(code) ||
        (code >= 0x20 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff)
      )
    )
      throw unavailable();
    return String.fromCodePoint(code);
  });
}
function scalar(node: XmlNode, name: string): string | undefined {
  const fields = node.children.filter((child) => child.name === name);
  if (fields.length > 1 || fields[0]?.children.length) throw unavailable();
  return fields[0]?.parts.join('');
}
async function readXml(
  response: Response,
  signal: AbortSignal,
): Promise<XmlNode> {
  const length = response.headers.get('content-length');
  if (
    !response.body ||
    (length !== null &&
      (!/^\d{1,12}$/.test(length) || Number(length) > maximumBytes))
  ) {
    void response.body?.cancel().catch(() => {});
    throw unavailable();
  }
  const reader = response.body.getReader(),
    bytes = new Uint8Array(maximumBytes);
  let size = 0,
    complete = false;
  try {
    for (;;) {
      // One bounded response chunk at a time, under the shared total deadline.
      // eslint-disable-next-line no-await-in-loop
      const chunk = await multipartAbortable(signal, () => reader.read());
      if (chunk.done) {
        complete = true;
        break;
      }
      if (size + chunk.value.byteLength > maximumBytes) throw unavailable();
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
    if (!size || (length !== null && Number(length) !== size))
      throw unavailable();
    return parseXml(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
        bytes.subarray(0, size),
      ),
    );
  } finally {
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function readR2MultipartPage(
  response: Response,
  signal: AbortSignal,
  bucket: string,
  key: string,
): Promise<MultipartDiscoveryPage> {
  const root = await readXml(response, signal);
  if (
    root.name !== 'ListMultipartUploadsResult' ||
    (scalar(root, 'Bucket') !== undefined &&
      scalar(root, 'Bucket') !== bucket) ||
    (scalar(root, 'Prefix') !== undefined && scalar(root, 'Prefix') !== key)
  )
    throw unavailable();
  const truncated = scalar(root, 'IsTruncated')?.trim();
  if (!['true', 'false'].includes(truncated ?? '')) throw unavailable();
  return {
    truncated: truncated === 'true',
    uploads: root.children
      .filter((node) => node.name === 'Upload')
      .map((node) => ({
        key: scalar(node, 'Key'),
        id: scalar(node, 'UploadId'),
      })),
    groupedPrefixes: root.children.filter(
      (node) => node.name === 'CommonPrefixes',
    ).length,
    nextKey: scalar(root, 'NextKeyMarker'),
    nextId: scalar(root, 'NextUploadIdMarker'),
  };
}
export async function r2MissingUpload(
  response: Response,
  signal: AbortSignal,
): Promise<boolean> {
  const root = await readXml(response, signal);
  return root.name === 'Error' && scalar(root, 'Code') === 'NoSuchUpload';
}
