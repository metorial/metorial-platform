import 'dotenv/config';
import { defineConfig } from 'prisma/config';

let databaseUrl = process.env.DATABASE_URL;

if (
  !databaseUrl &&
  process.env.DATABASE_USERNAME &&
  process.env.DATABASE_PASSWORD &&
  process.env.DATABASE_HOST &&
  process.env.DATABASE_PORT &&
  process.env.DATABASE_NAME
) {
  databaseUrl = `postgres://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL']
  }
});
