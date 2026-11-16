import { Service } from '@lowerdeck/service';
import type { Pricing } from '@metorial/model-catalog/src/types';
import { correctPrices } from '../lib/corrections';
import {
  acceptKnowledgeSnapshot,
  importKnowledgeSnapshot,
  pollKnowledge,
  syncKnowledge
} from '../lib/ingest';

class KnowledgeSyncServiceImpl {
  async sync(d: { url?: string; guardrails?: boolean } = {}) {
    return await syncKnowledge(d);
  }

  async poll(d: { url?: string } = {}) {
    return await pollKnowledge(d);
  }

  async acceptSnapshot(d: { snapshotId: string }) {
    return await acceptKnowledgeSnapshot(d);
  }

  async importSnapshot(d: { archive: Buffer; guardrails?: boolean }) {
    return await importKnowledgeSnapshot(d);
  }

  async correctPrices(d: {
    offeringId: string;
    from: Date;
    to?: Date | null;
    pricing: Pricing | null;
    reason: string;
    correctedBy: string;
  }) {
    return await correctPrices(d);
  }
}

export let knowledgeSyncService = Service.create(
  'knowledgeSyncService',
  () => new KnowledgeSyncServiceImpl()
).build();
