import { createHono } from '@metorial/hono';
import { subspaceAuthImportService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { authImportPresenter } from '../presenters';

export let authImportsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_auth_config_id: z.optional(z.string()),
          provider_deployment_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceAuthImportService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_auth_config_id: normalizeArrayParam(query.provider_auth_config_id),
        provider_deployment_id: normalizeArrayParam(query.provider_deployment_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, authImportPresenter));
    }
  )
  .get(':providerAuthImportId', async c => {
    let providerAuthImportId = c.req.param('providerAuthImportId');

    let authImport = await subspaceAuthImportService.get({ providerAuthImportId });

    return c.json(authImportPresenter(authImport));
  })
  .post(
    '',
    useValidation(
      'json',
      z.object({
        note: z.string(),
        metadata: z.optional(z.record(z.any())),
        providerId: z.optional(z.string()),
        providerDeploymentId: z.optional(z.string()),
        providerAuthConfigId: z.optional(z.string()),
        providerAuthMethodId: z.optional(z.string()),
        config: z.record(z.any())
      })
    ),
    async c => {
      let body = await c.req.json();
      let ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      let ua = c.req.header('user-agent') || 'unknown';

      let authImport = await subspaceAuthImportService.create({
        note: body.note,
        metadata: body.metadata,
        providerId: body.providerId,
        providerDeploymentId: body.providerDeploymentId,
        providerAuthConfigId: body.providerAuthConfigId,
        providerAuthMethodId: body.providerAuthMethodId,
        config: body.config,
        ip,
        ua
      });

      return c.json(authImportPresenter(authImport), 201);
    }
  );
