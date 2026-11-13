import { resolveSessionAttribution } from '../attribution/resolve';
import { db } from '../db';
import { getStore } from '../store/connection';
import type { VendorSource } from '../knowledge/types';
import type {
  Decimal,
  ReportedCost,
  SessionDocument,
  Tokens,
  UsageSliceDocument
} from '../store/derivedModels';
import { resolveSessionlessAttributions } from './sessionless';
import {
  attributionFields,
  baseSliceOf,
  buildSessionlessSlices,
  buildSessionSlices,
  parseSessionlessKey,
  type SliceAttribution
} from './slices';
import { FACTS_VERSION } from './versions';

export type BaseSlice = {
  bucket: Date;
  bucketMinutes: 15 | 1440;
  subagentId?: string;
  modelId?: string;
  modelRaw?: string;
  provider?: string;
  vendorId?: string;
  vendorSource?: VendorSource;

  // Sessionless slices only: the observed identity of the aggregate (07 §5.6).
  userId?: string;
  deviceId?: string;
  agentId?: string;
  client?: { family: string; version?: string; surface?: string };

  sessionsStarted: 0 | 1;
  turns: number;
  requests: number;
  failedRequests: number;
  toolCalls: number;
  tokens: Tokens;
  costReported: ReportedCost[];
  costComputedUsd?: Decimal;
  costContractUsd?: Decimal;
  costUsd?: Decimal;
  lines: { added: number; removed: number };
};

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

let replaceSlices = async (d: {
  organizationId: string;
  owner: { sessionKey: string } | { sessionlessKey: string };
  documents: UsageSliceDocument[];
}) => {
  let { usageSlices } = await collections();

  if (d.documents.length) {
    await usageSlices.bulkWrite(
      d.documents.map(document => ({
        replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true }
      })),
      { ordered: false }
    );
  }

  await usageSlices.deleteMany({
    organizationId: d.organizationId,
    ...d.owner,
    _id: { $nin: d.documents.map(document => document._id) }
  });
};

let sessionAttributionOf = async (
  session: SessionDocument
): Promise<SliceAttribution | null> => {
  if (session.attribution) return session.attribution;

  let result = await resolveSessionAttribution({ sessionKey: session._id });
  return result?.session.attribution ?? null;
};

let writeSessionlessFacts = async (d: { sessionKey: string; slices: BaseSlice[] }) => {
  let parsed = parseSessionlessKey(d.sessionKey);
  if (!parsed) throw new Error(`Invalid sessionless key ${d.sessionKey}.`);

  let instance = await db.instance.findUnique({
    where: { id: parsed.instanceId },
    include: { organization: true, project: true }
  });
  if (!instance) return;

  let scope = {
    organizationId: instance.organization.id,
    projectId: instance.project.id,
    instanceId: instance.id
  };

  let attributions = await resolveSessionlessAttributions({ scope, slices: d.slices });

  let documents = buildSessionlessSlices({
    key: d.sessionKey,
    scope,
    usageRetentionDays: instance.usageRetentionDays,
    slices: d.slices.map((slice, index) => ({ slice, attribution: attributions[index]! })),
    now: new Date()
  });

  await replaceSlices({
    organizationId: scope.organizationId,
    owner: { sessionlessKey: d.sessionKey },
    documents
  });
};

export let writeSessionFacts = async (d: { sessionKey: string; slices: BaseSlice[] }) => {
  if (parseSessionlessKey(d.sessionKey)) return await writeSessionlessFacts(d);

  let { sessions } = await collections();

  let session = await sessions.findOne({ _id: d.sessionKey });
  if (!session) return;

  let attribution = await sessionAttributionOf(session);
  if (!attribution) return;

  let now = new Date();
  let documents = buildSessionSlices({ session, attribution, slices: d.slices, now });

  await replaceSlices({
    organizationId: session.organizationId,
    owner: { sessionKey: session._id },
    documents
  });

  await sessions.updateOne(
    { _id: session._id },
    { $set: { factsComputedAt: now, 'versions.facts': FACTS_VERSION } }
  );
};

// Rebuilds a session's slice documents from the metrics they already hold, so a facts rebuild
// also works for frozen sessions whose raw records are gone.
export let rewriteSessionFacts = async (d: { sessionKey: string }) => {
  let { usageSlices } = await collections();

  let filter = parseSessionlessKey(d.sessionKey)
    ? { sessionlessKey: d.sessionKey }
    : { sessionKey: d.sessionKey };
  let slices = await usageSlices.find(filter).toArray();

  await writeSessionFacts({ sessionKey: d.sessionKey, slices: slices.map(baseSliceOf) });
};

export let rewriteSessionSliceDims = async (d: {
  organizationId: string;
  sessionKey: string;
  attribution: SliceAttribution;
}) => {
  let { usageSlices } = await collections();

  let result = await usageSlices.updateMany(
    { organizationId: d.organizationId, sessionKey: d.sessionKey },
    { $set: { ...attributionFields(d.attribution), computedAt: new Date() } }
  );

  return result.modifiedCount;
};

export let rewriteSessionlessSliceDims = async (d: {
  organizationId: string;
  sessionlessKey: string;
}) => {
  let { usageSlices } = await collections();

  let slices = await usageSlices
    .find({ organizationId: d.organizationId, sessionlessKey: d.sessionlessKey })
    .toArray();
  if (!slices.length) return 0;

  let first = slices[0]!;
  let attributions = await resolveSessionlessAttributions({
    scope: {
      organizationId: first.organizationId,
      projectId: first.projectId,
      instanceId: first.instanceId
    },
    slices: slices.map(baseSliceOf)
  });

  let now = new Date();

  await usageSlices.bulkWrite(
    slices.map((slice, index) => ({
      updateOne: {
        filter: { _id: slice._id },
        update: { $set: { ...attributionFields(attributions[index]!), computedAt: now } }
      }
    })),
    { ordered: false }
  );

  return slices.length;
};
