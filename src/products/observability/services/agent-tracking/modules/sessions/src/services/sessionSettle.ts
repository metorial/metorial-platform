import { Service } from '@lowerdeck/service';
import { usageSliceService } from '@mtsrc/agent-tracking-module-usage';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { settleSessionless } from '../lib/sessionless';
import { computeSessionAggregate, settleSession, storeSessionSummary } from '../lib/settle';

class SessionSettleServiceImpl {
  async settle(d: { sessionKey: string }) {
    await settleSession(d);
  }

  async settleSessionless(d: { organizationId: string; instanceId: string; bucket: Date }) {
    await settleSessionless(d);
  }

  // Rebuilds the summary and slices from the stored records without touching attribution or the
  // settle watermark. Returns false when the session has no records left to aggregate.
  async resummarize(d: { session: SessionDocument }) {
    let aggregate = await computeSessionAggregate(d.session);
    if (!aggregate.records) return false;

    await storeSessionSummary({
      session: d.session,
      aggregate,
      watermark: d.session.lastObservedAt
    });
    await usageSliceService.writeSessionSlices({
      sessionKey: d.session._id,
      slices: aggregate.slices
    });

    return true;
  }
}

export let sessionSettleService = Service.create(
  'sessionSettleService',
  () => new SessionSettleServiceImpl()
).build();
