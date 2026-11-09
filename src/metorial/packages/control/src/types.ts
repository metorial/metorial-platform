export type Template = string;

export type ControlMode = 'both' | 'oss' | 'enterprise';

export type RawEnvValue =
  string | boolean | { value?: string; from?: string; default?: string; required?: boolean };

export type RawEnv = Record<string, RawEnvValue>;

export interface RawKeyValue {
  key: string;
  value: string;
}

export interface RawEndpoint {
  port: number;
  env?: RawKeyValue[];
  health?: string | { path: string; status?: number };
  protocol?: 'http' | 'h2c';
  link?: {
    label: string;
    group?: 'app' | 'admin' | 'tool';
    menu?: string;
    path?: string;
  };
}

export interface RawDependency {
  identifier: string;
  start?: boolean;
  env?: { endpoint: string; key: string; value: string }[];
}

export interface RawBuildMigration {
  name: string;
  package: string;
  path?: string;
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

export interface RawBuild {
  kind: 'bun-service';
  tasks?: string[];
  include?: string[];
  closure?: boolean;
  concurrency?: number;
  heapMb?: number;
  start?: string;
  ports?: number[];
  health?: { port: number; path: string }[];
  migrations?: RawBuildMigration[];
  assets?: { from: string; to?: string }[];
  packages?: { build?: string[]; runtime?: string[] };
  modules?: 'production' | 'none';
  sentry?: boolean;
  node?: boolean;
  env?: Record<string, string>;
  buildEnv?: Record<string, string>;
  sources?: string[];
  strip?: string[];
  runtime?: 'bundle' | 'source';
  release?: boolean;
  versioned?: boolean;
  generateFirst?: boolean;
}

export interface RawCiImage {
  name: string;
  group?: string;
  dockerfile?: string;
  workspace?: string;
  image?: string;
  ecr?: string;
  canonical?: string;
  source?: string;
  platform?: string;
  stagingOnly?: boolean;
  build?: RawBuild;
}

export interface RawDockerfile {
  dockerfile?: string;
  workspace?: string;
  build: RawBuild;
}

export interface RawCiSuite {
  name: string;
  runner?: string;
  groups?: number;
  workspacePackages?: string[];
  profiles?: string[];
}

export interface RawStack {
  id: string;
  label?: string;
  mode?: ControlMode;
  description?: string;
  edition?: 'cloud' | 'on-prem';
}

export interface RawStackProduction {
  disabled?: boolean;
  image?: string;
  dockerfile?: string;
  workspace?: string;
  args?: Record<string, string>;
  command?: string;
  target?: string;
  env?: RawEnv;
}

export interface RawStackMember {
  mode?: ControlMode;
  init?: boolean;
  volumes?: Record<string, string>;
  env?: RawEnv;
  development?: { disabled?: boolean; container?: boolean; run?: string[]; env?: RawEnv };
  production?: RawStackProduction;
}

export interface RawManifest {
  name?: string;
  stack_only?: boolean;
  group?: string;
  mode?: ControlMode;
  dependencies?: (string | RawDependency)[];
  endpoints?: Record<string, RawEndpoint>;
  resources?: { type: 'redis' | 'nats' | 'etcd' | 'mail' | 'postgres'; env?: RawKeyValue[] }[];
  dev?: {
    prepare?: string[];
    run?: string[];
    cleanup?: string[];
    env?: RawEnv;
    expose?: { port: number }[];
    db?: Record<
      string,
      { name: string; engine: 'postgres' | 'mongodb' | 'mongo'; env: string; package: string }
    >;
  };
  docker?: { compose?: string[]; services?: string[]; stop?: boolean };
  cleanup?: { paths?: string[]; commands?: string[] };
  health?: { port: number; path: string; status?: number }[];
  e2e?: {
    start?: string[];
    image?: string;
    tests?: string[];
    services?: string[];
    health_timeout?: number;
    env?: RawEnv;
    resources?: { type: 'object-storage' }[];
  };
  ci?: { images?: RawCiImage[]; dockerfiles?: RawDockerfile[]; suite?: RawCiSuite };
  stack_definitions?: RawStack[];
  stacks?: Record<string, RawStackMember>;
  [key: string]: unknown;
}
