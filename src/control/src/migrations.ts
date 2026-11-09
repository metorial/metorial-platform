import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { prismaVersion } from './dockerfile/components';
import { atomicWrite, canonical, within } from './files';
import { discover } from './manifest';
import { discoverPackages } from './packages';
import type { LoadedManifest, ProjectRoot } from './types';

export let snapshotName = 'schema.snapshot.prisma';

let baselineName = '0_init';

let lockName = 'migration_lock.toml';

let ignoredFiles = new Set([snapshotName, lockName]);

let placeholderUrl = 'postgresql://static:static@127.0.0.1:1/static';

let excludedDirectories = ['src/sandbox'];

let ignoredSchemaDirectories = new Set(['generated', 'node_modules', 'migrations']);

export interface MigrationTarget {
  name: string;
  package: string;
  directory: string;
  schema: string;
  migrations: string;
  owners: string[];
}

export interface Problem {
  target: string;
  message: string;
}

let usage = 'control db migration create [DATABASE] <NAME>';

export let migrationTargets = (project: ProjectRoot): MigrationTarget[] => {
  let packages = discoverPackages(project.root);
  let manifests: LoadedManifest[] = discover(project.root, { stackOnly: true });
  let targets = new Map<string, MigrationTarget>();

  for (let loaded of manifests) {
    let builds = [
      ...loaded.manifest.ci.images.flatMap(image => (image.build ? [image.build] : [])),
      ...loaded.manifest.ci.dockerfiles.map(item => item.build)
    ];

    for (let build of builds) {
      for (let migration of build.migrations) {
        let owner = packages.find(item => item.name === migration.package);
        if (!owner) throw new Error(`unknown migration package ${migration.package}`);

        let excluded = excludedDirectories.some(path =>
          within(resolve(project.root, path), canonical(owner!.directory))
        );
        if (excluded) continue;

        let schema = resolve(owner.directory, migration.path);
        let key = `${migration.package}\0${schema}`;
        let existing = targets.get(key);

        if (existing) {
          if (!existing.owners.includes(loaded.directory))
            existing.owners.push(loaded.directory);
          continue;
        }

        targets.set(key, {
          name: migration.name,
          package: migration.package,
          directory: owner.directory,
          schema,
          migrations: join(dirname(schema), 'migrations'),
          owners: [loaded.directory]
        });
      }
    }
  }

  return [...targets.values()].sort((a, b) => a.name.localeCompare(b.name));
};

