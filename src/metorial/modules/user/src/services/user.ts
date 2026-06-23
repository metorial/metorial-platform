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
import { db, ID, User, UserType, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { fileReferenceService } from '@metorial/module-file';
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
    return withTransaction(async db => {
      let existingUser = await db.user.findFirst({
        where: {
          email: d.input.email
        }
      });
      if (existingUser) {
        throw new ServiceError(
          conflictError({
            message: 'User with this email already exists'
          })
        );
      }

      await Fabric.fire('user.created:before', d);

      let user = await db.user.create({
        data: {
          id: await ID.generateId('user'),
          status: 'active',
          type: d.type ?? 'user',

          email: d.input.email,
          name: d.input.name,
          image: d.input.image ?? { type: 'default' },

          passwordHash: d.input.password ? await Bun.password.hash(d.input.password) : null
        }
      });

      await Fabric.fire('user.created:after', { ...d, user, performedBy: user });

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

    return withTransaction(async db => {
      await Fabric.fire('user.updated:before', { ...d, performedBy: d.user });

      let nextImage = d.input.image;
      if (d.input.imageFileId !== undefined) {
        nextImage = await fileReferenceService.resolveImageEntityImage({
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' },
          owner: {
            type: 'user',
            userId: d.user.id
          },
          purpose: 'user_image',
          entityType: 'user',
          entityId: d.user.id
        });
      }

      let user = await db.user.update({
        where: { id: d.user.id },
        data: {
          name: d.input.name,
          email: d.input.email,
          image: nextImage,
          firstName: d.input.firstName,
          lastName: d.input.lastName,

          passwordHash: d.input.password
            ? await Bun.password.hash(d.input.password)
            : undefined
        }
      });

      if (d.input.image !== undefined || d.input.imageFileId !== undefined) {
        await fileReferenceService.cleanupImageEntityImage({
          image:
            d.user.image && canonicalize(d.user.image) !== canonicalize(nextImage)
              ? (d.user.image as any)
              : undefined
        });
      }

      await syncUserUpdateQueue.add({
        userId: user.id
      });

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
