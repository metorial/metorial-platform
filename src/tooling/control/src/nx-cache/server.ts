import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';

type CacheStats = {
  startedAt: string;
  updatedAt: string;
  namespace: string;
  artifactKeyPrefix: string;
  manifestRestoreKey?: string;
  manifestMatchedKey?: string;
  manifestSaveKey?: string;
  manifestSaved?: boolean;
  localHits: number;
  githubHits: number;
  misses: number;
  uploads: number;
  duplicateUploads: number;
  uploadFailures: number;
  prefetchHits: number;
  prefetchMisses: number;
  requests: {
    head: number;
    get: number;
    put: number;
  };
  usedDigests: string[];
  operations: {
    type: string;
    hash?: string;
    durationMs: number;
    status: string;
    message?: string;
  }[];
};

type ServerOptions = {
  port: number;
  host: string;
  root: string;
  manifestDir: string;
  statsPath: string;
  readyFile?: string;
  namespace: string;
  manifestSaveKey?: string;
  manifestRestoreKey?: string;
  manifestRestoreKeys: string[];
  maxManifestEntries: number;
};

type Manifest = {
  version: 1;
  updatedAt: string;
  digests: { hash: string; lastUsedAt: string; useCount: number }[];
};

let loadActionsCache = async () => await import('@actions/cache');

let isActionsCacheAvailable = () =>
  !!process.env.ACTIONS_RUNTIME_TOKEN &&
  !!(process.env.ACTIONS_CACHE_URL || process.env.ACTIONS_RESULTS_URL);

let ensureDir = (path: string) => mkdirSync(path, { recursive: true });

let findRuntimeRoot = () => {
  if (process.env.GITHUB_WORKSPACE) return process.env.GITHUB_WORKSPACE;

  let current = process.cwd();
  for (let i = 0; i < 8; i++) {
    let manifestPath = join(current, 'package.json');
    if (existsSync(manifestPath)) {
      try {
        let manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: string };
        if (manifest.name === '@metorial/oss') return current;
      } catch {}
    }

    let parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.env.INIT_CWD ?? process.cwd();
};

let resolveRuntimePath = (path: string): string =>
  isAbsolute(path) ? path : resolve(findRuntimeRoot(), path);

let safeWriteJson = (path: string, value: unknown) => {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
};

let artifactDir = (root: string, hash: string) => resolve(root, hash);
let artifactPath = (root: string, hash: string) => join(artifactDir(root, hash), 'artifact.tar');
let manifestPath = (manifestDir: string) => join(manifestDir, 'manifest.json');
let artifactKey = (namespace: string, hash: string) => `control-nx-task-${namespace}-${hash}`;
let isBenignSaveError = (message: string) =>
  /already exists|reserve|409|Unable to reserve|HTTP headers specified in the request is not supported/i.test(
    message
  );

let readManifest = (path: string): Manifest => {
  if (!existsSync(path)) return { version: 1, updatedAt: new Date().toISOString(), digests: [] };
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
};

let directorySize = (path: string): number => {
  if (!existsSync(path)) return 0;
  let entry = statSync(path);
  if (entry.isFile()) return entry.size;
  let total = 0;
  for (let name of Array.from(new Bun.Glob('**/*').scanSync({ cwd: path, dot: true }))) {
    let fullPath = join(path, name);
    let stat = statSync(fullPath);
    if (stat.isFile()) total += stat.size;
  }
  return total;
};

let formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  let kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KiB`;
  let mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MiB`;
  return `${(mb / 1024).toFixed(1)} GiB`;
};

let createStats = (opts: ServerOptions): CacheStats => ({
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  namespace: opts.namespace,
  artifactKeyPrefix: `control-nx-task-${opts.namespace}-`,
  manifestRestoreKey: opts.manifestRestoreKey,
  manifestSaveKey: opts.manifestSaveKey,
  manifestSaved: false,
  localHits: 0,
  githubHits: 0,
  misses: 0,
  uploads: 0,
  duplicateUploads: 0,
  uploadFailures: 0,
  prefetchHits: 0,
  prefetchMisses: 0,
  requests: { head: 0, get: 0, put: 0 },
  usedDigests: [],
  operations: []
});

