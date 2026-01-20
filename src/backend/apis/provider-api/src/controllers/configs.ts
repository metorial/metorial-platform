import { createHono } from '@metorial/hono';
import { subspaceConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { configPresenter } from '../presenters';

export let configsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_deployment_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceConfigService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_deployment_id: normalizeArrayParam(query.provider_deployment_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, configPresenter));
    }
  )
  .get(':providerConfigId', async c => {
    let providerConfigId = c.req.param('providerConfigId');

    let config = await subspaceConfigService.get({ providerConfigId });

    return c.json(configPresenter(config));
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
        config: z.union([
          z.object({
            type: z.literal('inline'),
            data: z.record(z.any())
          }),
          z.object({
            type: z.literal('vault'),
            providerConfigVaultId: z.string()
          })
        ])
      })
    ),
    async c => {
      let body = await c.req.json();

      let config = await subspaceConfigService.create({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        isEphemeral: body.isEphemeral,
        providerId: body.providerId,
        providerDeploymentId: body.providerDeploymentId,
        config: body.config
      });

      return c.json(configPresenter(config), 201);
    }
  )
  .patch(
    ':providerConfigId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any()))
      })
    ),
    async c => {
      let providerConfigId = c.req.param('providerConfigId');
      let body = await c.req.json();

      let config = await subspaceConfigService.update({
        providerConfigId,
        name: body.name,
        description: body.description,
        metadata: body.metadata
      });

      return c.json(configPresenter(config));
    }
  )
  .delete(':providerConfigId', async c => {
    let providerConfigId = c.req.param('providerConfigId');

    await subspaceConfigService.delete({ providerConfigId });

    return c.json({
      id: providerConfigId,
      object: 'provider.config' as const,
      deleted: true
    });
  });
