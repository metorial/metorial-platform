import 'dotenv/config';
import { defineConfig } from 'prisma/config';

let databaseUrl = process.env.DATABASE_URL;

if (
  !databaseUrl &&
  process.env.CORE_DB_USERNAME &&
  process.env.CORE_DB_PASSWORD &&
  process.env.CORE_DB_HOST &&
  process.env.CORE_DB_PORT &&
  process.env.CORE_DB_NAME
) {
  databaseUrl = `postgres://${process.env.CORE_DB_USERNAME}:${process.env.CORE_DB_PASSWORD}@${process.env.CORE_DB_HOST}:${process.env.CORE_DB_PORT}/${process.env.CORE_DB_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;
}

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
