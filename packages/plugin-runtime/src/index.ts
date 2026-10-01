// Host-side plugin runtime. Core — never plugin authors — imports this
// package to load, validate and orchestrate plugins under the specification's
// policy boundaries. The registry, lifecycle and hook machinery arrive with
// module 05.2; this surface pins the contract version the host enforces.

/** Package identity of the plugin runtime. */
export const PLUGIN_RUNTIME_PACKAGE = '@hyperbug/plugin-runtime' as const;

/** Version of this package, independent of the Plugin API version. */
export const PLUGIN_RUNTIME_VERSION = '1.0.0' as const;

export { PLUGIN_API_PACKAGE, PLUGIN_API_VERSION } from '@hyperbug/plugin-api';
