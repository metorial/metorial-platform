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
  link?: { label: string; group?: 'app' | 'admin' | 'tool'; path?: string };
}

export interface RawDependency {
  identifier: string;
  start?: boolean;
  env?: { endpoint: string; key: string; value: string }[];
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
}

export interface RawCiSuite {
  name: string;
  runner?: string;
  groups?: number;
  workspacePackages?: string[];
  profiles?: string[];
}

export interface RawManifest {
  name?: string;
  group?: string;
  mode?: ControlMode;
  dependencies?: (string | RawDependency)[];
  endpoints?: Record<string, RawEndpoint>;
  resources?: { type: 'redis' | 'nats' | 'etcd' | 'mail'; env?: RawKeyValue[] }[];
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
  ci?: { images?: RawCiImage[]; suite?: RawCiSuite };
  [key: string]: unknown;
}
