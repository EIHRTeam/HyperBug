import { assertId, assertRevision } from '@hyperbug/domain';

export const issueFormSchemaVersion = 1;
export const issueFormLimits = Object.freeze({
  definitionBytes: 65536,
  fields: 64,
  options: 64,
  depth: 12,
  nodes: 8192,
  input: 1024,
  textarea: 16384,
  attachmentsPerField: 16,
  attachmentsPerSubmission: 32,
  body: 32768,
  bodyBytes: 131072,
});

export type IssueFormErrorCode =
  | 'FORM_DEFINITION_INVALID'
  | 'FORM_ATTRIBUTE_UNSUPPORTED'
  | 'FORM_ANSWERS_INVALID'
  | 'FORM_DEFAULTS_INVALID'
  | 'FORM_ATTACHMENTS_INVALID'
  | 'FORM_SUBMISSION_FORBIDDEN'
  | 'FORM_VERSION_STALE';
export class IssueFormError extends Error {
  readonly code: IssueFormErrorCode;
  readonly path: string;
  constructor(code: IssueFormErrorCode, path: string) {
    super(code);
    this.code = code;
    this.path = path;
  }
}
interface FieldBase {
  readonly id: string;
}
interface LabelAttributes {
  readonly label: string;
  readonly description: string;
}
interface RequiredValidation {
  readonly required: boolean;
}
export type IssueFormField =
  | (FieldBase & {
      readonly type: 'markdown';
      readonly attributes: { readonly value: string };
    })
  | (FieldBase & {
      readonly type: 'input';
      readonly attributes: LabelAttributes & {
        readonly placeholder: string;
        readonly value: string;
      };
      readonly validations: RequiredValidation & {
        readonly min_length: number;
      };
    })
  | (FieldBase & {
      readonly type: 'textarea';
      readonly attributes: LabelAttributes & {
        readonly placeholder: string;
        readonly value: string;
        readonly render?: string;
      };
      readonly validations: RequiredValidation & {
        readonly min_length: number;
      };
    })
  | (FieldBase & {
      readonly type: 'dropdown';
      readonly attributes: LabelAttributes & {
        readonly options: readonly string[];
        readonly multiple: boolean;
        readonly default?: number;
      };
      readonly validations: RequiredValidation;
    })
  | (FieldBase & {
      readonly type: 'checkboxes';
      readonly attributes: LabelAttributes & {
        readonly options: readonly {
          readonly label: string;
          readonly required: boolean;
        }[];
      };
      readonly validations: RequiredValidation;
    })
  | (FieldBase & {
      readonly type: 'upload';
      readonly attributes: LabelAttributes;
      readonly validations: RequiredValidation & { readonly accept: string };
    });

