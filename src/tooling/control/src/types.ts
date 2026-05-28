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

export type ControlBuildStep = {
  run: string;
  cwd?: string;
  mode?: 'default' | 'cache-warm';
};

export type ControlBuildCopy = {
  from: string;
  to: string;
};

export type ControlBuildAutomation = {
  name: string;
  kind: 'run-targets' | 'run-dependents';
  target: string;
  projects: string[];
  project_filter?: string;
};

export type ControlBuildRuntime = {
  base_image?: string;
  packages?: string[];
  env?: Record<string, string>;
  expose?: number[];
  command?: string;
  healthcheck?: string;
  user?: string;
  workdir?: string;
};

export type ControlBuildRuntimePrismaSchema = {
  name: string;
  path: string;
};

export type ControlBuildRuntimeSkeleton = {
  enabled?: boolean;
  source?: string;
  install_command?: string;
  migrate?: boolean;
  prisma_schemas?: ControlBuildRuntimePrismaSchema[];
};

export type ControlBuildInstallLayer = {
  name?: string;
  tool?: 'bun' | 'go' | 'cargo' | 'custom';
  cwd?: string;
  manifests?: string[];
  command?: string;
};

export type ControlBuildConfig = {
  builder: 'node' | 'rust' | 'go';
  mode?: 'generated' | 'custom' | 'generated-with-overlay';
  context?: string;
  project?: string;
  target?: string;
  automations?: ControlBuildAutomation[];
  extra_paths?: string[];
  dockerfile?: string;
  runner_stage?: 'generated' | 'custom';
  workspace_root?: string;
  builder_image?: {
    image?: string;
  };
  install?: {
    strategy?: string;
    linker?: string;
    lockfile?: string;
    system_packages?: string[];
    layers?: ControlBuildInstallLayer[];
  };
  manifests?: {
    files?: string[];
  };
  inputs?: {
    paths?: string[];
    packages?: string[];
    include_paths?: string[];
    generated_paths?: string[];
  };
  codegen?: {
    steps?: ControlBuildStep[];
  };
  prebuild?: {
    steps?: ControlBuildStep[];
  };
  main?: {
    steps?: ControlBuildStep[];
  };
  artifacts?: {
    copy?: ControlBuildCopy[];
  };
  runtime?: ControlBuildRuntime;
  runtime_skeleton?: ControlBuildRuntimeSkeleton;
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
      setup?: string[];
      cwd?: string;
    };
  };
  env?: Record<string, string>;
  databases?: ControlDatabase[];
  deps?: ControlDep[];
  build?: ControlBuildConfig;
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
  session?: WorkspaceSession | null;
  keep?: boolean;
  noStage?: boolean;
};

export type GeneratedBuildPath = {
  pattern: string;
  absolutePath: string;
  relativeToService: string;
  relativeToContext: string;
  exists: boolean;
};

export type GeneratedBuildStep = {
  run: string;
  cwd?: string;
  cwdAbsolute?: string;
  cwdRelativeToContext?: string;
  mode: 'default' | 'cache-warm';
};

export type GeneratedBuildAutomation = {
  name: string;
  kind: 'run-targets' | 'run-dependents';
  target: string;
  projects: string[];
  command: string;
};

export type GeneratedBuildInstallLayer = {
  name: string;
  tier?: 'shared' | 'clients' | 'dependencies' | 'service';
  tool: 'bun' | 'go' | 'cargo' | 'custom';
  command: string;
  cwd?: string;
  cwdAbsolute?: string;
  cwdRelativeToContext?: string;
  manifestFiles: GeneratedBuildPath[];
};

export type GeneratedBuildSourceLayer = {
  name: string;
  tier: 'shared' | 'clients' | 'dependencies' | 'service';
  inputPaths: GeneratedBuildPath[];
  projects: string[];
  commands: string[];
};

export type GeneratedBuildArtifact = {
  from: string;
  to: string;
  fromAbsolute: string;
  fromRelativeToContext: string;
};

export type GeneratedBuildRuntimePrismaSchema = {
  name: string;
  path: GeneratedBuildPath;
};

export type GeneratedBuildRuntimeSkeleton = {
  enabled: boolean;
  source?: GeneratedBuildPath;
  installCommand: string;
  migrate: boolean;
  needsPrisma: boolean;
  prismaSchemas: GeneratedBuildRuntimePrismaSchema[];
};

export type GeneratedBuildPlan = {
  builder: 'node' | 'rust' | 'go';
  service: ControlService;
  mode: 'generated' | 'custom' | 'generated-with-overlay';
  contextKind: 'oss' | 'repo' | 'relative';
  contextRoot: string;
  dockerfilePath: string;
  workspaceRoot: string;
  manifestFiles: GeneratedBuildPath[];
  inputPaths: GeneratedBuildPath[];
  installLayers: GeneratedBuildInstallLayer[];
  sourceLayers: GeneratedBuildSourceLayer[];
  automations: GeneratedBuildAutomation[];
  codegenSteps: GeneratedBuildStep[];
  prebuildSteps: GeneratedBuildStep[];
  mainSteps: GeneratedBuildStep[];
  artifacts: GeneratedBuildArtifact[];
  runtime: Required<ControlBuildRuntime>;
  runtimeSkeleton?: GeneratedBuildRuntimeSkeleton;
  project?: string;
  target?: string;
  serviceDockerfile?: string;
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
  session?: WorkspaceSession | null;
  noStage?: boolean;
  e2eModules?: string[];
};

export type WorkspaceSession = {
  id: string;
  repoRoot: string;
  realEntrypoint: string;
  stagedEntrypoint: string;
  stagedOssRoot: string;
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
