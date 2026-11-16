import 'dotenv/config';
import { defineConfig } from 'prisma/config';

let databaseUrl = process.env.GLOBAL_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL']
  }
});
