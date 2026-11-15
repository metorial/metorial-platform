import type { ConfigHook, ConfigHookOptionsOf } from './types';

export let createFlagConfigHook =
  <H extends ConfigHook<boolean | undefined, any>>(
    inner: H,
    config: { defaultValue?: boolean } = {}
  ) =>
  (options?: ConfigHookOptionsOf<H>) => {
    let state = inner(options);
    let enabled = state.value ?? config.defaultValue ?? false;

    return {
      enabled,
      isLoading: state.isLoading,
      isReady: state.isReady,
      error: state.error,

      setEnabled: (next: boolean) => state.set(next),
      toggle: () => state.set(!enabled)
    };
  };
