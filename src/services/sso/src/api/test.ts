import { createHono, useValidatedBody } from '@metorial/hono';
import { v } from '@metorial/validation';
import { authPresenter } from '../presenters/auth';
import { setupPresenter } from '../presenters/setup';
import { tenantPresenter } from '../presenters/tenant';
import { authService } from '../services/auth';
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
    let body = await useValidatedBody(
      c,
      v.object({
        redirectUri: v.string()
      })
    );

    let tenant = await tenantService.getTenantById({ tenantId: c.req.param('tenantId') });

    let setup = await setupService.createSetup({
      tenant,
      input: {
        redirectUri: body.redirectUri
      }
    });

    return c.json(setupPresenter(setup));
  })
  .post('/auth', async c => {
    let body = await useValidatedBody(
      c,
      v.object({
        tenantId: v.string(),
        redirectUri: v.string(),
        state: v.string(),
        email: v.optional(v.string({ modifiers: [v.email()] }))
      })
    );

    let tenant = await tenantService.getTenantById({ tenantId: body.tenantId });

    let auth = await authService.createAuth({
      tenant,
      input: {
        state: body.state,
        redirectUri: body.redirectUri,
        email: body.email
      }
    });

    return c.json(authPresenter(auth));
  });
