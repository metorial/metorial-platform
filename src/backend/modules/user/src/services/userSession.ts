import { notImplementedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import { db, ID, User, UserSession, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';

class UserSessionService {
  async createUserSession(d: { user: User; context: Context }) {
    if (d.user.type === 'system') {
      throw new ServiceError(
        notImplementedError({
          message: 'System users cannot create sessions'
        })
      );
    }

    return withTransaction(async db => {
      await Fabric.fire('user.session.created:before', { ...d, performedBy: d.user });

      let session = await db.userSession.create({
        data: {
          id: await ID.generateId('userSession'),
          userOid: d.user.oid,
          clientSecret: generateCustomId('metorial_ses', 50)
        }
      });

      await Fabric.fire('user.session.created:after', {
        ...d,
        session,
        performedBy: d.user
      });

      return session;
    });
  }

  async deleteUserSession(d: { user: User; session: UserSession; context: Context }) {
    if (d.user.type === 'system') {
      throw new ServiceError(
        notImplementedError({
          message: 'System users cannot delete sessions'
        })
      );
    }

    return withTransaction(async db => {
      await Fabric.fire('user.session.deleted:before', { ...d, performedBy: d.user });

      let session = await db.userSession.delete({
        where: { oid: d.session.oid }
      });

      await Fabric.fire('user.session.deleted:after', {
        ...d,
        session,
        performedBy: d.user
      });

      return session;
    });
  }

  async getSessionByClientSecretSafe(d: { clientSecret: string; context: Context }) {
    let session = await db.userSession.findFirst({
      where: {
        clientSecret: d.clientSecret
      },
      include: {
        user: true
      }
    });

    if (session?.user.type === 'system') {
      throw new ServiceError(
        notImplementedError({
          message: 'System users cannot create sessions'
        })
      );
    }

    return session;
  }
}

export let userSessionService = Service.create(
  'userSessionService',
  () => new UserSessionService()
).build();
