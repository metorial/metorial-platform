import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from 'smol-toml';
import type { ControlConfig } from './types';

export let SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.nx',
  '.control',
  'out',
  'generated',
  'build',
  '.next',
  'coverage',
  '.cache',
  'vendor',
  'target'
]);

export let discoverControlFiles = (root: string): string[] => {
  let results: string[] = [];

  let walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (let entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      let full = join(dir, entry);
      let stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry === 'control.toml') results.push(full);
    }
  };

  walk(root);
  return results.sort();
};

export let loadControlConfigSync = (controlFile: string): ControlConfig => {
  let text = readFileSync(controlFile, 'utf8');
  return parse(text) as ControlConfig;
};
