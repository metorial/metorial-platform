#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { isEdition, type Edition } from '../edition';
import { buildEdition } from './build';
import { verifyPackageGraph, verifySourceMaps, type Violation } from './verify';
import { readWorkspace } from './workspace';

let usage = `Usage:
  metorial-editions build <entry> --edition <edition> --outdir <dir> [--external a,b] [--minify]
  metorial-editions verify --edition <edition> --entry <package|dir> [--entry ...]
                           [--sourcemaps <dir|file.map> ...] [--deny-package <name> ...] [--root <dir>]`;

let fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

let readEdition = (value: string | undefined): Edition => {
  if (!value || !isEdition(value)) return fail(`--edition is required\n\n${usage}`);
  return value;
};

let runBuild = async (args: string[]) => {
  let { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      outdir: { type: 'string' },
      external: { type: 'string' },
      minify: { type: 'boolean' }
    }
  });

  let [entry] = positionals;
  if (!entry || !values.outdir) return fail(usage);

  let outputs = await buildEdition({
    entry,
    edition: readEdition(values.edition),
    outdir: values.outdir,
    external: values.external?.split(',').filter(Boolean),
    minify: values.minify
  });

  for (let output of outputs) console.log(output);
};

let runVerify = async (args: string[]) => {
  let { values } = parseArgs({
    args,
    options: {
      edition: { type: 'string' },
      entry: { type: 'string', multiple: true },
      sourcemaps: { type: 'string', multiple: true },
      'deny-package': { type: 'string', multiple: true },
      root: { type: 'string' }
    }
  });

  let edition = readEdition(values.edition);
  let workspace = await readWorkspace(values.root ?? process.cwd());
  let violations: Violation[] = [];

  if (values.entry?.length) {
    violations.push(...verifyPackageGraph(workspace, edition, values.entry));
  }

  if (values.sourcemaps?.length) {
    violations.push(
      ...(await verifySourceMaps(
        workspace,
        edition,
        values.sourcemaps,
        values['deny-package']
      ))
    );
  }

  if (!values.entry?.length && !values.sourcemaps?.length) return fail(usage);

  for (let violation of violations) console.error(`[${violation.kind}] ${violation.message}`);

  if (violations.length) process.exit(1);

  console.log(`Edition ${edition}: no violations`);
};

let [command, ...rest] = process.argv.slice(2);

if (command == 'build') await runBuild(rest);
else if (command == 'verify') await runVerify(rest);
else fail(usage);
