import { createHono } from '@metorial/hono';
import { subspaceSetupSessionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { setupSessionPresenter } from '../presenters';

export let setupSessionsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_auth_method_id: z.optional(z.string()),
          status: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceSetupSessionService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_auth_method_id: normalizeArrayParam(query.provider_auth_method_id),
        status: normalizeArrayParam(query.status)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, setupSessionPresenter));
    }
  )
  .get(':providerSetupSessionId', async c => {
    let providerSetupSessionId = c.req.param('providerSetupSessionId');

    let session = await subspaceSetupSessionService.get({ providerSetupSessionId });

    return c.json(setupSessionPresenter(session));
  })
  .post(
    '',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any())),
        providerId: z.string(),
        providerDeploymentId: z.optional(z.string()),
        providerAuthMethodId: z.string(),
        uiMode: z.optional(z.enum(['popup', 'redirect'])),
        redirectUrl: z.optional(z.string())
      })
    ),
    async c => {
      let body = await c.req.json();

      let session = await subspaceSetupSessionService.create({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        providerId: body.providerId,
        providerDeploymentId: body.providerDeploymentId,
        providerAuthMethodId: body.providerAuthMethodId,
        uiMode: body.uiMode,
        redirectUrl: body.redirectUrl
      });

      return c.json(setupSessionPresenter(session), 201);
    }
  )
  .patch(
    ':providerSetupSessionId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any()))
      })
    ),
    async c => {
      let providerSetupSessionId = c.req.param('providerSetupSessionId');
      let body = await c.req.json();

      let session = await subspaceSetupSessionService.update({
        providerSetupSessionId,
        name: body.name,
        description: body.description,
        metadata: body.metadata
      });

      return c.json(setupSessionPresenter(session));
    }
  )
  .delete(':providerSetupSessionId', async c => {
    let providerSetupSessionId = c.req.param('providerSetupSessionId');

    await subspaceSetupSessionService.delete({ providerSetupSessionId });

    return c.json({
      id: providerSetupSessionId,
      object: 'provider.setup_session' as const,
      deleted: true
    });
  });
