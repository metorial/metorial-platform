import { attributionService } from '@mtsrc/agent-tracking-module-attribution';
import {
  sessionAttributionService,
  sessionSettleService
} from '@mtsrc/agent-tracking-module-sessions';
import { db } from '@mtsrc/agent-tracking-db';
import { isSessionlessKey, parseSessionlessKey } from '@mtsrc/agent-tracking-module-usage';
import { usageSliceService } from '@mtsrc/agent-tracking-module-usage';
import { knowledgeCacheService } from '@mtsrc/agent-tracking-module-knowledge';
import { organizationPricingService } from '@mtsrc/agent-tracking-module-pricing';
import { getStore } from '@mtsrc/agent-tracking-store';
import { isRecordRetentionExpired, planLayers, type RebuildTarget } from './plan';
import { behindLayers, type RebuildLayer } from '@mtsrc/agent-tracking-layers';

export type RebuildItemResult = { frozen: boolean; layers: RebuildLayer[] };

let findInstance = async (d: { instanceId: string; organizationId: string }) =>
  await db.instance.findFirst({
    where: { id: d.instanceId, organization: { id: d.organizationId } },
    select: { recordRetentionDays: true }
  });

let rebuildSessionless = async (d: {
  target: RebuildTarget;
  sessionKey: string;
  now: Date;
}): Promise<RebuildItemResult | null> => {
  let parsed = parseSessionlessKey(d.sessionKey);
  if (!parsed) return null;

  let organizationId = d.target.scope.organizationId;
  let instance = await findInstance({ instanceId: parsed.instanceId, organizationId });
  if (!instance) return null;

  let frozen = isRecordRetentionExpired({
    at: parsed.bucket,
    recordRetentionDays: instance.recordRetentionDays,
    now: d.now
  });
  let layers = planLayers({ requested: d.target.layers, frozen });

  if (layers.includes('summary')) {
    await sessionSettleService.settleSessionless({
      organizationId,
      instanceId: parsed.instanceId,
      bucket: parsed.bucket
    });
  } else if (layers.includes('facts')) {
    await usageSliceService.rewriteSessionSlices({ sessionKey: d.sessionKey });
  } else if (layers.includes('attribution')) {
    await usageSliceService.rewriteSessionlessSliceDims({
      organizationId,
      sessionlessKey: d.sessionKey
    });
  }

  return { frozen, layers };
};

// Redoes only the requested layers of one session, in dependency order: attribution feeds the
// slice dims, and a summary rebuild rewrites the slices from fresh base slices.
export let rebuildItem = async (d: {
  target: RebuildTarget;
  sessionKey: string;
  now?: Date;
}): Promise<RebuildItemResult | null> => {
  let now = d.now ?? new Date();

  // Rebuilds are usually queued by a knowledge or override change that another process just
  // published, so check both versions now instead of trusting caches up to 15 seconds old.
  knowledgeCacheService.expire();
  organizationPricingService.expire({ organizationId: d.target.scope.organizationId });

  if (isSessionlessKey(d.sessionKey)) return await rebuildSessionless({ ...d, now });

  let store = getStore();
  await store.ready();
  let { sessions } = store.collections();

  let session = await sessions.findOne({
    _id: d.sessionKey,
    organizationId: d.target.scope.organizationId
  });
  if (!session) return null;

  let instance = await findInstance({
    instanceId: session.instanceId,
    organizationId: session.organizationId
  });
  if (!instance) return null;

  let frozen =
    !!session.frozen ||
    isRecordRetentionExpired({
      at: session.startedAt,
      recordRetentionDays: instance.recordRetentionDays,
      now
    });
  if (frozen && !session.frozen) {
    await sessions.updateOne({ _id: session._id }, { $set: { frozen: true } });
  }

  let layers = planLayers({
    requested: d.target.layers,
    frozen,
    behind: d.target.onlyBehind ? behindLayers(session.versions) : undefined
  });
  let rewritesSlices = layers.includes('summary') || layers.includes('facts');
  let done: RebuildLayer[] = [];

  if (layers.includes('attribution')) {
    if (rewritesSlices) await attributionService.resolveSession({ sessionKey: session._id });
    else await sessionAttributionService.reattribute({ sessionKey: session._id });

    done.push('attribution');
  }

  let summarized = false;

  if (layers.includes('summary')) {
    summarized = await sessionSettleService.resummarize({ session });
    if (summarized) done.push('summary');
  }

  if (layers.includes('facts')) {
    if (!summarized) await usageSliceService.rewriteSessionSlices({ sessionKey: session._id });

    done.push('facts');
  }

  return { frozen, layers: done };
};
