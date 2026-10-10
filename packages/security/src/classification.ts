export type DataClassification = 'public' | 'personal' | 'sensitive' | 'secret';

/** Coarse minimums; feature-specific policy can require stricter protection. */
export const dataProtection = Object.freeze({
  public: Object.freeze({
    sharedCache: 'explicit-anonymous-only',
    diagnostics: 'allowlisted-metadata-only',
    storage: 'canonical-plaintext-permitted',
  }),
  personal: Object.freeze({
    sharedCache: 'forbidden',
    diagnostics: 'minimized-identifiers-only',
    storage: 'minimize-and-protect-by-purpose',
  }),
  sensitive: Object.freeze({
    sharedCache: 'forbidden',
    diagnostics: 'forbidden',
    storage: 'controlled-access-and-encryption-by-purpose',
  }),
  secret: Object.freeze({
    sharedCache: 'forbidden',
    diagnostics: 'forbidden',
    storage: 'keyed-digest-or-envelope-encryption-or-secret-store',
  }),
} satisfies Record<
  DataClassification,
  { sharedCache: string; diagnostics: string; storage: string }
>);
