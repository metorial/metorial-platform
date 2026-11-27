import type { ServiceError } from '@lowerdeck/error';
import type { PatchOperation } from '@lowerdeck/patch';

export type ConfigHookOptions = { enabled?: boolean };

export interface ConfigState<T> {
  value: T;
  isLoading: boolean;
  isReady: boolean;
  error: ServiceError<any> | null;
  patch(operations: PatchOperation[]): Promise<boolean>;
  set(next: T): Promise<boolean>;
}

export type ConfigHook<T, Options extends ConfigHookOptions = ConfigHookOptions> = (
  options?: Options
) => ConfigState<T>;

export type ConfigHookValue<H> = H extends (options?: any) => ConfigState<infer T> ? T : never;

export type ConfigHookOptionsOf<H> = H extends (options?: infer Options) => any
  ? Exclude<Options, undefined>
  : never;
