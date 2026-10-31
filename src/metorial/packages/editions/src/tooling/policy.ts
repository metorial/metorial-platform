import { readFile } from 'node:fs/promises';
import type { EgressPolicy } from './egress';

export type EditionPolicy = {
  denyPackages?: string[];
  denyWorkspacePackages?: string[];
  egress?: EgressPolicy;
};

export let readPolicy = async (path: string): Promise<EditionPolicy> =>
  JSON.parse(await readFile(path, 'utf8'));
