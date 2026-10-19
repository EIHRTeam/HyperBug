import {
  issueFormStorageCharacters,
  normalizeIssueFormDefinition,
} from '@hyperbug/application';

/** Exactly the shared stored-character ceiling, including jsonb separator spaces. */
export function nearLimitIssueFormDefinition(extra = 0) {
  const base = normalizeIssueFormDefinition({
    name: 'Storage boundary',
    description: 'Quotes: " :, \\ and separators',
    body: Array.from({ length: 4 }, (_, index) => ({
      type: 'textarea',
      id: `field-${index}`,
      attributes: { label: `Field ${index}` },
    })),
  });
  let remaining = 65536 - issueFormStorageCharacters(base) + extra;
  return {
    ...base,
    body: base.body.map((field) => {
      if (field.type !== 'textarea')
        throw new Error('Unexpected fixture field');
      const length = Math.min(16384, remaining);
      remaining -= length;
      return {
        ...field,
        attributes: { ...field.attributes, value: 'x'.repeat(length) },
      };
    }),
  };
}
