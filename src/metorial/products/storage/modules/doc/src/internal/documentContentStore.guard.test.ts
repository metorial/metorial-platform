import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

let metorialRoot = resolve(__dirname, '../../../../../..');
let storeFile = resolve(__dirname, 'documentContentStore.ts');
let skippedDirectories = new Set(['node_modules', 'dist', 'generated', '.turbo', 'build']);
let rawWritePattern =
  /\.documentContent\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert)\s*\(/;

let listSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) {
      return skippedDirectories.has(entry.name)
        ? []
        : listSourceFiles(join(directory, entry.name));
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [join(directory, entry.name)]
      : [];
  });

describe('DocumentContent writers', () => {
  it('only documentContentStore writes DocumentContent rows', () => {
    let files = listSourceFiles(metorialRoot);
    expect(files).toContain(storeFile);
    expect(rawWritePattern.test(readFileSync(storeFile, 'utf8'))).toBe(true);

    let offenders = files
      .filter(file => file !== storeFile)
      .filter(file => rawWritePattern.test(readFileSync(file, 'utf8')))
      .map(file => relative(metorialRoot, file));

    expect(offenders).toEqual([]);
  });
});
