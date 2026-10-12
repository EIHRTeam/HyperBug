export interface ReviewedPluginOrigins {
  readonly id: string;
  readonly connect: readonly string[];
  readonly images: readonly string[];
  readonly frames: readonly string[];
  readonly scripts: readonly string[];
}
// Build-time reviewed declarations only. Runtime config cannot add plugins/code.
export const reviewedPluginOrigins: readonly ReviewedPluginOrigins[] =
  Object.freeze([]);
