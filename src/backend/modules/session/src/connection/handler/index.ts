import { getFullConfig } from '@metorial/config';
import {
  Instance,
  Organization,
  ServerDeployment,
  ServerSession,
  ServerVariant
} from '@metorial/db';
import { BaseConnectionHandler } from './base';
import { EngineConnectionHandler } from './engine';
import { LegacyConnectionHandler } from './legacy';

export abstract class ConnectionHandler {
  static async create(
    session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    instance: Instance & { organization: Organization },
    opts: { mode: 'send-only' | 'send-and-receive' }
  ): Promise<BaseConnectionHandler> {
    let config = await getFullConfig();
    if (config.sessionRunner == 'legacy') {
      return LegacyConnectionHandler.create(session, instance, opts);
    }

    return EngineConnectionHandler.create(session, instance);
  }
}