/** Persist this JSON together with an immutable form-version identity. */
export interface IssueFormDefinition {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly description: string;
  readonly title: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly type: string | null;
  readonly body: readonly IssueFormField[];
}
export type IssueFormAnswer = string | readonly string[] | readonly number[];
export interface ValidatedIssueFormAnswers {
  readonly values: Readonly<Record<string, IssueFormAnswer>>;
  readonly attachmentIds: readonly string[];
  readonly markdown: string;
}
type ObjectValue = Record<string, unknown>;
function definitionError(path: string): never {
  throw new IssueFormError('FORM_DEFINITION_INVALID', path);
}
function answerError(path: string): never {
  throw new IssueFormError('FORM_ANSWERS_INVALID', path);
}
function object(value: unknown, path: string): ObjectValue {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    definitionError(path);
  return value as ObjectValue;
}
function keys(
  value: ObjectValue,
  allowed: readonly string[],
  path: string,
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new IssueFormError('FORM_ATTRIBUTE_UNSUPPORTED', path);
}
function validString(
  value: unknown,
  max: number,
  singleLine = false,
): value is string {
  return (
    typeof value === 'string' &&
    value.length <= max * 2 &&
    [...value].length <= max &&
    new TextDecoder().decode(new TextEncoder().encode(value)) === value &&
    ![...value].some((character) => {
      const point = character.codePointAt(0)!;
      return (point < 32 && ![9, 10, 13].includes(point)) || point === 127;
    }) &&
    (!singleLine || !/[\r\n]/u.test(value))
  );
}
function text(
  value: unknown,
  max: number,
  path: string,
  required = false,
  singleLine = false,
): string {
  if (
    !validString(value, max, singleLine) ||
    (required && (!value.trim() || (singleLine && value !== value.trim())))
  )
    definitionError(path);
  return value;
}
function optionalText(
  value: unknown,
  max: number,
  path: string,
  singleLine = false,
): string {
  return value === undefined ? '' : text(value, max, path, false, singleLine);
}
function boolean(value: unknown, path: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') definitionError(path);
  return value;
}
function boundedInteger(value: unknown, max: number, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  )
    definitionError(path);
  return value;
}
function array(value: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max)
    definitionError(path);
  return value;
}
function distinct(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) definitionError(path);
}
/** Reject non-JSON graphs, accessors, cycles, oversized or deeply nested input. */
function boundJson(value: unknown, byteLimit: number): void {
  const pending = [{ value, depth: 0 }];
  const seen = new Set<object>();
  let nodes = 0;
  let bytes = 0;
  while (pending.length) {
    const entry = pending.pop()!;
    if (++nodes > issueFormLimits.nodes || entry.depth > issueFormLimits.depth)
      definitionError('definition');
    if (entry.value === null || typeof entry.value === 'boolean') continue;
    if (typeof entry.value === 'string') {
      if (!validString(entry.value, byteLimit)) definitionError('definition');
      bytes += new TextEncoder().encode(JSON.stringify(entry.value)).length;
      if (bytes > byteLimit) definitionError('definition');
      continue;
    }
    if (typeof entry.value === 'number' && Number.isFinite(entry.value))
      continue;
    if (
      !entry.value ||
      typeof entry.value !== 'object' ||
      seen.has(entry.value)
    )
      definitionError('definition');
    seen.add(entry.value);
    if (
      Array.isArray(entry.value) &&
      (entry.value.length > issueFormLimits.nodes ||
        Object.keys(entry.value).length !== entry.value.length)
    )
      definitionError('definition');
    if (!Array.isArray(entry.value)) object(entry.value, 'definition');
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(entry.value),
    )) {
      if (Array.isArray(entry.value) && key === 'length') continue;
      if (
        !('value' in descriptor) ||
        !descriptor.enumerable ||
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        (Array.isArray(entry.value) && !/^(0|[1-9][0-9]*)$/.test(key))
      )
        definitionError('definition');
      bytes += new TextEncoder().encode(key).length;
      if (bytes > byteLimit) definitionError('definition');
      pending.push({ value: descriptor.value, depth: entry.depth + 1 });
    }
    if (Object.getOwnPropertySymbols(entry.value).length)
      definitionError('definition');
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > byteLimit)
    definitionError('definition');
}
function names(value: unknown, path: string): string[] {
  if (value === undefined || value === '') return [];
  if (Array.isArray(value) && value.length === 0) return [];
  const values =
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim())
      : array(value, 32, path);
  if (values.length > 32) definitionError(path);
  const result = values.map((v) => text(v, 100, path, true, true));
  distinct(result, path);
  return result;
}
function normalizeField(raw: unknown, index: number): IssueFormField {
  const path = `body.${index}`;
  const field = object(raw, path);
  keys(field, ['type', 'id', 'attributes', 'validations'], path);
  // Missing GitHub IDs get deterministic positional IDs, scoped to the
  // immutable version. Explicit IDs are recommended for editor continuity.
  const id =
    field.id === undefined
      ? `field-${index + 1}`
      : text(field.id, 80, path, true, true);
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
    ['__proto__', 'constructor', 'prototype'].includes(id)
  )
    definitionError(path);
  const attributes = object(field.attributes, path);
  const validations =
    field.validations === undefined ? {} : object(field.validations, path);
  if (field.type === 'markdown') {
    keys(attributes, ['value'], path);
    keys(validations, [], path);
    return {
      type: 'markdown',
      id,
      attributes: { value: text(attributes.value, 8192, path, true) },
    };
  }
  const label = text(attributes.label, 200, path, true, true);
  const description = optionalText(attributes.description, 2048, path);
  const required = boolean(validations.required, path);
  if (field.type === 'input' || field.type === 'textarea') {
    keys(
      attributes,
      field.type === 'textarea'
        ? ['label', 'description', 'placeholder', 'value', 'render']
        : ['label', 'description', 'placeholder', 'value'],
      path,
    );
    keys(validations, ['required', 'min_length'], path);
    const max =
      field.type === 'input' ? issueFormLimits.input : issueFormLimits.textarea;
    const common = {
      label,
      description,
      placeholder: optionalText(
        attributes.placeholder,
        max,
        path,
        field.type === 'input',
      ),
      value: optionalText(attributes.value, max, path, field.type === 'input'),
    };
    const constraints = {
      required,
      min_length:
        validations.min_length === undefined
          ? 0
          : boundedInteger(validations.min_length, max, path),
    };
    if (field.type === 'input')
      return {
        type: 'input',
        id,
        attributes: common,
        validations: constraints,
      };
    if (attributes.render === undefined)
      return {
        type: 'textarea',
        id,
        attributes: common,
        validations: constraints,
      };
    const render = text(attributes.render, 32, path, true, true);
    if (!/^[a-zA-Z0-9_+-]{1,32}$/.test(render)) definitionError(path);
    return {
      type: 'textarea',
      id,
      attributes: { ...common, render },
      validations: constraints,
    };
  }
  if (field.type === 'dropdown') {
    keys(
      attributes,
      ['label', 'description', 'options', 'multiple', 'default'],
      path,
    );
    keys(validations, ['required'], path);
    const options = array(
      attributes.options,
      issueFormLimits.options,
      path,
    ).map((v) => text(v, 200, path, true, true));
    distinct(options, path);
    const common = {
      label,
      description,
      options,
      multiple: boolean(attributes.multiple, path),
    };
    if (attributes.default === undefined)
      return {
        type: 'dropdown',
        id,
        attributes: common,
        validations: { required },
      };
    const selected = boundedInteger(
      attributes.default,
      options.length - 1,
      path,
    );
    if (options.some((option) => /^(none|n\/a)$/i.test(option)))
      definitionError(path);
    return {
      type: 'dropdown',
      id,
      attributes: { ...common, default: selected },
      validations: { required },
    };
  }
  if (field.type === 'checkboxes') {
    keys(attributes, ['label', 'description', 'options'], path);
    keys(validations, ['required'], path);
    const options = array(
      attributes.options,
      issueFormLimits.options,
      path,
    ).map((v) => {
      const option = object(v, path);
      keys(option, ['label', 'required'], path);
      return {
        label: text(option.label, 200, path, true, true),
        required: boolean(option.required, path),
      };
    });
    distinct(
      options.map((v) => v.label),
      path,
    );
    return {
      type: 'checkboxes',
      id,
      attributes: { label, description, options },
      validations: { required },
    };
  }
  if (field.type === 'upload') {
    keys(attributes, ['label', 'description'], path);
    keys(validations, ['required', 'accept'], path);
    let accept = optionalText(
      validations.accept,
      512,
      path,
      true,
    ).toLowerCase();
    if (accept) {
      const extensions = accept.split(',').map((v) => v.trim());
      if (
        extensions.length > 32 ||
        extensions.some((v) => !/^\.[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(v))
      )
        definitionError(path);
      distinct(extensions, path);
      accept = extensions.join(',');
    }
    return {
      type: 'upload',
      id,
      attributes: { label, description },
      validations: { required, accept },
    };
  }
  definitionError(path);
}

