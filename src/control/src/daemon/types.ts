export type Phase =
  'idle' | 'infra' | 'preparing' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';

export type UnitState =
  'stopped' | 'starting' | 'running' | 'restarting' | 'crashed' | 'healthy';

export interface UnitInfo {
  name: string;
  kind: 'service' | 'infra';
  state: UnitState;
  pid?: number;
  restarts: number;
  startedAt?: number;
  exitCode?: number | null;
  ports: number[];
}

export interface JobInfo {
  id: number;
  kind: string;
  state: 'running' | 'done' | 'failed';
  startedAt: number;
  endedAt?: number;
  error?: string;
}

export interface LinkInfo {
  label: string;
  group: 'app' | 'admin' | 'tool';
  url: string;
}

export interface WorkspaceInfo {
  id: string;
  root: string;
  branch: string;
  hostname: string;
  phase: Phase;
  error?: string;
  startedAt?: number;
  units: UnitInfo[];
  jobs: JobInfo[];
  links: LinkInfo[];
}

export interface StartOptions {
  selectors?: string[];
  noDocker?: boolean;
  noPrepare?: boolean;
  noProxy?: boolean;
}

export let jobKinds = ['db:generate', 'db:push', 'db:migrate', 'prepare'] as const;
export type JobKind = (typeof jobKinds)[number];
