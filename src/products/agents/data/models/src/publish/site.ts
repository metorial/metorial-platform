import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export let fingerprintFile = 'fingerprint.json';

let publishedEntries = [
  'organizations.json',
  'families.json',
  'models.json',
  'vendors.json',
  'offerings.json',
  'names.json',
  'agents.json',
  'organizations',
  'families',
  'models',
  'vendors',
  'agents',
  'logos'
];

// Workers static assets reject files over 25 MiB; the whole catalog is larger, so it ships gzipped.
let compressedEntry = 'catalog.json';
let compressedName = 'catalog.json.gz';

// Rewritten on every run even when nothing about the models changed.
let volatileFields = /"(?:lastSeenAt|generatedAt|fetchedAt)":\s*(?:"[^"]*"|null),?/g;

let liveFingerprintTimeoutMs = 15_000;

let exists = async (file: string) => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

let listFiles = async (dir: string, prefix = ''): Promise<string[]> => {
  let entries = await readdir(path.join(dir, prefix), { withFileTypes: true });
  let nested = await Promise.all(
    entries.map(entry =>
      entry.isDirectory()
        ? listFiles(dir, path.posix.join(prefix, entry.name))
        : [path.posix.join(prefix, entry.name)]
    )
  );
  return nested.flat();
};

let normalized = (file: string, content: Buffer) =>
  file.endsWith('.json')
    ? Buffer.from(content.toString('utf8').replace(volatileFields, ''))
    : content;

// Same fingerprint for the same data, however often the sources were re-fetched.
export let fingerprintDirs = async (dirs: { dir: string; files: string[] }[]) => {
  let hash = createHash('sha256');
  let all = dirs
    .flatMap(entry => entry.files.map(file => ({ dir: entry.dir, file })))
    .sort((a, b) => a.file.localeCompare(b.file));

  for (let { dir, file } of all) {
    hash.update(`${file}\0`);
    hash.update(normalized(file, await readFile(path.join(dir, file))));
    hash.update('\0');
  }

  return hash.digest('hex');
};

export let buildSite = async (opts: {
  outDir: string;
  siteDir: string;
  assetsDir: string;
  now: string;
}) => {
  let outFiles: string[] = [];
  for (let entry of publishedEntries) {
    let target = path.join(opts.outDir, entry);
    if (!(await exists(target))) throw new Error(`catalog output is missing ${entry}`);

    let isDir = (await stat(target)).isDirectory();
    outFiles.push(...(isDir ? await listFiles(opts.outDir, entry) : [entry]));
  }

  let compressedSource = path.join(opts.outDir, compressedEntry);
  if (!(await exists(compressedSource)))
    throw new Error(`catalog output is missing ${compressedEntry}`);

  let assetFiles = await listFiles(opts.assetsDir);
  let fingerprint = await fingerprintDirs([
    { dir: opts.outDir, files: [...outFiles, compressedEntry] },
    { dir: opts.assetsDir, files: assetFiles }
  ]);

  await rm(opts.siteDir, { recursive: true, force: true });
  await mkdir(opts.siteDir, { recursive: true });

  for (let entry of publishedEntries)
    await cp(path.join(opts.outDir, entry), path.join(opts.siteDir, entry), {
      recursive: true
    });
  await cp(opts.assetsDir, opts.siteDir, { recursive: true });

  await writeFile(
    path.join(opts.siteDir, compressedName),
    gzipSync(await readFile(compressedSource), { level: 9 })
  );
  await writeFile(
    path.join(opts.siteDir, fingerprintFile),
    `${JSON.stringify({ fingerprint, generatedAt: opts.now }, null, 2)}\n`
  );

  return { fingerprint, files: outFiles.length + assetFiles.length + 2 };
};

// Null when the site has never been deployed or can't be reached; both mean "deploy".
export let liveFingerprint = async (baseUrl: string) => {
  try {
    let response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/${fingerprintFile}?t=${Date.now()}`,
      {
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(liveFingerprintTimeoutMs)
      }
    );
    if (!response.ok) return null;

    let body = (await response.json()) as { fingerprint?: unknown };
    return typeof body.fingerprint === 'string' ? body.fingerprint : null;
  } catch {
    return null;
  }
};
