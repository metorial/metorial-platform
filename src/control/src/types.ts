export type RootKind = 'enterprise' | 'oss';

export interface ProjectRoot {
  kind: RootKind;
  root: string;
  oss: string;
}

export type Environment = Record<string, string>;

export type EnvValue =
  | string
  | boolean
  | {
      value?: string;
      from?: string;
      default?: string;
      required?: boolean;
    };

export interface Dependency {
  identifier: string;
  start: boolean;
  env: { endpoint: string; key: string; value: string }[];
}

export interface Endpoint {
  port: number;
  bind_port?: number;
  env: { key: string; value: string }[];
  health?: string | { path: string; status?: number };
}

export interface Database {
  package: string;
  host: string;
  port: number;
  user?: string;
  password?: string;
  database: string;
  service?: string;
  compose?: string;
  auth_source?: string;
}

export interface Manifest {
  package?: { name: string; groups: string[] };
  mode: 'both' | RootKind;
  dependencies: Dependency[];
  endpoints: Record<string, Endpoint>;
  dependency_endpoints: Record<string, Record<string, { hostname: string; port: number }>>;
  resources: { type: 'redis' | 'nats' | 'etcd'; env: { key: string; value: string }[] }[];
  groups: Record<string, string[]>;
  env: Record<string, EnvValue>;
  expose: { port: number }[];
  postgres: Record<string, Database>;
  mongo: Record<string, Database>;
  run: Record<
    string,
    {
      command: string;
      cwd?: string;
      env: Record<string, EnvValue>;
      depends_on: string[];
    }
  >;
  prepare: string[];
  docker: { compose: string[]; services: string[]; stop: boolean };
  cleanup: { paths: string[]; commands: string[] };
  health: { port: number; path: string; status?: number }[];
  e2e: {
    start: string[];
    image?: string;
    tests: string[];
    services: string[];
    health_timeout?: number;
    env: Record<string, EnvValue>;
    resources: { type: 'object-storage' }[];
  };
  ci: {
    images: {
      name: string;
      group: string;
      dockerfile?: string;
      workspace?: string;
      image?: string;
      ecr?: string;
      canonical?: string;
      source?: string;
      platform: string;
      stagingOnly: boolean;
    }[];
    suite?: {
      name: string;
      runner: string;
      groups: number;
      workspacePackages: string[];
      profiles: string[];
    };
  };
}

export interface LoadedManifest {
  path: string;
  manifest: Manifest;
}

export interface ServicePorts {
  postgres: number;
  mongo: number;
  redis: number;
  nats: number;
  etcd_client: number;
  etcd_peer: number;
}

export interface WorkspaceMetadata {
  id: string;
  branch: string;
  hostname: string;
  source_root: string;
  runtime: 'host' | 'docker';
  service_ports?: ServicePorts;
  endpoint_ports: Record<string, Record<string, number>>;
}
