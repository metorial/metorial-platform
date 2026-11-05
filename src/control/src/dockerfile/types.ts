export interface BuildMigration {
  name: string;
  package: string;
  path: string;
  env: string | string[];
  fallback?: string | string[];
  parts?: string | string[];
  query?: string;
  precedence?: 'url' | 'parts';
  defaults?: { port?: string; name?: string };
  encode?: boolean;
  iam?: { arnEnv: string; regionEnv?: string };
  lock?: number;
  renames?: { table: string; from: string; to: string }[];
}

export interface BuildAsset {
  from: string;
  to: string;
}

export interface BuildSpec {
  kind: 'bun-service';
  tasks: string[];
  include: string[];
  closure: boolean;
  concurrency?: number;
  heapMb?: number;
  start: string;
  ports: number[];
  health: { port: number; path: string }[];
  migrations: BuildMigration[];
  assets: BuildAsset[];
  packages: { build: string[]; runtime: string[] };
  modules: 'production' | 'none';
  sentry: boolean;
  node: boolean;
  env: Record<string, string>;
  buildEnv: Record<string, string>;
  sources: string[];
  strip: string[];
  runtime: 'bundle' | 'source';
  release: boolean;
  versioned: boolean;
  generateFirst: boolean;
}

export interface RenderContext {
  build: BuildSpec;
  packageName: string;
  packageDirectory: string;
  tooling: string;
  runtime: string;
  schemas: Record<string, { source: string; target: string; directory: boolean }>;
}
