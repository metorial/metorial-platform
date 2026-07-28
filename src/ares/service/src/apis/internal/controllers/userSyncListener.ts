import { v } from '@lowerdeck/validation';
import { db } from '../../../db';
import { getId } from '../../../id';
import { internalApp } from '../_app';

export let userSyncListenerController = internalApp.controller({
  upsert: internalApp
    .handler()
    .input(
      v.object({
        identifier: v.string(),
        callbackUrl: v.string(),
        secret: v.string()
      })
    )
    .do(async ({ input }) => {
      let existing = await db.userSyncListener.findUnique({
        where: { identifier: input.identifier }
      });
      let changed =
        !existing ||
        existing.callbackUrl !== input.callbackUrl ||
        existing.secret !== input.secret;
      let listener = changed
        ? await db.userSyncListener.upsert({
            where: { identifier: input.identifier },
            create: { ...getId('userSyncListener'), ...input },
            update: { callbackUrl: input.callbackUrl, secret: input.secret }
          })
        : existing!;
      return {
        id: listener.id,
        identifier: listener.identifier,
        callbackUrl: listener.callbackUrl,
        createdAt: listener.createdAt,
        updatedAt: listener.updatedAt
      };
    })
});
