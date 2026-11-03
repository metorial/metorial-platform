import type { BuildSpec } from './types';

type RawBuild = Partial<Omit<BuildSpec, 'kind' | 'migrations' | 'assets' | 'packages'>> & {
  kind: 'bun-service';
  migrations?: (Omit<BuildSpec['migrations'][number], 'path'> & { path?: string })[];
  assets?: { from: string; to?: string }[];
  packages?: { build?: string[]; runtime?: string[] };
};

export let normalizeBuild = (raw: RawBuild): BuildSpec => ({
  kind: raw.kind,
  tasks: raw.tasks ?? ['prisma:generate', 'server:build'],
  include: raw.include ?? [],
  concurrency: raw.concurrency,
  heapMb: raw.heapMb,
  start: raw.start ?? 'dist/index.js',
  ports: raw.ports ?? [],
  health: raw.health ?? [],
  migrations: (raw.migrations ?? []).map(migration => ({
    ...migration,
    path: migration.path ?? 'prisma/schema'
  })),
  assets: (raw.assets ?? []).map(asset => ({ from: asset.from, to: asset.to ?? asset.from })),
  packages: { build: raw.packages?.build ?? [], runtime: raw.packages?.runtime ?? [] },
  modules: raw.modules ?? 'none',
  sentry: raw.sentry ?? false,
  node: raw.node ?? false,
  env: raw.env ?? {}
});
