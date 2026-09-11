import { Service } from '@lowerdeck/service';
import type { ServerAuthConfig, ServerOAuthSetup } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { redactJsonShape } from '../../lib/redactJsonShape';
import { redactSensitiveKeys } from '../../lib/redactSensitiveKeys';

let getTenantRetention = async (tenantOid: bigint) => {
  let tenant = await db.tenant.findUnique({
    where: { oid: tenantOid },
    select: { collectErrors: true, storeContent: true }
  });

  return {
    collectErrors: tenant?.collectErrors ?? true,
    storeContent: tenant?.storeContent ?? true
  };
};

let buildPayload = (
  payload: Record<string, unknown> | null | undefined,
  retention: { collectErrors: boolean; storeContent: boolean }
) => {
  if (!payload) return undefined;
  if (!retention.collectErrors) return undefined;

  let safePayload = redactSensitiveKeys(payload) as Record<string, unknown>;
  return retention.storeContent
    ? safePayload
    : (redactJsonShape(safePayload) as Record<string, unknown>);
};

class serverEventServiceImpl {
  async recordServerOAuthSetupEvent(d: {
    serverOAuthSetup: Pick<ServerOAuthSetup, 'oid' | 'tenantOid'>;
    type: string;
    message?: string | null;
    payload?: Record<string, unknown> | null;
    functionInvocationId?: string | null;
    serverConnectionId?: string | null;
  }) {
    let retention = await getTenantRetention(d.serverOAuthSetup.tenantOid);

    return await db.serverOAuthSetupEvent.create({
      data: {
        ...getId('serverOAuthSetupEvent'),
        serverOAuthSetupOid: d.serverOAuthSetup.oid,
        type: d.type,
        message: d.message ?? null,
        payload: buildPayload(d.payload, retention),
        functionInvocationId: d.functionInvocationId ?? null,
        serverConnectionId: d.serverConnectionId ?? null
      }
    });
  }

  async recordServerAuthConfigEvent(d: {
    serverAuthConfig: Pick<ServerAuthConfig, 'oid' | 'tenantOid'>;
    type: string;
    message?: string | null;
    payload?: Record<string, unknown> | null;
    functionInvocationId?: string | null;
    serverConnectionId?: string | null;
  }) {
    let retention = await getTenantRetention(d.serverAuthConfig.tenantOid);

    return await db.serverAuthConfigEvent.create({
      data: {
        ...getId('serverAuthConfigEvent'),
        serverAuthConfigOid: d.serverAuthConfig.oid,
        type: d.type,
        message: d.message ?? null,
        payload: buildPayload(d.payload, retention),
        functionInvocationId: d.functionInvocationId ?? null,
        serverConnectionId: d.serverConnectionId ?? null
      }
    });
  }
}

export let serverEventService = Service.create(
  'serverEventService',
  () => new serverEventServiceImpl()
).build();
