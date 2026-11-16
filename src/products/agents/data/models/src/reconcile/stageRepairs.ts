import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { v } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';
import { pricingSources } from '../sources/providers';
import { repoRoot } from './workspace';

let packageDir = path.resolve(import.meta.dirname, '..', '..');
let root = await repoRoot(packageDir);
let manifest = process.argv[2];
if (!manifest) throw new Error('A source repair manifest is required');

let repairs = parseWith(
  v.array(v.object({ source: v.string(), file: v.string(), files: v.array(v.string()) })),
  JSON.parse(await readFile(manifest, 'utf8')),
  'source repairs'
);
let files = repairs.flatMap(repair => {
  let source = pricingSources.find(source => source.kind === repair.source);
  if (!source || source.file !== repair.file)
    throw new Error('Source repair manifest contains an unauthorized file');
  let directory = path.dirname(source.file);
  if (
    repair.files.some(
      file => path.normalize(file) !== file || !file.startsWith(`${directory}/`)
    )
  )
    throw new Error('Repair manifest escapes its provider folder');
  return repair.files.map(file => path.relative(root, path.join(packageDir, file)));
});

if (files.length) execFileSync('git', ['-C', root, 'add', '--', ...files]);
