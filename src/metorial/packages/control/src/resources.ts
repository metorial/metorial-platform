import type { RawDependency, RawKeyValue, Template } from './types';

export class DependencyDefinition {
  constructor(readonly spec: RawDependency) {}

  noStart() {
    return new DependencyDefinition({ ...this.spec, start: false });
  }

  env(endpoint: string, key: string, value: Template) {
    return new DependencyDefinition({
      ...this.spec,
      env: [...(this.spec.env ?? []), { endpoint, key, value }]
    });
  }

  toRaw(): string | RawDependency {
    return this.spec.start === undefined && !this.spec.env?.length
      ? this.spec.identifier
      : this.spec;
  }
}

export let dependency = (identifier: string) => new DependencyDefinition({ identifier });

export type ResourceType = 'redis' | 'nats' | 'etcd' | 'mail';

export class ResourceDefinition {
  constructor(
    readonly type: ResourceType,
    readonly env: RawKeyValue[]
  ) {}
}

let resource =
  (type: ResourceType) =>
  (env: Record<string, Template> = {}) =>
    new ResourceDefinition(
      type,
      Object.entries(env).map(([key, value]) => ({ key, value }))
    );

export let redis = resource('redis');
export let nats = resource('nats');
export let etcd = resource('etcd');
export let mail = resource('mail');

export class DatabaseDefinition {
  constructor(
    readonly engine: 'postgres' | 'mongodb',
    readonly spec: { package: string; name: string; env: string }
  ) {}
}

export let postgres = (spec: { package: string; name: string; env: string }) =>
  new DatabaseDefinition('postgres', spec);

export let mongodb = (spec: { package: string; name: string; env: string }) =>
  new DatabaseDefinition('mongodb', spec);
