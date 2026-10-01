import { assertId } from '@hyperbug/domain';

/**
 * Namespaced plugin configuration (PLUGIN-SPEC §§9.5, 10.3). Public values
 * are stored as text; secret values reach this port only as opaque encrypted
 * envelopes produced by the server through the module-03 key provider — the
 * port never sees secret plaintext, and reads return only presence.
 */
export interface PluginSettingRecord {
  /** Stable row identity; secret envelopes bind their context to this uuid. */
  readonly id: string;
  readonly pluginId: string;
  readonly key: string;
  readonly kind: 'public' | 'secret';
  /** Present for public settings; the value as canonical text. */
  readonly publicValue?: string;
  /** Present for secret settings; an opaque encrypted envelope (EncryptedSecret). */
  readonly secretRecord?: unknown;
  readonly updatedAtMs: number;
}

/** The redacted view configuration reads return; secret values never leave storage. */
export interface PluginSettingView {
  readonly key: string;
  readonly kind: 'public' | 'secret';
  readonly value?: string | number | boolean;
  readonly secretPresent?: boolean;
}

export interface PluginSettingsStore {
  /** Upsert one setting row within the plugin's namespace. */
  upsert(record: PluginSettingRecord): Promise<void>;
  /** All settings of one plugin; secrets carry only their envelope. */
  list(pluginId: string): Promise<readonly PluginSettingRecord[]>;
  remove(pluginId: string, key: string): Promise<boolean>;
  /** Remove every setting of the namespace; returns the removed count. */
  removeAll(pluginId: string): Promise<number>;
}

export function validatePluginSettingRecord(record: PluginSettingRecord): void {
  assertId(record.id);
  if (
    typeof record.pluginId !== 'string' ||
    !/^@[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/.test(record.pluginId)
  )
    throw new Error('Invalid plugin settings namespace');
  if (
    typeof record.key !== 'string' ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(record.key)
  )
    throw new Error('Invalid plugin setting key');
  if (record.kind === 'public') {
    if (typeof record.publicValue !== 'string')
      throw new Error('Public setting requires a text value');
    if (record.secretRecord !== undefined)
      throw new Error('Public setting cannot carry a secret envelope');
    if (record.publicValue.length > 4096)
      throw new Error('Public setting value exceeds the bound');
  } else if (record.kind === 'secret') {
    if (record.publicValue !== undefined)
      throw new Error('Secret setting cannot carry a public value');
    if (record.secretRecord === undefined)
      throw new Error('Secret setting requires an encrypted envelope');
  } else throw new Error('Invalid plugin setting kind');
  if (!Number.isSafeInteger(record.updatedAtMs) || record.updatedAtMs < 0)
    throw new Error('Invalid plugin setting timestamp');
}

/** Public text back to its manifest-declared primitive; numbers/booleans canonically. */
export function publicValueOf(
  text: string,
  valueType: 'string' | 'number' | 'boolean',
): string | number | boolean {
  if (valueType === 'string') return text;
  if (valueType === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    throw new Error('Invalid stored boolean setting');
  }
  const value = Number(text);
  if (!Number.isFinite(value))
    throw new Error('Invalid stored numeric setting');
  return value;
}

/** Canonical text for a public value of the declared type. */
export function publicTextOf(value: string | number | boolean): string {
  return typeof value === 'string' ? value : String(value);
}

export function pluginSettingView(
  record: PluginSettingRecord,
  valueType?: 'string' | 'number' | 'boolean',
): PluginSettingView {
  if (record.kind === 'secret')
    return { key: record.key, kind: 'secret', secretPresent: true };
  if (valueType === undefined)
    throw new Error('Public setting view needs the declared value type');
  return {
    key: record.key,
    kind: 'public',
    value: publicValueOf(record.publicValue ?? '', valueType),
  };
}
