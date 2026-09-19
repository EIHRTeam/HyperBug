import { defineConfig } from 'tsdown';
import { appTargets } from './tooling/build-targets.ts';

// Two runtime profiles, two bundling contracts. Both emit ESM only: the
// workspace is `type: module` and neither entry has a CommonJS consumer.
//
// `clean` stays off because `tooling/build.ts` owns `dist/` and also writes the
// workerd test fixtures there. Rolldown's default code splitting is left on, so
// the Worker target may emit shared chunks; `tests/fixtures/worker-modules.ts`
// discovers every emitted module instead of naming one file. The Node entry has
// no dynamic import, so it stays a single file and `tests/node/entry.test.ts`
// asserts that.
export default defineConfig(appTargets.map((target) => target.options));
