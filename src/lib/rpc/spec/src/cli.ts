#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from './compile';
import { generateGo, goFileName } from './generate/go';
import { generateTs } from './generate/ts';
import { ServiceSpec } from './spec';

let usage = `Usage: rpc-spec generate <spec.ts> [--go <dir>] [--ts <file>] [--check]

  --go <dir>                Write the Go package (<package>.gen.go) into <dir>
  --ts <file>               Write the TypeScript client types to <file>
  --check                   Write nothing; exit 1 and list files that are out of date
  --ts-client-import <mod>  Module the TS client imports createClient from (default @lowerdeck/rpc-client)
  --ldrpc-import <path>     Go import path of ldrpc`;

export type GenerateArgs = {
  spec: string;
  go?: string;
  ts?: string;
  check: boolean;
  tsClientImport?: string;
  ldrpcImport?: string;
};

export let parseArgs = (argv: string[]): GenerateArgs => {
  let [command, ...rest] = argv;
  if (command != 'generate') throw new Error(usage);

  let args: Partial<GenerateArgs> = { check: false };
  let flags: Record<string, keyof GenerateArgs> = {
    '--go': 'go',
    '--ts': 'ts',
    '--ts-client-import': 'tsClientImport',
    '--ldrpc-import': 'ldrpcImport'
  };

  for (let i = 0; i < rest.length; i++) {
    let arg = rest[i]!;

    if (arg == '--check') {
      args.check = true;
      continue;
    }

    let key = flags[arg];
    if (key) {
      let value = rest[++i];
      if (!value || value.startsWith('--'))
        throw new Error(`${arg} needs a value\n\n${usage}`);
      (args as any)[key] = value;
      continue;
    }

    if (arg.startsWith('--') || args.spec)
      throw new Error(`Unexpected argument ${arg}\n\n${usage}`);
    args.spec = arg;
  }

  if (!args.spec) throw new Error(usage);
  if (!args.go && !args.ts) throw new Error(`Pass --go and/or --ts\n\n${usage}`);

  return args as GenerateArgs;
};

export let loadSpec = async (path: string) => {
  let mod = await import(pathToFileURL(resolve(path)).href);
  let spec = mod.default;

  if (!(spec instanceof ServiceSpec)) {
    let hint = spec?.def?.methods
      ? ' (it looks like one, built by a different copy of @lowerdeck/rpc-spec; make the spec package resolve the workspace copy)'
      : '';
    throw new Error(`${path} must default-export a service() spec${hint}`);
  }

  return spec as ServiceSpec<any>;
};

export let generateFiles = async (args: GenerateArgs) => {
  let ir = compile(await loadSpec(args.spec));
  let files: { path: string; content: string }[] = [];

  if (args.go) {
    files.push({
      path: resolve(args.go, goFileName(ir)),
      content: generateGo(ir, { ldrpcImport: args.ldrpcImport })
    });
  }
  if (args.ts) {
    files.push({
      path: resolve(args.ts),
      content: generateTs(ir, { clientImport: args.tsClientImport })
    });
  }

  return files;
};

let readIfExists = async (path: string) => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
};

export let run = async (argv: string[]) => {
  let args = parseArgs(argv);
  let files = await generateFiles(args);
  let cwd = process.cwd();

  if (args.check) {
    let stale: string[] = [];
    for (let file of files) {
      if ((await readIfExists(file.path)) !== file.content)
        stale.push(relative(cwd, file.path));
    }

    if (stale.length) {
      console.error(
        `Out of date (run rpc-spec generate without --check):\n${stale.map(path => `  ${path}`).join('\n')}`
      );
      return 1;
    }
    return 0;
  }

  for (let file of files) {
    await mkdir(dirname(file.path), { recursive: true });
    if ((await readIfExists(file.path)) === file.content) continue;
    await writeFile(file.path, file.content);
    console.log(`wrote ${relative(cwd, file.path)}`);
  }
  return 0;
};

if (import.meta.main) {
  run(process.argv.slice(2)).then(
    code => process.exit(code),
    error => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  );
}
