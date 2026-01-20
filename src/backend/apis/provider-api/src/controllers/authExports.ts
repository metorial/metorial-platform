import { createHono } from '@metorial/hono';
import { subspaceAuthExportService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { authExportPresenter } from '../presenters';

export let authExportsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_auth_config_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceAuthExportService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_auth_config_id: normalizeArrayParam(query.provider_auth_config_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, authExportPresenter));
    }
  )
  .get(':providerAuthExportId', async c => {
    let providerAuthExportId = c.req.param('providerAuthExportId');

    let authExport = await subspaceAuthExportService.get({ providerAuthExportId });

    return c.json(authExportPresenter(authExport));
  })
  .post(
    '',
    useValidation(
      'json',
      z.object({
        note: z.string(),
        metadata: z.optional(z.record(z.any())),
        providerAuthConfigId: z.string()
      })
    ),
    async c => {
      let body = await c.req.json();
      let ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      let ua = c.req.header('user-agent') || 'unknown';

      let authExport = await subspaceAuthExportService.create({
        note: body.note,
        metadata: body.metadata,
        providerAuthConfigId: body.providerAuthConfigId,
        ip,
        ua
      });

      return c.json({
        ...authExportPresenter(authExport.authExport),
        value: authExport.decryptedConfigData
      }, 201);
    }
  );
