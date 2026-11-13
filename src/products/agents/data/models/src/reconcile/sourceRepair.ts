import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { requirePrices } from '../sources/pricing';
import { pricingSources, type PricingFailure, type PricingSource } from '../sources/providers';
import { sandboxCommand, sourceDirectory } from './sandbox';
import { providerTestCommand } from './sourceTools';
import { parseWith } from '../lib/validate';
import { v } from '@lowerdeck/validation';

let exec = promisify(execFile);
let maxRepairAttempts = 3;
let maxFolderBytes = 10 * 1024 * 1024;
let replaySchema = v.object({ data: v.array(v.any()), issues: v.array(v.string()) });

export interface SourceRepair {
  source: string;
  file: string;
  files: string[];
}

type FolderSnapshot = Map<string, { content: Buffer; mode: number }>;

export let snapshotSourceFolder = async (directory: string): Promise<FolderSnapshot> => {
  if ((await realpath(directory)) !== directory || !(await lstat(directory)).isDirectory())
    throw new Error('Provider folder must not traverse a symlink');
  let files: FolderSnapshot = new Map();
  let bytes = 0;
  let visit = async (dir: string) => {
    for (let entry of await readdir(dir, { withFileTypes: true })) {
      let file = path.join(dir, entry.name);
      let stat = await lstat(file);
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
        throw new Error('Provider folders cannot contain symlinks or hardlinks');
      if (stat.isDirectory()) await visit(file);
      else {
        if (!stat.isFile()) throw new Error('Provider folders may contain only regular files');
        bytes += stat.size;
        if (bytes > maxFolderBytes)
          throw new Error('Provider repair folder exceeds the size limit');
        files.set(path.relative(directory, file), {
          content: await readFile(file),
          mode: stat.mode
        });
      }
    }
  };
  await visit(directory);
  return files;
};

let restoreFolder = async (directory: string, snapshot: FolderSnapshot) => {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  for (let [relative, file] of snapshot) {
    let target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
    await chmod(target, file.mode);
  }
};

export let changedSourceFiles = (
  directory: string,
  before: FolderSnapshot,
  after: FolderSnapshot
) =>
  [...new Set([...before.keys(), ...after.keys()])]
    .filter(
      file =>
        !before.get(file)?.content.equals(after.get(file)?.content ?? Buffer.alloc(0)) ||
        before.get(file)?.mode !== after.get(file)?.mode
    )
    .map(file => path.join(directory, file));

export let validateSourceRepair = async (
  source: PricingSource,
  packageDir: string,
  raw: unknown,
  now: string,
  scratch: string
) => {
  let directory = sourceDirectory(packageDir, source.file);
  let environment = {
    PATH: process.env.PATH ?? '',
    HOME: scratch,
    NO_COLOR: '1'
  };
  for (let suite of ['provider', 'typecheck', 'all']) {
    let command = await sandboxCommand({
      command: 'bun',
      args: providerTestCommand(packageDir, directory, suite),
      writable: [directory],
      scratch
    });
    await exec(command.command, command.args, {
      cwd: packageDir,
      env: { ...environment, ...command.env },
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024
    });
  }

  let command = await sandboxCommand({
    command: 'bun',
    args: [
      path.join(import.meta.dirname, 'replaySource.ts'),
      path.resolve(packageDir, source.file),
      source.exportName
    ],
    writable: [],
    scratch
  });
  let parse: PricingSource['parse'] = (response, at) => {
    let output = execFileSync(command.command, command.args, {
      cwd: packageDir,
      env: { ...environment, ...command.env },
      input: JSON.stringify({ raw: response, now: at }),
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024
    });
    let result = parseWith(replaySchema, JSON.parse(output), 'repaired pricing result');
    let checked = requirePrices(
      result.data as Parameters<typeof requirePrices>[0],
      source.kind
    );
    return { data: checked.data, issues: [...result.issues, ...checked.issues] };
  };
  parse(raw, now);
  return parse;
};

export let repairPricingSources = async (d: {
  failures: PricingFailure[];
  packageDir: string;
  run: (
    failure: PricingFailure,
    source: PricingSource,
    attempt: number
  ) => Promise<{ exitCode: number; testCalls: number }>;
  validate: (source: PricingSource, raw: unknown) => Promise<PricingSource['parse']>;
}) => {
  let packageDir = await realpath(d.packageDir);
  let repairs: SourceRepair[] = [];
  let seen = new Set<string>();
  let originals: {
    source: PricingSource;
    directory: string;
    snapshot: FolderSnapshot;
    parse: PricingSource['parse'];
  }[] = [];

  try {
    for (let failure of d.failures) {
      if (seen.has(failure.source))
        throw new Error(`Duplicate repair request for ${failure.source}`);
      seen.add(failure.source);
      let source = pricingSources.find(source => source.kind === failure.source);
      if (!source || failure.raw === undefined)
        throw new Error(`No repairable response for ${failure.source}`);
      let directory = sourceDirectory(packageDir, source.file);
      if (!directory.startsWith(`${packageDir}${path.sep}src${path.sep}sources${path.sep}`))
        throw new Error('Invalid provider repair directory');
      let snapshot = await snapshotSourceFolder(directory);
      originals.push({ source, directory, snapshot, parse: source.parse });

      let feedback = failure;
      let accepted = false;
      for (let attempt = 0; attempt < maxRepairAttempts; attempt++) {
        try {
          try {
            await snapshotSourceFolder(directory);
          } catch {
            await restoreFolder(directory, snapshot);
          }
          let session = await d.run(feedback, source, attempt);
          if (session.exitCode !== 0)
            throw new Error(`Repair agent exited with ${session.exitCode}`);
          if (!session.testCalls)
            throw new Error(
              'Run the provider tests with the test tool before ending the session'
            );
          let after = await snapshotSourceFolder(directory);
          let changed = changedSourceFiles(directory, snapshot, after);
          if (!changed.length) throw new Error('Repair did not change its provider folder');
          let parse = await d.validate(source, failure.raw);
          changed = changedSourceFiles(
            directory,
            snapshot,
            await snapshotSourceFolder(directory)
          );
          if (!changed.length) throw new Error('Verification removed the provider repair');
          source.parse = parse;
          repairs.push({
            source: source.kind,
            file: source.file,
            files: changed.map(file => path.relative(packageDir, file))
          });
          accepted = true;
          break;
        } catch (error) {
          if (attempt + 1 === maxRepairAttempts) throw error;
          let output = error as Error & { stdout?: string; stderr?: string };
          let problem =
            `${output.message}\n${output.stdout ?? ''}\n${output.stderr ?? ''}`.slice(-12000);
          feedback = {
            ...failure,
            problems: [
              ...failure.problems,
              `Host verification failed. Fix the current files and rerun tests:\n${problem}`
            ]
          };
        }
      }
      if (!accepted) throw new Error(`${source.kind}: source repair was not accepted`);
    }
    return repairs;
  } catch (error) {
    for (let original of originals.reverse()) {
      await restoreFolder(original.directory, original.snapshot);
      original.source.parse = original.parse;
    }
    throw error;
  }
};
