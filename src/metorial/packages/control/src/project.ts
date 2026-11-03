import { compileEnv, type EnvInput } from './env';
import { EndpointDefinition } from './endpoint';
import type {
  DatabaseDefinition,
  DependencyDefinition,
  ResourceDefinition
} from './resources';
import type {
  ControlMode,
  RawCiImage,
  RawDockerfile,
  RawCiSuite,
  RawEnv,
  RawManifest,
  RawStack,
  RawStackMember,
  RawStackProduction
} from './types';

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

export class DockerfileDefinition {
  constructor(readonly spec: RawDockerfile) {}
}

export let dockerfile = (spec: RawDockerfile) => new DockerfileDefinition(spec);

export class CiSuiteDefinition {
  constructor(readonly spec: RawCiSuite) {}
}

export let ciSuite = (spec: RawCiSuite) => new CiSuiteDefinition(spec);

export class StackDefinition {
  constructor(readonly spec: RawStack) {}
}

export let stack = (spec: RawStack) => new StackDefinition(spec);

export interface StackMemberInput {
  mode?: 'oss' | 'enterprise';
  init?: boolean;
  volumes?: Record<string, string>;
  env?: EnvInput;
  development?:
    | false
    | {
        container?: boolean;
        run?: string[];
        env?: EnvInput;
      };
  production?:
    | false
    | {
        image?: string;
        dockerfile?: string;
        workspace?: string;
        args?: Record<string, string>;
        command?: string;
        target?: string;
        env?: EnvInput;
      };
}

export class StackMemberDefinition {
  constructor(readonly spec: RawStackMember) {}
}

export let stackMember = (input: StackMemberInput = {}) => {
  let production: RawStackProduction | undefined;
  if (input.production === false) production = { disabled: true };
  else if (input.production) {
    let { env, ...rest } = input.production;
    production = strip({ ...rest, env: env ? compileEnv(env) : undefined });
  }

  let development: RawStackMember['development'];
  if (input.development === false) development = { disabled: true };
  else if (input.development)
    development = strip({
      container: input.development.container,
      run: input.development.run,
      env: input.development.env ? compileEnv(input.development.env) : undefined
    });

  return new StackMemberDefinition(
    strip({
      mode: input.mode,
      init: input.init,
      volumes: input.volumes,
      env: input.env ? compileEnv(input.env) : undefined,
      development,
      production
    })
  );
};

export interface CiInput {
  images?: CiImageDefinition[];
  dockerfiles?: DockerfileDefinition[];
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
  stacks?: Record<string, StackMemberDefinition>;
  stackOnly?: boolean;
}

export interface RootProjectInput {
  mode: 'oss' | 'enterprise';
  ci?: CiInput;
  stacks?: StackDefinition[];
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
        dockerfiles: ci.dockerfiles?.map(item => item.spec),
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
      stack_only: input.stackOnly,
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
      ci: compileCi(input.ci),
      stacks: input.stacks
        ? Object.fromEntries(
            Object.entries(input.stacks).map(([id, member]) => [id, member.spec])
          )
        : undefined
    })
  );

export let rootProject = (input: RootProjectInput): ProjectDefinition =>
  new ProjectDefinition(
    strip({
      mode: input.mode,
      ci: compileCi(input.ci),
      stack_definitions: input.stacks?.map(item => item.spec)
    })
  );

export let compile = (definition: ProjectDefinition): RawManifest => definition.raw;
