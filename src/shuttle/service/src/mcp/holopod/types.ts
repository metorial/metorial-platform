export enum ContainerState {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  EXITED = 'EXITED',
  FAILED = 'FAILED',
  TERMINATED = 'TERMINATED'
}

export type BasicAuth = {
  username: string;
  password: string;
};

export type ImageSpec = {
  registry?: string;
  image: string;
  basicAuth?: BasicAuth;
};

export type ResourceLimits = {
  cpuLimit?: string;
  memoryLimit?: string;
};

export type NetworkRule = {
  action: string;
  protocol?: string;
  destination?: string;
  portRangeStart?: number;
  portRangeEnd?: number;
};

export type NetworkConfig = {
  rules: NetworkRule[];
  defaultPolicy?: string;
  dnsServers: string[];
};

export type ContainerConfig = {
  imageSpec: ImageSpec;
  command: string[];
  args: string[];
  workdir?: string;
  env: Record<string, string>;
  resources?: ResourceLimits;
  network?: NetworkConfig;
  timeoutSecs?: number;
  cleanup?: boolean;
};

export type CreateContainer = {
  containerId?: string;
  config?: ContainerConfig;
};

export type TerminateContainer = {
  force: boolean;
  timeoutSecs: number;
};

export type RunRequest = {
  create?: CreateContainer;
  stdin?: Buffer;
  closeStdin?: boolean;
  terminate?: TerminateContainer;
  heartbeat?: boolean;
};

export type ContainerCreated = {
  containerId: string;
  state: ContainerState;
};

export type ContainerExit = {
  exitCode: number;
  timestamp: string;
};

export type RunResponse = {
  containerId: string;
  created?: ContainerCreated;
  stdout?: Buffer;
  stderr?: Buffer;
  exit?: ContainerExit;
  error?: string;
  message?: string;
};

export type HealthResponse = {
  healthy: boolean;
  version: string;
  runningContainers: number;
  totalContainers: number;
  isolationRunnerPath?: string;
  healthIssues: string[];
};