/** YAML is decoded by a platform-neutral adapter before this canonical validator. */
export function normalizeIssueFormDefinition(
  input: unknown,
  format: 'github' | 'canonical' = 'github',
): IssueFormDefinition {
  boundJson(input, issueFormLimits.definitionBytes);
  const raw = object(input, 'definition');
  keys(
    raw,
    format === 'canonical'
      ? [
          'schemaVersion',
          'name',
          'description',
          'title',
          'labels',
          'assignees',
          'type',
          'body',
        ]
      : ['name', 'description', 'title', 'labels', 'assignees', 'type', 'body'],
    'definition',
  );
  if (format === 'canonical' && raw.schemaVersion !== issueFormSchemaVersion)
    definitionError('schemaVersion');
  const body = array(raw.body, issueFormLimits.fields, 'body').map(
    normalizeField,
  );
  distinct(
    body.map((field) => field.id),
    'body',
  );
  if (!body.some((field) => field.type !== 'markdown')) definitionError('body');
  const definition: IssueFormDefinition = {
    schemaVersion: issueFormSchemaVersion,
    name: text(raw.name, 100, 'name', true, true),
    description: text(raw.description, 500, 'description', true),
    title: optionalText(raw.title, 200, 'title', true),
    labels: names(raw.labels, 'labels'),
    assignees: names(raw.assignees, 'assignees'),
    type:
      raw.type === undefined || (format === 'canonical' && raw.type === null)
        ? null
        : text(raw.type, 100, 'type', true, true),
    body,
  };
  // Added defaults may enlarge the normalized representation.
  boundJson(definition, issueFormLimits.definitionBytes);
  if (issueFormStorageCharacters(definition) > 65536)
    definitionError('definition');
  return definition;
}

