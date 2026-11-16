import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { SlatePackRelease } from '../../../../prisma/generated/client';
import { buildSlatePackChannelQueue } from '../../../queues/packs/channels';
import { slatePackBuildService } from '../../../services/slatePackBuild';
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

let presentBuild = (build: {
  id: string;
  status: 'running' | 'completed' | 'failed';
  trigger: 'scheduled' | 'manual';
  forceFullSync: boolean;
  reset: boolean;
  rewindFeed: boolean;
  releasesWritten: number;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}) => ({
  id: build.id,
  status: build.status,
  trigger: build.trigger,
  forceFullSync: build.forceFullSync,
  reset: build.reset,
  rewindFeed: build.rewindFeed,
  releasesWritten: build.releasesWritten,
  error: build.error,
  startedAt: build.startedAt,
  completedAt: build.completedAt
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
          isBuilding: item.isBuilding,
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

  listBuilds: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({ tenantId: v.string(), subRegistryIdentifier: v.string() })
      )
    )
    .do(async ctx => {
      let channel = await slatePackChannelService.getChannelForTenant({
        tenantOid: ctx.tenant.oid,
        subRegistryId: ctx.input.subRegistryIdentifier
      });

      let paginator = await slatePackBuildService.listForChannel({ channelOid: channel.oid });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, presentBuild);
    }),

  getBuild: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        subRegistryIdentifier: v.string(),
        buildId: v.string()
      })
    )
    .do(async ctx => {
      let channel = await slatePackChannelService.getChannelForTenant({
        tenantOid: ctx.tenant.oid,
        subRegistryId: ctx.input.subRegistryIdentifier
      });
      let build = await slatePackBuildService.getForChannel({
        channelOid: channel.oid,
        id: ctx.input.buildId
      });

      return { ...presentBuild(build), logs: build.logs };
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
          rewindFeed: ctx.input.rewindFeed ?? false,
          manual: true
        },
        { deduplication: { id: `slate-pack-force-${channel.id}-${Date.now()}` } }
      );

      return { queued: true };
    })
});
