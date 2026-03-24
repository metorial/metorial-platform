import type { SlateInvocationResult } from '../lib/invocation/store';

export let slateDiscoveryBuildOutputPresenter = (buildOutput: SlateInvocationResult | null) => {
  if (!buildOutput) return null;

  return {
    object: 'slate.discovery.build_output' as const,
    logs: buildOutput.logs ?? null,
    status: buildOutput.status ?? null,
    createdAt: buildOutput.createdAt ?? null
  };
};
