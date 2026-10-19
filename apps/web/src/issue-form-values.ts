import type { OperationTypes } from '@hyperbug/api-client';
export type FormDocument =
  OperationTypes['GET /api/v1/projects/{projectId}/forms/{definitionId}']['response'];
export type FormField = FormDocument['definition']['body'][number];
export type Answer = string | string[] | number[];
export function initialAnswers(document: FormDocument): Record<string, Answer> {
  return Object.fromEntries(
    document.definition.body
      .filter((field) => field.type !== 'markdown')
      .map((field) => [
        field.id,
        field.type === 'input' || field.type === 'textarea'
          ? field.attributes.value
          : field.type === 'dropdown' && field.attributes.default !== undefined
            ? field.attributes.multiple
              ? [field.attributes.options[field.attributes.default]!]
              : field.attributes.options[field.attributes.default]!
            : field.type === 'dropdown' && !field.attributes.multiple
              ? ''
              : [],
      ]),
  );
}
export function answerError(
  field: FormField,
  value: Answer | undefined,
): string | undefined {
  if (field.type === 'markdown') return undefined;
  if (field.type === 'input' || field.type === 'textarea') {
    if (typeof value !== 'string') return 'Enter text.';
    if (field.validations.required && !value.trim())
      return 'This field is required.';
    if ([...value].length < field.validations.min_length && value.length)
      return `Enter at least ${field.validations.min_length} characters.`;
    const maximum = field.type === 'input' ? 1024 : 16384;
    if ([...value].length > maximum)
      return `Use at most ${maximum} characters.`;
    if (field.type === 'input' && /[\r\n]/u.test(value))
      return 'Use one line of text.';
  } else if (field.type === 'dropdown' && !field.attributes.multiple) {
    if (
      typeof value !== 'string' ||
      (value && !field.attributes.options.includes(value))
    )
      return 'Choose a supported option.';
    if (field.validations.required && !value) return 'Choose a value.';
  } else {
    if (!Array.isArray(value)) return 'Choose a value.';
    if (field.validations.required && !value.length)
      return 'Choose at least one value.';
    if (
      field.type === 'checkboxes' &&
      field.attributes.options.some(
        (option, index) =>
          option.required && !(value as number[]).includes(index),
      )
    )
      return 'Select each required checkbox.';
  }
  return undefined;
}
