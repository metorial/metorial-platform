import { canonicalize } from '@lowerdeck/canonicalize';
import {
  conflictError,
  forbiddenError,
  notFoundError,
  notImplementedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  User,
  UserType,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { findUserOidsByEmail, normalizeUserEmail } from '../lib/email';
import { cleanupUserFileImage, resolveUserFileImage } from '../lib/fileImage';
import { syncUserUpdateQueue } from '../queues/syncUserUpdate';

class UserService {
  private async ensureUserActive(user: User) {
    if (user.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted user'
        })
      );
    }
  }

  async createUser(d: {
    input: {
      name: string;
      email: string;
      image?: PrismaJson.EntityImage;
      password?: string;
    };
    type?: UserType;
    context: Context;
  }) {
    let data = { ...d, input: { ...d.input, email: normalizeUserEmail(d.input.email) } };

    return withTransaction(async db => {
      let existingUserOids = await findUserOidsByEmail(data.input.email);
      if (existingUserOids.length) {
        throw new ServiceError(
          conflictError({
            message: 'User with this email already exists'
          })
        );
      }

      await Fabric.fire('user.created:before', data);

      let user = await db.user.create({
        data: {
          id: await ID.generateId('user'),
          status: 'active',
          type: d.type ?? 'user',

          email: data.input.email,
          name: d.input.name,
          image: d.input.image ?? { type: 'default' },

          passwordHash: d.input.password ? await Bun.password.hash(d.input.password) : null
        }
      });

      await Fabric.fire('user.created:after', { ...data, user, performedBy: user });

      return user;
    });
  }

  async updateUser(d: {
    user: User;
    input: {
      name?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      image?: PrismaJson.EntityImage;
      imageFileId?: string | null;
      password?: string;
    };
    context: Context;
  }) {
    await this.ensureUserActive(d.user);

    let nextEmail =
      d.input.email !== undefined &&
      normalizeUserEmail(d.input.email) !== normalizeUserEmail(d.user.email)
        ? normalizeUserEmail(d.input.email)
        : undefined;

    return withTransaction(async db => {
      if (nextEmail !== undefined) {
        let existingUserOids = await findUserOidsByEmail(nextEmail);
        if (existingUserOids.length) {
          throw new ServiceError(
            conflictError({
              message: 'User with this email already exists'
            })
          );
        }
      }

      await Fabric.fire('user.updated:before', { ...d, performedBy: d.user });

      let nextImage = d.input.image;
      if (d.input.imageFileId !== undefined) {
        nextImage = await resolveUserFileImage({
          user: d.user,
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' }
        });
      }

      let user = await db.user.update({
        where: { id: d.user.id },
        data: {
          name: d.input.name,
          email: nextEmail,
          image: nextImage,
          firstName: d.input.firstName,
          lastName: d.input.lastName,

          passwordHash: d.input.password
            ? await Bun.password.hash(d.input.password)
            : undefined
        }
      });

      if (d.input.image !== undefined || d.input.imageFileId !== undefined) {
        await cleanupUserFileImage(
          d.user.image && canonicalize(d.user.image) !== canonicalize(nextImage)
            ? (d.user.image as any)
            : undefined
        );
      }

      await addAfterTransactionHook(() =>
        syncUserUpdateQueue.add({
          userId: user.id
        })
      );

      await Fabric.fire('user.updated:after', { ...d, user, performedBy: d.user });

      return user;
    });
  }

  async deleteUser(d: { user: User; context: Context }) {
    throw new ServiceError(
      notImplementedError({
        message: 'User deletion is not supported yet'
      })
    );

    await this.ensureUserActive(d.user);

    return withTransaction(async db => {
      await Fabric.fire('user.deleted:before', { ...d, performedBy: d.user });

      let user = await db.user.update({
        where: { id: d.user.id },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        }
      });

      await Fabric.fire('user.deleted:after', { ...d, user, performedBy: d.user });

      return user;
    });
  }

  async getUser(d: { userId: string }) {
    let user = await db.user.findUnique({
      where: { id: d.userId }
    });
    if (!user) throw new ServiceError(notFoundError('user', d.userId));

    return user;
  }
}

export let userService = Service.create('userService', () => new UserService()).build();
