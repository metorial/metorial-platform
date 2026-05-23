import { createHono } from '@mtsrc/hono';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { useValidation } from '../../lib/validator';
import { subRegistryPresenter, tenantPresenter } from '../../presenters';
import { useAuth } from './_app';

export let infoController = createHono().get(
  '',
  useValidation('query', paginatorSchema),
  async c => {
    let auth = await useAuth(c);

    return c.json({
      tenant: auth.tenant ? tenantPresenter(auth.tenant) : null,
      registry: auth.subRegistry ? subRegistryPresenter(auth.subRegistry) : null,
      user: auth.user
        ? { id: auth.user.id, identifier: auth.user.identifier, name: auth.user.name }
        : null
    });
  }
);
