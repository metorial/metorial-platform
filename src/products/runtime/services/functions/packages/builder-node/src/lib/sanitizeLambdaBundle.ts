import fs from 'fs/promises';
import path from 'path';

let sourcemapRegisterImportPattern =
  /^import\s+['"]\.\/?sourcemap-register\.cjs['"];?\s*/m;

export let stripSourcemapRegisterImports = (content: string) =>
  content.replace(sourcemapRegisterImportPattern, '');

export let sanitizeLambdaBundle = async (directory: string) => {
  let packageJsonPath = path.join(directory, 'package.json');

  try {
    let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as {
      type?: string;
    };

    if (packageJson.type === 'module') {
      delete packageJson.type;
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    }
  } catch {}

  try {
    await fs.unlink(path.join(directory, 'sourcemap-register.cjs'));
  } catch {}

  let entries = await fs.readdir(directory);

  for (let entry of entries) {
    if (!entry.endsWith('.js')) continue;

    let filePath = path.join(directory, entry);

    try {
      let content = await fs.readFile(filePath, 'utf-8');
      let sanitized = stripSourcemapRegisterImports(content);

      if (sanitized !== content) {
        await fs.writeFile(filePath, sanitized, 'utf-8');
      }
    } catch {}
  }
};
