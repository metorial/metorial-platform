import { createHono, useValidatedBody } from '@metorial/hono';
import { v } from '@metorial/validation';
import { setupPresenter } from '../presenters/setup';
import { tenantPresenter } from '../presenters/tenant';
import { setupService } from '../services/setup';
import { tenantService } from '../services/tenant';

export let testApi = createHono()
  .post('/tenant', async c => {
    let body = await useValidatedBody(
      c,
      v.object({
        name: v.string(),
        metadata: v.optional(v.record(v.any())),
        externalId: v.string()
      })
    );

    let tenant = await tenantService.createTenant({
      input: {
        name: body.name,
        metadata: body.metadata || {},
        externalId: body.externalId
      }
    });

    return c.json(tenantPresenter(tenant));
  })
  .post('/tenant/:tenantId/setup', async c => {
    let tenant = await tenantService.getTenantById({ tenantId: c.req.param('tenantId') });

    let setup = await setupService.createSetup({
      tenant
    });

    return c.json(setupPresenter(setup));
  });
