import { $ } from 'bun';
import fs from 'fs/promises';
import path from 'path';

let prismaFolder = path.join(process.cwd(), 'prisma');

if ((await fs.stat(prismaFolder)).isDirectory()) {
  let prismaSchemaFiles = await fs.readdir(prismaFolder);

  for (let folder of prismaSchemaFiles) {
    folder = path.join(prismaFolder, folder);
    let isDir = (await fs.stat(folder)).isDirectory();
    if (!isDir || folder.includes('generated')) continue;

    let hasPrismaFile = (await fs.readdir(folder)).some(f => f == 'schema.prisma');
    console.log(`Migrating ${folder}`);
    if (hasPrismaFile) {
      await $`bunx prisma db push --schema ${folder}/schema.prisma --skip-generate --accept-data-loss`;
    } else {
      // We're using multiple schema files
      await $`bunx prisma db push --schema ${folder}/schema --skip-generate --accept-data-loss`;
    }
  }
} else {
  console.log('No prisma folder found - skipping migration');
}
