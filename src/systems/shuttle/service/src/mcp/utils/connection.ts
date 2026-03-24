import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { ServerConnection } from '../../../prisma/generated/client';
import { db } from '../../db';

let activeConnections = new Set<string>();

export class ConnectionManager {
  constructor(private readonly connection: ServerConnection) {
    if (connection.status == 'disconnected') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot use a disconnected connection'
        })
      );
    }

    activeConnections.add(connection.id);

    this.init();
  }

  close() {
    activeConnections.delete(this.connection.id);
  }

  private async init() {
    await db.serverConnection.update({
      where: { id: this.connection.id },
      data: { status: 'connected', lastPingAt: new Date() }
    });
  }
}

setInterval(async () => {
  let cons = [...activeConnections];

  await db.serverConnection.updateMany({
    where: { id: { in: cons } },
    data: { lastPingAt: new Date() }
  });
}, 30 * 1000);
