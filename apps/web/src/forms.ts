// Form state belongs to TanStack Form; product forms remain Module 12.
export { useForm } from '@tanstack/react-form';

// Multiple validation timings may carry the same message; present it once.
export function fieldErrorText(errors: readonly (string | undefined)[]) {
  return [
    ...new Set(errors.filter((error): error is string => Boolean(error))),
  ].join(' ');
}
