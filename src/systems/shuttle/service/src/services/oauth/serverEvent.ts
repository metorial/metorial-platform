import { Service } from '@mtsrc/service';
import type {
  ServerAuthConfig,
  ServerOAuthSetup
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';

class serverEventServiceImpl {
  async recordServerOAuthSetupEvent(d: {
    serverOAuthSetup: Pick<ServerOAuthSetup, 'oid'>;
    type: string;
    message?: string | null;
    payload?: Record<string, unknown> | null;
    functionInvocationId?: string | null;
    serverConnectionId?: string | null;
  }) {
    return await db.serverOAuthSetupEvent.create({
      data: {
        ...getId('serverOAuthSetupEvent'),
        serverOAuthSetupOid: d.serverOAuthSetup.oid,
        type: d.type,
        message: d.message ?? null,
        payload: d.payload ?? undefined,
        functionInvocationId: d.functionInvocationId ?? null,
        serverConnectionId: d.serverConnectionId ?? null
      }
    });
  }

  async recordServerAuthConfigEvent(d: {
    serverAuthConfig: Pick<ServerAuthConfig, 'oid'>;
    type: string;
    message?: string | null;
    payload?: Record<string, unknown> | null;
    functionInvocationId?: string | null;
    serverConnectionId?: string | null;
  }) {
    return await db.serverAuthConfigEvent.create({
      data: {
        ...getId('serverAuthConfigEvent'),
        serverAuthConfigOid: d.serverAuthConfig.oid,
        type: d.type,
        message: d.message ?? null,
        payload: d.payload ?? undefined,
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
