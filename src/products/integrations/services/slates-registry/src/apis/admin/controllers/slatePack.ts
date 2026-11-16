import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { SlatePackRelease } from '../../../../prisma/generated/client';
import { buildSlatePackChannelQueue } from '../../../queues/packs/channels';
import { canBuildPacks, slatePackChannelService } from '../../../services/slatePackChannel';
import { app } from './_app';
import { tenantApp } from './tenant';

let presentRelease = (release: SlatePackRelease) => ({
  id: release.id,
  kind: release.kind,
  status: release.status,
  sequence: release.sequence,
  fullSyncId: release.fullSyncId,
  part: release.part,
  partCount: release.partCount,
  coversSequence: release.coversSequence,
  fileName: release.fileName,
  entryCount: release.entryCount,
  size: Number(release.size),
  sha256: release.sha256,
  createdAt: release.createdAt,
  prunedAt: release.prunedAt
});

export let slatePackController = app.controller({
  overview: tenantApp
    .handler()
    .input(v.object({ tenantId: v.string() }))
    .do(async ctx => {
      if (canBuildPacks()) await slatePackChannelService.ensureChannels();

      let channels = await slatePackChannelService.listChannelsForTenant({
        tenantOid: ctx.tenant.oid
      });

      return {
        canBuildPacks: canBuildPacks(),
        versionsWithoutChecksum: await slatePackChannelService.countVersionsWithoutChecksum(),
        channels: channels.map(item => ({
          subRegistry: {
            id: item.channel.subRegistry.id,
            identifier: item.channel.subRegistry.identifier,
            name: item.channel.subRegistry.name
          },
          lastSequence: item.channel.lastSequence,
          lastFullSyncAt: item.channel.lastFullSyncAt,
          lastIncrementalAt: item.channel.lastIncrementalAt,
          lastBuildError: item.channel.lastBuildError,
          lastBuildErrorAt: item.channel.lastBuildErrorAt,
          readyIncrementalCount: item.readyIncrementalCount,
          readyFullCount: item.readyFullCount,
          readySize: Number(item.readySize),
          prunedCount: item.prunedCount
        }))
      };
    }),

  listReleases: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          subRegistryIdentifier: v.string(),
          status: v.optional(v.enumOf(['ready', 'pruned']))
        })
      )
    )
    .do(async ctx => {
      let channel = await slatePackChannelService.getChannelForTenant({
        tenantOid: ctx.tenant.oid,
        subRegistryId: ctx.input.subRegistryIdentifier
      });

      let paginator = await slatePackChannelService.listReleasesForChannel({
        channelOid: channel.oid,
        status: ctx.input.status
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, presentRelease);
    }),

  forceFullSync: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        subRegistryIdentifier: v.string(),
        reset: v.optional(v.boolean()),
        rewindFeed: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      if (!canBuildPacks()) {
        throw new ServiceError(
          badRequestError({
            message: 'This registry cannot build slate packs. It needs root mode and signing.'
          })
        );
      }

      let channel = await slatePackChannelService.getChannelForTenant({
        tenantOid: ctx.tenant.oid,
        subRegistryId: ctx.input.subRegistryIdentifier
      });

      await buildSlatePackChannelQueue.add(
        { channelId: channel.id, forceFullSync: true, reset: ctx.input.reset ?? false,
          rewindFeed: ctx.input.rewindFeed ?? false
        },
        { deduplication: { id: `slate-pack-force-${channel.id}-${Date.now()}` } }
      );

      return { queued: true };
    })
});
