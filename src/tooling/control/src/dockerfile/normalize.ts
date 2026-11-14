import type { BuildSpec } from './types';

type RawBuild = Partial<Omit<BuildSpec, 'kind' | 'migrations' | 'assets' | 'packages'>> & {
  kind: 'bun-service';
  migrations?: (Omit<BuildSpec['migrations'][number], 'path'> & { path?: string })[];
  assets?: { from: string; to?: string }[];
  packages?: { build?: string[]; runtime?: string[] };
};

export let normalizeBuild = (raw: RawBuild): BuildSpec => {
  for (let asset of raw.assets ?? [])
    if (asset.from.startsWith('/') && !asset.to)
      throw new Error(`asset ${asset.from} is workspace-relative and needs an explicit "to"`);
  if (raw.versioned && !raw.release)
    throw new Error('a versioned build must also set release');

  return {
    kind: raw.kind,
    tasks: raw.tasks ?? ['prisma:generate', 'server:build'],
    include: raw.include ?? [],
    closure: raw.closure ?? false,
    concurrency: raw.concurrency,
    heapMb: raw.heapMb,
    start: raw.start ?? 'dist/index.js',
    ports: raw.ports ?? [],
    health: raw.health ?? [],
    migrations: (raw.migrations ?? []).map(migration => ({
      ...migration,
      path: migration.path ?? 'prisma/schema'
    })),
    assets: (raw.assets ?? []).map(asset => ({
      from: asset.from,
      to: asset.to ?? asset.from
    })),
    packages: { build: raw.packages?.build ?? [], runtime: raw.packages?.runtime ?? [] },
    modules: raw.modules ?? 'none',
    sentry: raw.sentry ?? false,
    node: raw.node ?? false,
    env: raw.env ?? {},
    buildEnv: raw.buildEnv ?? {},
    sources: raw.sources ?? [],
    strip: raw.strip ?? [],
    runtime: raw.runtime ?? 'bundle',
    release: raw.release ?? false,
    versioned: raw.versioned ?? false,
    generateFirst: raw.generateFirst ?? false
  };
};
