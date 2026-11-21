import { allPlatformConnections } from '../definitions/platformConnections';
import { checkIntervalMs, runProviderCheck } from './check';
import { createPlatformConnectionRegistry } from './platformRegistry';

export let platformConnectionRegistry = createPlatformConnectionRegistry({
  definitions: allPlatformConnections,
  check: async d => (await runProviderCheck(d)).result,
  onStatusChange: state =>
    console.log(
      `[ai-gateway] platform connection ${state.slug} is ${state.status}`,
      state.statusMessage ?? ''
    )
});

let checkTimer: ReturnType<typeof setInterval> | null = null;

export let startPlatformConnectionChecks = () => {
  if (checkTimer) return;

  for (let state of platformConnectionRegistry.list()) {
    if (!state.configured) {
      console.log(
        `[ai-gateway] platform connection ${state.slug} is disabled:`,
        state.statusMessage
      );
    }
  }

  void platformConnectionRegistry.checkAll();
  checkTimer = setInterval(
    () => void platformConnectionRegistry.checkAll(),
    checkIntervalMs()
  );
  checkTimer.unref?.();
};
