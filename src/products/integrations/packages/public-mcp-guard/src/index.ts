import { AsyncLocalStorage } from 'node:async_hooks';
import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';

export type PublicMcpGuardedEntity =
  | 'session'
  | 'session_provider'
  | 'provider_config'
  | 'provider_auth_config';

export type PublicMcpGrantResources = {
  session?: bigint | null;
  provider_config?: bigint | null;
  provider_auth_config?: bigint | null;
};

export type PublicMcpAccess = {
  publicMcpServerOid: bigint;
  grantOid?: bigint;
  // When a grant is set, only the resources listed here are reachable. Anything else a public
  // server owns belongs to another end user.
  grantResources?: PublicMcpGrantResources;
};

export type PublicMcpOwnable = {
  oid?: bigint;
  sessionOid?: bigint;
  ownerPublicMcpServerOid?: bigint | null;
};

// Public MCP owned resources hold an end user's credentials. Only the public MCP
// module may touch them, and it does so by running inside this capability scope.
let storage = new AsyncLocalStorage<PublicMcpAccess>();

export let runWithPublicMcpAccess = <T>(access: PublicMcpAccess, fn: () => T) =>
  storage.run(access, fn);

export let getPublicMcpAccess = () => storage.getStore() ?? null;

export let isPublicMcpOwned = (resource: PublicMcpOwnable | null | undefined) =>
  !!resource?.ownerPublicMcpServerOid;

let belongsToGrant = (
  access: PublicMcpAccess,
  resource: PublicMcpOwnable,
  entity: PublicMcpGuardedEntity | undefined
) => {
  if (!access.grantResources) return true;
  if (!entity) return false;

  if (entity === 'session_provider') {
    return !!resource.sessionOid && resource.sessionOid === access.grantResources.session;
  }

  return !!resource.oid && resource.oid === access.grantResources[entity];
};

export let hasPublicMcpAccessTo = (
  resource: PublicMcpOwnable | null | undefined,
  entity?: PublicMcpGuardedEntity
) => {
  if (!isPublicMcpOwned(resource)) return true;

  let access = getPublicMcpAccess();
  if (!access || access.publicMcpServerOid !== resource!.ownerPublicMcpServerOid) return false;

  return belongsToGrant(access, resource!, entity);
};

export let assertNotPublicMcpOwned = (
  resource: PublicMcpOwnable | null | undefined,
  entity: PublicMcpGuardedEntity | (string & {})
) => {
  if (hasPublicMcpAccessTo(resource, entity as PublicMcpGuardedEntity)) return;

  throw new ServiceError(
    forbiddenError({
      message: `This ${entity.replaceAll('_', ' ')} belongs to a public MCP server and cannot be used here.`,
      code: 'public_mcp_owned'
    })
  );
};

export let assertNotPublicMcpOwnedOrNotFound = (
  resource: PublicMcpOwnable | null | undefined,
  entity: PublicMcpGuardedEntity | (string & {})
) => {
  if (hasPublicMcpAccessTo(resource, entity as PublicMcpGuardedEntity)) return;
  throw new ServiceError(notFoundError(entity));
};

export let assertNoneArePublicMcpOwned = (
  resources: (PublicMcpOwnable | null | undefined)[],
  entity: PublicMcpGuardedEntity | (string & {})
) => {
  for (let resource of resources) assertNotPublicMcpOwned(resource, entity);
};

// Inside a public MCP scope a resource must be owned by the server. An unowned one would be the
// organization's own, such as the deployment's default auth config.
export let assertPublicMcpScopeUsesOwned = (
  resource: PublicMcpOwnable | null | undefined,
  entity: PublicMcpGuardedEntity | (string & {})
) => {
  if (!resource || !getPublicMcpAccess() || isPublicMcpOwned(resource)) return;

  throw new ServiceError(
    forbiddenError({
      message: `A public MCP server can only use ${entity.replaceAll('_', ' ')}s that belong to it.`,
      code: 'public_mcp_unowned_resource'
    })
  );
};
