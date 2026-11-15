import { Service } from '@lowerdeck/service';
import { db } from '@mtsrc/agent-tracking-db';
import { ATTRIBUTION_VERSION } from '@mtsrc/agent-tracking-layers';
import { getStore } from '@mtsrc/agent-tracking-store';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import {
  buildResolveInput,
  getAttributionContext,
  invalidateAttributionContext,
  loadAttributionInputs,
  toAttributionSession
} from '../lib/context';
import { resolveAttribution } from '../lib/resolver';
import type { AttributionSession, ResolvedAttribution } from '../lib/types';

export type SessionAttributionResult = {
  session: SessionDocument;
  resolved: ResolvedAttribution;
  changed: boolean;
};

class AttributionServiceImpl {
  async resolveSession(d: { sessionKey: string }): Promise<SessionAttributionResult | null> {
    let store = getStore();
    await store.ready();

    let sessions = store.collections().sessions;

    let session = await sessions.findOne({ _id: d.sessionKey });
    if (!session) return null;

    let resolved = await this.computeSessionAttribution(session);

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
  }

  // Sessionless aggregates have no context, rules or classification: they are attributed from
  // their observed ids and the links valid at their start only (07 §5.6).
  async resolveSessionless(d: {
    organizationId: string;
    sessions: AttributionSession[];
  }): Promise<ResolvedAttribution[]> {
    if (!d.sessions.length) return [];

    let loaded = await loadAttributionInputs({
      organizationId: d.organizationId,
      sessions: d.sessions
    });

    let results: ResolvedAttribution[] = [];
    for (let session of d.sessions) {
      let input = await buildResolveInput({ loaded, session, rules: [], sessionless: true });
      results.push(resolveAttribution(input));
    }

    return results;
  }

  async getContext(d: { organizationId: string }) {
    return await getAttributionContext(d.organizationId);
  }

  invalidate(d: { organizationId: string }) {
    invalidateAttributionContext(d.organizationId);
  }

  private async computeSessionAttribution(session: SessionDocument) {
    let attributionSession = toAttributionSession(session);

    let loaded = await loadAttributionInputs({
      organizationId: session.organizationId,
      sessions: [attributionSession]
    });

    let input = await buildResolveInput({
      loaded,
      session: attributionSession,
      credentialAgent: await this.isCredentialAgent(session)
    });

    return resolveAttribution(input);
  }

  private async isCredentialAgent(session: SessionDocument) {
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
  }
}

export let attributionService = Service.create(
  'attributionService',
  () => new AttributionServiceImpl()
).build();
