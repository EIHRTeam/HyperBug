import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { InstanceDocumentSchema } from '@hyperbug/contracts';

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: '19' })] }),
    tailwindcss(),
    {
      name: 'hyperbug-public-instance-contract',
      resolveId(id) {
        if (id === 'virtual:hyperbug-instance-contract')
          return '\0hyperbug-instance-contract';
      },
      load(id) {
        if (id === '\0hyperbug-instance-contract')
          return `export default ${JSON.stringify(InstanceDocumentSchema)}`;
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'baseline-widely-available',
    outDir: 'dist',
    assetsDir: 'assets',
    manifest: true,
    sourcemap: false,
    cssCodeSplit: true,
  },
  server: { host: '127.0.0.1' },
});