export let printCacheSummary = (statsPath: string, root?: string) => {
  statsPath = resolveRuntimePath(statsPath);
  root = root ? resolveRuntimePath(root) : undefined;

  if (!existsSync(statsPath)) {
    console.log(`No Nx cache stats found at ${statsPath}`);
    return;
  }

  let stats = JSON.parse(readFileSync(statsPath, 'utf8')) as CacheStats;
  let size = root ? directorySize(root) : 0;
  let slowest = [...stats.operations]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  console.log('Nx cache summary');
  console.log(`  Namespace:          ${stats.namespace}`);
  console.log(`  Manifest restored:  ${stats.manifestMatchedKey ?? 'none'}`);
  console.log(`  Manifest saved:     ${stats.manifestSaved ? (stats.manifestSaveKey ?? 'yes') : 'no'}`);
  console.log(`  Requests:           HEAD ${stats.requests.head}, GET ${stats.requests.get}, PUT ${stats.requests.put}`);
  console.log(`  Local hits:         ${stats.localHits}`);
  console.log(`  GitHub hits:        ${stats.githubHits}`);
  console.log(`  Misses:             ${stats.misses}`);
  console.log(`  Uploads:            ${stats.uploads}`);
  console.log(`  Duplicate uploads:  ${stats.duplicateUploads}`);
  console.log(`  Upload failures:    ${stats.uploadFailures}`);
  console.log(`  Prefetch:           ${stats.prefetchHits} hit, ${stats.prefetchMisses} miss`);
  console.log(`  Used digests:       ${stats.usedDigests.length}`);
  if (root) console.log(`  Local artifact dir: ${formatBytes(size)}`);

  if (slowest.length > 0) {
    console.log('');
    console.log('Slowest cache operations');
    for (let op of slowest) {
      console.log(`  ${String(op.durationMs).padStart(6)}ms ${op.type}${op.hash ? ` ${op.hash}` : ''} ${op.status}${op.message ? ` - ${op.message}` : ''}`);
    }
  }
};

