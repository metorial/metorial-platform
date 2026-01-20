import { createHono } from '@metorial/hono';
import { subspaceAuthConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { authConfigPresenter } from '../presenters';

export let authConfigsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_deployment_id: z.optional(z.string()),
          provider_auth_method_id: z.optional(z.string()),
          provider_auth_credentials_id: z.optional(z.string()),
          status: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceAuthConfigService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_deployment_id: normalizeArrayParam(query.provider_deployment_id),
        provider_auth_method_id: normalizeArrayParam(query.provider_auth_method_id),
        provider_auth_credentials_id: normalizeArrayParam(query.provider_auth_credentials_id),
        status: normalizeArrayParam(query.status)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, authConfigPresenter));
    }
  )
  .get(':providerAuthConfigId', async c => {
    let providerAuthConfigId = c.req.param('providerAuthConfigId');

    let authConfig = await subspaceAuthConfigService.get({ providerAuthConfigId });

    return c.json(authConfigPresenter(authConfig));
  })
  .post(
    '',
    useValidation(
      'json',
      z.object({
        name: z.string(),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any())),
        isEphemeral: z.optional(z.boolean()),
        providerId: z.string(),
        providerDeploymentId: z.optional(z.string()),
        providerAuthMethodId: z.string(),
        config: z.record(z.any())
      })
    ),
    async c => {
      let body = await c.req.json();
      let ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      let ua = c.req.header('user-agent') || 'unknown';

      let authConfig = await subspaceAuthConfigService.create({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        isEphemeral: body.isEphemeral,
        providerId: body.providerId,
        providerDeploymentId: body.providerDeploymentId,
        providerAuthMethodId: body.providerAuthMethodId,
        config: body.config,
        ip,
        ua
      });

      return c.json(authConfigPresenter(authConfig), 201);
    }
  )
  .patch(
    ':providerAuthConfigId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any()))
      })
    ),
    async c => {
      let providerAuthConfigId = c.req.param('providerAuthConfigId');
      let body = await c.req.json();
      let ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      let ua = c.req.header('user-agent') || 'unknown';

      let authConfig = await subspaceAuthConfigService.update({
        providerAuthConfigId,
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        ip,
        ua
      });

      return c.json(authConfigPresenter(authConfig));
    }
  )
  .delete(':providerAuthConfigId', async c => {
    let providerAuthConfigId = c.req.param('providerAuthConfigId');

    await subspaceAuthConfigService.delete({ providerAuthConfigId });

    return c.json({
      id: providerAuthConfigId,
      object: 'provider.auth_config' as const,
      deleted: true
    });
  });
