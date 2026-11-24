import { createCron } from '@lowerdeck/cron';
import { createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '@mtsrc/mcp-runtime-db';
import { env } from '@mtsrc/mcp-runtime-env';
import { isGatewayEgress } from '@mtsrc/mcp-runtime-network';

let PAGE_SIZE = 500;

// Tenants created before egress grants carried the Function Bay tenant, and tenants whose link
// failed in upsertTenant, are linked here. Integrations upserts a tenant only once.
export let linkFunctionBayTenantsCron = createCron(
  {
    name: 'shut/tenant/fb-link/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 4 * * *'
  },
  async () => {
    if (!isGatewayEgress()) return;

    await linkFunctionBayTenantsManyQueue.add({});
  }
);

export let linkFunctionBayTenantsManyQueue = createQueue<{ cursor?: string }>({
  name: 'shut/tenant/fb-link/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let linkFunctionBayTenantsManyProcessor = linkFunctionBayTenantsManyQueue.process(
  async data => {
    let tenants = await db.tenant.findMany({
      where: {
        functionBayTenantId: null,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: { id: true }
    });
    if (!tenants.length) return;

    await linkFunctionBayTenantSingleQueue.addManyWithOps(
      tenants.map(tenant => ({ data: { tenantId: tenant.id }, opts: { id: tenant.id } }))
    );

    if (tenants.length < PAGE_SIZE) return;

    await linkFunctionBayTenantsManyQueue.add(
      { cursor: tenants[tenants.length - 1]!.id },
      dailyPacedDelay()
    );
  }
);

export let linkFunctionBayTenantSingleQueue = createQueue<{ tenantId: string }>({
  name: 'shut/tenant/fb-link/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

// Function Bay is imported lazily because loading it registers the runtime's own tenant.
export let linkFunctionBayTenantSingleProcessor = linkFunctionBayTenantSingleQueue.process(
  async data => {
    let tenant = await db.tenant.findUnique({ where: { id: data.tenantId } });
    if (!tenant || tenant.functionBayTenantId) return;

    let { getTenantForFunctionBay } = await import('@mtsrc/mcp-runtime-function-bay');
    await getTenantForFunctionBay(tenant);
  }
);
