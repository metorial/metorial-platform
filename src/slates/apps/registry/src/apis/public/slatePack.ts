import { createHono } from '@lowerdeck/hono';
import { z } from 'zod';
import { useValidation } from '../../lib/validator';
import { slatePackService } from '../../services';
import { useAuth } from './_app';

let maxSlateFilters = 500;

let exportSchema = z.object({
  versions: z.enum(['current', 'all']).optional(),
  slates: z.string().optional(),
  sub_registry_id: z.string().optional()
});

export let slatePacksController = createHono().get(
  '/export',
  useValidation('query', exportSchema),
  async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let slateIds = query.slates
      ?.split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .slice(0, maxSlateFilters);

    let pack = await slatePackService.exportPack({
      tenant: auth.tenant,
      subRegistry: auth.subRegistry,
      versions: query.versions ?? 'current',
      slateIds
    });

    let fileName = `${auth.subRegistry?.identifier ?? 'slates'}-${new Date().toISOString().slice(0, 10)}.slatepack`;

    return new Response(pack.stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Slate-Pack-Entry-Count': String(pack.entryCount)
      }
    });
  }
);
