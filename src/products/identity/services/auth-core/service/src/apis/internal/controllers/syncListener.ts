import { v } from '@lowerdeck/validation';
import { db } from '../../../db';
import { getId } from '../../../id';
import { aresSyncEventTypes } from '../../../lib/syncEvents';
import { internalApp } from '../_app';

let sameEventTypes = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

export let syncListenerController = internalApp.controller({
  upsert: internalApp
    .handler()
    .input(
      v.object({
        identifier: v.string(),
        callbackUrl: v.string(),
        secret: v.string(),
        eventTypes: v.optional(v.array(v.enumOf([...aresSyncEventTypes])))
      })
    )
    .do(async ({ input }) => {
      let eventTypes = input.eventTypes ?? ['user.changed'];

      let existing = await db.syncListener.findUnique({
        where: { identifier: input.identifier }
      });

      let changed =
        !existing ||
        existing.callbackUrl !== input.callbackUrl ||
        existing.secret !== input.secret ||
        !sameEventTypes(existing.eventTypes, eventTypes);

      let listener = changed
        ? await db.syncListener.upsert({
            where: { identifier: input.identifier },
            create: {
              ...getId('syncListener'),
              identifier: input.identifier,
              callbackUrl: input.callbackUrl,
              secret: input.secret,
              eventTypes
            },
            update: {
              callbackUrl: input.callbackUrl,
              secret: input.secret,
              eventTypes
            }
          })
        : existing!;

      return {
        id: listener.id,
        identifier: listener.identifier,
        callbackUrl: listener.callbackUrl,
        eventTypes: listener.eventTypes,
        createdAt: listener.createdAt,
        updatedAt: listener.updatedAt
      };
    })
});
