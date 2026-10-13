export interface ReviewedPluginOrigins {
  readonly id: string;
  readonly connect: readonly string[];
  readonly images: readonly string[];
  readonly frames: readonly string[];
  readonly scripts: readonly string[];
}
export interface ReviewedPluginUI {
  readonly id: string;
  readonly slot: 'instance';
  readonly component: ComponentType;
  readonly origins: ReviewedPluginOrigins;
}

export function validatePluginDescriptors(
  plugins: readonly ReviewedPluginUI[],
): readonly ReviewedPluginUI[] {
  const ids = new Set<string>();
  return Object.freeze(
    plugins.map((plugin) => {
      if (
        !/^[a-z][a-z0-9-]{0,63}$/.test(plugin.id) ||
        ids.has(plugin.id) ||
        plugin.slot !== 'instance' ||
        typeof plugin.component !== 'function' ||
        plugin.origins.id !== plugin.id
      )
        throw new Error('INVALID_TRUSTED_PLUGIN');
      ids.add(plugin.id);
      const checked = (kind: 'connect' | 'images' | 'frames' | 'scripts') => {
        if (plugin.origins[kind].length > 16)
          throw new Error('INVALID_TRUSTED_PLUGIN');
        return Object.freeze([
          ...new Set(plugin.origins[kind].map(publicOrigin)),
        ]);
      };
      return Object.freeze({
        ...plugin,
        origins: Object.freeze({
          id: plugin.id,
          connect: checked('connect'),
          images: checked('images'),
          frames: checked('frames'),
          scripts: checked('scripts'),
        }),
      });
    }),
  );
}
// Only reviewed source imports may enter this list; runtime config cannot add code.
export const reviewedPluginUI = validatePluginDescriptors([]);
export const reviewedPluginOrigins = Object.freeze(
  reviewedPluginUI.map((plugin) => plugin.origins),
);
import type { ComponentType } from 'react';
import { publicOrigin } from './runtime-config.ts';
