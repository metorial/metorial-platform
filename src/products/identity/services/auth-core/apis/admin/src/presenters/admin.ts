import type { Admin } from '@mtsrc/auth-core-db';

export let adminPresenter = (admin: Admin) => ({
  object: 'ares#admin' as const,

  id: admin.id,
  email: admin.email,
  name: admin.name,

  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt
});
