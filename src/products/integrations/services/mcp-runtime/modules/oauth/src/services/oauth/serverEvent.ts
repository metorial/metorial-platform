import { Service } from '@lowerdeck/service';
import type { ServerAuthConfig, ServerOAuthSetup } from '@mtsrc/mcp-runtime-db';
import { db } from '@mtsrc/mcp-runtime-db';
import { getId } from '@mtsrc/mcp-runtime-db';
import { redactJsonShape } from '@mtsrc/mcp-runtime-data-utils';
import { redactSensitiveKeys } from '@mtsrc/mcp-runtime-data-utils';

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
