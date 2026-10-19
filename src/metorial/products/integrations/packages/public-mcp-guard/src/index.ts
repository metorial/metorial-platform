import { AsyncLocalStorage } from 'node:async_hooks';
import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';

export type PublicMcpAccess = {
  publicMcpServerOid: bigint;
  grantOid?: bigint;
};

export type PublicMcpOwnable = {
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

export let hasPublicMcpAccessTo = (resource: PublicMcpOwnable | null | undefined) => {
  if (!isPublicMcpOwned(resource)) return true;

  let access = getPublicMcpAccess();
  return !!access && access.publicMcpServerOid === resource!.ownerPublicMcpServerOid;
};

export let assertNotPublicMcpOwned = (
  resource: PublicMcpOwnable | null | undefined,
  entity: string
) => {
  if (hasPublicMcpAccessTo(resource)) return;

  throw new ServiceError(
    forbiddenError({
      message: `This ${entity.replaceAll('_', ' ')} belongs to a public MCP server and cannot be used here.`,
      code: 'public_mcp_owned'
    })
  );
};

export let assertNotPublicMcpOwnedOrNotFound = (
  resource: PublicMcpOwnable | null | undefined,
  entity: string
) => {
  if (hasPublicMcpAccessTo(resource)) return;
  throw new ServiceError(notFoundError(entity));
};

export let assertNoneArePublicMcpOwned = (
  resources: (PublicMcpOwnable | null | undefined)[],
  entity: string
) => {
  for (let resource of resources) assertNotPublicMcpOwned(resource, entity);
};

export let excludePublicMcpOwned = () => {
  let access = getPublicMcpAccess();
  if (access) {
    return {
      OR: [
        { ownerPublicMcpServerOid: null },
        { ownerPublicMcpServerOid: access.publicMcpServerOid }
      ]
    };
  }

  return { ownerPublicMcpServerOid: null };
};