/** Both SQLite JSON text and PostgreSQL jsonb::text must fit the stored bound. */
export function issueFormStorageCharacters(value: unknown): number {
  const json = JSON.stringify(value);
  let quoted = false;
  let escaped = false;
  let separators = 0;
  for (const character of json) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoted && character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') quoted = !quoted;
    else if (!quoted && (character === ':' || character === ',')) separators++;
  }
  // jsonb adds a space after each object colon/array or object comma. Ordering
  // does not affect the count; canonical form values contain no floats.
  return [...json].length + separators;
}

/** Drafts never silently migrate. Call inside the atomic submission operation too. */
export function assertActiveIssueFormVersion(
  enabled: boolean,
  activeVersion: number,
  submittedVersion: number,
): void {
  assertRevision(activeVersion);
  assertRevision(submittedVersion);
  if (!enabled || activeVersion !== submittedVersion)
    throw new IssueFormError('FORM_VERSION_STALE', 'formVersion');
}

function escapeMarkdownLabel(label: string): string {
  return label.replace(/[\\`*_{}[\]()<>#+.!|~-]/g, '\\$&');
}
function fenced(value: string, language: string): string {
  const longest = Math.max(
    0,
    ...[...value.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}
/**
 * Validates scalar/cardinality/value constraints and returns canonical answers.
 * Upload IDs are references, NOT proof of authorization/release/association.
 * The submission service must verify them atomically through the attachment port.
 */
export function validateIssueFormAnswers(
  form: IssueFormDefinition,
  input: unknown,
): ValidatedIssueFormAnswers {
  // Validate persisted JSON too: malformed/unsupported versions fail closed.
  const definition = normalizeIssueFormDefinition(form, 'canonical');
  try {
    boundJson(input, issueFormLimits.bodyBytes);
  } catch {
    answerError('answers');
  }
  const answers =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as ObjectValue)
      : answerError('answers');
  const fields = definition.body.filter((field) => field.type !== 'markdown');
  if (
    Object.keys(answers).some((id) => !fields.some((field) => field.id === id))
  )
    answerError('answers');
  const values: Record<string, IssueFormAnswer> = Object.create(null);
  const attachmentIds: string[] = [];
  const sections: string[] = [];
  for (const field of fields) {
    const path = `answers.${field.id}`;
    const answer = Object.hasOwn(answers, field.id)
      ? answers[field.id]
      : undefined;
    let generated = '';
    if (field.type === 'input' || field.type === 'textarea') {
      const value = answer === undefined ? '' : answer;
      if (
        !validString(
          value,
          field.type === 'input'
            ? issueFormLimits.input
            : issueFormLimits.textarea,
          field.type === 'input',
        )
      )
        answerError(path);
      const normalized = value.replace(/\r\n?/g, '\n');
      if (
        (field.validations.required && !normalized.trim()) ||
        (normalized.length > 0 &&
          [...normalized].length < field.validations.min_length)
      )
        answerError(path);
      values[field.id] = normalized;
      generated =
        normalized &&
        field.type === 'textarea' &&
        field.attributes.render !== undefined
          ? fenced(normalized, field.attributes.render)
          : normalized;
    } else if (field.type === 'dropdown') {
      const selected =
        answer === undefined || answer === ''
          ? []
          : field.attributes.multiple
            ? answer
            : [answer];
      if (
        !Array.isArray(selected) ||
        selected.length > field.attributes.options.length ||
        selected.some(
          (v) => typeof v !== 'string' || !field.attributes.options.includes(v),
        ) ||
        new Set(selected).size !== selected.length ||
        (field.validations.required && selected.length === 0)
      )
        answerError(path);
      const ordered = field.attributes.options.filter((v) =>
        selected.includes(v),
      );
      values[field.id] = field.attributes.multiple
        ? ordered
        : (ordered[0] ?? '');
      generated = ordered.map(escapeMarkdownLabel).join(', ');
    } else if (field.type === 'checkboxes') {
      const selected = answer === undefined ? [] : answer;
      if (
        !Array.isArray(selected) ||
        selected.length > field.attributes.options.length ||
        selected.some(
          (v) =>
            typeof v !== 'number' ||
            !Number.isInteger(v) ||
            v < 0 ||
            v >= field.attributes.options.length,
        ) ||
        new Set(selected).size !== selected.length ||
        (field.validations.required && selected.length === 0) ||
        field.attributes.options.some(
          (option, index) => option.required && !selected.includes(index),
        )
      )
        answerError(path);
      const ordered = field.attributes.options
        .map((_, index) => index)
        .filter((index) => selected.includes(index));
      values[field.id] = ordered;
      // Option labels may contain authored Markdown; final content policy still applies.
      generated = field.attributes.options
        .map(
          (option, index) =>
            `- [${ordered.includes(index) ? 'x' : ' '}] ${option.label}`,
        )
        .join('\n');
    } else {
      const selected = answer === undefined ? [] : answer;
      if (
        !Array.isArray(selected) ||
        selected.length > issueFormLimits.attachmentsPerField ||
        new Set(selected).size !== selected.length ||
        (field.validations.required && selected.length === 0)
      )
        answerError(path);
      const ids: string[] = [];
      for (const id of selected) {
        try {
          assertId(id);
        } catch {
          answerError(path);
        }
        ids.push(id);
      }
      ids.sort();
      attachmentIds.push(...ids);
      values[field.id] = ids;
      generated = ids
        .map((id) => `[Attachment](/attachments/${id})`)
        .join('\n');
    }
    if (generated)
      sections.push(
        `### ${escapeMarkdownLabel(field.attributes.label)}\n\n${generated}`,
      );
  }
  if (
    attachmentIds.length > issueFormLimits.attachmentsPerSubmission ||
    new Set(attachmentIds).size !== attachmentIds.length
  )
    answerError('answers');
  const markdown = sections.join('\n\n');
  if (issueFormStorageCharacters(values) > 65536) answerError('answers');
  if (
    [...markdown].length > issueFormLimits.body ||
    new TextEncoder().encode(markdown).length > issueFormLimits.bodyBytes
  )
    answerError('answers');
  return { values, attachmentIds: attachmentIds.sort(), markdown };
}
