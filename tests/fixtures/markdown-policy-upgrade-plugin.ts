import type { Plugin } from 'rolldown';

/** Test-only replacement bundle. Never make production policy configurable. */
export function markdownPolicyUpgradePlugin(): Plugin {
  let changed = false;
  return {
    name: 'hyperbug-test-markdown-policy-upgrade',
    transform: {
      filter: {
        id: { include: /packages\/security\/src\/markdown\/index\.ts$/ },
      },
      order: 'pre',
      handler(code) {
        const version = /(['"])hyperbug-content-1\1/g;
        const removedTag = /^\s*(['"])del\1,?\s*$/gm;
        if (
          [...code.matchAll(version)].length !== 1 ||
          [...code.matchAll(removedTag)].length !== 1
        )
          throw new Error(
            'Policy replacement fixture no longer matches the reviewed source',
          );
        changed = true;
        return {
          code: code
            .replace(version, "'hyperbug-content-test-2'")
            .replace(removedTag, ''),
          map: null,
        };
      },
    },
    buildEnd(error) {
      if (!error && !changed)
        throw new Error('Policy replacement module was not bundled');
    },
  };
}
