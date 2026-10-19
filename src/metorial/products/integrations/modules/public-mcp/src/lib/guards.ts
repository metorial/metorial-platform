import type { PublicMcpAccess } from '@metorial-subspace/public-mcp-guard';

export {
  assertNoneArePublicMcpOwned,
  assertNotPublicMcpOwned,
  assertNotPublicMcpOwnedOrNotFound,
  assertPublicMcpScopeUsesOwned,
  getPublicMcpAccess,
  hasPublicMcpAccessTo,
  isPublicMcpOwned,
  runWithPublicMcpAccess
} from '@metorial-subspace/public-mcp-guard';

export let createPublicMcpGrantAccess = (d: {
  grant: {
    oid: bigint;
    publicMcpServerOid: bigint;
    configOid: bigint | null;
    authConfigOid: bigint | null;
    currentSessionOid: bigint | null;
  };
  sessionOid?: bigint | null;
}): PublicMcpAccess => ({
  publicMcpServerOid: d.grant.publicMcpServerOid,
  grantOid: d.grant.oid,
  grantResources: {
    session: d.sessionOid ?? d.grant.currentSessionOid,
    provider_config: d.grant.configOid,
    provider_auth_config: d.grant.authConfigOid
  }
});
