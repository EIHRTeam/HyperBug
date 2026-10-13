import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/database/postgres/src/schema.ts',
  out: './packages/database/postgres/migrations',
});
