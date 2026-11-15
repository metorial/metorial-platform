import { createPathConfigHook } from './createPathConfigHook';
import type { ConfigHook, ConfigHookOptionsOf, ConfigHookValue } from './types';

export let createFieldConfigHook = <
  H extends ConfigHook<any, any>,
  K extends keyof ConfigHookValue<H> & string
>(
  inner: H,
  key: K
): ConfigHook<ConfigHookValue<H>[K], ConfigHookOptionsOf<H>> =>
  createPathConfigHook<ConfigHookValue<H>[K], ConfigHookOptionsOf<H>>(inner, () => [key]);