export let runCacheServer = async (opts: ServerOptions) => {
  opts = {
    ...opts,
    root: resolveRuntimePath(opts.root),
    manifestDir: resolveRuntimePath(opts.manifestDir),
    statsPath: resolveRuntimePath(opts.statsPath),
    readyFile: opts.readyFile ? resolveRuntimePath(opts.readyFile) : undefined
  };

  ensureDir(opts.root);
  ensureDir(opts.manifestDir);

  let stats = createStats(opts);
  let used = new Map<string, { hash: string; lastUsedAt: string; useCount: number }>();
  let downloads = new Map<string, Promise<boolean>>();
  let remoteArtifacts = new Set<string>();
  let queuedUploads = new Set<string>();
  let uploadQueue = Promise.resolve();
  let uploadTasks: Promise<void>[] = [];

  let persistStats = () => {
    stats.updatedAt = new Date().toISOString();
    stats.usedDigests = [...used.values()]
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .map(d => d.hash);
    safeWriteJson(opts.statsPath, stats);
  };

  let recordOp = (op: CacheStats['operations'][number]) => {
    stats.operations.push(op);
    if (stats.operations.length > 200) stats.operations.shift();
    persistStats();
  };

  let touch = (hash: string) => {
    let existing = used.get(hash);
    used.set(hash, {
      hash,
      lastUsedAt: new Date().toISOString(),
      useCount: (existing?.useCount ?? 0) + 1
    });
  };

  let localExists = (hash: string) => existsSync(artifactPath(opts.root, hash));

  let restoreArtifact = async (hash: string) => {
    if (localExists(hash)) return true;
    let existing = downloads.get(hash);
    if (existing) return existing;

    let task = (async () => {
      let started = Date.now();
      let dir = artifactDir(opts.root, hash);
      rmSync(dir, { recursive: true, force: true });
      ensureDir(dir);

      if (!isActionsCacheAvailable()) {
        recordOp({ type: 'restore', hash, durationMs: Date.now() - started, status: 'skipped', message: 'GitHub Actions cache env missing' });
        return false;
      }

      try {
        let actionsCache = await loadActionsCache();
        let matched = await actionsCache.restoreCache([dir], artifactKey(opts.namespace, hash), []);
        let hit = !!matched && localExists(hash);
        if (hit) remoteArtifacts.add(hash);
        recordOp({ type: 'restore', hash, durationMs: Date.now() - started, status: hit ? 'hit' : 'miss', message: matched });
        return hit;
      } catch (err) {
        recordOp({
          type: 'restore',
          hash,
          durationMs: Date.now() - started,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err)
        });
        return false;
      } finally {
        downloads.delete(hash);
      }
    })();

    downloads.set(hash, task);
    return task;
  };

  let queueUpload = (hash: string) => {
    if (remoteArtifacts.has(hash) || queuedUploads.has(hash)) {
      stats.duplicateUploads++;
      recordOp({
        type: 'upload',
        hash,
        durationMs: 0,
        status: 'skipped',
        message: remoteArtifacts.has(hash) ? 'already restored from GitHub cache' : 'already queued'
      });
      return;
    }

    queuedUploads.add(hash);
    let task = uploadQueue.then(async () => {
      let started = Date.now();
      let dir = artifactDir(opts.root, hash);
      try {
        if (!localExists(hash)) return;

        if (!isActionsCacheAvailable()) {
          recordOp({ type: 'upload', hash, durationMs: Date.now() - started, status: 'skipped', message: 'GitHub Actions cache env missing' });
          return;
        }

        let actionsCache = await loadActionsCache();
        await actionsCache.saveCache([dir], artifactKey(opts.namespace, hash));
        remoteArtifacts.add(hash);
        stats.uploads++;
        recordOp({ type: 'upload', hash, durationMs: Date.now() - started, status: 'saved' });
      } catch (err) {
        let message = err instanceof Error ? err.message : String(err);
        if (isBenignSaveError(message)) {
          remoteArtifacts.add(hash);
          stats.duplicateUploads++;
          recordOp({ type: 'upload', hash, durationMs: Date.now() - started, status: 'duplicate', message });
          return;
        }
        stats.uploadFailures++;
        recordOp({ type: 'upload', hash, durationMs: Date.now() - started, status: 'failed', message });
      } finally {
        queuedUploads.delete(hash);
      }
    });

    uploadQueue = task.catch(() => {});
    uploadTasks.push(task);
  };

  let restoreManifest = async () => {
    if (!opts.manifestRestoreKey || !isActionsCacheAvailable()) return;
    let started = Date.now();
    try {
      let actionsCache = await loadActionsCache();
      let matched = await actionsCache.restoreCache(
        [opts.manifestDir],
        opts.manifestRestoreKey,
        opts.manifestRestoreKeys
      );
      stats.manifestMatchedKey = matched;
      recordOp({ type: 'manifest-restore', durationMs: Date.now() - started, status: matched ? 'hit' : 'miss', message: matched });
    } catch (err) {
      recordOp({
        type: 'manifest-restore',
        durationMs: Date.now() - started,
        status: 'failed',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  };

  let prefetchFromManifest = async () => {
    await restoreManifest();
    let manifest = readManifest(manifestPath(opts.manifestDir));
    for (let entry of manifest.digests.slice(0, opts.maxManifestEntries)) {
      if (localExists(entry.hash)) {
        stats.prefetchHits++;
        continue;
      }
      let hit = await restoreArtifact(entry.hash);
      if (hit) stats.prefetchHits++;
      else stats.prefetchMisses++;
    }
    persistStats();
  };

  let writeManifest = async () => {
    let previous = readManifest(manifestPath(opts.manifestDir));
    for (let entry of previous.digests) {
      if (!used.has(entry.hash)) used.set(entry.hash, entry);
    }

    let digests = [...used.values()]
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .slice(0, opts.maxManifestEntries);

    safeWriteJson(manifestPath(opts.manifestDir), {
      version: 1,
      updatedAt: new Date().toISOString(),
      digests
    } satisfies Manifest);

    if (!opts.manifestSaveKey || !isActionsCacheAvailable()) return;
    let started = Date.now();
    try {
      let actionsCache = await loadActionsCache();
      await actionsCache.saveCache([opts.manifestDir], opts.manifestSaveKey);
      stats.manifestSaved = true;
      recordOp({ type: 'manifest-save', durationMs: Date.now() - started, status: 'saved', message: opts.manifestSaveKey });
    } catch (err) {
      let message = err instanceof Error ? err.message : String(err);
      if (isBenignSaveError(message)) {
        stats.manifestSaved = true;
        recordOp({ type: 'manifest-save', durationMs: Date.now() - started, status: 'duplicate', message });
        return;
      }
      recordOp({ type: 'manifest-save', durationMs: Date.now() - started, status: 'failed', message });
    }
  };

  let finalize = async () => {
    await Promise.allSettled(uploadTasks);
    await writeManifest();
    persistStats();
  };

  persistStats();
  let prefetchTask = prefetchFromManifest().catch(err => {
    recordOp({
      type: 'prefetch',
      durationMs: 0,
      status: 'failed',
      message: err instanceof Error ? err.message : String(err)
    });
  });

  let server = Bun.serve({
    hostname: opts.host,
    port: opts.port,
    async fetch(req) {
      let url = new URL(req.url);
      let match = url.pathname.match(/^\/v1\/cache\/([^/]+)$/);

      if (url.pathname === '/control/finalize' && req.method === 'POST') {
        await finalize();
        return Response.json(stats);
      }

      if (url.pathname === '/control/summary') {
        persistStats();
        return Response.json(stats);
      }

      if (!match) return new Response('not found', { status: 404 });
      let hash = decodeURIComponent(match[1]!);
      touch(hash);

      if (req.method === 'HEAD') {
        stats.requests.head++;
        if (localExists(hash)) {
          stats.localHits++;
          persistStats();
          return new Response(null, { status: 200 });
        }
        let hit = await restoreArtifact(hash);
        if (hit) {
          stats.githubHits++;
          persistStats();
          return new Response(null, { status: 200 });
        }
        stats.misses++;
        persistStats();
        return new Response(null, { status: 404 });
      }

      if (req.method === 'GET') {
        stats.requests.get++;
        if (localExists(hash)) {
          stats.localHits++;
        } else {
          let hit = await restoreArtifact(hash);
          if (hit) stats.githubHits++;
          else {
            stats.misses++;
            persistStats();
            return new Response('cache miss', { status: 404 });
          }
        }

        persistStats();
        return new Response(Bun.file(artifactPath(opts.root, hash)), {
          headers: { 'content-type': 'application/octet-stream' }
        });
      }

      if (req.method === 'PUT') {
        stats.requests.put++;
        ensureDir(artifactDir(opts.root, hash));
        writeFileSync(artifactPath(opts.root, hash), Buffer.from(await req.arrayBuffer()));
        queueUpload(hash);
        persistStats();
        return new Response('ok');
      }

      return new Response('method not allowed', { status: 405 });
    }
  });

  if (opts.readyFile) {
    ensureDir(dirname(opts.readyFile));
    writeFileSync(opts.readyFile, `${server.url}\n`);
  }

  console.log(`Nx cache ready file: ${opts.readyFile ?? 'none'}`);
  console.log(`Nx cache server listening at ${server.url}`);
  await prefetchTask;
  await new Promise(() => {});
};
