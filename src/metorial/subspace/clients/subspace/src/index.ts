/**
 * Subspace RPC controllers have been removed. This client is intentionally
 * stubbed until callers cut over to @metorial-subspace/module-* services.
 */
export type SubspaceControllerClient = Record<string, never>;

export let createSubspaceControllerClient = (_o?: unknown): SubspaceControllerClient => {
  throw new Error(
    'Subspace RPC client is no longer available. Call @metorial-subspace/module-* services directly.'
  );
};
