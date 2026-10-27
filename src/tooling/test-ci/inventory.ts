import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { v, type ValidationTypeValue } from '../../lowerdeck/packages/validation/src';

let discoveredInventory: Inventory | undefined;

export let imageDefinitionFields = {
  name: v.string(),
  group: v.enumOf(['enterprise', 'oss', 'horizon', 'external']),
  package: v.string(),
  dockerfile: v.string(),
  workspace: v.string(),
  image: v.string(),
  ecr: v.string(),
  canonical: v.string(),
  source: v.nullable(v.string()),
  platform: v.literal('linux/amd64'),
  stagingOnly: v.boolean(),
  tested: v.boolean(),
  manifest: v.string()
};

export let inventorySchema = v.object({
  version: v.literal(1),
  infrastructure: v.array(v.string()),
  images: v.array(v.object(imageDefinitionFields)),
  suites: v.array(
    v.object({
      name: v.string(),
      package: v.string(),
      runner: v.enumOf(['control', 'compose']),
      groups: v.number(),
      workspacePackages: v.array(v.string()),
      profiles: v.array(v.string()),
      directory: v.string(),
      workspace: v.string(),
      services: v.array(v.string()),
      images: v.array(v.string()),
      manifests: v.array(v.string()),
      tests: v.array(v.object({ name: v.string(), directory: v.string() }))
    })
  )
});

export type Inventory = ValidationTypeValue<typeof inventorySchema>;

export type ImageDefinition = Inventory['images'][number];

export type SuiteDefinition = Inventory['suites'][number];

export let parseInventory = (value: unknown): Inventory => {
  let parsed = inventorySchema.validate(value);
  if (!parsed.success) throw new Error('Invalid control CI inventory');

  return parsed.value;
};

export let readInventory = (): Inventory => {
  let path =
    process.env.CONTROL_CI_INVENTORY ??
    (process.env.RUNNER_TEMP
      ? resolve(process.env.RUNNER_TEMP, 'backend-inventory.json')
      : undefined);
  if (path && existsSync(path)) return parseInventory(JSON.parse(readFileSync(path, 'utf8')));
  if (process.env.CI) throw new Error(`Missing generated control CI inventory: ${path}`);
  if (discoveredInventory) return discoveredInventory;

  let crate = resolve(import.meta.dir, '../../control/Cargo.toml');
  let result = Bun.spawnSync(
    [
      'cargo',
      'run',
      '--quiet',
      '--locked',
      '--manifest-path',
      crate,
      '--',
      '--root',
      resolve(import.meta.dir, '../../..'),
      'ci',
      'describe',
      '--json'
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (result.exitCode) throw new Error(result.stderr.toString());

  discoveredInventory = parseInventory(JSON.parse(result.stdout.toString()));
  return discoveredInventory;
};
