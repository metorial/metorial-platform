#!/usr/bin/env bun

import { $ } from 'bun';
import fs from 'fs/promises';
import { join } from 'path';

let args = process.argv.slice(2);

if (args[0] == 'start') {
  let command = args.slice(1).join(' ');
  if (!command) {
    console.error('No command provided to run.');
    process.exit(1);
  }

  console.log('1. Preparing DB');

  let dbPackage = join(__dirname, '../../../src/backend/db');

  let pgUser = process.env.PGUSER || 'postgres';
  let pgPassword = process.env.PGPASSWORD || 'postgres';
  let pgHost = process.env.PGHOST || 'localhost';
  let pgPort = process.env.PGPORT || '5432';

  let ephemeralDB = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/mt_oss_${Math.random().toString(36).substring(2, 15)}`;

  await $`bun run prisma db push --skip-generate`
    .env({ DATABASE_URL: ephemeralDB })
    .cwd(dbPackage);

  console.log(`Database prepared at ${ephemeralDB}`);

  console.log('2. Running seeders');

  let currentDir = process.cwd();
  let seedersDir = join(currentDir, '.metorial-test/seed');

  let seeders: string[] = [];

  try {
    seeders = await fs.readdir(seedersDir);
  } catch (error) {}

  for (let seeder of seeders) {
    await $`bun ${join('.metorial-test/seed', seeder)}`
      .env({ DATABASE_URL: ephemeralDB })
      .cwd(currentDir);
  }

  if (!seeders.length) {
    console.log('No seeders found, skipping seeding step.');
  } else {
    console.log(`Seeded with ${seeders.length} seeders.`);
  }

  console.log(`3. Running test command "${command}"`);

  let out = await $`bun run ${{ raw: command }}`.nothrow();

  if (out.exitCode == 0) {
    console.log(`Command "${command}" executed successfully.`);
  } else {
    console.error(`Command "${command}" failed with exit code ${out.exitCode}.`);
    process.exit(out.exitCode);
  }
} else {
  console.error('Invalid command. Use "start" followed by the command to run.');
  process.exit(1);
}