let schemaFilesOf = (path: string): string[] => {
  if (!statSync(path).isDirectory()) return [path];

  return readdirSync(path, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap(entry => {
      let child = join(path, entry.name);

      if (entry.isDirectory())
        return ignoredSchemaDirectories.has(entry.name) ? [] : schemaFilesOf(child);

      return entry.name.endsWith('.prisma') ? [child] : [];
    });
};

export let currentSchema = (target: MigrationTarget) =>
  schemaFilesOf(target.schema)
    .map(file => readFileSync(file, 'utf8'))
    .join('\n');

export let snapshotPath = (target: MigrationTarget) => join(target.migrations, snapshotName);

export let writeSnapshot = (target: MigrationTarget) =>
  atomicWrite(snapshotPath(target), currentSchema(target));

export let migrationFolders = (target: MigrationTarget) =>
  existsSync(target.migrations)
    ? readdirSync(target.migrations, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort()
    : [];

let prismaBinary = (directory: string) => {
  if (process.env.PRISMA_BIN) return [process.env.PRISMA_BIN];

  let current = resolve(directory);

  while (true) {
    let path = join(current, 'node_modules', '.bin', 'prisma');
    if (existsSync(path)) return [path];

    let parent = dirname(current);
    if (parent === current) return ['bunx', `prisma@${prismaVersion}`];
    current = parent;
  }
};

interface DiffResult {
  changed: boolean;
  script: string;
  error?: string;
}

let diff = (target: MigrationTarget, script: boolean): DiffResult => {
  let directory = mkdtempSync(join(tmpdir(), 'control-migrations-'));

  try {
    let config = join(directory, 'prisma.config.mjs');
    atomicWrite(
      config,
      `export default { schema: ${JSON.stringify(target.schema)}, datasource: { url: ${JSON.stringify(placeholderUrl)} } };\n`
    );

    let command = [
      ...prismaBinary(target.directory),
      'migrate',
      'diff',
      '--from-schema',
      snapshotPath(target),
      '--to-schema',
      target.schema,
      '--config',
      config,
      ...(script ? ['--script'] : ['--exit-code'])
    ];
    let result = Bun.spawnSync(command, {
      cwd: target.directory,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore'
    });
    let stdout = result.stdout.toString();

    if (script)
      return result.exitCode === 0
        ? {
            changed: true,
            script: stdout
              .split('\n')
              .filter(line => !line.startsWith('Loaded Prisma config'))
              .join('\n')
              .trim()
          }
        : { changed: false, script: '', error: result.stderr.toString() || stdout };

    if (result.exitCode === 0) return { changed: false, script: '' };
    if (result.exitCode === 2) return { changed: true, script: '' };

    return { changed: false, script: '', error: result.stderr.toString() || stdout };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

let git = (directory: string, args: string[]) => {
  let result = Bun.spawnSync(['git', '-C', directory, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore'
  });

  return {
    ok: result.exitCode === 0,
    output: result.stdout.toString(),
    error: result.stderr.toString().trim()
  };
};

let historyProblems = (target: MigrationTarget, base: string): string[] => {
  if (!existsSync(target.migrations)) return [];

  if (!git(target.migrations, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).ok) {
    console.warn(
      `${target.name}: ${base} does not exist in this repository, skipping the history check`
    );

    return [];
  }

  let mergeBase = git(target.migrations, ['merge-base', 'HEAD', base]);
  if (!mergeBase.ok)
    throw new Error(
      `cannot compare ${target.name} migrations against ${base}: ${mergeBase.error || 'no merge base'}`
    );

  let changes = git(target.migrations, [
    'diff',
    '--name-status',
    '--no-renames',
    '--relative',
    mergeBase.output.trim(),
    '--',
    '.'
  ]);
  if (!changes.ok) throw new Error(`git diff failed for ${target.name}: ${changes.error}`);

  let entries = changes.output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      let [status, path] = line.split('\t');

      return { status: status!, path: path! };
    });

  let rebaselined = entries.some(
    entry => entry.status === 'A' && entry.path === `${baselineName}/migration.sql`
  );

  let problems = rebaselined
    ? []
    : entries
        .filter(entry => entry.status !== 'A')
        .filter(entry => entry.path.includes('/') && !ignoredFiles.has(entry.path))
        .map(
          entry =>
            `existing migration ${entry.path} was ${entry.status === 'D' ? 'deleted' : 'modified'} (applied migrations are immutable, add a new migration instead)`
        );

  let snapshotChanged = entries.some(entry => entry.path === snapshotName);
  let migrationAdded = entries.some(entry => entry.status === 'A' && entry.path.includes('/'));
  if (snapshotChanged && !migrationAdded)
    problems.push(`${snapshotName} changed without a new migration being added`);

  return problems;
};

export let checkTarget = (target: MigrationTarget, base?: string): string[] => {
  let fix = `Run \`control db migration create ${target.name} <name>\` to generate the migration.`;

  if (!migrationFolders(target).length)
    return [
      `${relative(process.cwd(), target.migrations)} has no migrations. Generate the initial migration with \`prisma migrate diff --from-empty --to-schema ${relative(target.directory, target.schema)} --script\`.`
    ];

  let problems: string[] = [];

  for (let folder of migrationFolders(target))
    if (!existsSync(join(target.migrations, folder, 'migration.sql')))
      problems.push(`migration ${folder} has no migration.sql`);

  if (!existsSync(snapshotPath(target))) {
    problems.push(
      `${snapshotName} is missing from ${relative(process.cwd(), target.migrations)}`
    );

    return problems;
  }

  let result = diff(target, false);
  if (result.error) problems.push(`schema comparison failed: ${result.error.trim()}`);
  else if (result.changed)
    problems.push(`the Prisma schema changed since the last migration. ${fix}`);

  if (base) problems.push(...historyProblems(target, base));

  return problems;
};

export let check = (project: ProjectRoot, selectors: string[], base?: string) => {
  let targets = migrationTargets(project);
  let selected = selectors.length
    ? targets.filter(target =>
        selectors.some(item => item === target.name || item === target.package)
      )
    : targets;

  for (let selector of selectors)
    if (!selected.some(target => target.name === selector || target.package === selector))
      throw new Error(
        `unknown database ${selector} (known: ${targets.map(t => t.name).join(', ')})`
      );

  let problems: Problem[] = selected.flatMap(target =>
    checkTarget(target, base).map(message => ({ target: target.name, message }))
  );

  return { checked: selected, problems };
};

export let resolveTarget = (
  project: ProjectRoot,
  start: string,
  name: string | undefined
): MigrationTarget => {
  let targets = migrationTargets(project);
  let names = targets.map(target => target.name).join(', ');

  if (name) {
    let match = targets.find(target => target.name === name || target.package === name);
    if (!match) throw new Error(`unknown database ${name} (known: ${names})`);

    return match;
  }

  let here = canonical(start);
  let inside = targets.filter(target => within(canonical(target.directory), here));
  let candidates = inside.length
    ? inside
    : targets.filter(target => target.owners.some(owner => within(canonical(owner), here)));

  if (candidates.length === 1) return candidates[0]!;

  if (candidates.length > 1)
    throw new Error(
      `${candidates.length} databases match this directory (${candidates.map(t => t.name).join(', ')}). Specify one: ${usage}`
    );

  throw new Error(`this directory has no database. Specify one: ${usage} (known: ${names})`);
};

let timestamp = (date: Date) => date.toISOString().replace(/[-:T]/g, '').slice(0, 14);

export let migrationSlug = (name: string) => {
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!/^[a-z][a-z0-9_]*$/.test(slug))
    throw new Error(
      `invalid migration name ${JSON.stringify(name)}, use letters, digits and underscores`
    );

  return slug;
};

export let createMigration = (target: MigrationTarget, name: string, now = new Date()) => {
  let slug = migrationSlug(name);

  if (!existsSync(snapshotPath(target)))
    throw new Error(`${snapshotName} is missing for ${target.name}, cannot compute a diff`);

  let result = diff(target, true);
  if (result.error) throw new Error(`schema comparison failed: ${result.error.trim()}`);

  let detected = diff(target, false);
  if (detected.error) throw new Error(`schema comparison failed: ${detected.error.trim()}`);
  if (!detected.changed)
    throw new Error(`the ${target.name} schema has no changes since the last migration`);

  let folder = `${timestamp(now)}_${slug}`;
  let directory = join(target.migrations, folder);
  if (existsSync(directory)) throw new Error(`${directory} already exists`);

  mkdirSync(directory, { recursive: true });
  atomicWrite(join(directory, 'migration.sql'), `${result.script}\n`);
  writeSnapshot(target);

  return { folder, path: directory.split(sep).join('/') };
};

export let runCheck = (project: ProjectRoot, selectors: string[], base?: string) => {
  let { checked, problems } = check(project, selectors, base);

  if (problems.length) {
    for (let problem of problems) console.error(`${problem.target}: ${problem.message}`);

    throw new Error(
      `${new Set(problems.map(problem => problem.target)).size} database(s) have migration problems`
    );
  }

  console.log(`${checked.length} database migration set(s) match their schemas`);
};

export let runMigration = (project: ProjectRoot, start: string, positional: string[]) => {
  let [action, ...rest] = positional;
  if (action !== 'create') throw new Error(`unknown migration command, usage: ${usage}`);

  let name = rest.pop();
  if (!name || rest.length > 1) throw new Error(`usage: ${usage}`);

  let target = resolveTarget(project, start, rest[0]);
  let created = createMigration(target, name);

  console.log(`created ${created.path} for ${target.name}`);
};
