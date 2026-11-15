import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Subprocess } from 'bun';
import { ObjectStorageClient } from '../src/index';

const WORKSPACE = resolve(import.meta.dir, '../../..');
const BINARY = join(WORKSPACE, 'target/debug/object-store-service');

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });

/** Builds and starts the object store on a local backend, with a `files` bucket. */
export const startLiveServer = async (name: string) => {
  const build = Bun.spawnSync(['cargo', 'build', '-p', 'object-store', '--bin', 'object-store-service'], {
    cwd: WORKSPACE,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (build.exitCode !== 0 || !existsSync(BINARY)) throw new Error('cargo build failed');

  const root = mkdtempSync(join(tmpdir(), `object-store-${name}-`));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const configPath = join(root, 'config.toml');
  writeFileSync(
    configPath,
    [
      '[server]',
      'host = "127.0.0.1"',
      `port = ${port}`,
      'health_port = 0',
      '[backend]',
      'type = "local"',
      `root_path = "${join(root, 'data')}"`,
      'physical_bucket = "store"',
    ].join('\n')
  );

  const child: Subprocess = Bun.spawn([BINARY], {
    env: { ...Bun.env, CONFIG_PATH: configPath, RUST_LOG: 'warn' },
    stdout: 'ignore',
    stderr: 'inherit',
  });

  const client = new ObjectStorageClient(url, 30_000);
  for (let tries = 0; ; tries++) {
    try {
      await client.ping();
      break;
    } catch (error) {
      if (tries > 100) throw error;
      await Bun.sleep(100);
    }
  }
  await client.createBucket('files');

  return {
    url,
    root,
    client,
    stop: async () => {
      child.kill('SIGKILL');
      await child.exited;
      rmSync(root, { recursive: true, force: true });
    },
  };
};
