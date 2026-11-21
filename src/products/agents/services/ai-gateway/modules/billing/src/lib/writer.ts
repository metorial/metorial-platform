import { db, getId } from '@mtsrc/ai-gateway-db';
import type { BillingCharge } from './accumulator';
import { billingWindowOf } from './windows';

let maxWriteAttempts = 3;

let isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code == 'P2002';

let projectOids = new Map<string, bigint>();

let projectOidOf = async (projectId: string) => {
  let cached = projectOids.get(projectId);
  if (cached !== undefined) return cached;

  let project = await db.project.findUnique({
    where: { id: projectId },
    select: { oid: true }
  });
  if (project) projectOids.set(projectId, project.oid);

  return project?.oid ?? null;
};

// Adds a charge to the project's open window. A window that was sealed meanwhile is never
// written again: the charge moves on to the window that is open now.
export let createBillingWindowWriter =
  (d: { now?: () => Date } = {}) =>
  async (charge: BillingCharge) => {
    let now = d.now ?? (() => new Date());

    let projectOid = await projectOidOf(charge.projectId);
    if (projectOid === null) {
      console.warn(
        `[ai-gateway] Dropped billing usage for unknown project ${charge.projectId}`
      );
      return;
    }

    for (let attempt = 1; attempt <= maxWriteAttempts; attempt++) {
      let window = billingWindowOf(now());

      let updated = await db.billingWindow.updateMany({
        where: { projectOid, windowStart: window.start, status: 'open' },
        data: {
          costNanoUsd: { increment: charge.costNanoUsd },
          requestCount: { increment: charge.requestCount },
          revision: { increment: 1 }
        }
      });
      if (updated.count) return;

      try {
        await db.billingWindow.create({
          data: {
            ...getId('billingWindow'),
            projectOid,
            windowStart: window.start,
            windowEnd: window.end,
            costNanoUsd: charge.costNanoUsd,
            requestCount: charge.requestCount
          }
        });
        return;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    throw new Error(`Could not record billing usage for project ${charge.projectId}`);
  };
