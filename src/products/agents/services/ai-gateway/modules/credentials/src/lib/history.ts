import { ID } from '@mtsrc/ai-gateway-db';
import type { ConnectionCheckResult } from '@mtsrc/ai-gateway-spec';
import {
  getStore,
  isStoreConfigured,
  type ConnectionCheckDocument
} from '@mtsrc/ai-gateway-store';

let historyRetentionDays = 90;
let dayMs = 24 * 60 * 60 * 1000;

export type ConnectionCheckTrigger = ConnectionCheckDocument['trigger'];

export let recordConnectionCheck = async (d: {
  connection: { id: string };
  providerSlug: string;
  organizationId?: string;
  instanceId?: string;
  trigger: ConnectionCheckTrigger;
  result: ConnectionCheckResult;
  checkedAt: Date;
  durationMs: number;
}) => {
  if (!isStoreConfigured()) return;

  try {
    let store = getStore();
    await store.ready();

    await store.connectionChecks.create({
      _id: ID.generateIdSync('connectionCheck'),
      connectionId: d.connection.id,
      providerSlug: d.providerSlug,
      organizationId: d.organizationId,
      instanceId: d.instanceId,
      trigger: d.trigger,
      outcome: d.result.outcome,
      message: d.result.message,
      httpStatus: d.result.httpStatus,
      modelCount: d.result.modelCount,
      checkedAt: d.checkedAt,
      durationMs: d.durationMs,
      expiresAt: new Date(d.checkedAt.getTime() + historyRetentionDays * dayMs)
    });
  } catch (error) {
    console.error('[ai-gateway] Failed to record connection check', error);
  }
};
