import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    // These will be overridden by wrangler during migrations
    accountId: 'placeholder',
    databaseId: 'placeholder',
    token: 'placeholder',
  },
});