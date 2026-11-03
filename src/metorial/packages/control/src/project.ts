import { compileEnv, type EnvInput } from './env';
import { EndpointDefinition } from './endpoint';
import type {
  DatabaseDefinition,
  DependencyDefinition,
  ResourceDefinition
} from './resources';
import type { ControlMode, RawCiImage, RawCiSuite, RawEnv, RawManifest } from './types';

export class DevDefinition {
  constructor(
    readonly input: {
      prepare?: string[];
      run?: string[];
      cleanup?: string[];
      env?: EnvInput;
      expose?: number[];
      databases?: Record<string, DatabaseDefinition>;
    }
  ) {}
}

export let dev = (input: DevDefinition['input']) => new DevDefinition(input);

export class DockerDefinition {
  constructor(readonly spec: { compose?: string[]; services?: string[]; stop?: boolean }) {}
}

export let docker = (spec: DockerDefinition['spec']) => new DockerDefinition(spec);

export class CleanupDefinition {
  constructor(readonly spec: { paths?: string[]; commands?: string[] }) {}
}

export let cleanup = (spec: CleanupDefinition['spec']) => new CleanupDefinition(spec);

export class HealthDefinition {
  constructor(readonly spec: { port: number; path: string; status?: number }) {}
}

export let healthCheck = (port: number, path: string, status?: number) =>
  new HealthDefinition({ port, path, ...(status === undefined ? {} : { status }) });

export class E2eResource {
  constructor(readonly type: 'object-storage') {}
}

export let objectStorage = () => new E2eResource('object-storage');

export class E2eDefinition {
  constructor(
    readonly input: {
      start?: string[];
      image?: string;
      tests?: string[];
      services?: string[];
      healthTimeout?: number;
      env?: EnvInput;
      resources?: E2eResource[];
    }
  ) {}
}

export let e2e = (input: E2eDefinition['input']) => new E2eDefinition(input);

export class CiImageDefinition {
  constructor(readonly spec: RawCiImage) {}
}

export let ciImage = (spec: RawCiImage) => new CiImageDefinition(spec);

export class CiSuiteDefinition {
  constructor(readonly spec: RawCiSuite) {}
}

export let ciSuite = (spec: RawCiSuite) => new CiSuiteDefinition(spec);

export interface CiInput {
  images?: CiImageDefinition[];
  suite?: CiSuiteDefinition;
}

export interface ProjectInput {
  name: string;
  group?: string;
  mode?: ControlMode;
  endpoints?: Record<string, EndpointDefinition>;
  dependencies?: DependencyDefinition[];
  resources?: ResourceDefinition[];
  dev?: DevDefinition;
  docker?: DockerDefinition;
  cleanup?: CleanupDefinition;
  health?: HealthDefinition[];
  e2e?: E2eDefinition;
  ci?: CiInput;
}

export interface RootProjectInput {
  mode: 'oss' | 'enterprise';
  ci?: CiInput;
}

export let PROJECT_BRAND = Symbol.for('metorial.control.project');

export class ProjectDefinition {
  readonly [PROJECT_BRAND] = true;

  constructor(readonly raw: RawManifest) {}
}

export let isProjectDefinition = (value: unknown): value is ProjectDefinition =>
  typeof value === 'object' && value !== null && PROJECT_BRAND in value;

let strip = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

let compileCi = (ci: CiInput | undefined): RawManifest['ci'] =>
  ci
    ? strip({
        images: ci.images?.map(image => image.spec),
        suite: ci.suite?.spec
      })
    : undefined;

let compileDev = (input: DevDefinition['input'] | undefined): RawManifest['dev'] => {
  if (!input) return undefined;

  return strip({
    prepare: input.prepare,
    run: input.run,
    cleanup: input.cleanup,
    env: input.env ? compileEnv(input.env) : undefined,
    expose: input.expose?.map(port => ({ port })),
    db: input.databases
      ? Object.fromEntries(
          Object.entries(input.databases).map(([key, db]) => [
            key,
            { ...db.spec, engine: db.engine }
          ])
        )
      : undefined
  });
};

let compileE2e = (input: E2eDefinition['input'] | undefined): RawManifest['e2e'] => {
  if (!input) return undefined;

  return strip({
    start: input.start,
    image: input.image,
    tests: input.tests,
    services: input.services,
    health_timeout: input.healthTimeout,
    env: input.env ? (compileEnv(input.env) as RawEnv) : undefined,
    resources: input.resources?.map(resource => ({ type: resource.type }))
  });
};

export let project = (input: ProjectInput): ProjectDefinition =>
  new ProjectDefinition(
    strip({
      name: input.name,
      group: input.group,
      mode: input.mode,
      dependencies: input.dependencies?.map(item => item.toRaw()),
      endpoints: input.endpoints
        ? Object.fromEntries(
            Object.entries(input.endpoints).map(([name, item]) => [name, item.toRaw()])
          )
        : undefined,
      resources: input.resources?.map(item => strip({ type: item.type, env: item.env })),
      dev: compileDev(input.dev?.input),
      docker: input.docker?.spec,
      cleanup: input.cleanup?.spec,
      health: input.health?.map(item => item.spec),
      e2e: compileE2e(input.e2e?.input),
      ci: compileCi(input.ci)
    })
  );

export let rootProject = (input: RootProjectInput): ProjectDefinition =>
  new ProjectDefinition(strip({ mode: input.mode, ci: compileCi(input.ci) }));

export let compile = (definition: ProjectDefinition): RawManifest => definition.raw;
