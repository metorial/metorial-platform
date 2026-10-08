import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
  chmodSync,
  symlinkSync,
  rmSync
} from 'node:fs';
import { dirname, join } from 'node:path';

export type StoredInput = { path: string; mode: string; data: string };
export type InputDescriptor = {
  version: 1;
  key: string;
  directories: string[];
  extras: string[];
  generated: StoredInput[];
  json: StoredInput[];
  root: StoredInput[];
};

let git = (args: string[]) => {
  let result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString();
};
let cachedObjectFormat = '';
let objectFormat = () =>
  (cachedObjectFormat ||= git(['rev-parse', '--show-object-format']).trim());
let blob = (bytes: Buffer) =>
  createHash(objectFormat()).update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
let mode = (path: string) => {
  let stat = lstatSync(path);
  return stat.isSymbolicLink() ? '120000' : stat.mode & 0o111 ? '100755' : '100644';
};
let content = (path: string) =>
  lstatSync(path).isSymbolicLink() ? Buffer.from(readlinkSync(path)) : readFileSync(path);
let safePath = (path: unknown): path is string =>
  typeof path === 'string' &&
  path.length > 0 &&
  !path.startsWith('/') &&
  !path.split('/').some(part => part === '..' || part === '.' || part === '') &&
  !path.includes('\\') &&
  !path.includes('\0');

export let validateDescriptor = (value: unknown, key: string): InputDescriptor => {
  let descriptor = value as InputDescriptor;
  if (!descriptor || descriptor.version !== 1 || descriptor.key !== key)
    throw new Error('Invalid input descriptor version or key');
  for (let field of ['directories', 'extras'] as const) {
    if (
      !Array.isArray(descriptor[field]) ||
      !descriptor[field].every(safePath) ||
      new Set(descriptor[field]).size !== descriptor[field].length
    )
      throw new Error(`Invalid descriptor ${field}`);
  }
  for (let field of ['generated', 'json', 'root'] as const) {
    if (
      !Array.isArray(descriptor[field]) ||
      !descriptor[field].every(
        input =>
          safePath(input.path) &&
          ['100644', '100755', '120000'].includes(input.mode) &&
          typeof input.data === 'string' &&
          /^[A-Za-z0-9+/]*={0,2}$/.test(input.data)
      ) ||
      new Set(descriptor[field].map(input => input.path)).size !== descriptor[field].length
    )
      throw new Error(`Invalid descriptor ${field}`);
    if (descriptor[field].some(input => input.mode === '120000'))
      throw new Error('Generated descriptor inputs must be regular files');
  }
  if (
    !descriptor.json.some(input => input.path === 'bun.lock') ||
    !descriptor.json.some(input => input.path === 'package.json')
  )
    throw new Error('Descriptor lacks dependency metadata');
  return descriptor;
};

export let captureDescriptor = (cache: string, key: string): InputDescriptor => {
  let recipe = JSON.parse(readFileSync(join(cache, 'recipe.json'), 'utf8')) as {
    directories: string[];
    extras: string[];
    generated: string[];
  };
  let stored = (root: string, path: string): StoredInput => ({
    path,
    mode: mode(join(root, path)),
    data: content(join(root, path)).toString('base64')
  });
  return validateDescriptor(
    {
      version: 1,
      key,
      directories: recipe.directories,
      extras: recipe.extras,
      root: [...new Bun.Glob('*').scanSync({ cwd: 'out', onlyFiles: true })]
        .sort()
        .map(path => stored('out', path)),
      generated: recipe.generated.map(path => stored(join(cache, 'generated'), path)),
      json: [
        ...new Bun.Glob('**/*').scanSync({
          cwd: join(cache, 'json'),
          dot: true,
          onlyFiles: true
        })
      ]
        .sort()
        .map(path => stored(join(cache, 'json'), path))
    },
    key
  );
};

export let gitInputs = (): Map<string, { mode: string; oid: string }> => {
  let inputs = new Map<string, { mode: string; oid: string }>();
  let collect = (directory: string, prefix: string) => {
    let modified = new Set(
      git(['-C', directory, 'ls-files', '--modified', '--deleted', '-z']).split('\0')
    );
    for (let entry of git(['-C', directory, 'ls-files', '--stage', '-z'])
      .split('\0')
      .filter(Boolean)) {
      let match = entry.match(/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/);
      if (!match || match[3] !== '0')
        throw new Error('Cannot fingerprint unresolved Git index');
      let path = prefix + match[4];
      if (!existsSync(path) && !lstatSyncSafe(path)) continue;
      if (match[1] === '160000') {
        if (!existsSync(join(path, '.git')))
          throw new Error(`Uninitialized Git submodule: ${path}`);
        collect(path, path + '/');
        continue;
      }
      inputs.set(
        path,
        modified.has(match[4])
          ? { mode: mode(path), oid: blob(content(path)) }
          : { mode: match[1], oid: match[2] }
      );
    }
  };
  collect('.', '');
  return inputs;
};
let lstatSyncSafe = (path: string) => {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
};

export let descriptorInputs = (
  descriptor: InputDescriptor,
  tracked: ReturnType<typeof gitInputs>
) => {
  let inputs = new Map<string, { mode: string; oid: string }>();
  for (let [path, input] of tracked) {
    if (
      descriptor.extras.includes(path) ||
      descriptor.directories.some(directory => path.startsWith(directory + '/'))
    )
      inputs.set(`full/${path}`, input);
  }
  for (let input of descriptor.generated)
    inputs.set(`full/${input.path}`, {
      mode: input.mode,
      oid: blob(Buffer.from(input.data, 'base64'))
    });
  for (let input of descriptor.json)
    inputs.set(`json/${input.path}`, {
      mode: input.mode,
      oid: blob(Buffer.from(input.data, 'base64'))
    });
  return inputs;
};

export let materializeDescriptor = (
  descriptor: InputDescriptor,
  tracked: ReturnType<typeof gitInputs>
) => {
  rmSync('out', { recursive: true, force: true });
  let write = (path: string, inputMode: string, bytes: Buffer) => {
    mkdirSync(dirname(path), { recursive: true });
    if (inputMode === '120000') symlinkSync(bytes.toString(), path);
    else {
      writeFileSync(path, bytes);
      chmodSync(path, inputMode === '100755' ? 0o755 : 0o644);
    }
  };
  let generated = new Set(descriptor.generated.map(input => input.path));
  for (let [path, input] of tracked) {
    if (
      !generated.has(path) &&
      (descriptor.extras.includes(path) ||
        descriptor.directories.some(directory => path.startsWith(directory + '/')))
    )
      write(join('out/full', path), input.mode, content(path));
  }
  for (let input of descriptor.generated)
    write(join('out/full', input.path), input.mode, Buffer.from(input.data, 'base64'));
  for (let input of descriptor.root)
    write(join('out', input.path), input.mode, Buffer.from(input.data, 'base64'));
  for (let input of descriptor.json)
    write(join('out/json', input.path), input.mode, Buffer.from(input.data, 'base64'));
};
