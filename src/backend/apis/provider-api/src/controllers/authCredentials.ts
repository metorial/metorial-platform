import { createHono } from '@metorial/hono';
import { subspaceAuthCredentialsService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { authCredentialsPresenter } from '../presenters';

export let authCredentialsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_auth_method_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceAuthCredentialsService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_auth_method_id: normalizeArrayParam(query.provider_auth_method_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, authCredentialsPresenter));
    }
  )
  .get(':providerAuthCredentialsId', async c => {
    let providerAuthCredentialsId = c.req.param('providerAuthCredentialsId');

    let credentials = await subspaceAuthCredentialsService.get({ providerAuthCredentialsId });

    return c.json(authCredentialsPresenter(credentials));
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
        providerAuthMethodId: z.string(),
        credentials: z.record(z.any())
      })
    ),
    async c => {
      let body = await c.req.json();

      let credentials = await subspaceAuthCredentialsService.create({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        isEphemeral: body.isEphemeral,
        providerId: body.providerId,
        providerAuthMethodId: body.providerAuthMethodId,
        credentials: body.credentials
      });

      return c.json(authCredentialsPresenter(credentials), 201);
    }
  )
  .patch(
    ':providerAuthCredentialsId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any()))
      })
    ),
    async c => {
      let providerAuthCredentialsId = c.req.param('providerAuthCredentialsId');
      let body = await c.req.json();

      let credentials = await subspaceAuthCredentialsService.update({
        providerAuthCredentialsId,
        name: body.name,
        description: body.description,
        metadata: body.metadata
      });

      return c.json(authCredentialsPresenter(credentials));
    }
  )
  .delete(':providerAuthCredentialsId', async c => {
    let providerAuthCredentialsId = c.req.param('providerAuthCredentialsId');

    await subspaceAuthCredentialsService.delete({ providerAuthCredentialsId });

    return c.json({
      id: providerAuthCredentialsId,
      object: 'provider.auth_credentials' as const,
      deleted: true
    });
  });
