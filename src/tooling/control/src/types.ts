export type ControlDatabase = {
  adapter: 'postgres';
  name: string;
  dep?: string;
  owner?: string;
  encoding?: string;
};

export type ResolvedDatabase = {
  name: string;
  adapter: 'postgres';
  dep: string;
  owner: string;
  user: string;
  password: string;
  host: string;
  port: number;
  encoding?: string;
};

export type ControlDep = {
  name: string;
  preset?: string;
  mock?: string;
  control?: string;
  scope?: 'full' | 'service';
  image?: string;
  env?: Record<string, string>;
  port?: number;
  inline?: {
    build?: { context: string; dockerfile: string; target?: string };
    image?: string;
    command?: string[];
    port?: number;
    health?: { path?: string; cmd?: string };
  } | boolean;
};

export type ControlConfig = {
  control: {
    name: string;
    entrypoint?: string;
  };
  service?: {
    port?: number;
    dockerfile?: string;
    docker_target?: string;
    build_context?: string;
    health?: { path?: string; cmd?: string };
    command?: string[];
  };
  test?: {
    e2e?: {
      command: string;
      setup?: string[];
      cwd?: string;
      runner?: 'service' | 'sidecar';
      vitest_mode?: string;
    };
    unit?: {
      command: string;
      cwd?: string;
    };
  };
  env?: Record<string, string>;
  databases?: ControlDatabase[];
  deps?: ControlDep[];
};

export type ResolvedDep = {
  key: string;
  name: string;
  composeName: string;
  alias: string;
  port?: number;
  kind: 'preset' | 'mock' | 'control' | 'docker' | 'inline';
  config: ControlDep;
  sourceDir: string;
  children?: ResolvedGraph;
};

export type ResolvedGraph = {
  name: string;
  dir: string;
  config: ControlConfig;
  entrypoint: string;
  ossRoot: string;
  rootPrefix: string;
  deps: ResolvedDep[];
  depHosts: Record<string, { host: string; port?: number }>;
  databases: Record<string, ResolvedDatabase>;
  env: Record<string, string>;
  serviceComposeName: string;
  testRunnerComposeName: string;
};

export type ControlService = {
  name: string;
  dir: string;
  relPath: string;
  controlFile: string;
  config: ControlConfig;
};

export type ServiceRegistry = {
  controlRoot: string;
  ossRoot: string;
  services: ControlService[];
  byName: Map<string, ControlService>;
  byDir: Map<string, ControlService>;
};

export type BatchServiceResult = {
  name: string;
  relPath: string;
  status: 'passed' | 'failed';
  durationMs: number;
  error?: Error;
  phase?: string;
};

export type BatchResult = {
  passed: string[];
  failed: { name: string; error: Error; phase?: string }[];
  results: BatchServiceResult[];
  totalDurationMs: number;
};

export type RunPhase =
  | 'setup'
  | 'build'
  | 'health'
  | 'test-setup'
  | 'test'
  | 'teardown';

export type GlobalGraphNode = {
  name: string;
  relPath: string;
  missing?: boolean;
};

export type GlobalGraphEdge = {
  from: string;
  to: string;
  missing?: boolean;
};

export type GlobalGraph = {
  nodes: GlobalGraphNode[];
  edges: GlobalGraphEdge[];
};

export type BuildOptions = {
  entrypoint?: string;
  verbose?: boolean;
  tagPrefix?: string;
  services?: ControlService[];
};

export type RunOptions = {
  target?: string;
  mode: 'e2e' | 'unit';
  entrypoint?: string;
  projectPrefix?: string;
  keep?: boolean;
  verbose?: boolean;
  ci?: boolean;
  services?: ControlService[];
};

export type MockDefinition = {
  name: string;
  port: number;
  serverPath: string;
  healthCmd: string;
};

export let MOCK_DEFINITIONS: Record<string, MockDefinition> = {
  'object-store': {
    name: 'object-store',
    port: 52010,
    serverPath: 'object-store/server.ts',
    healthCmd:
      'bun -e "fetch(\'http://localhost:52010/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"'
  },
  voyager: {
    name: 'voyager',
    port: 52060,
    serverPath: 'voyager/server.ts',
    healthCmd:
      'bun -e "fetch(\'http://localhost:52060/\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"'
  },
  relay: {
    name: 'relay',
    port: 52110,
    serverPath: 'relay/server.ts',
    healthCmd:
      'bun -e "fetch(\'http://localhost:52110/ping\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"'
  }
};

export let PRESET_PORTS: Record<string, number> = {
  postgres: 5432,
  redis: 6379,
  nats: 4222
};
