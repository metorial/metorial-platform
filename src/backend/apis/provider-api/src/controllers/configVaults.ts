import { createHono } from '@metorial/hono';
import { subspaceConfigVaultService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { configVaultPresenter } from '../presenters';

export let configVaultsController = createHono()
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

      let paginator = await subspaceConfigVaultService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_deployment_id: normalizeArrayParam(query.provider_deployment_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, configVaultPresenter));
    }
  )
  .get(':providerConfigVaultId', async c => {
    let providerConfigVaultId = c.req.param('providerConfigVaultId');

    let vault = await subspaceConfigVaultService.get({ providerConfigVaultId });

    return c.json(configVaultPresenter(vault));
  })
  .post(
    '',
    useValidation(
      'json',
      z.object({
        name: z.string(),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any())),
        providerId: z.string(),
        providerDeploymentId: z.optional(z.string()),
        config: z.record(z.any())
      })
    ),
    async c => {
      let body = await c.req.json();

      let vault = await subspaceConfigVaultService.create({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        providerId: body.providerId,
        providerDeploymentId: body.providerDeploymentId,
        config: body.config
      });

      return c.json(configVaultPresenter(vault), 201);
    }
  )
  .patch(
    ':providerConfigVaultId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any()))
      })
    ),
    async c => {
      let providerConfigVaultId = c.req.param('providerConfigVaultId');
      let body = await c.req.json();

      let vault = await subspaceConfigVaultService.update({
        providerConfigVaultId,
        name: body.name,
        description: body.description,
        metadata: body.metadata
      });

      return c.json(configVaultPresenter(vault));
    }
  )
  .delete(':providerConfigVaultId', async c => {
    let providerConfigVaultId = c.req.param('providerConfigVaultId');

    await subspaceConfigVaultService.delete({ providerConfigVaultId });

    return c.json({
      id: providerConfigVaultId,
      object: 'provider.config_vault' as const,
      deleted: true
    });
  });
