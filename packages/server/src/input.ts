import type { InputLimits } from '@hyperbug/config';
import { RequestFailure } from './errors.ts';

function excessive(): never {
  throw new RequestFailure('INPUT_LIMIT_EXCEEDED');
}

/** Scan before JSON.parse; escaped quotes and brackets inside strings are data. */
export function assertJsonDepth(text: string, maxDepth: number): void {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const character of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '[' || character === '{') {
      if (++depth > maxDepth) excessive();
    } else if (character === ']' || character === '}') depth--;
  }
}

/** Parsed JSON only. Endpoint schemas still enforce types, formats and enums. */
export function assertJsonShape(value: unknown, limits: InputLimits): void {
  const pending = [value];
  let nodes = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++nodes > limits.maxJsonNodes) excessive();
    if (typeof item === 'string' && item.length > limits.maxJsonStringLength)
      excessive();
    if (typeof item === 'number' && !Number.isFinite(item)) {
      throw new RequestFailure('INVALID_JSON');
    }
    if (Array.isArray(item)) {
      if (item.length > limits.maxJsonArrayItems) excessive();
      pending.push(...item);
    } else if (item !== null && typeof item === 'object') {
      const keys = Object.keys(item);
      if (keys.length > limits.maxJsonObjectKeys) excessive();
      for (const key of keys) {
        if (key.length > limits.maxJsonStringLength) excessive();
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
          throw new RequestFailure('INVALID_JSON');
        }
        pending.push((item as Record<string, unknown>)[key]);
      }
    }
    if (nodes + pending.length > limits.maxJsonNodes) excessive();
  }
}

export function assertQueryBounds(request: Request, limits: InputLimits): void {
  if (request.url.length > limits.maxUrlLength) excessive();
  const params = new URL(request.url).searchParams;
  let count = 0;
  for (const [name, value] of params) {
    if (
      ++count > limits.maxQueryParameters ||
      name.length > 128 ||
      value.length > limits.maxQueryValueLength
    )
      excessive();
  }
}
