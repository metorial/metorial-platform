#!/usr/bin/env bun

import { $ } from 'bun';
import fs from 'fs/promises';
import path from 'path';

let rootDir = path.resolve(import.meta.dir, '../../..');
let workspaceRoots = [
  'clients/metorial-consumer',
  'clients/metorial-dashboard',
  'src/backend',
  'src/frontend',
  'src/packages'
];

let collectPackageJsonFiles = async (dir: string): Promise<string[]> => {
  let entries = await fs.readdir(dir, { withFileTypes: true });
  let files: string[] = [];

  for (let entry of entries) {
    let fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...(await collectPackageJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name === 'package.json') {
      files.push(fullPath);
    }
  }

  return files;
};

let testPackages: string[] = [];

for (let workspaceRoot of workspaceRoots) {
  let absoluteRoot = path.join(rootDir, workspaceRoot);
  let packageJsonFiles = await collectPackageJsonFiles(absoluteRoot);

  for (let packageJsonFile of packageJsonFiles) {
    let packageJson = JSON.parse(await fs.readFile(packageJsonFile, 'utf8'));
    let testScript = packageJson?.scripts?.test;

    if (!testScript) continue;
    if (testScript.includes('Error: no test specified')) continue;
    if (packageJson?.workspaces) continue;

    testPackages.push(path.dirname(packageJsonFile));
  }
}

testPackages.sort();

for (let packageDir of testPackages) {
  let relativeDir = path.relative(rootDir, packageDir);
  console.log(`Running tests in ${relativeDir}`);
  await $`bun run test`.cwd(packageDir);
}
