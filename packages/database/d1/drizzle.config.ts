import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: './packages/database/d1/src/schema.ts',
  out: './packages/database/d1/migrations',
});
