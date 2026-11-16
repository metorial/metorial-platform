import { useCurrentOrganization } from '../organization/current';
import { createPathConfigHook } from './createPathConfigHook';
import type { ConfigHook, ConfigHookOptionsOf, ConfigHookValue } from './types';

type RecordKeys<T> = {
  [P in keyof T]: T[P] extends any[] ? never : T[P] extends Record<string, any> ? P : never;
}[keyof T] &
  string;

type RecordValue<T, K extends keyof T> = T[K] extends Record<string, infer V> ? V : never;

export let createInstanceScopedConfigHook = <
  H extends ConfigHook<any, any>,
  K extends RecordKeys<ConfigHookValue<H>>
>(
  inner: H,
  key: K
): ConfigHook<
  RecordValue<ConfigHookValue<H>, K> | undefined,
  ConfigHookOptionsOf<H> & { instanceId?: string }
> =>
  createPathConfigHook<
    RecordValue<ConfigHookValue<H>, K> | undefined,
    ConfigHookOptionsOf<H>,
    { instanceId?: string }
  >(inner, options => {
    let organization = useCurrentOrganization();
    let instanceId = options?.instanceId ?? organization.data?.currentInstance?.id;

    return instanceId ? [key, instanceId] : null;
  });

export let createProjectScopedConfigHook = <
  H extends ConfigHook<any, any>,
  K extends RecordKeys<ConfigHookValue<H>>
>(
  inner: H,
  key: K
): ConfigHook<
  RecordValue<ConfigHookValue<H>, K> | undefined,
  ConfigHookOptionsOf<H> & { projectId?: string }
> =>
  createPathConfigHook<
    RecordValue<ConfigHookValue<H>, K> | undefined,
    ConfigHookOptionsOf<H>,
    { projectId?: string }
  >(inner, options => {
    let organization = useCurrentOrganization();
    let projectId = options?.projectId ?? organization.data?.currentProject?.id;

    return projectId ? [key, projectId] : null;
  });
