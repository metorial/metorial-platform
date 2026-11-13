import { resolveSessionAttribution } from '../attribution/resolve';
import { reattributeSession } from '../attribution/session';
import { db } from '../db';
import { isSessionlessKey, parseSessionlessKey } from '../facts/slices';
import {
  rewriteSessionFacts,
  rewriteSessionlessSliceDims,
  writeSessionFacts
} from '../facts/write';
import { settleSessionless } from '../sessions/sessionless';
import { computeSessionAggregate, storeSessionSummary } from '../sessions/settle';
import { getStore } from '../store/connection';
import {
  behindLayers,
  isRecordRetentionExpired,
  planLayers,
  type RebuildLayer,
  type RebuildTarget
} from './plan';

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
    await settleSessionless({
      organizationId,
      instanceId: parsed.instanceId,
      bucket: parsed.bucket
    });
  } else if (layers.includes('facts')) {
    await rewriteSessionFacts({ sessionKey: d.sessionKey });
  } else if (layers.includes('attribution')) {
    await rewriteSessionlessSliceDims({ organizationId, sessionlessKey: d.sessionKey });
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
    if (rewritesSlices) await resolveSessionAttribution({ sessionKey: session._id });
    else await reattributeSession({ sessionKey: session._id });

    done.push('attribution');
  }

  let summarized = false;

  if (layers.includes('summary')) {
    let aggregate = await computeSessionAggregate(session);

    if (aggregate.records) {
      await storeSessionSummary({ session, aggregate, watermark: session.lastObservedAt });
      await writeSessionFacts({ sessionKey: session._id, slices: aggregate.slices });

      summarized = true;
      done.push('summary');
    }
  }

  if (layers.includes('facts')) {
    if (!summarized) await rewriteSessionFacts({ sessionKey: session._id });

    done.push('facts');
  }

  return { frozen, layers: done };
};
