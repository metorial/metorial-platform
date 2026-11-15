import { access, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';

export let sandboxCommand = async (d: {
  command: string;
  args: string[];
  writable: string[];
  scratch: string;
}) => {
  await mkdir(d.scratch, { recursive: true });
  let canonicalDirectory = async (directory: string) => {
    let resolved = path.resolve(directory);
    if ((await realpath(resolved)) !== resolved)
      throw new Error('Sandbox write directories must not traverse symlinks');
    return resolved;
  };
  let scratch = await canonicalDirectory(d.scratch);
  let writable = [
    ...new Set(await Promise.all([...d.writable, scratch].map(canonicalDirectory)))
  ];
  let env = { TMPDIR: scratch, TMP: scratch, TEMP: scratch, MODEL_CATALOG_SANDBOX: '1' };

  if (process.platform === 'darwin') {
    let quote = (value: string) => JSON.stringify(value);
    let profile = `(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null") ${writable.map(dir => `(subpath ${quote(dir)})`).join(' ')})`;
    return {
      command: '/usr/bin/sandbox-exec',
      args: ['-p', profile, d.command, ...d.args],
      env
    };
  }

  if (process.platform === 'linux') {
    let command = '/usr/bin/bwrap';
    await access(command);
    return {
      command,
      args: [
        '--die-with-parent',
        '--new-session',
        '--unshare-user',
        '--unshare-pid',
        '--ro-bind',
        '/',
        '/',
        '--proc',
        '/proc',
        '--dev',
        '/dev',
        ...writable.flatMap(dir => ['--bind', dir, dir]),
        '--',
        d.command,
        ...d.args
      ],
      env
    };
  }

  throw new Error(`Provider repair sandbox is unavailable on ${process.platform}`);
};

export let sourceDirectory = (packageDir: string, sourceFile: string) =>
  path.dirname(path.resolve(packageDir, sourceFile));
