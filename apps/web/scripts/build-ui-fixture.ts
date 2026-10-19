import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';
import config from '../vite.config.ts';

// Explicit separate test artifact; production build has only index.html.
const root = fileURLToPath(new URL('../', import.meta.url));
await build({
  ...config,
  root,
  configFile: false,
  build: {
    ...config.build,
    outDir: resolve(process.argv[2] ?? '/tmp/hyperbug-module11-ui'),
    rolldownOptions: { input: resolve(root, 'fixtures/ui.html') },
  },
});
