import { Service } from '@lowerdeck/service';
import { leaseGlobalRepository } from '@metorial/multi-region';
import { randomUUID } from 'node:crypto';

let LEASE_TTL_MS = 2 * 60 * 1000;
let LEASE_RENEW_MS = 30 * 1000;

class InternalSecurityReviewLeaseServiceImpl {
  async withGlobalReviewLease<T>(d: {
    subjectKey: string;
    fn: (signal: AbortSignal) => Promise<T>;
  }): Promise<{ acquired: false } | { acquired: true; result: T }> {
    let name = `security-review:${d.subjectKey}`;
    let token = randomUUID();

    let acquired = await leaseGlobalRepository.tryAcquireLease({
      name,
      token,
      ttlMs: LEASE_TTL_MS
    });
    if (!acquired) return { acquired: false };

    let controller = new AbortController();
    let renewal = setInterval(async () => {
      let renewed = await leaseGlobalRepository
        .renewLease({ name, token, ttlMs: LEASE_TTL_MS })
        .catch(() => false);

      if (!renewed) controller.abort(new Error('Security review lease was lost'));
    }, LEASE_RENEW_MS);

    try {
      return { acquired: true, result: await d.fn(controller.signal) };
    } finally {
      clearInterval(renewal);
      await leaseGlobalRepository.releaseLease({ name, token }).catch(() => {});
    }
  }
}

export let internalSecurityReviewLeaseService = Service.create(
  'internalSecurityReviewLeaseService',
  () => new InternalSecurityReviewLeaseServiceImpl()
).build();
