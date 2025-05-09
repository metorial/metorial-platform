import { Context } from '@metorial/context';
import { db, ID, User, UserSession, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';
import { Service } from '@metorial/service';

class UserSessionService {
  async createUserSession(d: { user: User; context: Context }) {
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
    return await db.userSession.findFirst({
      where: {
        clientSecret: d.clientSecret
      },
      include: {
        user: true
      }
    });
  }
}

export let userSessionService = Service.create(
  'userSessionService',
  () => new UserSessionService()
).build();
