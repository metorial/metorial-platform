import { db } from '../db';
import { getStore } from '../store/connection';
import type { SessionDocument } from '../store/derivedModels';
import { buildResolveInput, loadAttributionInputs, toAttributionSession } from './context';
import { resolveAttribution } from './resolver';
import type { ResolvedAttribution } from './types';
import { ATTRIBUTION_VERSION } from './versions';

export type SessionAttributionResult = {
  session: SessionDocument;
  resolved: ResolvedAttribution;
  changed: boolean;
};

let isCredentialAgent = async (session: SessionDocument) => {
  let { agentId, userId } = session.observed ?? {};
  if (!agentId || !userId) return false;

  let token = await db.ingestToken.findFirst({
    where: {
      instance: { id: session.instanceId },
      agentEntity: { id: agentId },
      userEntity: { id: userId }
    },
    select: { oid: true }
  });

  return !!token;
};

export let computeSessionAttribution = async (session: SessionDocument) => {
  let attributionSession = toAttributionSession(session);

  let loaded = await loadAttributionInputs({
    organizationId: session.organizationId,
    sessions: [attributionSession]
  });

  let input = await buildResolveInput({
    loaded,
    session: attributionSession,
    credentialAgent: await isCredentialAgent(session)
  });

  return resolveAttribution(input);
};

export let resolveSessionAttribution = async (d: {
  sessionKey: string;
}): Promise<SessionAttributionResult | null> => {
  let store = getStore();
  await store.ready();

  let sessions = store.collections().sessions;

  let session = await sessions.findOne({ _id: d.sessionKey });
  if (!session) return null;

  let resolved = await computeSessionAttribution(session);

  let changed =
    session.attribution?.inputsHash != resolved.inputsHash ||
    session.coverage?.fullyAttributed != resolved.fullyAttributed;
  if (!changed) return { session, resolved, changed: false };

  let attribution = {
    entries: resolved.entries,
    dimIds: resolved.dimIds,
    version: ATTRIBUTION_VERSION,
    inputsHash: resolved.inputsHash,
    computedAt: new Date()
  };

  await sessions.updateOne(
    { _id: d.sessionKey },
    {
      $set: {
        attribution,
        'versions.attribution': ATTRIBUTION_VERSION,
        'coverage.fullyAttributed': resolved.fullyAttributed
      }
    }
  );

  return { session: { ...session, attribution }, resolved, changed: true };
};
