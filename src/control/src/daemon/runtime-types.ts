import type { LogStore } from './logs';
import type { JobInfo, JobKind, Phase, StartOptions, WorkspaceInfo } from './types';
import type { ProjectRoot, WorkspaceMetadata, Environment } from '../types';

export interface Runtime {
  readonly id: string;
  readonly project: ProjectRoot;
  readonly logs: LogStore;
  data: WorkspaceMetadata;
  phase: Phase;
  readonly startable: boolean;

  info(): WorkspaceInfo;
  start(options?: StartOptions): Promise<void>;
  stop(options?: { keepInfra?: boolean }): Promise<void>;
  clean?(): Promise<void>;
  restartWorkspace(options?: { infra?: boolean }): Promise<void>;
  restartUnit(name: string): Promise<void>;
  stopServiceUnit(name: string): Promise<void>;
  startServiceUnit(name: string): Promise<void | unknown>;
  runJob(kind: JobKind, selectors?: string[]): JobInfo;
  shellContext(unit?: string): { cwd: string; env: Environment };
  shutdown(): Promise<void>;
}
