import { Service } from '@lowerdeck/service';
import { db, type BillingWindowStatus } from '@mtsrc/ai-gateway-db';
import { projectService } from '@mtsrc/ai-gateway-module-scope';
import type { ProjectRestriction } from '@mtsrc/ai-gateway-spec';
import { createBillingAccumulator } from '../lib/accumulator';
import { createBillingWindowWriter } from '../lib/writer';
import { billingSealGraceMs, toNanoUsd } from '../lib/windows';

let flushIntervalMs = 5000;
let maxListLimit = 500;

let accumulator = createBillingAccumulator({
  write: createBillingWindowWriter(),
  flushIntervalMs,
  onError: (error, charge) =>
    console.error(
      `[ai-gateway] Could not write billing usage for ${charge.projectId}, retrying`,
      error
    )
});

let windowInclude = { project: { include: { organization: true } } } as const;

class BillingServiceImpl {
  // Only Metorial-billed usage is charged: requests served over Metorial's own provider keys
  // and decision-model calls that ran on them.
  charge = (d: { projectId: string; costUsd: number; requests?: number }) =>
    accumulator.add({
      projectId: d.projectId,
      costNanoUsd: toNanoUsd(d.costUsd),
      requestCount: d.requests ?? 0
    });

  async flush() {
    await accumulator.flush();
  }

  async close() {
    await accumulator.close();
  }

  async listWindows(d: {
    from: Date;
    to: Date;
    statuses?: BillingWindowStatus[];
    after?: string;
    limit?: number;
  }) {
    let limit = Math.min(Math.max(d.limit ?? 100, 1), maxListLimit);

    let cursor = d.after
      ? await db.billingWindow.findUnique({
          where: { id: d.after },
          select: { id: true, windowStart: true }
        })
      : null;

    let windows = await db.billingWindow.findMany({
      where: {
        windowStart: { gte: d.from, lt: d.to },
        status: d.statuses ? { in: d.statuses } : undefined,
        ...(cursor
          ? {
              OR: [
                { windowStart: { gt: cursor.windowStart } },
                { windowStart: cursor.windowStart, id: { gt: cursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ windowStart: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: windowInclude
    });

    return { items: windows.slice(0, limit), hasMore: windows.length > limit };
  }

  async sealWindows(d: { now?: Date } = {}) {
    let now = d.now ?? new Date();

    let sealed = await db.billingWindow.updateMany({
      where: {
        status: 'open',
        windowEnd: { lte: new Date(now.getTime() - billingSealGraceMs) }
      },
      data: { status: 'complete' }
    });

    return { sealed: sealed.count };
  }

  async setRestriction(d: { projectId: string; restriction: ProjectRestriction }) {
    let project = await projectService.getProjectWithOrganization({ projectId: d.projectId });

    return await projectService.setBillingRestriction({
      project,
      restriction: d.restriction
    });
  }
}

export let billingService = Service.create(
  'billingService',
  () => new BillingServiceImpl()
).build();

export type BillingWindowWithProject = Awaited<
  ReturnType<typeof billingService.listWindows>
>['items'][number];
