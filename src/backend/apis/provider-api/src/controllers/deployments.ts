import { createHono } from '@metorial/hono';
import { subspaceDeploymentService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { deploymentPresenter } from '../presenters';

export let deploymentsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_version_id: z.optional(z.string()),
          status: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceDeploymentService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_version_id: normalizeArrayParam(query.provider_version_id),
        status: normalizeArrayParam(query.status)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, deploymentPresenter));
    }
  )
  .get(':providerDeploymentId', async c => {
    let providerDeploymentId = c.req.param('providerDeploymentId');

    let deployment = await subspaceDeploymentService.get({ providerDeploymentId });

    return c.json(deploymentPresenter(deployment));
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
        lockedProviderVersionId: z.optional(z.string()),
        config: z.union([
          z.object({
            type: z.literal('none')
          }),
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

      let deployment = await subspaceDeploymentService.create({
        name: body.name,
        description: body.description,
        metadata: body.metadata,
        isEphemeral: body.isEphemeral,
        providerId: body.providerId,
        lockedProviderVersionId: body.lockedProviderVersionId,
        config: body.config
      });

      return c.json(deploymentPresenter(deployment), 201);
    }
  )
  .patch(
    ':providerDeploymentId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        metadata: z.optional(z.record(z.any()))
      })
    ),
    async c => {
      let providerDeploymentId = c.req.param('providerDeploymentId');
      let body = await c.req.json();

      let deployment = await subspaceDeploymentService.update({
        providerDeploymentId,
        name: body.name,
        description: body.description,
        metadata: body.metadata
      });

      return c.json(deploymentPresenter(deployment));
    }
  )
  .delete(':providerDeploymentId', async c => {
    let providerDeploymentId = c.req.param('providerDeploymentId');

    await subspaceDeploymentService.delete({ providerDeploymentId });

    return c.json({
      id: providerDeploymentId,
      object: 'provider.deployment' as const,
      deleted: true
    });
  });
