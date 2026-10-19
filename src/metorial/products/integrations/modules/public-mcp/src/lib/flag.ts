import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { flagService, isFlagEnabled } from '@metorial/module-flags';

let CACHE_TTL_MS = 30_000;
let enabledCache = new Map<bigint, { enabled: boolean; expiresAt: number }>();

let loadEnabled = async (d: { instanceOid: bigint }) => {
  let instance = await metorialDb.instance.findUnique({
    where: { oid: d.instanceOid },
    include: { organization: true, project: true }
  });
  if (!instance) return false;

  let flags = await flagService.getFlags({
    organization: instance.organization,
    project: instance.project
  });

  return isFlagEnabled(flags['public-mcp-servers-enabled']);
};

export let isPublicMcpEnabledForInstance = async (d: { instanceOid: bigint }) => {
  let cached = enabledCache.get(d.instanceOid);
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;

  let enabled = await loadEnabled(d);
  enabledCache.set(d.instanceOid, { enabled, expiresAt: Date.now() + CACHE_TTL_MS });

  return enabled;
};

export let assertPublicMcpEnabled = async (d: { instanceOid: bigint }) => {
  if (await loadEnabled(d)) return;

  throw new ServiceError(
    forbiddenError({
      message: 'Public MCP servers are not enabled for this organization.',
      code: 'public_mcp_not_enabled'
    })
  );
};

export let assertPublicMcpEnabledOrNotFound = async (d: { instanceOid: bigint }) => {
  if (await isPublicMcpEnabledForInstance(d)) return;
  throw new ServiceError(notFoundError('public_mcp_server'));
};
