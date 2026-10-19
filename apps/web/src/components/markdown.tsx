import { createElement, type ReactNode, useState } from 'react';
import type { OperationTypes } from '@hyperbug/api-client';
import { AttachmentReference } from './attachment.tsx';

export type MarkdownTree = NonNullable<
  OperationTypes['GET /api/v1/projects/{projectId}/issues/{issueId}']['response']['bodyTree']
>;
type MarkdownNode = MarkdownTree['children'][number];

function ImageReference({
  node,
}: {
  node: Extract<MarkdownNode, { type: 'image' }>;
}) {
  const [revealed, setRevealed] = useState(false);
  if (node.source.kind === 'attachment')
    return <AttachmentReference id={node.source.id} label={node.alt} />;
  // Arbitrary hosts cannot be added to the app CSP. Explicit navigation keeps
  // external content isolated and never makes an automatic tracking request.
  return (
    <span className="image-reference">
      {revealed ? (
        <a
          href={node.source.url}
          target="_blank"
          rel="noreferrer noopener"
          referrerPolicy="no-referrer"
        >
          Open external image: {node.alt || 'image'} (new tab)
        </a>
      ) : (
        <button type="button" onClick={() => setRevealed(true)}>
          Show external image link: {node.alt || 'image'}
        </button>
      )}
      <span> Opening this image contacts an external host.</span>
    </span>
  );
}
function inlineText(nodes: readonly MarkdownNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? node.value
        : node.type === 'image'
          ? node.alt
          : ['ul', 'ol', 'input'].includes(node.tagName)
            ? ''
            : inlineText(node.children),
    )
    .join('');
}
function renderNode(
  node: MarkdownNode,
  index: number,
  taskLabel?: string,
): ReactNode {
  if (node.type === 'text') return node.value;
  if (node.type === 'image') return <ImageReference key={index} node={node} />;
  // Canonical attachment links, including Issue Form uploads, use the same
  // authorized isolated download control as attachment image references.
  if (node.tagName === 'a' && typeof node.properties.href === 'string') {
    const attachment =
      /^\/attachments\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(
        node.properties.href,
      );
    if (attachment)
      return (
        <AttachmentReference
          key={index}
          id={attachment[1]!}
          label={inlineText(node.children) || 'Attachment'}
        />
      );
  }
  const props: Record<string, unknown> = { ...node.properties, key: index };
  if (Array.isArray(props.className))
    props.className = props.className.join(' ');
  if (Array.isArray(props.rel)) props.rel = props.rel.join(' ');
  if (node.tagName === 'input')
    return createElement('input', {
      ...props,
      readOnly: true,
      'aria-label': taskLabel || 'Task status',
    });
  if (node.tagName === 'br' || node.tagName === 'hr')
    return createElement(node.tagName, props);
  const heading = /^h[1-6]$/.test(node.tagName)
    ? `h${Math.min(6, Number(node.tagName[1]) + 1)}`
    : node.tagName;
  const label =
    node.tagName === 'li' ? inlineText(node.children).trim() : taskLabel;
  return createElement(
    heading,
    props,
    node.children.map((child, childIndex) =>
      renderNode(child, childIndex, label),
    ),
  );
}
/** Transport adapter only: the trusted API's centralized policy owns the tree.
 * No Markdown parsing, sanitization, innerHTML, or local HTML allowlist. */
export function Markdown({
  tree,
  version,
}: {
  tree?: MarkdownTree | undefined;
  version?: string | undefined;
}) {
  if (!tree || version !== 'hyperbug-content-1')
    return (
      <p>
        Content is unavailable under this app’s supported content policy. Reload
        or contact the administrator.
      </p>
    );
  return (
    <div className="markdown">
      {tree.children.map((node, index) => renderNode(node, index))}
    </div>
  );
}
