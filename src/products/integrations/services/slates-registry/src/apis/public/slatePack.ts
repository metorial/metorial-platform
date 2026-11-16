import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { z } from 'zod';
import { useValidation } from '../../lib/validator';
import { slatePackReleasePresenter } from '../../presenters';
import { slatePackChannelService, slatePackService } from '../../services';
import { useAuth } from './_app';

let maxSlateFilters = 500;

let maxSequence = 1_000_000_000;

let exportSchema = z.object({
  versions: z.enum(['current', 'all']).optional(),
  slates: z.string().optional(),
  sub_registry_id: z.string().optional()
});

let parseFromSequence = (value: string | undefined) => {
  if (value === undefined || value === '') return null;

  let sequence = Number(value);
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > maxSequence) {
    throw new ServiceError(
      badRequestError({ message: 'from_sequence must be a non-negative integer.' })
    );
  }

  return sequence;
};

let parseMode = (value: string | undefined) => {
  if (value === undefined || value === '' || value === 'auto') return 'auto' as const;
  if (value === 'full') return 'full' as const;

  throw new ServiceError(badRequestError({ message: 'mode must be auto or full.' }));
};

export let slatePacksController = createHono()
  .get('/export', useValidation('query', exportSchema), async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let slateIds = query.slates
      ?.split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .slice(0, maxSlateFilters);

    let pack = await slatePackService.exportPack({
      tenant: auth.tenant,
      subRegistry: auth.subRegistry,
      versions: query.versions ?? 'current',
      slateIds
    });

    let fileName = `${auth.subRegistry?.identifier ?? 'slates'}-${new Date().toISOString().slice(0, 10)}.slatepack`;

    return new Response(pack.stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Slate-Pack-Entry-Count': String(pack.entryCount)
      }
    });
  })

  .get('/channels/:subRegistryId', async c => {
    let subRegistryId = c.req.param('subRegistryId');
    let info = await slatePackChannelService.getChannelInfo({ subRegistryId });

    return c.json({
      object: 'slates_registry.slate_pack.channel',
      subRegistryId,
      latestSequence: info.latestSequence,
      oldestSequence: info.oldestSequence,
      latestFullSync: info.latestFullSync,
      lastIncrementalAt: info.channel.lastIncrementalAt,
      lastFullSyncAt: info.channel.lastFullSyncAt
    });
  })

  .get('/channels/:subRegistryId/plan', async c => {
    let subRegistryId = c.req.param('subRegistryId');
    let plan = await slatePackChannelService.planDownload({
      subRegistryId,
      fromSequence: parseFromSequence(c.req.query('from_sequence')),
      mode: parseMode(c.req.query('mode'))
    });

    return c.json({
      object: 'slates_registry.slate_pack.plan',
      subRegistryId,
      mode: plan.mode,
      reason: plan.reason,
      fromSequence: plan.fromSequence,
      latestSequence: plan.latestSequence,
      truncated: plan.truncated,
      releases: plan.releases.map(release =>
        slatePackReleasePresenter(release, { subRegistryId })
      )
    });
  })

  .get('/channels/:subRegistryId/releases/:releaseId', async c => {
    let subRegistryId = c.req.param('subRegistryId');
    let { release } = await slatePackChannelService.getRelease({
      subRegistryId,
      releaseId: c.req.param('releaseId')
    });

    return c.json(slatePackReleasePresenter(release, { subRegistryId }));
  })

  .get('/channels/:subRegistryId/releases/:releaseId/download', async c => {
    let { release, stream } = await slatePackChannelService.openReleaseStream({
      subRegistryId: c.req.param('subRegistryId'),
      releaseId: c.req.param('releaseId')
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(release.size),
        'Content-Disposition': `attachment; filename="${release.fileName}"`,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Slate-Pack-Sha256': release.sha256
      }
    });
  });
